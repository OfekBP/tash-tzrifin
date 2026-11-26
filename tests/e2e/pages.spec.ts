// כללי היסוד של כל עמוד, בכל רוחב מסך: אין שגיאות, אין גלילה לרוחב, כותרת ותת-כותרת בשורה אחת,
// התמונות נטענות, הסרגל התחתון במקומו וכל הקישורים הפנימיים מובילים לעמוד שקיים.
import fs from 'node:fs';
import path from 'node:path';
import { DIST, SITE, builtRoutes, expect, test, watchErrors } from './helpers';

const routes = builtRoutes();
const known = new Set(routes.map((r) => SITE + r));
const SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

for (const size of SIZES) {
  test.describe(`${size.width}px`, () => {
    test.use({ viewport: size });

    for (const route of routes) {
      test(`עמוד /${route}`, async ({ page }) => {
        const errors = watchErrors(page);
        const failed: string[] = [];
        page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

        await page.goto(route, { waitUntil: 'load' });

        const m = await page.evaluate(() => {
          const oneLine = (el: Element | null) => {
            if (!el) return true;
            const lh = parseFloat(getComputedStyle(el).lineHeight) || 0;
            return el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height < lh * 1.6 + 2;
          };
          const dock = document.querySelector('.dock');
          const dr = dock?.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            h1: oneLine(document.querySelector('.page-head h1, .hero h1')),
            lead: oneLine(document.querySelector('.page-head .lead')),
            hidden: document.documentElement.classList.contains('css-wait'),
            dock: dock ? getComputedStyle(dock).position : 'missing',
            dockGap: dr ? Math.round(innerHeight - dr.bottom) : -1,
            broken: [...document.images]
              .filter((i) => i.getAttribute('src') && i.loading !== 'lazy' && i.complete && i.naturalWidth === 0)
              .map((i) => i.getAttribute('src')),
            links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''),
          };
        });

        expect(m.overflow, 'גלילה לרוחב').toBeLessThanOrEqual(0);
        expect(m.h1, 'הכותרת בשורה אחת').toBe(true);
        expect(m.lead, 'תת-הכותרת בשורה אחת ולא נחתכת').toBe(true);
        expect(m.hidden, 'העמוד מוצג (css-wait הוסר)').toBe(false);
        expect(m.dock, 'הסרגל התחתון צמוד לתחתית').toBe('fixed');
        expect(m.dockGap, 'הסרגל התחתון בתוך המסך').toBeGreaterThanOrEqual(8);
        expect(m.broken, 'תמונות שבורות').toEqual([]);

        const dead = m.links.filter((href) => {
          if (!href.startsWith(SITE)) return false; // קישור חיצוני, tel:, עוגן
          const clean = href.split(/[?#]/)[0];
          if (known.has(clean)) return false;
          return !fs.existsSync(path.join(DIST, clean.slice(SITE.length))); // קובץ (תמונה, סרטון, JSON)
        });
        expect(dead, 'קישורים פנימיים שבורים').toEqual([]);

        expect(failed, 'בקשות שנכשלו').toEqual([]);
        expect(errors, 'שגיאות קונסול').toEqual([]);
      });
    }
  });
}

test('עמוד שלא קיים מציג את עמוד ה-404 שלנו', async ({ page }) => {
  const res = await page.goto('no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('.nf-code')).toHaveText('404');
  await expect(page.locator('.dock')).toBeVisible();
});
