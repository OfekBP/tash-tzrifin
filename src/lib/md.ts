import { marked } from 'marked';

/** גוף עמוד ב-Markdown: פתיח, ואחריו חלקים לפי "## כותרת" (כל חלק הופך לכרטיס נפתח). */
export function splitSections(body: string | undefined): { intro: string; parts: { title: string; html: string }[] } {
  const chunks = (body ?? '').trim().split(/^## /m);
  const intro = chunks[0].trim() ? (marked.parse(chunks[0].trim()) as string) : '';
  const parts = chunks.slice(1).map((c) => {
    const nl = c.indexOf('\n');
    return { title: c.slice(0, nl).trim(), html: marked.parse(c.slice(nl + 1).trim()) as string };
  });
  return { intro, parts };
}

/**
 * שורה אחת מתוך רשימה בתוכן, עם אפשרות לקישור בתוכה.
 * כך כותבים מספר טלפון לחיץ: "מוקד: [1111](tel:1111)".
 */
export const inline = (text: string): string => marked.parseInline(text) as string;
