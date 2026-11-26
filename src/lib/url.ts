/** פרמטרים בכתובת העמוד (חיפוש, סינון): קריאה, ועדכון בלי ניווט. */

export const getParam = (key: string): string => new URLSearchParams(location.search).get(key) ?? '';

/** מעדכן פרמטר אחד ושומר על שאר הפרמטרים, על ה-hash ועל history.state. ערך ריק מסיר את הפרמטר. */
export function setParam(key: string, value: string): void {
  const u = new URL(location.href);
  if (value) u.searchParams.set(key, value);
  else u.searchParams.delete(key);
  history.replaceState(history.state, '', u);
}
