/** נירמול טקסט עברי לחיפוש. משותף לשרת (בניית אינדקס) ולדפדפן (שאילתות). */

const NIQQUD = /[֑-ׇ]/g;
const QUOTES = /["'״׳`´“”‘’]/g;
const PUNCT = /[\s,.;:!?/()\[\]{}\-–—_|]+/;
const PREFIXES = 'הוכלמבש';
const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * בלי ניקוד ובלי גרשיים, באותיות קטנות, ואות סופית הופכת לאות רגילה (כדי ש"מסמך" ו"מסמכים" יתחילו אותו דבר).
 * אורך הטקסט נשמר, חוץ מניקוד וגרשיים שנעלמים.
 */
export function normalize(s: string): string {
  return s.normalize('NFKC').replace(NIQQUD, '').replace(QUOTES, '').toLowerCase().replace(/[ךםןףץ]/g, (c) => FINALS[c]);
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

/** הופך טקסט לבטוח להכנסה לתוך HTML */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
