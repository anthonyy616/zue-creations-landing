// E2E smoke test for the media upload pipeline:
//   login -> create project -> upload generated image via the UI
//   -> verify R2 holds the original + sharp variants -> cleanup.
//
// Requires the app to be running (`next start -p 3100`) with R2 credentials
// in `.env`, and a seeded admin user.
//
//   node scripts/smoke-upload.mjs
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

const R2_PUBLIC_MEDIA_URL = (process.env.R2_PUBLIC_MEDIA_URL ?? "").replace(/\/$/, "");
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

if (!R2_PUBLIC_MEDIA_URL || !BUCKET) {
  console.error("R2_PUBLIC_MEDIA_URL / R2_BUCKET_NAME missing from .env");
  process.exit(1);
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

const SRC_WIDTH = 1000;
const SRC_HEIGHT = 667;
// The media view describes the preferred display variant (md = 960px).
const MD_WIDTH = 960;
const MD_HEIGHT = Math.round((SRC_HEIGHT * MD_WIDTH) / SRC_WIDTH);

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
  create: {
    width: SRC_WIDTH,
    height: SRC_HEIGHT,
    channels: 3,
    background: { r: 245, g: 76, b: 76 },
  },
})
  .jpeg()
  .toBuffer();

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();
// Accept every confirm dialog. A persistent handler is reliable; registering
// page.once() right before each click races the dialog event and the dialog
// gets auto-dismissed (window.confirm -> false) instead.
page.on("dialog", (dialog) => dialog.accept());
let projectId = null;
let keyPrefix = null; // storage prefix to sweep in cleanup if the flow dies early

try {
  // 1. Login.
  await page.goto(`${BASE_URL}/admin/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  check("valid login reaches dashboard", true);

  // 2. Create a project.
  const slug = `upload-smoke-${Date.now()}`;
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill("Upload Smoke Shoot");
  await page.getByLabel(/Slug/).fill(slug);
  await page.getByLabel("Date").fill("2026-02-01");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
  projectId = page.url().split("/").pop();
  check("create project redirects to edit page", true);

  // 3. Upload the generated image through the hidden file input.
  const confirmPromise = page.waitForResponse(
    (res) => res.url().includes("/api/media/confirm") && res.request().method() === "POST",
    { timeout: 60000 }
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "smoke.jpg",
    mimeType: "image/jpeg",
    buffer: testImage,
  });
  const confirmRes = await confirmPromise;
  check("confirm API responded", confirmRes.ok(), `status ${confirmRes.status()}`);
  const confirmBody = await confirmRes.json();
  const view = confirmBody.media;

  check(
    "confirm returned display variant dimensions",
    view.width === MD_WIDTH && view.height === MD_HEIGHT,
    `${view.width}×${view.height} (expected ${MD_WIDTH}×${MD_HEIGHT})`
  );
  check("media view url is absolute", /^https?:\/\//.test(view.url), view.url);

  // 4. The thumbnail appears in the media list with dimensions.
  await page
    .locator(`li:has-text("${MD_WIDTH}×${MD_HEIGHT}")`)
    .waitFor({ timeout: 15000 });
  check("uploaded media renders in the list", true);

  // 5. Verify R2 contains the original + sharp variants.
  const urlMatch = view.url.match(/\/media\/([0-9a-f-]+)/);
  if (!urlMatch) {
    check("extract storage key prefix from url", false, view.url);
  } else {
    const prefix = `media/${urlMatch[1]}`;
    keyPrefix = prefix; // enable the finally-sweep
    const keys = await listKeys(prefix);
    const originalKey = keys.find((k) => k.endsWith("smoke.jpg"));
    const variantKeys = keys.filter((k) => k !== originalKey);
    const webpVariants = variantKeys.filter((k) => k.endsWith(".webp"));
    const jpegVariants = variantKeys.filter((k) => k.endsWith(".jpg"));

    check("original object stored in R2", Boolean(originalKey));
    check(
      "webp variants generated (480/960 for a 1000px image)",
      webpVariants.length === 2,
      webpVariants.map((k) => k.split("/").pop()).join(", ") || "none"
    );
    check(
      "jpeg variants generated",
      jpegVariants.length === 2,
      jpegVariants.map((k) => k.split("/").pop()).join(", ") || "none"
    );

    // 6. Delete the media item via the UI (exercises the DELETE route + R2 cleanup).
    await page.getByRole("button", { name: "Delete media" }).click();
    await page
      .locator(`li:has-text("${MD_WIDTH}×${MD_HEIGHT}")`)
      .waitFor({ state: "detached", timeout: 15000 });
    check("media item deleted via UI", true);

    const afterDelete = await listKeys(prefix);
    check("R2 objects removed by delete route", afterDelete.length === 0, `${afterDelete.length} remain`);

    // 7. Delete the project (cascades the media row). Loop so leftovers
    // from runs that died mid-flow are swept too. Wait on the row *count*
    // dropping, not detach of a re-resolving .first() element.
    await page.goto(`${BASE_URL}/admin/projects`);
    let deletedAny = false;
    for (;;) {
      const rows = page.locator("li", { hasText: "Upload Smoke Shoot" });
      const before = await rows.count();
      if (before === 0) break;
      deletedAny = true;
      await rows.first().getByRole("button", { name: "Delete" }).click();
      await page.waitForFunction(
        ({ text, expected }) =>
          Array.from(document.querySelectorAll("li")).filter((li) =>
            li.textContent.includes(text)
          ).length === expected,
        { text: "Upload Smoke Shoot", expected: before - 1 },
        { timeout: 15000 }
      );
    }
    check("project deleted", deletedAny);
  }
} catch (err) {
  check("upload flow completed without errors", false, err.message);
} finally {
  // Sweep any R2 objects left behind if the flow died before cleanup.
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