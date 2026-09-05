// E2E verification for the animated public site (Phase "custom JS motion"):
//   login -> create two photography projects (one with two images) so the
//   branch holds several frames -> photography page shows the film rail with
//   every frame, drifts on its own, responds to arrows/drag/click
//   -> project page gallery lets you scroll between its images
//   -> ambient olive gradient is present -> cleanup.
//
// Run against the built prod server:  node scripts/smoke-rail.mjs
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

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

async function listKeys(prefix) {
  const out = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return (out.Contents ?? []).map((o) => o.Key);
}
async function deleteKeys(keys) {
  if (!keys.length) return;
  await r2.send(
    new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) } })
  );
}

function makeImage(hex, w = 1400, h = 1050) {
  return sharp({
    create: { width: w, height: h, channels: 3, background: hex },
  })
    .jpeg()
    .toBuffer();
}

const [imgA1, imgA2, imgB] = await Promise.all([
  makeImage({ r: 190, g: 120, b: 40 }),
  makeImage({ r: 40, g: 90, b: 180 }),
  makeImage({ r: 20, g: 150, b: 110 }),
]);

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();
page.on("dialog", (dialog) => dialog.accept());
page.setDefaultTimeout(60000);

const projectA = { title: "Rail Story A", slug: `rail-a-${Date.now()}` };
const projectB = { title: "Rail Story B", slug: `rail-b-${Date.now()}` };
const sweeps = new Set(); // R2 key prefixes created this run

// Reads the scroller frame counters, e.g. ["02 / 04"].
async function readCounters() {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-live="polite"]'))
      .map((el) => el.textContent.trim())
      .filter((t) => /^\d+\/\d+$/.test(t))
  );
}

// Polls until a frame counter satisfies pred. Returns the value, or null.
async function waitCounter(pred, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < end) {
    last = await readCounters();
    const hit = last.find(pred);
    if (hit) return hit;
    await page.waitForTimeout(400);
  }
  console.log("DEBUG  no counter match; latest:", JSON.stringify(last));
  return null;
}

async function createProjectAndUpload({ title, slug, buffers, names }) {
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel(/Slug/).fill(slug);
  await page.getByLabel("Date").fill("2026-05-01");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
  const urls = [];
  for (let i = 0; i < buffers.length; i++) {
    const confirmPromise = page.waitForResponse(
      (res) => res.url().includes("/api/media/confirm") && res.request().method() === "POST",
      { timeout: 60000 }
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: names[i],
      mimeType: "image/jpeg",
      buffer: buffers[i],
    });
    const res = await confirmPromise;
    const view = (await res.json()).media;
    if (view?.url) {
      urls.push(view.url);
      const m = view.url.match(/\/media\/([0-9a-f-]+)/);
      if (m) sweeps.add(`media/${m[1]}`);
    }
  }
  return urls;
}

let prefixForDelete = null;

try {
  // 1. Login.
  await page.goto(`${BASE_URL}/admin/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  check("valid login reaches dashboard", true);

  // 2. Baseline: how many photography frames exist before this run?
  const baseline = await (async () => {
    for (let i = 0; i < 8; i++) {
      await page.goto(`${BASE_URL}/photography`);
      const region = page.locator('[role="region"][aria-label*="frame"]').first();
      if (await region.count()) {
        const label = (await region.getAttribute("aria-label")) ?? "";
        const m = label.match(/of (\d+)/);
        if (m) return Number(m[1]);
      }
      await page.waitForTimeout(1200);
    }
    return 0;
  })();

  // 3. Create two photography projects — A gets two frames.
  await createProjectAndUpload({
    title: projectA.title,
    slug: projectA.slug,
    buffers: [imgA1, imgA2],
    names: ["a1.jpg", "a2.jpg"],
  });
  await createProjectAndUpload({
    title: projectB.title,
    slug: projectB.slug,
    buffers: [imgB],
    names: ["b1.jpg"],
  });
  check("two projects created with 3 uploads", true);

  // 4. Photography page now shows the film rail with every frame.
  let rail = null;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    await page.goto(`${BASE_URL}/photography`);
    const region = page.locator('[role="region"][aria-label*="frame"]').first();
    if (await region.count()) {
      const label = (await region.getAttribute("aria-label")) ?? "";
      const m = label.match(/frame \d+ of (\d+)/);
      if (m) {
        total = Number(m[1]);
        rail = region;
        break;
      }
    }
    await page.waitForTimeout(1200);
  }
  check("photography shows the film rail", rail !== null);
  check(
    "rail holds every frame of the branch",
    rail !== null && total >= baseline + 3,
    `${total} frames (baseline ${baseline})`
  );
  const railImages = rail ? await rail.locator("img").count() : 0;
  check("every rail frame renders an image", railImages === total, `${railImages} images`);

  // 5. The strip drifts on its own (pauses are handled by hover/touch).
  await page.mouse.move(2, 2); // keep the pointer away so hover doesn't pause
  await rail.scrollIntoViewIfNeeded();
  const before = await rail.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(7600); // quiet 4.2s + smooth advance
  const after = await rail.evaluate((el) => el.scrollLeft);
  check("strip drifts forward on its own", after > before + 80, `${Math.round(before)} -> ${Math.round(after)}`);

  // 6. Arrows step between frames and the counter + progress follow.
  const c1 = (await readCounters())[0] ?? null;
  await page.getByRole("button", { name: "Next frame" }).first().click();
  const c2 = await waitCounter((t) => t !== c1);
  check("next arrow advances the frame", c1 !== c2, `${c1 ?? "?"} -> ${c2 ?? "?"}`);
  const progress = await page
    .locator('[aria-live="polite"]')
    .first()
    .evaluate(() => {
      const bar = document.querySelector("div.bg-accent");
      return bar ? bar.getBoundingClientRect().width : 0;
    })
    .catch(() => 0);
  check("progress hairline fills as you advance", progress > 0, `${Math.round(progress)}px`);

  // 7. Drag with the mouse scrolls the strip, but does not navigate.
  // Reset to the first frame first so the drag has room to move.
  await rail.evaluate((el) => {
    el.scrollTo({ left: 0, behavior: "smooth" });
  });
  await page.waitForTimeout(900);
  await rail.scrollIntoViewIfNeeded();
  const box = await rail.boundingBox();
  const dragFrom = await rail.evaluate((el) => el.scrollLeft);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  const dragTo = await rail.evaluate((el) => el.scrollLeft);
  check("dragging scrolls between frames", dragTo > dragFrom + 120, `${Math.round(dragFrom)} -> ${Math.round(dragTo)}`);
  check("drag did not navigate away", page.url().includes("/photography"), page.url());

  // 8. Clicking a frame opens its project (drag suppression only cancels drags).
  await page.getByRole("link", { name: new RegExp(`^${projectA.title} — open project$`) }).first().click();
  await page.waitForURL(new RegExp(`/work/${projectA.slug}`));
  check("clicking a rail frame opens the project", true);

  // 9. The project gallery pages between A's two images.
  const paged = page.locator('[role="region"][aria-label*="of 2"]').first();
  await paged.waitFor();
  const pa = await paged.evaluate((el) => el.scrollLeft);
  await page.getByRole("button", { name: "Next frame" }).first().click();
  await waitCounter((t) => t.startsWith("02/"));
  const pb = await paged.evaluate((el) => el.scrollLeft);
  check("project page scrolls between its images", pb > pa + 50, `${Math.round(pa)} -> ${Math.round(pb)}`);

  // 10. Ambient olive gradient sits behind the black page.
  await page.goto(`${BASE_URL}/`);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("page stays black", bodyBg === "rgb(0, 0, 0)", bodyBg);
  const aura = await page.evaluate(() => {
    const el = document.querySelector(".bg-aura");
    if (!el) return null;
    return getComputedStyle(el).backgroundImage;
  });
  check("olive gradient aura present", (aura ?? "").includes("radial-gradient"), aura?.slice(0, 60) ?? "none");

  // 11. Hero headline still carries its animated lines.
  await page.getByRole("heading", { level: 1 }).waitFor();
  const heroLines = await page
    .evaluate(() => {
      const h1 = document.querySelector("h1");
      return h1 ? h1.querySelectorAll("span.block.overflow-hidden").length : 0;
    })
    .catch(() => 0);
  check("hero headline renders as animated lines", heroLines === 3, `${heroLines} lines`);
} catch (err) {
  check("rail flow completed without errors", false, err.message);
} finally {
  // Cleanup: delete both test projects via the admin UI, then sweep R2.
  try {
    for (const p of [projectA, projectB]) {
      await page.goto(`${BASE_URL}/admin/projects`);
      for (;;) {
        const rows = page.locator("li", { hasText: p.title });
        const before = await rows.count();
        if (before === 0) break;
        await rows.first().getByRole("button", { name: "Delete" }).click();
        await page.waitForFunction(
          ({ text, expected }) =>
            Array.from(document.querySelectorAll("li")).filter((li) =>
              li.textContent.includes(text)
            ).length === expected,
          { text: p.title, expected: before - 1 },
          { timeout: 20000 }
        );
      }
    }
    for (const prefix of sweeps) {
      await deleteKeys(await listKeys(prefix));
    }
  } catch {
    /* best-effort cleanup */
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
