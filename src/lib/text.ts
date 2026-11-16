/** נירמול טקסט עברי לחיפוש. משותף לשרת (בניית אינדקס) ולדפדפן (שאילתות). */

const NIQQUD = /[֑-ׇ]/g;
const QUOTES = /["'״׳`´“”‘’]/g;
const PUNCT = /[\s,.;:!?/()\[\]{}\-–—_|]+/;
const PREFIXES = 'הוכלמבש';

export function normalize(s: string): string {
  return s.normalize('NFKC').replace(NIQQUD, '').replace(QUOTES, '').toLowerCase();
}

/** מפרק לטוקנים. עבור מילים עבריות ארוכות מוסיף גם גרסה בלי אות שימוש (ה/ב/ל...) בתחילת המילה. */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const t of normalize(s).split(PUNCT)) {
    if (!t) continue;
    out.push(t);
    if (t.length > 3 && PREFIXES.includes(t[0]) && /[א-ת]/.test(t[0])) out.push(t.slice(1));
  }
  return out;
}
