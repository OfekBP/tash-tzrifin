/** נירמול טקסט עברי לחיפוש. משותף לשרת (בניית אינדקס) ולדפדפן (שאילתות). */

const NIQQUD = /[֑-ׇ]/g;
const QUOTES = /["'״׳`´“”‘’]/g;
const PUNCT = /[\s,.;:!?/()\[\]{}\-–—_|]+/;
const PREFIXES = 'הוכלמבש';

export function normalize(s: string): string {
  return s.normalize('NFKC').replace(NIQQUD, '').replace(QUOTES, '').toLowerCase();
}

/** מילות הטקסט אחרי נירמול, כפי שנכתבו (בלי גרסאות נוספות). */
export function words(s: string): string[] {
  return normalize(s).split(PUNCT).filter(Boolean);
}

/** המילה עצמה, ולמילה עברית ארוכה גם הגרסה בלי אות שימוש (ה/ב/ל...) בתחילתה. */
export function variants(t: string): string[] {
  return t.length > 3 && PREFIXES.includes(t[0]) ? [t, t.slice(1)] : [t];
}

/** מפרק לטוקנים לאינדקס: כל מילה עם כל הגרסאות שלה. */
export function tokenize(s: string): string[] {
  return words(s).flatMap(variants);
}
