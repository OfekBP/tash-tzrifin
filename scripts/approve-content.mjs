// אישור תוכן שסומן reviewed, כדי שיעלה לאתר החי.
// שימוש:  npm run approve -- "שם המאשר"          (מאשר כל מה שבסטטוס reviewed)
//          npm run approve -- "שם המאשר" housing   (רק קובץ אחד, לפי שם הקובץ בלי סיומת)
// רצים רק אחרי שעברתם על התוכן. הסקריפט רק מעדכן את שדות האישור בקבצים.
import fs from 'node:fs';
import path from 'node:path';

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
    let s = fs.readFileSync(p, 'utf8');
    const nl = s.includes('\r\n') ? '\r\n' : '\n';
    const isBank = dir.endsWith('banks');
    if (isBank) {
      if (!/^guideStatus: reviewed\s*$/m.test(s)) continue;
      s = s.replace(/^guideStatus: reviewed\s*$/m, `guideStatus: approved${nl}guideApprovedBy: "${by}"`);
    } else {
      if (!/^status: reviewed\s*$/m.test(s)) continue;
      s = s.replace(/^status: reviewed\s*$/m, `status: approved${nl}approvedBy: "${by}"${nl}approvedOn: ${today}`);
    }
    fs.writeFileSync(p, s);
    console.log('אושר:', p);
    changed++;
  }
}
console.log(changed ? `אושרו ${changed} קבצים. הריצו npm run build ובדקו.` : 'לא נמצא תוכן בסטטוס reviewed.');
