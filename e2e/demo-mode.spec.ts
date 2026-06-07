import { test, expect } from "@playwright/test";

test("smoke test in demo mode", async ({ page }) => {
  await page.goto("/");
  // Wardix title should be present
  await expect(page).toHaveTitle(/Wardix/i);
  
  // Verify no immediate console errors in demo mode
  page.on("pageerror", (exception) => {
    expect(exception).toBeNull();
  });
});
