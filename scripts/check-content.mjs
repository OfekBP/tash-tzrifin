// בדיקת תוכן לפני פרסום.
// שגיאה (מפילה את הבנייה): הפניה לתוכן שלא קיים, מזהה כפול. דברים כאלה נעלמים מהאתר בשקט.
// אזהרה (רק מודפסת): פערי תוכן שכדאי להשלים, למשל סכום בלי תוקף או זכות בלי רשימת מסמכים.
//
// שימוש:  npm run check:content                שגיאות מפילות, אזהרות מודפסות
//          npm run check:content -- --strict    גם אזהרות מפילות
//          npm run check:content -- --summary   מדפיס רק ספירה לכל סוג אזהרה
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const summaryOnly = process.argv.includes('--summary');
const errors = [];
/** @type {Map<string, string[]>} */
const warnings = new Map();
const warn = (kind, msg) => warnings.set(kind, [...(warnings.get(kind) ?? []), msg]);

function frontmatter(file) {
  const s = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(s);
  return { data: m ? (parse(m[1]) ?? {}) : {}, body: m ? s.slice(m[0].length) : s };
}
function folder(rel, ext, read) {
  const dir = path.join(root, rel);
  return Object.fromEntries(
    fs.readdirSync(dir)
      .filter((f) => !f.startsWith('_') && f.endsWith(ext))
      .map((f) => [f.slice(0, -ext.length), read(path.join(dir, f))]),
  );
}
const yamlList = (rel) => parse(fs.readFileSync(path.join(root, rel), 'utf8')) ?? [];

const rights = folder('src/content/rights', '.md', frontmatter);
const guides = folder('src/content/guides', '.md', frontmatter);
const banks = folder('src/content/banks', '.yaml', (f) => ({ data: parse(fs.readFileSync(f, 'utf8')) ?? {} }));
const data = {
  faq: yamlList('src/data/faq.yaml'),
  glossary: yamlList('src/data/glossary.yaml'),
  quiz: yamlList('src/data/quiz.yaml'),
  people: yamlList('src/data/people.yaml'),
  frameworks: yamlList('src/data/frameworks.yaml'),
  assignments: yamlList('src/data/assignments.yaml'),
  links: yamlList('src/data/links.yaml'),
};

const hasRight = (id) => Object.hasOwn(rights, id);
const approved = (e) => e.data.status === 'approved';
const days = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

// ---------- שגיאות ----------
for (const [id, r] of Object.entries(rights)) {
  for (const rel of r.data.related ?? []) if (!hasRight(rel)) errors.push(`rights/${id}.md: related מפנה לזכות שלא קיימת: ${rel}`);
}
for (const f of data.faq) {
  for (const rid of f.rights ?? []) if (!hasRight(rid)) errors.push(`faq.yaml (${f.id}): rights מפנה לזכות שלא קיימת: ${rid}`);
}
for (const b of data.quiz) {
  const refs = [...(b.base ?? []), ...(b.questions ?? []).flatMap((q) => (q.options ?? []).flatMap((o) => o.add ?? []))];
  for (const rid of refs) if (!hasRight(rid)) errors.push(`quiz.yaml (${b.id}): מפנה לזכות שלא קיימת: ${rid}`);
}
for (const [name, items] of Object.entries(data)) {
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x.id)) errors.push(`${name}.yaml: מזהה כפול: ${x.id}`);
    seen.add(x.id);
  }
}
{
  const people = new Set(data.people.map((p) => p.id));
  const frameworks = new Set(data.frameworks.map((f) => f.id));
  for (const a of data.assignments) {
    if (!people.has(a.person)) errors.push(`assignments.yaml (${a.id}): איש קשר שלא קיים: ${a.person}`);
    if (!frameworks.has(a.framework)) errors.push(`assignments.yaml (${a.id}): מסגרת שלא קיימת: ${a.framework}`);
  }
}

// ---------- אזהרות: זכויות ----------
for (const [id, r] of Object.entries(rights)) {
  const d = r.data;
  const where = `rights/${id}.md`;
  if (!approved(r)) continue;
  for (const f of d.figures ?? []) {
    if (!/^\d{4}/.test(String(f.asOf ?? ''))) warn('סכום שמוצג למשתמשים בלי תוקף', `${where}: "${f.label}" (asOf: "${f.asOf}")`);
  }
  if ((d.to_verify ?? []).length) warn('זכות מאושרת עם הערות "לבדיקה" פתוחות', `${where}: ${d.to_verify.length} הערות`);
  if (!d.approver) warn('חסר "מי מאשר"', where);
  if (!(d.documents ?? []).length) warn('חסרה רשימת מסמכים', where);
  if (!(d.how_to_apply ?? []).length) warn('חסר "איך מגישים בקשה"', where);
  for (const rel of d.related ?? []) {
    if (hasRight(rel) && !approved(rights[rel])) warn('הפניה לתוכן שלא אושר (לא תוצג באתר)', `${where}: related → ${rel}`);
  }
}
for (const [kind, entries] of Object.entries({ rights, guides })) {
  for (const [id, e] of Object.entries(entries)) {
    if (!approved(e)) continue;
    const where = `${kind}/${id}.md`;
    const lead = e.data.lead ?? '';
    if (lead.length > 32) warn('תת-כותרת ארוכה מ-32 תווים (עלולה לא להיכנס בשורה אחת)', `${where}: ${lead.length} תווים`);
    if (!e.data.lastVerified) warn('חסר תאריך אימות (lastVerified)', where);
    else if (days(e.data.lastVerified) > 180) warn('לא אומת יותר מחצי שנה', `${where}: ${String(e.data.lastVerified).slice(0, 10)}`);
  }
}

// ---------- אזהרות: שאלות נפוצות כפולות ----------
{
  const key = (s) => String(s).replace(/[\s?.,!:״"׳'-]/g, '');
  const byQuestion = new Map(data.faq.map((f) => [key(f.q), f]));
  for (const [id, r] of Object.entries(rights)) {
    for (const f of r.data.faq ?? []) {
      const twin = byQuestion.get(key(f.q));
      if (!twin) continue;
      const same = key(twin.a) === key(f.a);
      warn(same ? 'שאלה שמופיעה פעמיים (שאלות נפוצות + עמוד זכות)' : 'שאלה שמופיעה פעמיים בנוסח שונה', `rights/${id}.md ↔ faq.yaml (${twin.id}): ${f.q}`);
    }
  }
}

// ---------- אזהרות: שאלון ----------
{
  const reachable = new Set();
  for (const b of data.quiz) {
    const adds = (b.questions ?? []).flatMap((q) => (q.options ?? []).flatMap((o) => o.add ?? []));
    for (const rid of [...(b.base ?? []), ...adds]) reachable.add(rid);
    // לענף "docs" יש קישורים קבועים בעמוד השאלון עצמו
    if (b.id !== 'docs' && !(b.base ?? []).length && !adds.length) warn('ענף בשאלון שלא מוביל לאף זכות', `quiz.yaml: ${b.id} (${b.label})`);
  }
  for (const [id, r] of Object.entries(rights)) {
    if (approved(r) && !reachable.has(id)) warn('זכות שהשאלון לא מגיע אליה', `rights/${id}.md`);
  }
}

// ---------- אזהרות: בנקים ----------
for (const [id, b] of Object.entries(banks)) {
  if (b.data.status !== 'approved') continue;
  if (b.data.guideStatus !== 'approved') warn('בנק בלי מדריך כתוב מאושר', `banks/${id}.yaml`);
  if (!b.data.playlist) warn('בנק בלי סרטון הדרכה', `banks/${id}.yaml`);
}

// ---------- פלט ----------
const total = [...warnings.values()].reduce((n, list) => n + list.length, 0);
for (const [kind, list] of warnings) {
  console.log(`\nאזהרה: ${kind} (${list.length})`);
  if (!summaryOnly) for (const m of list) console.log(`  - ${m}`);
}
if (errors.length) {
  console.error(`\nשגיאות תוכן (${errors.length}):`);
  for (const m of errors) console.error(`  ✗ ${m}`);
}
console.log(`\nבדיקת תוכן: ${errors.length} שגיאות, ${total} אזהרות.`);
process.exit(errors.length || (strict && total) ? 1 : 0);
