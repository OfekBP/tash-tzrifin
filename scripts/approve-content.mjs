// אישור תוכן שסומן reviewed, כדי שיעלה לאתר החי.
// שימוש:  npm run approve -- "שם המאשר"          (מאשר כל מה שבסטטוס reviewed)
//          npm run approve -- "שם המאשר" housing   (רק קובץ אחד, לפי שם הקובץ בלי סיומת)
// רצים רק אחרי שעברתם על התוכן. הסקריפט רק מעדכן את שדות האישור בקבצים.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * מחזיר את תוכן הקובץ אחרי אישור, או null אם אין בו מה לאשר.
 * - שורת הסטטוס יכולה להסתיים בהערה (כמו בתבניות).
 * - שדות אישור שכבר קיימים מוחלפים, כדי שלא ייווצרו מפתחות כפולים.
 * - בבנק מאושרים בנפרד הסטטוס הכללי (status) והמדריך הכתוב (guideStatus).
 */
export function approve(text, by, today, isBank) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  let s = text.replace(/\r\n/g, '\n');
  let changed = false;
  const reviewed = (key) => new RegExp(`^${key}:[ \\t]*reviewed[ \\t]*(#.*)?$`, 'm');
  const setField = (key, value, after) => {
    const line = `${key}: ${value}`;
    const existing = new RegExp(`^${key}:.*$`, 'm');
    s = existing.test(s) ? s.replace(existing, () => line) : s.replace(after, (m) => `${m}\n${line}`);
  };

  if (reviewed('status').test(s)) {
    s = s.replace(reviewed('status'), 'status: approved');
    setField('approvedBy', JSON.stringify(by), /^status: approved$/m);
    setField('approvedOn', today, /^approvedBy:.*$/m);
    changed = true;
  }
  if (isBank && reviewed('guideStatus').test(s)) {
    s = s.replace(reviewed('guideStatus'), 'guideStatus: approved');
    setField('guideApprovedBy', JSON.stringify(by), /^guideStatus: approved$/m);
    changed = true;
  }
  return changed ? s.replace(/\n/g, nl) : null;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [by, ...only] = process.argv.slice(2);
  if (!by) {
    console.error('חסר שם המאשר. דוגמה: npm run approve -- "שם מלא"');
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const dirs = ['src/content/rights', 'src/content/guides', 'src/content/banks'];
  let changed = 0;

  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('_') || !/\.(md|yaml)$/.test(f)) continue;
      const name = f.replace(/\.(md|yaml)$/, '');
      if (only.length && !only.includes(name)) continue;
      const p = path.join(dir, f);
      const next = approve(fs.readFileSync(p, 'utf8'), by, today, dir.endsWith('banks'));
      if (next === null) continue;
      fs.writeFileSync(p, next);
      console.log('אושר:', p);
      changed++;
    }
  }
  console.log(changed ? `אושרו ${changed} קבצים. הריצו npm run build ובדקו.` : 'לא נמצא תוכן בסטטוס reviewed.');
}
