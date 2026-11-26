/**
 * כפתור "חזרה" של המכשיר סוגר חלון פתוח (dialog) במקום לצאת מהעמוד.
 * בפתיחה נדחפת רשומת היסטוריה, ובסגירה רגילה היא מוסרת.
 * רשומה שנשארה בלי חלון (אחרי רענון או "קדימה") מדולגת בסקריפט הכללי שב-Base.astro.
 * משותף לחלון איש הקשר, להגדלת התמונה במדריך ולהדרכה. רק חלון אחד פתוח בכל רגע.
 */
let current: { close: () => void } | null = null;

addEventListener('popstate', () => {
  if (!current) return;
  const c = current;
  current = null; // הדפדפן כבר הסיר את הרשומה: סוגרים בלי לחזור פעם נוספת
  c.close();
});

export function modalHistory(dlg: HTMLDialogElement, close: () => void = () => dlg.close()) {
  const self = { close };
  /** החלון נסגר (כפתור, Esc, רקע): מסירים את הרשומה שנדחפה. אין מה להסיר אם הסגירה הגיעה מכפתור החזרה. */
  const closed = () => {
    // אירוע סגירה שהתעכב והגיע אחרי שהחלון כבר נפתח מחדש: מתעלמים
    if (current !== self || dlg.open) return;
    current = null;
    history.back();
  };
  dlg.addEventListener('close', closed);
  return {
    /** לקרוא מיד אחרי פתיחת החלון. */
    opened() {
      if (current === self) return;
      current = self;
      history.pushState({ ...(history.state ?? {}), modal: 1 }, '');
    },
    /** לחלון שמוסר מהעמוד מיד עם הסגירה (ההדרכה): קוראים ישירות, בלי לחכות לאירוע. */
    closed,
  };
}
