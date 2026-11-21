import { getCollection, type CollectionEntry } from 'astro:content';

/** ב-dev (ובבנייה עם PUBLIC_SHOW_DRAFTS=true) מוצגות גם טיוטות, עם תווית. בפרודקשן רק approved. */
export const SHOW_DRAFTS = import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';

export const SITE_NAME = 'ת״ש חובה בח״א צריפין';
export const TECH_CONTACT_ID = 'ofek-ben-porat';

export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

type WithStatus = { data: { status: string } };
export const isVisible = (e: WithStatus) => SHOW_DRAFTS || e.data.status === 'approved';
export const isDraft = (e: WithStatus) => e.data.status !== 'approved';

export async function visible<K extends 'rights' | 'guides' | 'banks' | 'people' | 'links'>(name: K): Promise<CollectionEntry<K>[]> {
  const all = await getCollection(name);
  return all.filter((e) => isVisible(e as unknown as WithStatus));
}

/** 0534289108 → 053-428-9108 */
export function displayPhone(p: string): string {
  return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
}
export const telHref = (p: string) => `tel:+972${p.slice(1)}`;
export const waHref = (p: string) => `https://wa.me/972${p.slice(1)}`;

export const categoryLabels: Record<string, string> = {
  holidays: 'חופשות',
  financial: 'כלכלה וסיוע',
  'service-relief': 'הקלות בשירות',
  'lone-soldier': 'חייל בודד',
  family: 'משפחה והורות',
  health: 'בריאות',
  equipment: 'ציוד',
  housing: 'דיור והלנה',
  work: 'עבודה',
  special: 'קיצור שירות',
  other: 'אחר',
};
