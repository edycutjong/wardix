import { test, expect, Page } from "@playwright/test";

const SHOTS = "/Users/edycu/Projects/DemoStudio/019_Wardix/screenshots";

const beat = (page: Page, ms = 1500) => page.waitForTimeout(ms);
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png` });

test("Wardix — full demo walkthrough", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("IAM & Policy Control Plane");
  await beat(page, 2000);
  await shot(page, "01-hero-dashboard");

  await page.getByText("Step 1").click();
  await beat(page, 2500);
  await shot(page, "02-step-1-allow");

  await page.getByText("Step 2").click();
  await beat(page, 2500);
  await shot(page, "03-step-2-deny");

  await page.getByText("Step 4").click();
  await beat(page, 3000);
  await shot(page, "04-step-4-injection");

  await beat(page, 2000);
  await shot(page, "05-final-dashboard");
});
