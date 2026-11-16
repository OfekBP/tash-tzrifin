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
await sharp(logo).resize(400, 400).webp({ quality: 88, effort: 6 }).toFile('public/logos/app-logo-400.webp');
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

// סמל בלי רקע (לשימוש על רקע שמיים, למשל במסך הטעינה): הצפה מהקצוות על גוון התכלת של הרקע
{
  const { data: d, info: inf } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = inf.width, h = inf.height, o = Buffer.from(d);
  const bgc = [d[(40 * w + w / 2 | 0) * 4], d[(40 * w + w / 2 | 0) * 4 + 1], d[(40 * w + w / 2 | 0) * 4 + 2]];
  const dist = (i) => Math.hypot(d[i * 4] - bgc[0], d[i * 4 + 1] - bgc[1], d[i * 4 + 2] - bgc[2]);
  const TOL = 92;
  const gone = new Uint8Array(w * h);
  const st = [];
  // טבעת הקצה של הריבוע (אנטי-אליאסינג כהה): נחשבת רקע, ומשם מתחילה ההצפה
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i * 4 + 3] <= 10) { st.push(i); continue; }
    let rim = false;
    for (let dy = -7; dy <= 7 && !rim; dy += 7) for (let dx = -7; dx <= 7; dx += 7) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || d[(yy * w + xx) * 4 + 3] <= 10) { rim = true; break; }
    }
    if (rim) { o[i * 4 + 3] = 0; gone[i] = 1; st.push(i); }
  }
  const visited = new Uint8Array(w * h);
  while (st.length) {
    const i = st.pop();
    if (visited[i]) continue;
    visited[i] = 1;
    if (!gone[i] && d[i * 4 + 3] > 10 && dist(i) > TOL) continue;
    gone[i] = 1;
    o[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) st.push(i - 1);
    if (x < w - 1) st.push(i + 1);
    if (y > 0) st.push(i - w);
    if (y < h - 1) st.push(i + w);
  }
  // ריכוך קצה של 2 פיקסלים
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x;
    if (gone[i]) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (gone[(y + dy) * w + x + dx]) { near = true; break; }
    if (near) o[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(((dist(i) - TOL * 0.6) / (TOL * 0.9)) * 255)));
  }
  await sharp(o, { raw: { width: w, height: h, channels: 4 } }).trim().resize(400, 400, { fit: 'inside' }).webp({ quality: 90, alphaQuality: 95, effort: 6 }).toFile('public/logos/app-emblem-400.webp');
}
for (const f of ['icons/512.png', 'icons/maskable-512.png', 'icons/192.png', 'icons/180.png', 'og.png']) {
  const b = await sharp('public/' + f).png({ palette: true, quality: 92, compressionLevel: 9, effort: 10 }).toBuffer();
  fs.writeFileSync('public/' + f, b);
}
console.log('done');
