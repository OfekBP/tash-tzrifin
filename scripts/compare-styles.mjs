// משווה שני "צילומי סגנונות" (tests/e2e/styles.spec.ts). שימוש:  node scripts/compare-styles.mjs before after
// יוצא עם קוד 1 אם יש הבדל כלשהו, ומדפיס את ההבדלים הראשונים בכל קובץ.
import fs from 'node:fs';
import path from 'node:path';

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('שימוש: node scripts/compare-styles.mjs <לפני> <אחרי>');
  process.exit(2);
}
const dir = (label) => path.resolve('.shots', label, 'styles');
const files = fs.readdirSync(dir(a)).filter((f) => f.endsWith('.json')).sort();
const missing = fs.readdirSync(dir(b)).filter((f) => !files.includes(f));
const NL = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
/** כל שורה בצילום: שם התכונה, טאב, הערך */
const parse = (s) => Object.fromEntries(s.split(NL).filter(Boolean).map((kv) => [kv.slice(0, kv.indexOf(TAB)), kv.slice(kv.indexOf(TAB) + 1)]));

let bad = 0;
let elements = 0;
for (const file of files) {
  const fb = path.join(dir(b), file);
  if (!fs.existsSync(fb)) {
    console.log(`✗ ${file}: חסר בצילום השני`);
    bad++;
    continue;
  }
  const A = JSON.parse(fs.readFileSync(path.join(dir(a), file), 'utf8'));
  const B = JSON.parse(fs.readFileSync(fb, 'utf8'));
  elements += A.els.length;
  const diffs = [];
  if (A.els.length !== B.els.length) diffs.push(`מספר האלמנטים שונה: ${A.els.length} לעומת ${B.els.length}`);
  for (let i = 0; i < Math.min(A.els.length, B.els.length); i++) {
    const [la, ia] = A.els[i];
    const [lb, ib] = B.els[i];
    if (la !== lb) {
      diffs.push(`אלמנט ${i}: "${la}" לעומת "${lb}"`);
      break;
    }
    const sa = A.styles[ia];
    const sb = B.styles[ib];
    if (sa === sb) continue;
    const pa = parse(sa);
    const pb = parse(sb);
    const props = [...new Set([...Object.keys(pa), ...Object.keys(pb)])].filter((p) => pa[p] !== pb[p]);
    diffs.push(`${la}: ${props.slice(0, 4).map((p) => `${p}: ${pa[p]} → ${pb[p]}`).join(' | ')}${props.length > 4 ? ` (+${props.length - 4})` : ''}`);
  }
  if (diffs.length) {
    bad++;
    console.log(`✗ ${file}: ${diffs.length} הבדלים`);
    for (const d of diffs.slice(0, 6)) console.log(`    ${d}`);
  }
}
for (const f of missing) {
  console.log(`✗ ${f}: קיים רק בצילום השני`);
  bad++;
}
console.log(bad ? `\n${bad} קבצים עם הבדלים מתוך ${files.length}.` : `\nזהה: ${files.length} צילומים, ${elements} אלמנטים.`);
process.exit(bad ? 1 : 0);
