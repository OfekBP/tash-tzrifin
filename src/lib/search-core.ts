/**
 * ליבת החיפוש, בלי תלות בדפדפן. אותה לוגיקה משמשת את החיפוש הכללי (search.astro)
 * ואת החיפוש שבתוך העמודים (page-search.ts), ולכן שניהם מתנהגים אותו דבר.
 *
 * איך מילה שהוקלדה מתאימה למילה בתוכן, מהחזק לחלש:
 *   זהה (10) · תחילת מילה (7) · אותו שורש, למשל חופשה/חופשות (5) · בתוך מילה (3) · שגיאת הקלדה אחת (2)
 * התאמה בכותרת שווה פי 3, במילות המפתח פי 2, בתקציר ובגוף פי 1.
 * כל מילה בשאילתה חייבת להתאים. אם אין אף תוצאה כזו, מוחזרות תוצאות קרובות (partial).
 */
// הסיומת .ts מפורשת כדי שבדיקות היחידה (node --test) יוכלו לטעון את הקובץ בלי כלי בנייה
import { normalize, tokenize, variants, words } from './text.ts';
import { SYNONYMS } from '../data/synonyms.ts';

const HEBREW = /^[א-ת]+$/;
/** סיומות נפוצות, אחרי נירמול (ם סופית כבר הפכה ל-מ). הארוכה נבדקת קודם. */
const SUFFIXES = ['יות', 'ות', 'ימ', 'ה', 'ת', 'י'];
const stemCache = new Map<string, string>();

/** שורש מקורב: מסיר סיומת נפוצה אחת (רבים, נקבה, שייכות) ממילה עברית, כל עוד נשארות לפחות 3 אותיות. */
export function stem(word: string): string {
  let s = stemCache.get(word);
  if (s !== undefined) return s;
  s = word;
  if (word.length >= 4 && HEBREW.test(word)) {
    const suffix = SUFFIXES.find((x) => word.endsWith(x) && word.length - x.length >= 3);
    if (suffix) s = word.slice(0, -suffix.length);
  }
  stemCache.set(word, s);
  return s;
}

/** מילות קישור שלא עוזרות למצוא תוכן. מושמטות מהשאילתה, אלא אם היא מורכבת רק מהן. */
const STOP = new Set(
  ['לי', 'של', 'שלי', 'אני', 'יש', 'אין', 'איך', 'מה', 'מי', 'על', 'עם', 'את', 'אם', 'או', 'זה', 'זו', 'האם', 'כמה', 'גם', 'כל', 'הוא', 'היא', 'אפשר', 'צריך', 'צריכה', 'רוצה', 'לקבל'].map(normalize),
);

const synonyms = new Map<string, string[]>();
for (const [keys, values] of Object.entries(SYNONYMS)) {
  const targets = values.flatMap((v) => words(v));
  for (const key of words(keys)) synonyms.set(stem(key), [...(synonyms.get(stem(key)) ?? []), ...targets]);
}
/** מילים נרדפות למילה שהוקלדה, גם כשהיא ברבים או עם אות שימוש. */
function synonymsFor(word: string): string[] {
  for (const v of variants(word)) {
    const hit = synonyms.get(stem(v));
    if (hit) return hit;
  }
  return [];
}

export type SearchDoc = { t: string[]; k: string[]; s: string[]; b: string[] };

/** מסמך לחיפוש: כותרת, מילות מפתח, תקציר וגוף (אופציונלי). */
export function makeDoc(title: string, keywords = '', summary = '', body = ''): SearchDoc {
  return { t: tokenize(title), k: tokenize(keywords), s: tokenize(summary), b: [...new Set(tokenize(body))] };
}

/** מרחק עריכה 1 לכל היותר (החלפה, הוספה, הסרה, היפוך אותיות סמוכות). */
function near(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

/** עד כמה מילת חיפוש מתאימה לאחת ממילות השדה. בגוף הטקסט (loose = false) נספרות רק התאמות חזקות. */
function matchWord(q: string, field: string[], loose = true): number {
  let best = 0;
  const qStem = q.length >= 3 ? stem(q) : '';
  for (const w of field) {
    if (w === q) return 10;
    if (w.startsWith(q)) best = Math.max(best, 7);
    else if (qStem && stem(w) === qStem) best = Math.max(best, 5);
    else if (loose && q.length >= 3 && w.includes(q)) best = Math.max(best, 3);
    else if (loose && q.length >= 4 && w.length >= 4 && near(q, w.slice(0, q.length + 1))) best = Math.max(best, 2);
  }
  return best;
}

/** מילה אחת שהוקלדה, עם החלופות שלה: כפי שנכתבה, בלי אות שימוש, ומילים נרדפות במשקל נמוך יותר. */
export type QueryWord = { typed: string; alts: { term: string; weight: number }[] };
export type Query = { words: QueryWord[] };

export function parseQuery(raw: string): Query {
  let typed = words(raw);
  const content = typed.filter((w) => !STOP.has(w));
  if (content.length) typed = content;
  return {
    words: typed.map((word) => {
      const alts = variants(word).map((term) => ({ term, weight: 1 }));
      for (const term of synonymsFor(word)) {
        if (!alts.some((a) => a.term === term)) alts.push({ term, weight: 0.6 });
      }
      return { typed: word, alts };
    }),
  };
}

/** המילים שכדאי להדגיש בתוצאות: מה שהוקלד, הגרסה בלי אות שימוש, השורש והמילים הנרדפות. */
export function highlightTerms(q: Query): string[] {
  const out = new Set<string>();
  for (const w of q.words) {
    for (const { term } of w.alts) {
      out.add(term);
      const s = stem(term);
      if (s.length >= 3) out.add(s);
    }
  }
  return [...out];
}

/** ניקוד של מסמך מול שאילתה, וכמה ממילות השאילתה נמצאו בו. */
export function scoreDoc(doc: SearchDoc, q: Query): { score: number; matched: number } {
  let score = 0;
  let matched = 0;
  for (const w of q.words) {
    // המילה שהוקלדה, עם או בלי אות שימוש, נספרת פעם אחת. כל מילה נרדפת נספרת בנפרד.
    let own = 0;
    const found: number[] = [];
    for (const { term, weight } of w.alts) {
      const m = Math.max(matchWord(term, doc.t) * 3, matchWord(term, doc.k) * 2, matchWord(term, doc.s), matchWord(term, doc.b, false));
      if (weight === 1) own = Math.max(own, m);
      else if (m > 0) found.push(m * weight);
    }
    if (own > 0) found.push(own);
    if (found.length) {
      // ההתאמה הטובה ביותר קובעת. התאמות נוספות (למשל שתי מילים נרדפות) מוסיפות מעט, כדי שעמוד שמתאים ליותר מהן יעלה
      found.sort((a, b) => b - a);
      matched++;
      score += found[0] + 0.25 * found.slice(1).reduce((sum, x) => sum + x, 0);
    }
  }
  return { score, matched };
}

/**
 * מדרג רשימת פריטים. קודם פריטים שמתאימים לכל מילות השאילתה. אם אין כאלה והשאילתה ארוכה ממילה אחת,
 * מוחזרים פריטים שמתאימים לחלק מהמילים (partial = true), מהקרוב לרחוק.
 */
export function rank<T>(items: T[], doc: (item: T) => SearchDoc, raw: string, boost: (item: T) => number = () => 1): { hits: T[]; partial: boolean } {
  const query = parseQuery(raw);
  const n = query.words.length;
  if (!n) return { hits: [], partial: false };
  const scored = items
    .map((item, index) => {
      const r = scoreDoc(doc(item), query);
      return { item, index, matched: r.matched, score: r.score * boost(item) };
    })
    .filter((x) => x.matched > 0);
  let pool = scored.filter((x) => x.matched === n);
  const partial = pool.length === 0 && n > 1;
  if (partial) pool = scored;
  pool.sort((a, b) => (partial ? b.matched - a.matched : 0) || b.score - a.score || a.index - b.index);
  return { hits: pool.map((x) => x.item), partial };
}
