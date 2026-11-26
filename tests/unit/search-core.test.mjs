// בדיקות יחידה לליבת החיפוש (src/lib/search-core.ts): שורשים, מילות קישור, מילים נרדפות ודירוג. הרצה: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightTerms, makeDoc, parseQuery, rank, stem } from '../../src/lib/search-core.ts';

test('stem: צורות של אותה מילה מקבלות אותו שורש', () => {
  assert.equal(stem('חופשה'), 'חופש');
  assert.equal(stem('חופשות'), 'חופש');
  assert.equal(stem('חופש'), 'חופש');
  assert.equal(stem('זכות'), stem('זכויות'));
  assert.equal(stem('מסמכימ'), 'מסמכ'); // אחרי נירמול: ם סופית כבר הפכה ל-מ
  assert.equal(stem('בית'), 'בית'); // קצרה מדי בשביל להסיר סיומת
  assert.equal(stem('ai'), 'ai'); // לא עברית
});

test('parseQuery: מילות קישור מושמטות, אלא אם אין שום דבר אחר', () => {
  assert.deepEqual(parseQuery('אבד לי ציוד').words.map((w) => w.typed), ['אבד', 'ציוד']);
  assert.deepEqual(parseQuery('אני צריך כסף').words.map((w) => w.typed), ['כספ']);
  assert.deepEqual(parseQuery('מה יש לי').words.map((w) => w.typed), ['מה', 'יש', 'לי']);
  assert.deepEqual(parseQuery('   ').words, []);
});

test('parseQuery: מילים נרדפות נוספות במשקל נמוך, גם למילה ברבים או עם אות שימוש', () => {
  const alts = (q) => Object.fromEntries(parseQuery(q).words[0].alts.map((a) => [a.term, a.weight]));
  assert.equal(alts('כסף')['כלכלי'], 0.6);
  assert.equal(alts('כסף')['כספ'], 1);
  assert.equal(alts('חתונה')['נשוי'], 0.6);
  assert.equal(alts('חתונות')['נשוי'], 0.6);
  assert.equal(alts('לחתונה')['נשוי'], 0.6);
  assert.equal(alts('בנק')['כלכלי'], undefined);
});

test('highlightTerms: המילה, הגרסה בלי אות שימוש והשורש', () => {
  const terms = highlightTerms(parseQuery('בחופשות'));
  for (const t of ['בחופשות', 'חופשות', 'חופש']) assert.ok(terms.includes(t), t);
});

const items = [
  { id: 'leave', doc: makeDoc('חופשות מיוחדות', 'חופשה מיוחדת חופשת לימודים', 'חופשה כלכלית, אישית, ללימודים') },
  { id: 'aid', doc: makeDoc('סיוע כלכלי', 'מצוקה כלכלית תווי קנייה הלוואה מידית', 'סיוע לחייל במצוקה כלכלית') },
  { id: 'married', doc: makeDoc('חייל נשוי וחייל הורה', 'נשוי הורה נישואין מענק נישואין', 'מענק נישואין והקלות') },
  { id: 'lost', doc: makeDoc('אובדן ציוד אישי', 'אובדן ציוד נזק לציוד טלפון שאבד', 'פיצוי על ציוד אישי') },
  { id: 'dental', doc: makeDoc('פרוטזות ואורתודנטיה', 'שיניים כתרים שתלים', 'הפניה לטיפול שיניים', 'המלצת רופא שיניים צבאי') },
  { id: 'faq', doc: makeDoc('האם חופשה מיוחדת יורדת מהחופשה השנתית?', 'חופשות', 'לא.') },
];
const top = (q, boost) => rank(items, (i) => i.doc, q, boost).hits.map((i) => i.id);

test('rank: צורות שונות של אותה מילה מוצאות את אותו עמוד', () => {
  for (const q of ['חופשה', 'חופשות', 'חופש', 'בחופשה']) assert.ok(top(q).includes('leave'), q);
});

test('rank: מילים נרדפות, מילות קישור, שגיאת הקלדה ואות שימוש', () => {
  assert.equal(top('כסף')[0], 'aid');
  assert.equal(top('חתונה')[0], 'married');
  assert.equal(top('אבד לי ציוד')[0], 'lost');
  assert.equal(top('רופא שיניים')[0], 'dental');
  assert.equal(top('הלואה')[0], 'aid'); // חסרה ו׳
  assert.equal(top('להלוואה')[0], 'aid');
});

test('rank: כל המילים חייבות להתאים, ואם אין התאמה מלאה מוחזרות תוצאות קרובות', () => {
  const strict = rank(items, (i) => i.doc, 'אובדן ציוד');
  assert.equal(strict.partial, false);
  assert.deepEqual(strict.hits.map((i) => i.id), ['lost']);

  const partial = rank(items, (i) => i.doc, 'חופשה zzzz');
  assert.equal(partial.partial, true);
  assert.ok(partial.hits.some((i) => i.id === 'leave'));

  const none = rank(items, (i) => i.doc, 'zzzz');
  assert.deepEqual(none, { hits: [], partial: false });
});

test('rank: boost מעלה סוג תוכן מועדף כשההתאמה דומה', () => {
  const boost = (i) => (i.id === 'leave' ? 1.6 : 1);
  assert.equal(top('חופשה', boost)[0], 'leave');
});
