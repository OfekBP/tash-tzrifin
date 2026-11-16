// מייצר את כל נכסי הלוגו של האפליקציה ממקור אחד.
// שימוש: node scripts/build-brand-assets.mjs <נתיב לקובץ הלוגו המקורי>
import sharp from 'sharp';
import fs from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('חסר נתיב לקובץ הלוגו');

// 1. שקיפות לפינות: הצפה מארבע הפינות על פיקסלים כהים (הרקע השחור שנשמר בקובץ)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const lum = (i) => (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11);
const out = Buffer.from(data);
const seen = new Uint8Array(W * H);
const stack = [0, W - 1, (H - 1) * W, H * W - 1];
while (stack.length) {
  const i = stack.pop();
  if (seen[i]) continue;
  if (lum(i) > 70) continue;
  seen[i] = 1;
  out[i * 4 + 3] = 0;
  const x = i % W, y = (i / W) | 0;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - W);
  if (y < H - 1) stack.push(i + W);
}
// ריכוך קצה: פיקסלים שצמודים לאזור השקוף מקבלים שקיפות לפי בהירותם
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (seen[i]) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (seen[(y + dy) * W + x + dx]) { near = true; break; }
    if (near) out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(((lum(i) - 40) / 110) * 255)));
  }
}
let logo = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).trim().png().toBuffer();
let meta = await sharp(logo).metadata();
const side = Math.max(meta.width, meta.height);
logo = await sharp(logo).resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
meta = await sharp(logo).metadata();
console.log('trimmed', meta.width, meta.height);

fs.mkdirSync('public/icons', { recursive: true });
const SKY = '#C5E4FB';

// לוגו ראשי (שקוף, פינות מעוגלות)
await sharp(logo).resize(96, 96).webp({ quality: 90, effort: 6 }).toFile('public/logos/app-logo-96.webp');
await sharp(logo).resize(264, 264).webp({ quality: 88, effort: 6 }).toFile('public/logos/app-logo-264.webp');
// אייקוני PWA / iOS
await sharp(logo).resize(192, 192).png().toFile('public/icons/192.png');
await sharp(logo).resize(512, 512).png().toFile('public/icons/512.png');
await sharp({ create: { width: 180, height: 180, channels: 4, background: SKY } })
  .composite([{ input: await sharp(logo).resize(180, 180).toBuffer() }])
  .png().toFile('public/icons/180.png');
// maskable: רקע מלא, הלוגו באזור הבטוח (80%)
await sharp({ create: { width: 512, height: 512, channels: 4, background: SKY } })
  .composite([{ input: await sharp(logo).resize(410, 410).toBuffer(), gravity: 'center' }])
  .png().toFile('public/icons/maskable-512.png');
// favicon
await sharp(logo).resize(64, 64).png().toFile('public/icons/favicon-64.png');
const png32 = await sharp(logo).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync('public/favicon.ico', Buffer.concat([ico, png32]));
// תמונת שיתוף (וואטסאפ וכו')
const og = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4F1FF"/><stop offset="1" stop-color="#E6DDFF"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>');
await sharp(og).composite([{ input: await sharp(logo).resize(460, 460).toBuffer(), gravity: 'center' }]).png().toFile('public/og.png');
for (const f of ['icons/512.png', 'icons/maskable-512.png', 'icons/192.png', 'icons/180.png', 'og.png']) {
  const b = await sharp('public/' + f).png({ palette: true, quality: 92, compressionLevel: 9, effort: 10 }).toBuffer();
  fs.writeFileSync('public/' + f, b);
}
console.log('done');
