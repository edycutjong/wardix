import { test, expect, Page } from "@playwright/test";

const SHOTS = "/Users/edycu/Projects/DemoStudio/019_Wardix/screenshots";

const beat = (page: Page, ms = 1500) => page.waitForTimeout(ms);
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png` });

test("Wardix — full demo walkthrough", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Control Plane for Delegated AI Agents", { timeout: 30000 });
  await beat(page, 1500);

  // Perform scroll down and scroll up actions
  await page.mouse.wheel(0, 600);
  await beat(page, 1500);
  await page.mouse.wheel(0, -600);
  await beat(page, 1000);

  await shot(page, "01-hero-dashboard");

  await page.locator('button:has-text("Run")').nth(1).click(); // In-scope call
  await beat(page, 2500);
  await shot(page, "02-step-1-allow");

  await page.locator('button:has-text("Run")').nth(2).click(); // Out-of-scope call
  await beat(page, 2500);
  await shot(page, "03-step-2-deny");

  await page.locator('button:has-text("Run")').nth(3).click(); // Revoked grant
  await beat(page, 3000);
  await shot(page, "04-step-4-injection");

  await beat(page, 2000);
  await shot(page, "05-final-dashboard");
});
