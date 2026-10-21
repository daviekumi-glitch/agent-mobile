import { chromium } from '@playwright/test';
const base = 'http://localhost:4174';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const shots = [
  ['/about', 'about'],
  ['/tools', 'tools'],
  ['/skills', 'skills'],
  ['/settings', 'settings'],
];
for (const [path, name] of shots) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `/tmp/shot-${name}-390.png`, fullPage: false });
  const h1 = await page.locator('h1').first().textContent();
  console.log(name, 'h1 =', JSON.stringify(h1?.trim()));
}
// desktop width for settings
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(base + '/settings', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/shot-settings-1280.png' });
console.log('settings 1280 ok');
// deep-link prefill
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + '/chat?q=What%20is%20compound%20interest%3F', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const val = await page.locator('textarea').first().inputValue();
console.log('prefill =', JSON.stringify(val));
await page.screenshot({ path: '/tmp/shot-prefill-390.png' });
await browser.close();
