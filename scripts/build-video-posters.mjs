// מפיק תמונת פתיחה (poster) לכל סרטון הדרכה: פריים מהשנייה הראשונה, בפורמט WebP, ליד קובץ הסרטון.
// כך במקום מלבן כהה רואים מה יש בסרטון עוד לפני שלוחצים על ההפעלה (חשוב במיוחד באייפון).
//
// הרצה אחרי הוספת סרטון:  node scripts/build-video-posters.mjs
// הסקריפט משתמש ב-Edge או ב-Chrome שמותקן במחשב, כי הדפדפן של הבדיקות האוטומטיות לא מפענח את פורמט הסרטונים.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = 'public/videos';
/** סרטון שהשנייה הראשונה שלו ריקה: מאיזו שנייה לקחת את התמונה */
const AT = { 'commanders-interviews/commanders.mp4': 6 };
const files = fs
  .readdirSync(root, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.mp4'))
  .map((f) => path.join(root, f));

let browser;
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel });
    break;
  } catch {
    /* מנסים את הדפדפן הבא */
  }
}
if (!browser) {
  console.error('לא נמצא Edge או Chrome במחשב.');
  process.exit(1);
}

const page = await browser.newPage();
for (const file of files) {
  await page.goto(pathToFileURL(path.resolve(file)).href);
  const at = AT[path.relative(root, file).split(path.sep).join('/')] ?? 1;
  const size = await page.evaluate(async (at) => {
    const v = document.querySelector('video');
    v.muted = true;
    v.pause();
    v.controls = false;
    if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    v.currentTime = Math.min(at, v.duration / 2);
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    document.documentElement.style.cssText = 'margin:0;background:#000';
    document.body.style.margin = '0';
    v.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:fill;margin:0;background:#000';
    return { w: v.videoWidth, h: v.videoHeight };
  }, at);
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.waitForTimeout(300);
  const png = await page.screenshot();
  const out = file.replace(/\.mp4$/, '.webp');
  const buf = await sharp(png).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 78, effort: 6 }).toBuffer();
  fs.writeFileSync(out, buf);
  console.log(`${out}  ${size.w}x${size.h}  ${buf.length} בייט`);
}
await browser.close();
