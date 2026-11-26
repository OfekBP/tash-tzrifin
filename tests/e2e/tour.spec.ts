// ההדרכה (כפתור ה-?) נפתחת בכל סוג עמוד, כל צעד נכנס במסך, והיא נסגרת בסוף בלי שגיאות.
import { PAGE_TYPES, expect, test, watchErrors } from './helpers';

const PAGES = { ...PAGE_TYPES, 'not-found': 'rights/no-such-right/' };
const SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
];

for (const size of SIZES) {
  test.describe(`${size.width}px`, () => {
    test.use({ viewport: size });

    for (const [name, route] of Object.entries(PAGES)) {
      test(`הדרכה: ${name}`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(route);
        await page.locator('.help-btn').click();
        const dlg = page.locator('dialog.tour');
        await expect(dlg).toBeVisible();
        // בלי אנימציה, כדי שהמדידה לא תתפוס את ההדגשה באמצע תנועה
        await page.addStyleTag({ content: '.tour-spot{transition:none!important}' });

        let steps = 0;
        for (; steps < 15 && (await dlg.count()) > 0; steps++) {
          await expect(dlg.locator('.tour-count')).toHaveText(/^[1-9]\d* מתוך [1-9]\d*$/);
          await expect(dlg.locator('#tour-title')).not.toBeEmpty();
          const box = await page.evaluate(() => {
            const card = document.querySelector('.tour-card')!.getBoundingClientRect();
            const spot = document.querySelector('.tour-spot')!.getBoundingClientRect();
            const overlap = spot.width ? Math.max(0, Math.min(card.bottom, spot.bottom) - Math.max(card.top, spot.top)) : 0;
            return { top: card.top, bottom: card.bottom, left: card.left, right: card.right, overlap, vh: innerHeight, vw: innerWidth };
          });
          expect(box.top, 'כרטיס ההסבר בתוך המסך').toBeGreaterThanOrEqual(0);
          expect(box.bottom, 'כרטיס ההסבר בתוך המסך').toBeLessThanOrEqual(box.vh + 1);
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(box.vw + 1);
          expect(box.overlap, 'הכרטיס לא מכסה את החלק המודגש').toBeLessThanOrEqual(8);
          await dlg.locator('.tour-next').click();
        }
        await expect(dlg).toHaveCount(0);
        expect(steps).toBeGreaterThan(0);
        // עמוד ה-404 עצמו מחזיר 404, וזו לא תקלה
        expect(errors.filter((e) => !(name === 'not-found' && /404/.test(e)))).toEqual([]);
      });
    }
  });
}
