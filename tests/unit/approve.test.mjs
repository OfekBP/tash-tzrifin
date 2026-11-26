// בדיקות יחידה לסקריפט אישור התוכן (הפונקציה הטהורה בלבד, בלי לגעת בקבצי תוכן). הרצה: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { approve } from '../../scripts/approve-content.mjs';

const today = '2026-11-26';

test('שורת סטטוס עם הערה בסופה מאושרת, ושדות האישור נוספים אחריה', () => {
  const out = approve('---\ntitle: x\nstatus: reviewed  # draft | reviewed | approved\norigin: official\n---\nbody\n', 'שם "מלא"', today, false);
  assert.equal(out, '---\ntitle: x\nstatus: approved\napprovedBy: "שם \\"מלא\\""\napprovedOn: 2026-11-26\norigin: official\n---\nbody\n');
});

test('שדות אישור קיימים מוחלפים ולא משוכפלים', () => {
  const out = approve('status: reviewed\napprovedBy: "ישן"\napprovedOn: 2025-01-01\nlastVerified: 2025-01-01\n', 'חדש', today, false);
  assert.equal(out, 'status: approved\napprovedBy: "חדש"\napprovedOn: 2026-11-26\nlastVerified: 2025-01-01\n');
});

test('אין מה לאשר: מוחזר null', () => {
  assert.equal(approve('status: draft\n', 'x', today, false), null);
  assert.equal(approve('status: approved\nguideStatus: draft\n', 'x', today, true), null);
  assert.equal(approve('guideStatus: reviewed\n', 'x', today, false), null); // לא בנק
});

test('בנק: רק המדריך הכתוב', () => {
  const out = approve('name: בנק\nguideStatus: reviewed\nstatus: approved\napprovedBy: "א"\napprovedOn: 2026-01-01\n', 'ב', today, true);
  assert.equal(out, 'name: בנק\nguideStatus: approved\nguideApprovedBy: "ב"\nstatus: approved\napprovedBy: "א"\napprovedOn: 2026-01-01\n');
});

test('בנק: סטטוס כללי ומדריך יחד, וסיומות השורה נשמרות', () => {
  const out = approve('name: בנק\r\nstatus: reviewed\r\nguideStatus: reviewed # x\r\n', 'ב', today, true);
  assert.equal(out, 'name: בנק\r\nstatus: approved\r\napprovedBy: "ב"\r\napprovedOn: 2026-11-26\r\nguideStatus: approved\r\nguideApprovedBy: "ב"\r\n');
});
