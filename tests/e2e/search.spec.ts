// החיפוש הכללי והחיפוש בתוך העמודים.
import { expect, test } from './helpers';

test.describe('חיפוש כללי', () => {
  /**
   * טבלת הזהב: שאילתה אמיתית ← התוצאה שחייבת להופיע ראשונה (או בין הראשונות).
   * כוללת את מה שחיילים באמת מקלידים: צורות רבים, אותיות שימוש, שגיאות הקלדה, מילים נרדפות ומילות קישור.
   */
  const first: [string, RegExp][] = [
    ['חופשה', /חופשות מיוחדות/],
    ['חופשות', /חופשות מיוחדות/],
    ['חופש', /חופשות מיוחדות/],
    ['בחופשה', /חופשות מיוחדות/], // אות שימוש
    ['שכר דירה', /שכר דירה/],
    ['לאומי', /בנק לאומי/],
    ['ריכוז יתרות', /אישורים מהבנק/],
    ['עטודאים', /עתודאים/], // שגיאת הקלדה
    ['לשחרור', /שחרור|קיצור שירות/], // אות שימוש
    ['כסף', /סיוע כלכלי/], // מילה נרדפת
    ['אני צריך כסף', /סיוע כלכלי/], // מילות קישור
    ['חתונה', /חייל נשוי/], // מילה נרדפת
    ['רופא שיניים', /טיפול שיניים/],
    ['אבד לי ציוד', /אובדן ציוד/],
    ['אמא חולה', /הקלות בתנאי שירות/],
    ['תלוש', /מסמכים כלכליים/],
    ['משקית', /אנשי קשר/],
    ['וואטסאפ', /אנשי קשר/],
    ['מינוס', /סיוע כלכלי/],
    ['תשמש', /תשלומי משפחה/],
    ['שאלות', /שאלות נפוצות/],
  ];
  for (const [query, expected] of first) {
    test(`"${query}" מוביל קודם כול ל-${expected.source}`, async ({ page }) => {
      await page.goto(`search/?q=${encodeURIComponent(query)}`);
      await expect(page.locator('#results .result').first().locator('.t')).toHaveText(expected);
    });
  }

  /** שאילתה ← טקסט שחייב להופיע איפשהו בתוצאות. */
  const cases: [string, RegExp][] = [
    ['בבנק', /בנק/],
    ['אבד ציוד', /אובדן ציוד/],
    ['מענק', /סיוע כלכלי|חייל/],
    ['אופק', /איש קשר/],
  ];

  for (const [query, expected] of cases) {
    test(`"${query}" מוצא תוצאה מתאימה`, async ({ page }) => {
      await page.goto(`search/?q=${encodeURIComponent(query)}`);
      await expect(page.locator('#results .result').first()).toBeVisible();
      await expect(page.locator('#results')).toContainText(expected);
    });
  }

  test('שאילתה בלי תוצאות מציגה הודעה, שלושה כפתורי המשך, והספירה מוקראת', async ({ page }) => {
    await page.goto('search/?q=zzzzqq');
    await expect(page.locator('#results .empty')).toBeVisible();
    await expect(page.locator('#count')).toHaveText('לא נמצאו תוצאות');
    await expect(page.locator('.empty-actions a')).toHaveCount(3);
    await page.locator('.empty-actions a', { hasText: 'כל הזכויות' }).click();
    await expect(page).toHaveURL(/\/rights\/$/);
  });

  test('כשאין התאמה לכל המילים מוצגות תוצאות קרובות, עם הסבר', async ({ page }) => {
    await page.goto(`search/?q=${encodeURIComponent('חופשה zzzzqq')}`);
    await expect(page.locator('#near')).toBeVisible();
    await expect(page.locator('#results .result').first()).toContainText('חופש');
  });

  test('תוצאה של שאלה נפוצה מובילה ישר לשאלה ופותחת אותה', async ({ page }) => {
    await page.goto(`search/?q=${encodeURIComponent('תווי הקנייה שלי נמחקים')}`);
    const hit = page.locator('#results .result', { hasText: 'תווי הקנייה שלי נמחקים' }).first();
    await expect(hit).toHaveAttribute('href', /\/faq\/#q-/);
    await hit.click();
    await expect(page).toHaveURL(/\/faq\/#q-/);
    const target = page.locator('details.acc:target');
    await expect(target).toHaveAttribute('open', '');
    await expect(target).toBeInViewport();
  });

  test('תוצאה של מושג מובילה ישר למושג במילון', async ({ page }) => {
    await page.goto(`search/?q=${encodeURIComponent('רמת פעילות')}`);
    const hit = page.locator('#results .result[href*="/glossary/#t-"]').first();
    await hit.click();
    await expect(page.locator('#list .row:target')).toBeInViewport();
  });

  test('השדה מוכן להקלדה בכניסה, והכתובת מתעדכנת', async ({ page }) => {
    await page.goto('search/');
    await expect(page.locator('#q')).toBeFocused();
    await page.locator('#q').fill('לאומי');
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.locator('#count')).toHaveText(/נמצא/);
  });
});

test.describe('חיפוש בעמוד', () => {
  const shown = '#groups [data-person]:not([hidden])';

  test('אנשי קשר: חיפוש לפי שם יחידה מוצא אנשים', async ({ page }) => {
    await page.goto('contacts/');
    for (const unit of ['אופק', '324', 'להב']) {
      await page.locator('#q').fill(unit);
      await expect(page.locator(shown).first(), unit).toBeVisible();
      await expect(page.locator('[data-ps-empty]')).toBeHidden();
    }
  });

  test('אנשי קשר: כל הצעת חיפוש של העמוד מחזירה תוצאות', async ({ page }) => {
    await page.goto('contacts/');
    const chips = page.locator('#ps-suggest [data-q]');
    const n = await chips.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await page.locator('#q').fill('');
      await page.locator('#q').focus();
      await chips.nth(i).click();
      await expect(page.locator('#q')).not.toHaveValue('');
      await expect(page.locator(shown).first()).toBeVisible();
    }
  });

  test('זכויות: מילה עם גרשיים מודגשת, והסינון נשמר בכתובת וברענון', async ({ page }) => {
    await page.goto('rights/');
    await page.locator('#q').fill('הת״ש');
    await expect(page.locator('#list mark').first()).toHaveText('הת״ש');
    await expect(page.locator('#ps-count')).toHaveText(/תוצא/);

    await page.locator('#q').fill('');
    await expect(page).not.toHaveURL(/[?&]q=/); // הכתובת מתעדכנת רגע אחרי ההקלדה
    await page.locator('h1').click(); // יוצאים מהשדה: הצעות החיפוש נסגרות ומפנות את שורת הנושאים
    await expect(page.locator('#ps-suggest')).toBeHidden();
    await page.locator('[data-cat="holidays"]').click();
    await expect(page).toHaveURL(/[?&]cat=holidays/);
    const filtered = await page.locator('#list > a:not([hidden])').count();
    await page.reload();
    await expect(page.locator('[data-cat="holidays"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#list > a:not([hidden])')).toHaveCount(filtered);
  });

  test('זכויות: חיפוש שלא מוצא מציע לחפש בכל האתר', async ({ page }) => {
    await page.goto('rights/');
    await page.locator('#q').fill('zzzzqq');
    await expect(page.locator('[data-ps-empty] a')).toHaveAttribute('href', /search\/\?q=zzzzqq/);
  });

  for (const width of [320, 360, 375]) {
    test(`טקסט הרמז בשדה החיפוש נכנס במלואו ב-${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      for (const route of ['rights/', 'guides/', 'guides/banks/', 'faq/', 'glossary/', 'contacts/', 'search/']) {
        await page.goto(route);
        const fits = await page.evaluate(async () => {
          await document.fonts.ready;
          const q = document.getElementById('q') as HTMLInputElement;
          const cs = getComputedStyle(q);
          const ph = getComputedStyle(q, '::placeholder');
          const ctx = document.createElement('canvas').getContext('2d')!;
          ctx.font = `${ph.fontWeight} ${ph.fontSize} ${ph.fontFamily}`;
          // רוחב אזור הטקסט: רוחב השדה פחות מסגרת וריפוד (clientWidth של שדה קלט אינו עקבי בין דפדפנים)
          const px = (v: string) => parseFloat(v) || 0;
          const room = q.getBoundingClientRect().width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - px(cs.paddingLeft) - px(cs.paddingRight);
          return ctx.measureText(q.placeholder).width <= room;
        });
        expect(fits, route).toBe(true);
      }
    });
  }

  test('אנשי קשר: שורת תתי-היחידות מוצגת במלואה גם ב-320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('contacts/');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.prow .row .s')].filter((s) => s.scrollHeight > s.clientHeight + 1).length);
    expect(clipped).toBe(0);
  });

  test('אנשי קשר: המסגרת שנבחרה נשמרת בכתובת', async ({ page }) => {
    await page.goto('contacts/');
    await page.locator('[data-fw="lahav"]').click();
    await expect(page).toHaveURL(/[?&]fw=lahav/);
    await page.reload();
    await expect(page.locator('[data-fw="lahav"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
