import { esc, normalize } from './text';
import { getParam, setParam } from './url';
import { highlightTerms, makeDoc, parseQuery, scoreDoc, type SearchDoc } from './search-core';

/**
 * חיפוש חי בתוך עמוד: מסנן ומדרג את הפריטים שכבר מופיעים בעמוד, תוך כדי הקלדה.
 * כל פריט מסומן ב-data-search בפורמט "כותרת|מילות מפתח|תקציר".
 * כללי ההתאמה והדירוג נמצאים ב-search-core.ts ומשותפים לחיפוש הכללי.
 */

type Doc = { el: HTMLElement; doc: SearchDoc; index: number };
export interface PageSearchOptions {
  /** השדה, ההודעה הריקה, המונה, כפתור הניקוי וההצעות: ברירת המחדל היא האלמנטים של PageSearch.astro */
  input?: HTMLInputElement;
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

export function initPageSearch(options: PageSearchOptions) {
  const o = {
    input: document.getElementById('q') as HTMLInputElement,
    empty: document.querySelector<HTMLElement>('[data-ps-empty]'),
    count: document.getElementById('ps-count'),
    clear: document.getElementById('ps-clear'),
    suggest: document.getElementById('ps-suggest'),
    ...options,
  };
  const docs: Doc[] = o.items.map((el, index) => {
    const [t = '', k = '', s = ''] = (el.dataset.search ?? el.textContent ?? '').split('|');
    return { el, index, doc: makeDoc(t, k, s) };
  });
  const globalHref = o.globalHref ?? (o.input.closest<HTMLElement>('.ps')?.dataset.global ?? '');
  const parent = o.reorder && o.items[0] ? o.items[0].parentElement : null;
  const hl = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-hl]')];
  o.empty?.setAttribute('role', 'status'); // ההודעה "לא מצאנו תוצאות" מוקראת בקורא מסך
  /** התוצאה המובילה בחיפוש הנוכחי: היעד של Enter */
  let top: HTMLElement | null = null;

  function refresh(replace = true) {
    const raw = o.input.value.trim();
    const query = parseQuery(raw);
    const n = query.words.length;
    const marks = highlightTerms(query);
    o.clear && (o.clear.hidden = !raw);
    if (o.suggest) o.suggest.hidden = !!raw || document.activeElement !== o.input;
    if (replace) setParam('q', raw);

    const scored = docs.map((d) => {
      const r = n ? scoreDoc(d.doc, query) : { score: 0, matched: 0 };
      return { d, score: r.score, matched: r.matched, allowed: !o.extra || o.extra(d.el) };
    });
    // כל המילים חייבות להתאים. אם אין אף פריט כזה, מוצגים פריטים שמתאימים לחלק מהמילים ("תוצאות קרובות")
    const partial = n > 1 && !scored.some((x) => x.allowed && x.matched === n) && scored.some((x) => x.allowed && x.matched > 0);
    const passes = (x: (typeof scored)[number]) => x.allowed && (n === 0 || (partial ? x.matched > 0 : x.matched === n));

    for (const x of scored) {
      const pass = passes(x);
      x.d.el.hidden = !pass;
      for (const h of hl(x.d.el)) clearMarks(h);
      if (pass && n) for (const h of hl(x.d.el)) highlight(h, marks);
    }
    const byRank = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
      (n ? (partial ? b.matched - a.matched : 0) || b.score - a.score : 0) || a.d.index - b.d.index;
    const ranked = [...scored].sort(byRank);
    if (parent) for (const { d } of ranked) parent.append(d.el);
    top = ranked.find(passes)?.d.el ?? null;

    const shown = scored.filter(passes).length;
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
      const label = shown === 1 ? (partial ? 'תוצאה קרובה אחת' : 'תוצאה אחת') : `${shown} ${partial ? 'תוצאות קרובות' : 'תוצאות'}`;
      o.count.textContent = raw && shown ? label : '';
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
