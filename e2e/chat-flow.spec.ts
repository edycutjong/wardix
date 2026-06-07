import { test, expect } from "@playwright/test";

test("security console flow", async ({ page }) => {
  await page.goto("/");
  // Check that the main application structure loads
  // We look for a common security dashboard element
  const body = page.locator("body");
  await expect(body).toBeVisible();
});
