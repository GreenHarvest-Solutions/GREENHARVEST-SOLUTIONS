const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1597, height: 811 });
  await page.goto('http://localhost:3000/admin/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
