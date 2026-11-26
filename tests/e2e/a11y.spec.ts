// נגישות, בשיטת "מותר רק להשתפר": הממצאים הקיימים רשומים בקובצי allow, ובדיקה נכשלת רק כשנוסף ממצא חדש.
// אחרי תיקון נגישות מעדכנים את הרשימות:  UPDATE_ALLOW=1 npx playwright test tests/e2e/a11y.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { PAGE_TYPES, expect, test } from './helpers';

const DIR = path.resolve('tests/e2e/allow');
const AXE_FILE = path.join(DIR, 'axe.json');
const TAP_FILE = path.join(DIR, 'tap-targets.json');
const UPDATE = !!process.env.UPDATE_ALLOW;
const read = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});

type Counts = Record<string, number>;
const axeAllow: Record<string, Counts> = read(AXE_FILE);
const tapAllow: Record<string, string[]> = read(TAP_FILE);
const axeNow: Record<string, Counts> = {};
const tapNow: Record<string, string[]> = {};

// בדיקה אחרי בדיקה, כדי שהרשימות ייכתבו פעם אחת בסוף
test.describe.configure({ mode: 'serial' });

for (const [name, route] of Object.entries(PAGE_TYPES)) {
  test(`נגישות: ${name}`, async ({ page }) => {
    // בלי אנימציות: סעיף שנפתח בהדרגה נראה ל-axe כטקסט בהיר מדי, והתוצאה משתנה מריצה לריצה
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route, { waitUntil: 'load' });
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await page.evaluate(() => document.fonts.ready);

    // 1. axe: כמה אלמנטים נכשלים בכל כלל
    const { violations } = await new AxeBuilder({ page }).analyze();
    const counts: Counts = Object.fromEntries(violations.map((v) => [v.id, v.nodes.length]).sort());
    axeNow[name] = counts;

    // 2. מטרות מגע קטנות מ-44px (קישור בתוך שורת טקסט פטור)
    const small = await page.evaluate(() => {
      const out = new Set<string>();
      for (const el of document.querySelectorAll<HTMLElement>('a[href], button, summary, input:not([type=hidden]), select, [role=button]')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
        if (el.closest('[hidden], dialog:not([open]), .splash')) continue;
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue;
        // תיבת סימון שעטופה בתווית גדולה: התווית היא מטרת המגע
        const label = el.tagName === 'INPUT' ? el.closest('label') : null;
        const box = label ? label.getBoundingClientRect() : r;
        if (box.width >= 44 && box.height >= 44) continue;
        // המפתח בלי המידות עצמן, כדי שהבדל של פיקסל בין מערכות הפעלה לא ייראה כממצא חדש
        const cls = [...el.classList].sort().join('.');
        out.add(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`);
      }
      return [...out].sort();
    });
    tapNow[name] = small;

    if (UPDATE) return;

    const allowed = axeAllow[name] ?? {};
    const worse = Object.entries(counts).filter(([id, n]) => n > (allowed[id] ?? 0)).map(([id, n]) => `${id}: ${n} (מותר ${allowed[id] ?? 0})`);
    expect(worse, 'ממצאי נגישות חדשים (axe)').toEqual([]);

    const known = new Set(tapAllow[name] ?? []);
    expect(small.filter((k) => !known.has(k)), 'מטרות מגע חדשות שקטנות מ-44px').toEqual([]);
  });
}

test.afterAll(() => {
  if (!UPDATE) return;
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(AXE_FILE, JSON.stringify(axeNow, null, 2) + '\n');
  fs.writeFileSync(TAP_FILE, JSON.stringify(tapNow, null, 2) + '\n');
});
