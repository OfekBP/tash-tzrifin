// בדיקות יחידה לנירמול הטקסט של החיפוש (src/lib/text.ts). הרצה: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, tokenize, variants, words } from '../../src/lib/text.ts';

test('normalize: גרשיים, ניקוד ואותיות לטיניות', () => {
  assert.equal(normalize('ת״ש'), 'תש');
  assert.equal(normalize("מש'קית"), 'משקית');
  assert.equal(normalize('שָׁלוֹם'), 'שלום');
  assert.equal(normalize('AI'), 'ai');
});

test('words: פיצול לפי רווחים וסימני פיסוק, בלי גרסאות נוספות', () => {
  assert.deepEqual(words('שכר דירה, חופשה'), ['שכר', 'דירה', 'חופשה']);
  assert.deepEqual(words('  ריכוז-יתרות / עו״ש  '), ['ריכוז', 'יתרות', 'עוש']);
  assert.deepEqual(words(''), []);
});

test('variants: מילה ארוכה שמתחילה באות שימוש מקבלת גם גרסה בלעדיה', () => {
  assert.deepEqual(variants('הלוואה'), ['הלוואה', 'לוואה']);
  assert.deepEqual(variants('בבנק'), ['בבנק', 'בנק']);
  assert.deepEqual(variants('בנק'), ['בנק']); // קצרה מדי
  assert.deepEqual(variants('חופשה'), ['חופשה']); // לא מתחילה באות שימוש
});

test('tokenize: כל מילה עם כל הגרסאות שלה', () => {
  assert.deepEqual(tokenize('לשחרור מוקדם'), ['לשחרור', 'שחרור', 'מוקדם', 'וקדם']);
  assert.deepEqual(tokenize('ת״ש בטאצ׳'), ['תש', 'בטאצ', 'טאצ']);
});
