// E2E smoke test for the admin area: login -> create -> edit -> delete.
// Requires the app to be running (e.g. `next start -p 3100`) and a seeded
// admin user. Uses the system Chrome via playwright-core (no browser download).
//
//   node scripts/smoke-admin.mjs
//
// Env overrides: BASE_URL (default http://localhost:3100), ADMIN_EMAIL,
// ADMIN_PASSWORD, CHROME_PATH.

import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

try {
  // 1. Unauthenticated access redirects to login.
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.waitForURL(/\/admin\/login/);
  check("unauthenticated /admin/projects redirects to login", true);

  // 2. Wrong credentials show a generic error and stay on login.
  await page.goto(`${BASE_URL}/admin/login`);
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin\/login/);
  const alert = page.locator('p[role="alert"]');
  await alert.waitFor({ timeout: 15000 });
  const alertText = await alert.textContent();
  check("bad credentials show generic error", /invalid credentials/i.test(alertText ?? ""));

  // 3. Correct credentials log in and land on the dashboard.
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  check("valid login reaches /admin/dashboard", true);
  const dashText = await page.evaluate(() => document.body.innerText);
  check(
    "dashboard shows stats + New project CTA",
    /total projects/i.test(dashText) && dashText.includes("New project")
  );

  // 4. Create a project via the inline form.
  const slug = `smoke-${Date.now()}`;
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill("Smoke Test Shoot");
  await page.getByLabel(/Slug/).fill(slug);
  await page.getByLabel("Date").fill("2026-01-15");
  await page.getByLabel("Location").fill("Lagos");
  await page.getByLabel("Description").fill("Created by the smoke test.");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
  check("create project redirects to edit page", true);
  const editUrl = page.url();

  // 5. Edit an existing project.
  await page.getByLabel("Title").fill("Smoke Test Shoot — Edited");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
  await page.waitForTimeout(500);
  const titleValue = await page.getByLabel("Title").inputValue();
  check("update persists title", titleValue === "Smoke Test Shoot — Edited", titleValue);

  // 6. The project appears in the list.
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.getByText("Smoke Test Shoot — Edited").waitFor();
  check("updated project appears in list", true);

  // 7. Delete the project (confirm dialog).
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).last().click();
  await page.getByText("Smoke Test Shoot — Edited").waitFor({ state: "detached" });
  check("project deleted from list", true);
} catch (err) {
  check("flow completed without errors", false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
