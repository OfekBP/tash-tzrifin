// "צילום" של הסגנון המחושב של כל אלמנט, בכל סוגי העמודים ובמצבים השונים שלהם.
// משמש כשער לניקוי CSS: מצלמים לפני ואחרי, והתוצאה חייבת להיות זהה.
//
//   STYLES=before npx playwright test tests/e2e/styles.spec.ts     (על הגרסה הישנה, אחרי build)
//   STYLES=after  npx playwright test tests/e2e/styles.spec.ts     (על הגרסה החדשה, אחרי build)
//   node scripts/compare-styles.mjs before after
//
// בלי המשתנה STYLES הקובץ מדולג, כך שהוא לא חלק מהבדיקות הרגילות.
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { PAGE_TYPES, base, test } from './helpers';

const LABEL = process.env.STYLES;
const OUT = path.resolve('.shots', LABEL ?? '_', 'styles');

/** עוצר כל אנימציה בנקודה קבועה, כדי שהערכים לא יהיו תלויים ברגע המדידה. */
async function freeze(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const settle = () => {
      for (const a of document.getAnimations()) {
        try {
          a.finish();
        } catch {
          a.pause();
          a.currentTime = 0;
        }
      }
    };
    // פעמיים, עם המתנה בין לבין: אחרי שאנימציית מעבר-העמוד מסתיימת, הדפדפן צריך עוד רגע כדי להחזיר את העמוד למצבו הרגיל
    settle();
    await frames();
    settle();
    await frames();
    // אנימציות בתוך SVG (המטוסים במסך הפתיחה) רצות על שעון משלהן
    for (const svg of document.querySelectorAll('svg')) {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }
  });
}

async function snap(page: Page, name: string) {
  await freeze(page);
  const data = await page.evaluate(() => {
    const dict = new Map<string, number>();
    const els: [string, number][] = [];
    // לפי סדר אלפביתי: הדפדפן מונה משתני CSS בסדר שמשתנה מריצה לריצה
    const TAB = String.fromCharCode(9);
    const NL = String.fromCharCode(10);
    const ser = (cs: CSSStyleDeclaration) => {
      const names: string[] = [];
      for (let i = 0; i < cs.length; i++) names.push(cs[i]);
      names.sort();
      let s = '';
      for (const n of names) s += n + TAB + cs.getPropertyValue(n) + NL;
      return s;
    };
    let index = 0;
    for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
      const label = `${index++} ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].join('.') : ''}`;
      for (const pseudo of ['', '::before', '::after', '::placeholder', '::marker']) {
        const cs = getComputedStyle(el, pseudo || null);
        if ((pseudo === '::before' || pseudo === '::after') && cs.content === 'none') continue;
        if (pseudo === '::placeholder' && !(el instanceof HTMLInputElement)) continue;
        if (pseudo === '::marker' && cs.display !== 'list-item' && el.tagName !== 'LI' && el.tagName !== 'SUMMARY') continue;
        const s = ser(cs);
        let id = dict.get(s);
        if (id === undefined) {
          id = dict.size;
          dict.set(s, id);
        }
        els.push([label + pseudo, id]);
      }
    }
    return { els, styles: [...dict.keys()] };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data));
}

test.describe('צילום סגנונות', () => {
  test.skip(!LABEL, 'רץ רק עם STYLES=שם');
  test.describe.configure({ mode: 'parallel' });

  for (const width of [320, 390]) {
    for (const [name, route] of Object.entries({ ...PAGE_TYPES, 'not-found': 'no-such-page/' })) {
      test(`${name} @${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
        await page.goto(route, { waitUntil: 'load' });
        await snap(page, `${name}-${width}`);
      });
    }
  }

  test('מצב לרוחב', async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    for (const [name, route] of Object.entries({ home: '', rights: 'rights/', right: 'rights/lone-soldier/' })) {
      await page.goto(route, { waitUntil: 'load' });
      await snap(page, `${name}-landscape`);
    }
  });

  test('מחשב', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const [name, route] of Object.entries({ home: '', rights: 'rights/', right: 'rights/lone-soldier/', bank: 'guides/banks/leumi/' })) {
      await page.goto(route, { waitUntil: 'load' });
      await snap(page, `${name}-desktop`);
    }
  });

  test('תנועה מופחתת', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [name, route] of Object.entries({ home: '', right: 'rights/lone-soldier/', walkthrough: 'guides/tash-btouch-steps/' })) {
      await page.goto(route, { waitUntil: 'load' });
      await snap(page, `${name}-reduced-motion`);
    }
  });

  test('חיפוש בעמוד: הצעות, תוצאות, בלי תוצאות, סינון', async ({ page }) => {
    await page.goto('rights/', { waitUntil: 'load' });
    await page.locator('#q').focus();
    await snap(page, 'state-rights-suggest');
    await page.locator('#q').fill('חופש');
    await page.locator('#list mark').first().waitFor();
    await snap(page, 'state-rights-query');
    await page.locator('#q').fill('zzzzqq');
    await page.locator('[data-ps-empty] a').waitFor();
    await snap(page, 'state-rights-empty');
    await page.locator('#q').fill('');
    await page.locator('h1').click();
    await page.locator('[data-cat="holidays"]').click();
    await snap(page, 'state-rights-chip');
  });

  test('חיפוש כללי: תוצאות, קרובות, בלי תוצאות', async ({ page }) => {
    await page.goto(`search/?q=${encodeURIComponent('חופשה')}`, { waitUntil: 'load' });
    await page.locator('#results .result').first().waitFor();
    await snap(page, 'state-search-results');
    await page.goto(`search/?q=${encodeURIComponent('חופשה zzzzqq')}`, { waitUntil: 'load' });
    await page.locator('#results .result').first().waitFor();
    await snap(page, 'state-search-near');
    await page.goto('search/?q=zzzzqq', { waitUntil: 'load' });
    await page.locator('.empty-actions').waitFor();
    await snap(page, 'state-search-empty');
  });

  test('אנשי קשר: חלון איש קשר וסינון', async ({ page }) => {
    await page.goto('contacts/', { waitUntil: 'load' });
    await page.locator('[data-fw="lahav"]').click();
    await snap(page, 'state-contacts-chip');
    await page.locator('[data-open]:visible').first().click();
    await page.locator('#sheet[open]').waitFor();
    await snap(page, 'state-contacts-sheet');
  });

  test('הדרכה פתוחה', async ({ page }) => {
    for (const [name, route] of Object.entries({ home: '', right: 'rights/lone-soldier/' })) {
      await page.goto(route, { waitUntil: 'load' });
      await page.locator('.help-btn').click();
      await page.locator('dialog.tour').waitFor();
      await snap(page, `state-tour-${name}`);
    }
  });

  test('עמוד זכות: הכול פתוח, מסמך מסומן', async ({ page }) => {
    await page.goto('rights/financial-aid/', { waitUntil: 'load' });
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    await page.locator('.checklist input[type=checkbox]').first().check();
    await snap(page, 'state-right-open');
  });

  test('מדריך מצולם: הגדלת תמונה', async ({ page }) => {
    await page.goto('guides/tash-btouch-steps/', { waitUntil: 'load' });
    await page.locator('[data-zoom]').first().click();
    await page.locator('#wt-zoom[open]').waitFor();
    await snap(page, 'state-zoom');
  });

  test('שאלון: שאלה, תוצאה, בלי תוצאה', async ({ page }) => {
    await page.goto('guide-me/', { waitUntil: 'load' });
    await page.locator('[data-branch="money"]').click();
    await snap(page, 'state-quiz-question');
    for (let i = 0; i < 6 && (await page.locator('#options [data-k]').count()) > 0; i++) await page.locator('#options [data-k]').first().click();
    await snap(page, 'state-quiz-result');
    await page.locator('#restart').click();
    await page.locator('[data-branch="other"]').click();
    await snap(page, 'state-quiz-empty');
  });

  test('שאלה נפוצה ומושג כיעד של קישור ישיר, ובנק במצב מחשב', async ({ page }) => {
    await page.goto('faq/', { waitUntil: 'load' });
    const id = await page.locator('details.acc[id^="q-"]').first().getAttribute('id');
    await page.goto(`faq/#${id}`, { waitUntil: 'load' });
    await snap(page, 'state-faq-target');
    await page.goto('guides/banks/leumi/?doc=balance', { waitUntil: 'load' });
    await page.locator('[data-device="pc"]').click();
    await snap(page, 'state-bank-pc-doc');
    await page.goto('guides/banks/?doc=balance', { waitUntil: 'load' });
    await snap(page, 'state-banks-doc');
  });
});

// מסך הפתיחה: בלי הדילוג שבשאר הבדיקות
base.describe('צילום סגנונות: מסך הפתיחה', () => {
  base.skip(!LABEL, 'רץ רק עם STYLES=שם');
  base('מסך הפתיחה מוצג', async ({ page }) => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.locator('html.splash-on').waitFor();
    await snap(page, 'state-splash');
  });
});
