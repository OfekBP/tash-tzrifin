// מצלם את flyer.html לתמונה אחת לשליחה. הרצה מתיקיית הפרויקט: node design/flyer/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const here = (f) => new URL(f, import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(here('flyer.html').href);
await page.evaluate(() => document.fonts.ready);

// אזהרה אם התוכן גולש מהמסגרת או שתמונה לא נטענה
const problems = await page.evaluate(() => {
  const main = document.querySelector('main');
  const out = [];
  if (main.scrollHeight > main.clientHeight) out.push(`overflow: ${main.scrollHeight - main.clientHeight}px`);
  for (const img of document.images) if (!img.naturalWidth) out.push(`missing image: ${img.src}`);
  for (const k of document.querySelectorAll('.key')) {
    const r = k.getBoundingClientRect();
    if (r.left < 48 || r.right > 1032) out.push(`key out of bounds: ${k.textContent.trim()}`);
  }
  return out;
});

await page.screenshot({ path: fileURLToPath(here('add-to-home-screen.png')) });
await browser.close();
console.log(problems.length ? problems.join('\n') : 'ok');
