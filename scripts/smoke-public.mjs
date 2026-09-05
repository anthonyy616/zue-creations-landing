// E2E smoke test for the Phase 5 public site:
//   login -> create project -> upload image -> public pages render it
//   -> theme toggle flips to olive and persists -> cleanup.
//
// Requires the app to be running (`next start -p 3100`) with DB + R2 creds
// in `.env`, and a seeded admin user.
//
//   node scripts/smoke-public.mjs

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

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

const TITLE = "Public Smoke Story";
const SLUG = `public-smoke-${Date.now()}`;
const keyPrefix = null; // (kept for parity with other smoke scripts)

const testImage = await sharp({
  create: { width: 1600, height: 1000, channels: 3, background: { r: 40, g: 120, b: 90 } },
})
  .jpeg()
  .toBuffer();

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();
page.on("dialog", (dialog) => dialog.accept()); // persistent — reliable
let projectId = null;

async function deleteR2ByUrl(url) {
  const m = url && url.match(/\/media\/([0-9a-f-]+)/);
  if (!m) return;
  const out = await r2.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `media/${m[1]}` })
  );
  const keys = (out.Contents ?? []).map((o) => o.Key);
  if (keys.length) {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      })
    );
  }
}

try {
  // 1. Login as admin.
  await page.goto(`${BASE_URL}/admin/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  check("valid login reaches dashboard", true);

  // 2. Create a photography project.
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel(/Slug/).fill(SLUG);
  await page.getByLabel("Date").fill("2026-03-10");
  await page.getByLabel("Location").fill("Accra");
  await page.getByLabel("Description").fill("A public-site smoke test story.");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
  projectId = page.url().split("/").pop();
  check("project created", true);

  // 3. Upload one image so the project has a cover.
  const confirmPromise = page.waitForResponse(
    (res) => res.url().includes("/api/media/confirm") && res.request().method() === "POST",
    { timeout: 60000 }
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "cover.jpg",
    mimeType: "image/jpeg",
    buffer: testImage,
  });
  const confirmRes = await confirmPromise;
  const coverUrl = (await confirmRes.json()).media?.url;
  check("cover image uploaded", confirmRes.ok() && typeof coverUrl === "string");

  // The project title can appear more than once on a page (film-rail chip +
  // index row), so visibility is tested across all matches.
  const titleVisible = () =>
    page
      .getByText(TITLE)
      .evaluateAll((els) =>
        els.some((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.display !== "none" &&
            s.visibility !== "hidden"
          );
        })
      )
      .catch(() => false);

  // 4. The public home page shows the project (ISR on-demand revalidation).
  // ISR regenerates on the request *after* the revalidation is triggered, so
  // reload until the fresh markup arrives.
  let homeShows = false;
  for (let i = 0; i < 6; i++) {
    await page.goto(`${BASE_URL}/`);
    const visible = await titleVisible();
    if (visible) { homeShows = true; break; }
    await page.waitForTimeout(1500);
  }
  check("home lists the new project after revalidation", homeShows);
  const homeImgs = await page.locator("main img").count();
  check("home renders project images", homeImgs > 0, `${homeImgs} images`);

  // 5. Category page shows it under Photography.
  let categoryShows = false;
  for (let i = 0; i < 6; i++) {
    await page.goto(`${BASE_URL}/photography`);
    const visible = await titleVisible();
    if (visible) { categoryShows = true; break; }
    await page.waitForTimeout(1500);
  }
  check("photography page lists the project", categoryShows);

  // 6. Project page renders title, meta and the uploaded image.
  await page.goto(`${BASE_URL}/work/${SLUG}`);
  await page.getByRole("heading", { level: 1, name: TITLE }).waitFor();
  await page.getByText("Photography · 2026 · Accra").waitFor();
  check("project page shows title + meta", true);
  const projImg = page.locator("article img").first();
  await projImg.waitFor();
  const src = await projImg.getAttribute("src");
  const srcset = await projImg.getAttribute("srcset");
  check("project page image points at R2", /^https:\/\//.test(src ?? ""), src?.slice(0, 60));
  check(
    "image resolved to a WebP variant by the R2 loader",
    (src ?? "").endsWith(".webp") && srcset?.length > 0,
    `${src?.split("/").pop()} (srcset ${srcset?.split(",").length} candidates)`
  );

  // 7. Theme toggle: default black, click -> olive, persists after reload.
  const html = page.locator("html");
  const bgBlack = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("default theme is black", bgBlack === "rgb(0, 0, 0)", bgBlack);

  await page.getByRole("button", { name: "Switch to olive theme" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "olive",
    undefined,
    { timeout: 5000 }
  );
  // Let the 500ms color cross-fade finish before sampling the background.
  await page.waitForTimeout(800);
  const bgOlive = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("toggle switches body to olive", bgOlive === "rgb(103, 122, 4)", bgOlive);

  await page.reload();
  const stored = await page.evaluate(() => document.documentElement.dataset.theme);
  const bgAfterReload = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("olive theme persists after reload", stored === "olive" && bgAfterReload === "rgb(103, 122, 4)");

  // Back to black for cleanliness.
  await page.getByRole("button", { name: "Switch to black theme" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme !== "olive",
    undefined,
    { timeout: 5000 }
  );
  await page.waitForTimeout(800);
  const bgBack = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("theme returns to black", bgBack === "rgb(0, 0, 0)", bgBack);
} catch (err) {
  check("public flow completed without errors", false, err.message);
} finally {
  // Cleanup: remove the project via the admin UI (cascades media rows),
  // then sweep R2 objects by prefix.
  try {
    if (projectId) {
      await page.goto(`${BASE_URL}/admin/projects`);
      const rows = page.locator("li", { hasText: TITLE });
      const before = await rows.count();
      if (before > 0) {
        await rows.first().getByRole("button", { name: "Delete" }).click();
        await page.waitForFunction(
          ({ text, expected }) =>
            Array.from(document.querySelectorAll("li")).filter((li) =>
              li.textContent.includes(text)
            ).length === expected,
          { text: TITLE, expected: before - 1 },
          { timeout: 15000 }
        );
      }
    }
    if (coverUrl) await deleteR2ByUrl(coverUrl);
  } catch {
    /* best-effort cleanup */
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);