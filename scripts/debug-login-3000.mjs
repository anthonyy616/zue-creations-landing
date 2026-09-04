import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
page.on("dialog", async (d) => {
  console.log("[dialog]", d.type(), d.message());
  await d.accept();
});

const steps = [];
const step = (s) => {
  steps.push(s);
  console.log("CHECK", s);
};

try {
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForURL("**/admin/login**", { timeout: 10000 });
  step("1. /admin redirects to /admin/login");

  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "ZueAdmin!2026");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/admin/dashboard**", { timeout: 15000 });
  step("2. Login succeeds -> /admin/dashboard");

  await page.goto(`${BASE}/admin/projects`, { waitUntil: "networkidle" });
  const heading = await page.locator("h1").first().textContent();
  step(`3. /admin/projects renders (h1: "${heading?.trim()}")`);

  // Session persists across requests (cookie works on subsequent pages)
  const dash = await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
  step(`4. /admin/dashboard -> HTTP ${dash.status()}`);

  const body = await page.evaluate(() => document.body.innerText);
  const isAuthed = !body.includes("Sign in");
  step(`5. Dashboard shows authenticated content: ${isAuthed}`);
} catch (e) {
  console.log("FAIL", e.message?.slice(0, 500));
  await page.screenshot({ path: "scripts/debug-login-3000-fail.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}