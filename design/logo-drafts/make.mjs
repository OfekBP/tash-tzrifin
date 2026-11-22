// מייצר טיוטות לוגו (SVG + PNG). הרצה: node design/logo-drafts/make.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const P = { navy: '#1B2A6B', purple: '#6C3FD1', purpleLight: '#B79BF5', lav: '#DCCBFF', sky: '#8EC5FF', blue: '#2F6AD0', white: '#FFFFFF', gold: '#F2C14E' };

const rad = (d) => (d * Math.PI) / 180;
const pt = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

/** כוכב דוד כשני משולשים */
const star = (cx, cy, R, fill) => {
  const tri = (off) => [0, 120, 240].map((a) => pt(cx, cy, R, a + off).map((n) => n.toFixed(1)).join(',')).join(' ');
  return `<polygon points="${tri(-90)}" fill="${fill}"/><polygon points="${tri(90)}" fill="${fill}"/>`;
};

/** גלגל שיניים: טבעת עם שיניים */
const gear = (cx, cy, rOut, rIn, teeth, fill, toothW, toothH) => {
  let g = `<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="${fill}"/>`;
  for (let i = 0; i < teeth; i++) {
    const a = (360 / teeth) * i;
    g += `<rect x="${cx - toothW / 2}" y="${cy - rOut - toothH + 4}" width="${toothW}" height="${toothH}" rx="4" fill="${fill}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  return g;
};

/** ספר פתוח */
const book = (cx, y, w, h, page, edge) => {
  const l = cx - w / 2, r = cx + w / 2;
  return `
  <path d="M${cx} ${y} C ${cx - w * 0.18} ${y - h * 0.32}, ${l + w * 0.2} ${y - h * 0.34}, ${l} ${y - h * 0.18} L ${l + 6} ${y + h * 0.78} C ${l + w * 0.2} ${y + h * 0.5}, ${cx - w * 0.18} ${y + h * 0.52}, ${cx} ${y + h} Z" fill="${page}"/>
  <path d="M${cx} ${y} C ${cx + w * 0.18} ${y - h * 0.32}, ${r - w * 0.2} ${y - h * 0.34}, ${r} ${y - h * 0.18} L ${r - 6} ${y + h * 0.78} C ${r - w * 0.2} ${y + h * 0.5}, ${cx + w * 0.18} ${y + h * 0.52}, ${cx} ${y + h} Z" fill="${page}"/>
  <path d="M${l} ${y - h * 0.18} L ${l + 6} ${y + h * 0.78}" stroke="${edge}" stroke-width="9" stroke-linecap="round" fill="none"/>
  <path d="M${r} ${y - h * 0.18} L ${r - 6} ${y + h * 0.78}" stroke="${edge}" stroke-width="9" stroke-linecap="round" fill="none"/>`;
};

/** שרוך: חבל שזור (פס כהה + קו מקווקו בהיר מעליו) */
const cord = (d, w, base = P.purple, hi = P.purpleLight) =>
  `<path d="${d}" fill="none" stroke="${base}" stroke-width="${w}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${hi}" stroke-width="${w * 0.42}" stroke-linecap="round" stroke-dasharray="${w * 0.7} ${w * 0.9}" opacity="0.9"/>`;

const svg = (body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>${defs}</defs>${body}</svg>`;

// ───────── טיוטה A: אייקון אפליקציה, שמיים + שרוך סגול סביב ─────────
const A = svg(
  `
  <rect width="512" height="512" rx="116" fill="url(#bgA)"/>
  <ellipse cx="256" cy="120" rx="210" ry="120" fill="#fff" opacity="0.14"/>
  ${cord('M256 70 C 120 70, 70 170, 70 256 C 70 380, 160 452, 256 452 C 352 452, 442 380, 442 256 C 442 170, 392 70, 256 70', 22)}
  ${gear(256, 226, 96, 70, 8, P.navy, 34, 28)}
  <circle cx="256" cy="226" r="70" fill="#fff"/>
  ${star(256, 226, 56, P.blue)}
  ${book(256, 318, 236, 78, '#fff', P.gold)}
  <path d="M256 452 C 236 470, 214 488, 196 498" fill="none" stroke="${P.purple}" stroke-width="20" stroke-linecap="round"/>
  <path d="M256 452 C 276 470, 298 488, 316 498" fill="none" stroke="${P.purple}" stroke-width="20" stroke-linecap="round"/>
  <circle cx="256" cy="452" r="19" fill="${P.purple}"/><circle cx="256" cy="452" r="8" fill="${P.purpleLight}"/>
  `,
  `<linearGradient id="bgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE0FF"/><stop offset="1" stop-color="#5E9BF0"/></linearGradient>`,
);

// ───────── טיוטה B: סמל עגול נאמן למקור (חרב, ספר, גלגל, כוכב) + טבעת שרוך ─────────
const B = svg(
  `
  <circle cx="256" cy="256" r="244" fill="url(#bgB)"/>
  ${cord('M256 22 A234 234 0 1 1 255.9 22', 26)}
  <circle cx="256" cy="256" r="206" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="3"/>
  <!-- חרב -->
  <polygon points="256,86 270,112 270,330 242,330 242,112" fill="#EEF2FF"/>
  <rect x="226" y="326" width="60" height="14" rx="6" fill="#C9D3F5"/>
  <rect x="248" y="340" width="16" height="62" rx="4" fill="#DCE3FA"/>
  ${book(256, 270, 300, 92, '#fff', P.gold)}
  ${gear(256, 236, 74, 52, 8, P.navy, 28, 22)}
  <circle cx="256" cy="236" r="52" fill="#fff"/>
  ${star(256, 236, 42, P.navy)}
  <path d="M256 462 C 242 474, 232 482, 224 488" fill="none" stroke="${P.purple}" stroke-width="18" stroke-linecap="round"/>
  <path d="M256 462 C 270 474, 280 482, 288 488" fill="none" stroke="${P.purple}" stroke-width="18" stroke-linecap="round"/>
  <circle cx="256" cy="462" r="18" fill="${P.purple}"/><circle cx="256" cy="462" r="7" fill="${P.purpleLight}"/>
  `,
  `<radialGradient id="bgB" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#6DC3E0"/><stop offset="1" stop-color="#2A64B0"/></radialGradient>`,
);

// ───────── טיוטה C: מינימלי, סגול-כחול, שרוך כסרט זורם (כמו הנחש במקור) ─────────
const C = svg(
  `
  <rect width="512" height="512" rx="116" fill="url(#bgC)"/>
  ${cord('M410 70 C 300 20, 120 60, 150 160 C 175 240, 330 190, 330 290 C 330 370, 220 380, 120 450', 26, '#fff', P.lav)}
  ${gear(256, 216, 98, 72, 8, '#fff', 34, 28)}
  <circle cx="256" cy="216" r="70" fill="url(#bgC)"/>
  ${star(256, 216, 50, '#fff')}
  ${book(256, 334, 252, 82, '#fff', P.lav)}
  `,
  `<linearGradient id="bgC" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="512" y2="512"><stop offset="0" stop-color="#8050E8"/><stop offset="1" stop-color="#397DE8"/></linearGradient>`,
);

const drafts = { 'A-sky-icon': A, 'B-badge': B, 'C-minimal': C };
const tiles = [];
for (const [name, s] of Object.entries(drafts)) {
  fs.writeFileSync(path.join(dir, `${name}.svg`), s);
  await sharp(Buffer.from(s), { density: 192 }).resize(1024, 1024).png().toFile(path.join(dir, `${name}.png`));
  tiles.push(await sharp(Buffer.from(s), { density: 96 }).resize(420, 420).png().toBuffer());
}
// גיליון השוואה + תצוגה בגודל אייקון קטן
const sheet = sharp({ create: { width: 420 * 3 + 80, height: 560, channels: 4, background: '#F5F7FF' } });
const comp = tiles.map((t, i) => ({ input: t, left: 20 + i * 440, top: 20 }));
for (const [i, s] of Object.values(drafts).entries()) {
  const small = await sharp(Buffer.from(s), { density: 96 }).resize(96, 96).png().toBuffer();
  const tiny = await sharp(Buffer.from(s), { density: 96 }).resize(48, 48).png().toBuffer();
  comp.push({ input: small, left: 20 + i * 440, top: 450 }, { input: tiny, left: 140 + i * 440, top: 474 });
}
await sheet.composite(comp).png().toFile(path.join(dir, 'sheet.png'));
console.log('done');
