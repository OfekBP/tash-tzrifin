import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export { base, expect };

/** בסיס האתר בבנייה המקומית (GitHub Pages). ב-Vercel האתר יושב בשורש. */
export const SITE = '/tash-tzrifin/';
export const DIST = path.resolve('dist');

/** כל העמודים שנבנו ל-dist, יחסית לבסיס האתר ('' = דף הבית). */
export function builtRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') out.push(path.relative(DIST, dir).split(path.sep).join('/'));
    }
  };
  walk(DIST);
  return out.map((r) => (r ? `${r}/` : '')).sort();
}

/** עמוד מייצג לכל סוג עמוד באתר. */
export const PAGE_TYPES: Record<string, string> = {
  home: '',
  rights: 'rights/',
  right: 'rights/lone-soldier/',
  'right-long': 'rights/financial-aid/',
  guides: 'guides/',
  'guide-walkthrough': 'guides/tash-btouch-steps/',
  'guide-videos': 'guides/tash-btouch/',
  'guide-steps': 'guides/submit-request/',
  banks: 'guides/banks/',
  bank: 'guides/banks/leumi/',
  faq: 'faq/',
  glossary: 'glossary/',
  contacts: 'contacts/',
  search: 'search/',
  quiz: 'guide-me/',
};

/** רעש מוכר שאינו תקלה: ביטול מעבר-עמוד כשהניווט מהיר מהאנימציה. */
const IGNORED = [/Transition was aborted because of invalid state/];

/** אוסף שגיאות קונסול ושגיאות JS מהעמוד. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  const keep = (text: string) => { if (!IGNORED.some((re) => re.test(text))) errors.push(text); };
  page.on('console', (m) => { if (m.type() === 'error') keep(m.text()); });
  page.on('pageerror', (e) => keep(String(e)));
  return errors;
}

/** ברירת המחדל לבדיקות: מדלגים על מסך הפתיחה. בדיקת מסך הפתיחה עצמה משתמשת ב-base. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try { sessionStorage.setItem('splash', '1'); } catch { /* אין אחסון: לא נורא */ }
    });
    await use(context);
  },
});
