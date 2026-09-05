// E2E smoke test for project deletion cleanup:
//   login -> create project -> upload image -> delete the PROJECT directly
//   (media still attached) -> verify R2 objects are removed, not orphaned.
//
// Requires the app to be running (`next start -p 3100` or dev server) with
// R2 + DB credentials in `.env`, and a seeded admin user.
//
//   node scripts/smoke-project-delete.mjs
//
// Env overrides: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, CHROME_PATH.

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });

import { chromium } from "playwright-core";
import sharp from "sharp";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

if (!BUCKET) {
  console.error("R2_BUCKET_NAME missing from .env");
  process.exit(1);
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

async function listKeys(prefix) {
  const out = await r2.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (out.Contents ?? []).map((o) => o.Key);
}

async function deleteKeys(keys) {
  if (!keys.length) return;
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  );
}

const testImage = await sharp({
  create: { width: 640, height: 427, channels: 3, background: { r: 40, g: 120, b: 220 } },
})
  .jpeg()
  .toBuffer();

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();
page.on("dialog", (dialog) => dialog.accept());
let keyPrefix = null;

try {
  // 1. Login.
  await page.goto(`${BASE_URL}/admin/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  check("valid login reaches dashboard", true);

  // 2. Create a project.
  const slug = `del-smoke-${Date.now()}`;
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill("Delete Smoke Shoot");
  await page.getByLabel(/Slug/).fill(slug);
  await page.getByLabel("Date").fill("2026-03-10");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
  check("create project redirects to edit page", true);

  // 3. Upload an image (media stays attached to the project on purpose).
  const confirmPromise = page.waitForResponse(
    (res) => res.url().includes("/api/media/confirm") && res.request().method() === "POST",
    { timeout: 60000 }
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "del-smoke.jpg",
    mimeType: "image/jpeg",
    buffer: testImage,
  });
  const confirmRes = await confirmPromise;
  check("confirm API responded", confirmRes.ok(), `status ${confirmRes.status()}`);
  const view = (await confirmRes.json()).media;
  const urlMatch = view.url.match(/\/media\/([0-9a-f-]+)/);
  if (!urlMatch) {
    check("extract storage key prefix from url", false, view.url);
  } else {
    const prefix = `media/${urlMatch[1]}`;
    keyPrefix = prefix; // enable the finally-sweep
    const keys = await listKeys(prefix);
    check("upload stored original + variants in R2", keys.length >= 3, `${keys.length} objects`);

    // 4. Delete the project directly via the list page (media still attached).
    await page.goto(`${BASE_URL}/admin/projects`);
    const rows = page.locator("li", { hasText: "Delete Smoke Shoot" });
    await rows.first().getByRole("button", { name: "Delete" }).click();
    await page.waitForFunction(
      ({ text }) =>
        Array.from(document.querySelectorAll("li")).filter((li) =>
          li.textContent.includes(text)
        ).length === 0,
      { text: "Delete Smoke Shoot" },
      { timeout: 15000 }
    );
    check("project deleted from list", true);

    // 5. The media rows cascade in the DB and R2 objects are cleaned up.
    const remaining = await listKeys(prefix);
    check("R2 objects removed by project delete", remaining.length === 0, `${remaining.length} remain`);
    keyPrefix = null; // nothing left to sweep
  }
} catch (err) {
  check("project delete flow completed without errors", false, err.message);
} finally {
  if (keyPrefix) {
    try {
      await deleteKeys(await listKeys(keyPrefix));
    } catch {
      /* best-effort */
    }
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);