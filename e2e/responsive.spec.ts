import { test, expect } from "@playwright/test";

test.describe("Responsive Layout", () => {
  test("mobile view", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    // Ensure the main layout element exists on mobile
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("desktop view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
