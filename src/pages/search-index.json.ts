import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { docTypeLabels } from '../lib/constants';
import { categoryLabels, href, isVisible, visible } from '../lib/site';
import { plain } from '../lib/md';
import { words } from '../lib/text';

/** אינדקס חיפוש שנבנה בזמן build ומכיל רק תוכן שמותר לפרסם. הדירוג עצמו נעשה בדפדפן (src/lib/search-core.ts). */
type Item = {
  id: string;
  /** סוג התוצאה, לדירוג: זכויות ומדריכים לפני שאלות נפוצות */
  kind: 'page' | 'right' | 'bank' | 'guide' | 'contact' | 'faq' | 'term';
  title: string;
  type: string;
  summary: string;
  keywords: string;
  /** גוף העמוד, לחיפוש בלבד (לא מוצג): בלי סימוני Markdown, וכל מילה פעם אחת כדי שהקובץ יישאר קטן */
  body?: string;
  url: string;
};

function bodyText(...parts: (string | undefined)[]): string {
  const text = parts
    .filter(Boolean)
    .join(' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`]/g, ' ');
  return [...new Set(words(text))].join(' ');
}

export const GET: APIRoute = async () => {
  const docWords = Object.values(docTypeLabels).join(' ') + ' אישור יתרות אישור יתרה ריכוז יתרות עו״ש דף חשבון';
  const items: Item[] = [];

  // העמודים הראשיים: חיפוש כללי כמו "משקית", "בנק" או "שאלות" מוביל לעמוד עצמו, ולא לעשרות פריטים בודדים
  const pages: [title: string, summary: string, keywords: string, path: string][] = [
    ['זכויות והטבות', 'מי זכאי, אילו מסמכים ואיך מגישים', 'זכויות הטבות זכות', '/rights/'],
    ['אנשי קשר', 'מש״קיות ומש״קי הת״ש לפי מסגרת ויחידה', 'מש״קית מש״ק משקית טלפון וואטסאפ', '/contacts/'],
    ['אישורים מהבנק', 'הדרכות להפקת אישורים מכל בנק', `בנק בנקים תדפיס ${docWords}`, '/guides/banks/'],
    ['מדריכים וכלים', 'ארגז כלים לעשייה בפועל', 'מדריך מדריכים הדרכה', '/guides/'],
    ['שאלות נפוצות', 'תשובות לשאלות שחוזרות הכי הרבה', 'שאלה תשובות', '/faq/'],
    ['מילון מושגים', 'המילים של עולם הת״ש, בלי ז׳רגון', 'מושג פירוש הסבר', '/glossary/'],
    ['מאיפה מתחילים?', 'שאלון קצר שמכוון לזכויות הרלוונטיות', 'שאלון להתחיל', '/guide-me/'],
  ];
  for (const [title, summary, keywords, path] of pages) {
    items.push({ id: `p-${path}`, kind: 'page', title, type: 'עמוד', summary, keywords, url: href(path) });
  }

  for (const r of await visible('rights')) {
    const d = r.data;
    items.push({
      id: `r-${r.id}`,
      kind: 'right',
      title: d.title,
      type: 'זכות',
      summary: d.summary,
      keywords: [...d.keywords, ...d.category.map((c) => categoryLabels[c])].join(' '),
      body: bodyText(
        ...d.eligibility,
        ...d.conditions,
        ...d.benefits,
        ...d.documents,
        ...d.how_to_apply,
        ...d.exceptions,
        d.approver,
        ...d.figures.map((f) => f.label),
        ...d.faq.flatMap((f) => [f.q, f.a]),
        r.body,
      ),
      url: href(`/rights/${r.id}/`),
    });
  }

  for (const b of await visible('banks')) {
    items.push({
      id: `b-${b.id}`,
      kind: 'bank',
      title: `${b.data.name}: אישורים`,
      type: 'מדריך בנק',
      summary: 'הדרכה להפקת אישורים מהבנק',
      keywords: [b.data.name, ...b.data.aliases, docWords].join(' '),
      url: href(`/guides/banks/${b.id}/`),
    });
  }

  for (const g of await visible('guides')) {
    const w = g.data.walkthrough;
    items.push({
      id: `g-${g.id}`,
      kind: 'guide',
      title: g.data.title,
      type: 'מדריך',
      summary: g.data.summary,
      keywords: g.data.keywords.join(' '),
      body: bodyText(
        g.body,
        ...g.data.videos.map((v) => v.title),
        ...(w
          ? [
              w.stepsTitle,
              ...w.steps.flatMap((s) => [s.title, s.text, s.tip]),
              w.note,
              w.troubleTitle,
              ...w.trouble.flatMap((t) => [t.title, t.text]),
              w.rightsTitle,
              w.rightsText,
              ...w.tags.flatMap((t) => [t.label, t.text]),
              ...w.remember.flatMap((t) => [t.title, t.text]),
            ]
          : []),
      ),
      url: href(`/guides/${g.id}/`),
    });
  }

  const people = new Map((await getCollection('people')).filter(isVisible).map((p) => [p.id, p]));
  const frameworks = new Map((await getCollection('frameworks')).map((f) => [f.id, f]));
  for (const a of await getCollection('assignments')) {
    const p = people.get(a.data.person.id);
    if (!p) continue;
    const fw = frameworks.get(a.data.framework.id)!;
    items.push({
      id: `c-${a.id}`,
      kind: 'contact',
      title: `${p.data.name} · ${a.data.units.join(', ')}`,
      type: `איש קשר · ${fw.data.name}`,
      // בלי מילים כלליות (מש״קית, טלפון): הן מובילות לעמוד אנשי הקשר, ואיש קשר בודד נמצא לפי שם, יחידה או מסגרת
      summary: '',
      keywords: `${fw.data.name} ${a.data.units.join(' ')}`,
      url: href(`/contacts/?q=${encodeURIComponent(a.data.units[0])}`),
    });
  }

  // שאלה נפוצה ומושג במילון: הקישור מוביל ישר אליהם (#q-… / #t-…), והעמוד פותח וגולל (Base.astro)
  for (const f of await getCollection('faq')) {
    items.push({ id: `f-${f.id}`, kind: 'faq', title: f.data.q, type: 'שאלה נפוצה', summary: plain(f.data.a), keywords: f.data.group, url: `${href('/faq/')}#q-${f.id}` });
  }
  for (const t of await getCollection('glossary')) {
    items.push({ id: `t-${t.id}`, kind: 'term', title: t.data.term, type: 'מילון', summary: plain(t.data.meaning), keywords: t.data.aliases.join(' '), url: `${href('/glossary/')}#t-${t.id}` });
  }

  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
