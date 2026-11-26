import { normalize, tokenize, variants, words } from './text';
import { getParam, setParam } from './url';

/**
 * חיפוש חי בתוך עמוד: מסנן ומדרג את הפריטים שכבר מופיעים בעמוד, תוך כדי הקלדה.
 * כל פריט מסומן ב-data-search בפורמט "כותרת|מילות מפתח|תקציר". כל מילה בחיפוש חייבת להתאים (AND),
 * התאמה בתחילת מילה או בכותרת מדורגת גבוה יותר, ויש סבילות לטעות הקלדה אחת במילים ארוכות.
 */

type Doc = { el: HTMLElement; t: string[]; k: string[]; s: string[]; index: number };
export interface PageSearchOptions {
  input: HTMLInputElement;
  items: HTMLElement[];
  /** מקבצים (קטגוריות/קבוצות): מוסתרים כשאין בהם פריט מוצג */
  groups?: HTMLElement[];
  /** מסדר מחדש את הפריטים לפי דירוג (רק ברשימה שטוחה) */
  reorder?: boolean;
  /** סינון נוסף (למשל צ׳יפ קטגוריה) */
  extra?: (el: HTMLElement) => boolean;
  empty?: HTMLElement | null;
  count?: HTMLElement | null;
  clear?: HTMLElement | null;
  suggest?: HTMLElement | null;
  /** שורת "בכל האתר" בתוצאה ריקה */
  globalHref?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** מרחק עריכה 1 לכל היותר (החלפה, הוספה, הסרה, היפוך סמוכים) */
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

function matchToken(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === q) return 10;
    if (w.startsWith(q)) best = Math.max(best, 7);
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 3);
    else if (q.length >= 4 && w.length >= 4 && near(q, w.slice(0, q.length + 1))) best = Math.max(best, 2);
  }
  return best;
}

const SEP = /[\s,.;:!?/()\[\]{}\-–—_|·]/;

/** הטקסט המנורמל, ולכל תו בו המיקום שלו בטקסט המקורי (גרשיים וניקוד נעלמים בנירמול). */
function normMap(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const c of normalize(text[i])) {
      norm += c;
      map.push(i);
    }
  }
  return { norm, map };
}

function highlight(root: Element, terms: string[]) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const n of nodes) {
    const text = n.nodeValue ?? '';
    const { norm, map } = normMap(text);
    const ranges: [number, number][] = [];
    for (const t of terms) {
      let from = 0;
      for (;;) {
        const at = norm.indexOf(t, from);
        if (at < 0) break;
        // התחלת מילה בלבד (אפשר אחרי אות שימוש אחת), כדי שההדגשה תהיה צפויה
        const wordStart = at === 0 || SEP.test(norm[at - 1]);
        const afterPrefix = at > 0 && 'הוכלמבש'.includes(norm[at - 1]) && (at === 1 || SEP.test(norm[at - 2]));
        if (wordStart || afterPrefix) ranges.push([at, at + t.length]);
        from = at + t.length;
      }
    }
    if (!ranges.length) continue;
    ranges.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([...r]);
    }
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const [a, b] of merged) {
      // מהמיקום המנורמל חזרה לטקסט המקורי: גרשיים שבתוך ההתאמה נכנסים להדגשה
      const start = map[a];
      const end = map[b - 1] + 1;
      if (start > pos) frag.append(text.slice(pos, start));
      const m = document.createElement('mark');
      m.textContent = text.slice(start, end);
      frag.append(m);
      pos = end;
    }
    if (pos < text.length) frag.append(text.slice(pos));
    n.replaceWith(frag);
  }
}

function clearMarks(root: Element) {
  root.querySelectorAll('mark').forEach((m) => m.replaceWith(document.createTextNode(m.textContent ?? '')));
  root.normalize();
}

export function initPageSearch(o: PageSearchOptions) {
  const docs: Doc[] = o.items.map((el, index) => {
    const [t = '', k = '', s = ''] = (el.dataset.search ?? el.textContent ?? '').split('|');
    return { el, index, t: tokenize(t), k: tokenize(k), s: tokenize(s) };
  });
  const globalHref = o.globalHref ?? (o.input.closest<HTMLElement>('.ps')?.dataset.global ?? '');
  const parent = o.reorder && o.items[0] ? o.items[0].parentElement : null;
  const hl = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-hl]')];
  /** התוצאה המובילה בחיפוש הנוכחי: היעד של Enter */
  let top: HTMLElement | null = null;

  function refresh(replace = true) {
    const raw = o.input.value.trim();
    // כל מילה בחיפוש חייבת להתאים (AND). לכל מילה מספיקה אחת הגרסאות שלה: כפי שנכתבה, או בלי אות שימוש
    const ws = words(raw);
    const hlTerms = [...new Set(ws.flatMap(variants))];
    o.clear && (o.clear.hidden = !raw);
    if (o.suggest) o.suggest.hidden = !!raw || document.activeElement !== o.input;
    if (replace) setParam('q', raw);

    const scored = docs.map((d) => {
      let score = 0;
      let ok = true;
      for (const w of ws) {
        let best = 0;
        for (const v of variants(w)) {
          best = Math.max(best, matchToken(v, d.t) * 3, matchToken(v, d.k) * 2, matchToken(v, d.s));
        }
        if (!best) { ok = false; break; }
        score += best;
      }
      const pass = (!ws.length || ok) && (!o.extra || o.extra(d.el));
      return { d, score: ws.length ? score : 0, pass };
    });

    for (const { d, pass } of scored) {
      d.el.hidden = !pass;
      for (const h of hl(d.el)) clearMarks(h);
      if (pass && ws.length) for (const h of hl(d.el)) highlight(h, hlTerms);
    }
    if (parent) {
      const order = [...scored].sort((a, b) => (ws.length ? b.score - a.score : 0) || a.d.index - b.d.index);
      for (const { d } of order) parent.append(d.el);
    }
    top = null;
    let bestScore = -1;
    for (const x of scored) {
      if (x.pass && x.score > bestScore) {
        bestScore = x.score;
        top = x.d.el;
      }
    }
    const shown = scored.filter((x) => x.pass).length;
    o.groups?.forEach((g) => (g.hidden = ![...g.querySelectorAll<HTMLElement>('[data-search]')].some((i) => !i.hidden)));
    if (o.empty) {
      o.empty.hidden = shown > 0;
      if (shown === 0) {
        const link = globalHref && raw ? ` או <a href="${esc(globalHref)}?q=${encodeURIComponent(raw)}">לחפש בכל האתר</a>` : '';
        o.empty.innerHTML = raw ? `לא מצאנו תוצאות ל״${esc(raw)}״. נסו מילה אחרת${link}.` : 'אין פריטים להצגה.';
      }
    }
    if (o.count) {
      o.count.hidden = !raw;
      o.count.textContent = raw ? (shown ? `${shown === 1 ? 'תוצאה אחת' : `${shown} תוצאות`}` : '') : '';
    }
  }

  let timer: number;
  o.input.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => refresh(), 60); });
  o.input.addEventListener('focus', () => refresh(false));
  o.input.addEventListener('blur', () => window.setTimeout(() => o.suggest && (o.suggest.hidden = true), 150));
  o.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      refresh();
      o.input.blur();
      if (o.input.value.trim()) top?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (e.key === 'Escape' && o.input.value) {
      o.input.value = '';
      refresh();
    }
  });
  o.clear?.addEventListener('click', () => { o.input.value = ''; refresh(); o.input.focus(); });
  o.suggest?.querySelectorAll<HTMLElement>('[data-q]').forEach((b) =>
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      o.input.value = b.dataset.q ?? '';
      o.input.focus();
      refresh();
    }),
  );
  const initial = getParam('q');
  if (initial) o.input.value = initial;
  refresh(false);
  return { refresh };
}
