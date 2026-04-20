import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 776 });
  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(process.cwd(), 'screenshot1.png'), fullPage: true });
  await browser.close();
  console.log('Screenshot taken!');
})();
