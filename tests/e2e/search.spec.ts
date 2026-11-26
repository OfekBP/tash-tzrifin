// החיפוש הכללי והחיפוש בתוך העמודים.
import { expect, test } from './helpers';

test.describe('חיפוש כללי', () => {
  /** שאילתה ← טקסט שחייב להופיע בתוצאות. שאילתות אמיתיות, כולל אותיות שימוש ושגיאות הקלדה. */
  const cases: [string, RegExp][] = [
    ['חופשה', /חופשות מיוחדות/],
    ['שכר דירה', /דיור|חייל בודד/],
    ['לאומי', /לאומי/],
    ['ריכוז יתרות', /אישורים/],
    ['הלואה', /סיוע כלכלי/], // שגיאת הקלדה
    ['בבנק', /בנק/], // אות שימוש
    ['לשחרור', /קיצור שירות/], // אות שימוש
    ['אבד ציוד', /אובדן ציוד/],
    ['מענק', /סיוע כלכלי|חייל/],
  ];

  for (const [query, expected] of cases) {
    test(`"${query}" מוצא תוצאה מתאימה`, async ({ page }) => {
      await page.goto(`search/?q=${encodeURIComponent(query)}`);
      await expect(page.locator('#results .result').first()).toBeVisible();
      await expect(page.locator('#results')).toContainText(expected);
    });
  }

  test('שאילתה בלי תוצאות מציגה הודעה, והספירה מוקראת', async ({ page }) => {
    await page.goto('search/?q=zzzzqq');
    await expect(page.locator('#results .empty')).toBeVisible();
    await expect(page.locator('#count')).toHaveText('לא נמצאו תוצאות');
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

  test('אנשי קשר: המסגרת שנבחרה נשמרת בכתובת', async ({ page }) => {
    await page.goto('contacts/');
    await page.locator('[data-fw="lahav"]').click();
    await expect(page).toHaveURL(/[?&]fw=lahav/);
    await page.reload();
    await expect(page.locator('[data-fw="lahav"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
