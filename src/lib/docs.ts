import { docTypeLabels, docTypeMatch } from './constants';
import { normalize } from './text';

/** סוג אישור בנקאי שיש לו הדרכה בעמודי הבנקים. */
export type DocType = keyof typeof docTypeLabels;

const table = (Object.keys(docTypeMatch) as DocType[]).map((type) => [type, docTypeMatch[type].map(normalize)] as const);

/** האם מסמך ברשימת המסמכים של זכות הוא אישור בנקאי שיש לו הדרכה, ואיזה. */
export function docTypeOf(text: string): DocType | null {
  const n = normalize(text);
  return table.find(([, phrases]) => phrases.some((p) => n.includes(p)))?.[0] ?? null;
}

export const isDocType = (value: string): value is DocType => Object.hasOwn(docTypeLabels, value);
