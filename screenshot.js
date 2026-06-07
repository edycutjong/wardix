const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('https://wardix.edycu.dev/');
  await page.waitForTimeout(2000);
  
  // Click the first 'Run' button (In-scope call)
  await page.locator('button:has-text("Run")').nth(1).click(); // nth(0) is probably "Run all scenarios" -> actually that has text "Run all scenarios". The cards have "Run"
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/assets/demo-allow.png' });

  // Click the second 'Run' button (Out-of-scope call)
  await page.locator('button:has-text("Run")').nth(2).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/assets/demo-deny-scope.png' });

  // Click the third 'Run' button (Revoked grant)
  await page.locator('button:has-text("Run")').nth(3).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/assets/demo-deny-revoke.png' });

  await browser.close();
})();
