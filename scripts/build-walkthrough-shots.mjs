// חד-פעמי: ממיר את צילומי המסך של מדריך ת״ש בטאצ׳ ל-WebP ומטשטש שמות פרטיים.
// שימוש: node scripts/build-walkthrough-shots.mjs <תיקיית-מקור-עם-JPG>
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('חסר נתיב לתיקיית המקור');
const out = 'public/guides/tash-btouch-steps';
mkdirSync(out, { recursive: true });

// אזורים לטשטוש (פיקסלים בתמונה המקורית, רוחב 420): [left, top, width, height]
const blur = {
  s2: [[205, 300, 118, 40]], // כתובת מייל
  s5a: [[8, 178, 200, 30]], // "ערב טוב, <שם>"
  s5b: [[8, 178, 200, 30]],
};
const files = ['r', 's1', 's2', 's3', 's5a', 's5b', 's6a', 's6b', 's6c', 's7', 's8', 's9a', 's9b', 's9c'];

for (const f of files) {
  const input = join(src, `${f}.jpg`);
  let img = sharp(input);
  const regions = blur[f] ?? [];
  if (regions.length) {
    const overlays = [];
    for (const [left, top, width, height] of regions) {
      const patch = await sharp(input).extract({ left, top, width, height }).blur(14).modulate({ brightness: 1 }).toBuffer();
      overlays.push({ input: patch, left, top });
    }
    img = sharp(await sharp(input).composite(overlays).toBuffer());
  }
  const info = await img.webp({ quality: 72 }).toFile(join(out, `${f}.webp`));
  console.log(f, info.width, info.height, Math.round(info.size / 1024) + 'KB');
}
