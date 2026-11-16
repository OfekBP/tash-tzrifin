import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { docTypeLabels } from '../lib/constants';
import { categoryLabels, href, isVisible, visible } from '../lib/site';

/** אינדקס חיפוש שנבנה בזמן build ומכיל רק תוכן שמותר לפרסם. */
export const GET: APIRoute = async () => {
  const docWords = Object.values(docTypeLabels).join(' ') + ' אישור יתרות אישור יתרה ריכוז יתרות עו״ש דף חשבון';
  const items: { id: string; title: string; type: string; summary: string; keywords: string; url: string }[] = [];

  for (const r of await visible('rights')) {
    items.push({
      id: `r-${r.id}`,
      title: r.data.title,
      type: 'זכות',
      summary: r.data.summary,
      keywords: [...r.data.keywords, ...r.data.category.map((c) => categoryLabels[c])].join(' '),
      url: href(`/rights/${r.id}/`),
    });
  }

  for (const b of await visible('banks')) {
    items.push({
      id: `b-${b.id}`,
      title: `${b.data.name}: אישורים`,
      type: 'מדריך בנק',
      summary: 'הדרכה להפקת אישורים מהבנק',
      keywords: [b.data.name, ...b.data.aliases, docWords].join(' '),
      url: href(`/guides/banks/${b.id}/`),
    });
  }

  for (const g of await visible('guides')) {
    items.push({ id: `g-${g.id}`, title: g.data.title, type: 'מדריך', summary: g.data.summary, keywords: g.data.keywords.join(' '), url: href(`/guides/${g.id}/`) });
  }

  const people = new Map((await getCollection('people')).filter(isVisible).map((p) => [p.id, p]));
  const frameworks = new Map((await getCollection('frameworks')).map((f) => [f.id, f]));
  for (const a of await getCollection('assignments')) {
    const p = people.get(a.data.person.id);
    if (!p) continue;
    const fw = frameworks.get(a.data.framework.id)!;
    items.push({
      id: `c-${a.id}`,
      title: `${p.data.name} · ${a.data.units.join(', ')}`,
      type: `איש קשר · ${fw.data.name}`,
      summary: 'מש״קית/מש״ק ת״ש',
      keywords: `${fw.data.name} ${a.data.units.join(' ')} מש״קית משקית ת״ש אנשי קשר טלפון`,
      url: href(`/contacts/?q=${encodeURIComponent(a.data.units[0])}`),
    });
  }

  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
