// מסלולים: חלונות וכפתור החזרה של המכשיר, השאלון, רשימת המסמכים, הסרגל התחתון ומסך הפתיחה.
import fs from 'node:fs';
import { parse } from 'yaml';
import { base, expect, test } from './helpers';

const modalState = () => (history.state && typeof history.state === 'object' ? (history.state.modal ?? null) : null);

test.describe('כפתור החזרה של המכשיר סוגר חלון פתוח', () => {
  test('חלון איש קשר', async ({ page }) => {
    await page.goto('contacts/');
    const sheet = page.locator('#sheet');
    const first = page.locator('[data-open]').first();

    await first.click();
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/contacts\/$/);

    // סגירה רגילה מסירה את רשומת ההיסטוריה שנוספה
    await first.click();
    await page.locator('#sheet-close').click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => page.evaluate(modalState)).toBeNull();

    // רענון כשהחלון פתוח לא משאיר לחיצת "חזרה" מתה
    await first.click();
    await expect(sheet).toBeVisible();
    await page.reload();
    await expect.poll(() => page.evaluate(modalState)).toBeNull();
    await expect(page).toHaveURL(/\/contacts\/$/);
  });

  test('הגדלת תמונה במדריך', async ({ page }) => {
    await page.goto('guides/tash-btouch-steps/');
    const zoom = page.locator('#wt-zoom');
    await page.locator('[data-zoom]').first().click();
    await expect(zoom).toBeVisible();
    await page.goBack();
    await expect(zoom).toBeHidden();
    await expect(page).toHaveURL(/tash-btouch-steps\/$/);

    await page.locator('[data-zoom]').first().click();
    await page.locator('#wt-zoom-x').click();
    await expect(zoom).toBeHidden();
    await expect.poll(() => page.evaluate(modalState)).toBeNull();
  });

  test('ההדרכה', async ({ page }) => {
    await page.goto('rights/');
    await page.locator('.help-btn').click();
    await expect(page.locator('dialog.tour')).toBeVisible();
    await page.goBack();
    await expect(page.locator('dialog.tour')).toHaveCount(0);
    await expect(page).toHaveURL(/\/rights\/$/);

    await page.locator('.help-btn').click();
    await page.locator('.tour-x').click();
    await expect(page.locator('dialog.tour')).toHaveCount(0);
    await expect.poll(() => page.evaluate(modalState)).toBeNull();
  });
});

test.describe('השאלון', () => {
  const branches = (parse(fs.readFileSync('src/data/quiz.yaml', 'utf8')) as { id: string }[]).map((b) => b.id);

  for (const id of branches) {
    test(`ענף ${id} מסתיים עם לאן להמשיך`, async ({ page }) => {
      await page.goto('guide-me/');
      await page.locator(`[data-branch="${id}"]`).click();
      // עונים תמיד את התשובה הראשונה, עד שמגיעים לתוצאה
      for (let i = 0; i < 10 && (await page.locator('#options [data-k]').count()) > 0; i++) {
        await page.locator('#options [data-k]').first().click();
      }
      await expect(page.locator('#step-title')).toHaveText(/כדאי/);
      await expect(page.locator('#options a[href]').first()).toBeVisible();
      await expect(page.locator('#quiz-nav')).toBeVisible();
    });
  }

  test('רענון באמצע ממשיך מאותה שאלה, וחזרה מחזירה שאלה אחת', async ({ page }) => {
    await page.goto('guide-me/');
    const title = page.locator('#step-title');
    await page.locator('[data-branch="money"]').click();
    const first = await title.textContent();
    await page.locator('#options [data-k]').first().click();
    await expect(title).not.toHaveText(first!);
    const second = await title.textContent();

    await page.reload();
    await expect(title).toHaveText(second!);
    await page.goBack();
    await expect(title).toHaveText(first!);
  });
});

test.describe('עמוד זכות', () => {
  test('סימון מסמך נשמר אחרי רענון, והסרגל התחתון לא נעלם', async ({ page }) => {
    await page.goto('rights/private-work-permit/');
    const box = page.locator('.checklist input[type=checkbox]').first();
    await box.scrollIntoViewIfNeeded();
    await box.check();
    await expect(box).toBeFocused();
    await expect(page.locator('.dock')).toBeVisible();
    await page.reload();
    await expect(page.locator('.checklist input[type=checkbox]').first()).toBeChecked();
  });

  test('בזמן הקלדה בחיפוש הסרגל התחתון מפנה מקום', async ({ page }) => {
    await page.goto('rights/');
    await page.locator('#q').click();
    await expect(page.locator('.dock')).toBeHidden();
    await page.locator('h1').click();
    await expect(page.locator('.dock')).toBeVisible();
  });

  test('חץ החזרה מחזיר לרשימה', async ({ page }) => {
    await page.goto('rights/');
    await page.locator('#list > a').first().click();
    await expect(page).toHaveURL(/\/rights\/[a-z-]+\/$/);
    await page.locator('[data-back]').click();
    await expect(page).toHaveURL(/\/rights\/(\?.*)?$/);
  });
});

// בלי הדילוג על מסך הפתיחה שבשאר הבדיקות
base('מסך הפתיחה מופיע פעם אחת בכניסה, ונעלם תוך כמה שניות', async ({ page }) => {
  await page.goto('');
  const html = page.locator('html');
  await expect(html).toHaveClass(/splash-on/);
  await expect(page.locator('#splash')).toBeVisible();
  await expect(html).not.toHaveClass(/splash-on/, { timeout: 4500 });
  await expect(page.locator('.bento')).toBeVisible();

  await page.goto('rights/');
  await expect(html).not.toHaveClass(/splash-on/);
});
