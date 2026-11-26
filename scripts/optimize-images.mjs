// מכין ללוגואים גרסאות WebP בגודל שבו הם באמת מוצגים (פי 3, למסכים חדים), במקום PNG גדול מהנדרש.
//
// מקור:  design/originals/logos/**.png   (לא עולה לאתר)
// תוצר:  public/logos/**.webp            (מה שהאתר מגיש)
//
// הוספת לוגו: שמים את ה-PNG ב-design/originals/logos, מוסיפים שורה ל-jobs, ומריצים:
//   node scripts/optimize-images.mjs          כותב את קובצי ה-WebP
//   node scripts/optimize-images.mjs --dry    רק מדפיס גדלים
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dry = process.argv.includes('--dry');
const SRC = 'design/originals/logos';
const OUT = 'public/logos';

/** [קובץ, רוחב מרבי, גובה מרבי] בפיקסלים של הקובץ שנוצר (פי 3 מהגודל המוצג) */
const jobs = [
  ['tash-btouch-badge.png', 168, 168], // מוצג עד 56px
  ['ofek.png', 162, 162], // לוגואי היחידות: עד 54px
  ['f108.png', 162, 162],
  ['lahav.png', 162, 162],
  ['f502.png', 162, 162],
  // לוגו בנק מוצג בתוך מסגרת של עד 140x68px
  ['banks/discount.png', 420, 204],
  ['banks/igud.png', 420, 204],
  ['banks/massad.png', 420, 204],
  ['banks/mercantile.png', 420, 204],
  ['banks/pepper.png', 420, 204],
];

let before = 0;
let after = 0;
for (const [file, width, height] of jobs) {
  const src = path.join(SRC, file);
  const out = path.join(OUT, file.replace(/\.png$/, '.webp'));
  const meta = await sharp(src).metadata();
  const buf = await sharp(src).resize({ width, height, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toBuffer();
  const size = fs.statSync(src).size;
  before += size;
  after += buf.length;
  const dims = await sharp(buf).metadata();
  console.log(`${file.padEnd(28)} ${`${meta.width}x${meta.height}`.padEnd(9)} ${String(size).padStart(6)}  ->  ${`${dims.width}x${dims.height}`.padEnd(9)} ${String(buf.length).padStart(6)}`);
  if (!dry) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
  }
}
console.log(`סה״כ: ${before} -> ${after} בייט (${Math.round((1 - after / before) * 100)}% פחות)`);
