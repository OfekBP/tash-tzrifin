// ניקוי בטוח של src/styles/global.css, שנכתב בשיטת "מוסיפים בסוף" ולכן צבר כללים מתים וכפילויות.
//
//   node scripts/css-audit.mjs                       דוח בלבד
//   node scripts/css-audit.mjs --list                דוח מפורט: כל כלל וכל הגדרה שיוסרו
//   node scripts/css-audit.mjs --write               מבצע את הניקוי
//   node scripts/css-audit.mjs --write --only=dead   רק צעד אחד (dead, keyframes, overridden)
//
// שלושה צעדים, ואף אחד מהם לא משנה את מה שהדפדפן מציג:
// 1. dead: כלל שהבורר שלו דורש מחלקה או מזהה שלא מופיעים בשום מקום, לא ב-HTML וב-JS הבנויים (dist) ולא בקוד המקור (src).
// 2. keyframes: אנימציה שאף הגדרה לא מפעילה, או שמוגדרת שוב בהמשך הקובץ.
// 3. overridden: אותו בורר בדיוק קובע את אותה תכונה שוב בהמשך הקובץ (באותו תנאי @media או בלי תנאי),
//    כך שההגדרה המוקדמת אף פעם לא משפיעה.
// אחרי הרצה עם --write חובה להשוות צילומי סגנונות (tests/e2e/styles.spec.ts + scripts/compare-styles.mjs).
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const FILE = 'src/styles/global.css';
const args = process.argv.slice(2);
const write = args.includes('--write');
const list = args.includes('--list');
const only = (args.find((a) => a.startsWith('--only=')) ?? '--only=').slice(7);
const run = (step) => !only || only.split(',').includes(step);
const log = (line) => list && console.log(line);

// ---------- כל המילים שמופיעות באתר הבנוי ובקוד המקור ----------
const used = new Set();
let haystack = '';
function scan(dir, exts) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p, exts);
    else if (exts.some((x) => e.name.endsWith(x)) && path.resolve(p) !== path.resolve(FILE)) {
      const text = fs.readFileSync(p, 'utf8');
      haystack += text + '\n';
      for (const m of text.matchAll(/[A-Za-z_][\w-]*/g)) used.add(m[0]);
    }
  }
}
if (!fs.existsSync('dist')) {
  console.error('אין dist: הריצו קודם npm run build.');
  process.exit(2);
}
scan('dist', ['.html', '.js']);
scan('src', ['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx', '.yaml', '.yml', '.json', '.svg', '.html']);

/** מחלקות ומזהים שהבורר דורש. מה שבתוך [..] או בתוך :not(..) / :is(..) / :where(..) / :has(..) לא נספר, ליתר ביטחון. */
function required(selector) {
  let s = selector.replace(/\[[^\]]*\]/g, '');
  for (let prev = ''; prev !== s; ) {
    prev = s;
    s = s.replace(/:(not|is|where|has|matches)\([^()]*\)/g, '');
  }
  return [...s.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
}
const isDead = (selector) => required(selector).some((name) => !used.has(name));
const inKeyframes = (rule) => rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name);

/** תנאי ה-@ שהכלל נמצא בתוכם: '' בלי תנאי, null כשהכלל נמצא במבנה שלא מטפלים בו (לא @media ולא @supports). */
function context(rule) {
  const parts = [];
  for (let n = rule.parent; n && n.type !== 'root'; n = n.parent) {
    if (n.type !== 'atrule' || (n.name !== 'media' && n.name !== 'supports')) return null;
    parts.unshift(`@${n.name} ${n.params}`.replace(/\s+/g, ' ').trim());
  }
  return parts.join(' > ');
}

/** תכונה מקוצרת שמאפסת תכונות מפורטות. בכוונה רשימה צרה: רק מה שבטוח. */
const SIDES = '(top|right|bottom|left)';
const SHORTHAND = {
  margin: new RegExp(`^margin-${SIDES}$`),
  padding: new RegExp(`^padding-${SIDES}$`),
  inset: new RegExp(`^${SIDES}$`),
  border: new RegExp(`^border-${SIDES}(-(width|style|color))?$|^border-(width|style|color)$`),
  'border-radius': /^border-(top|bottom)-(left|right)-radius$/,
  background: /^background-(color|image|position|size|repeat|origin|clip|attachment)$/,
  font: /^font-(family|size|style|weight|stretch|variant)$|^line-height$/,
  animation: /^animation-(name|duration|timing-function|delay|iteration-count|direction|fill-mode|play-state)$/,
  transition: /^transition-(property|duration|timing-function|delay)$/,
  flex: /^flex-(grow|shrink|basis)$/,
  gap: /^(row|column)-gap$/,
  overflow: /^overflow-[xy]$/,
  outline: /^outline-(width|style|color)$/,
  'place-items': /^(align|justify)-items$/,
  'place-content': /^(align|justify)-content$/,
  'text-decoration': /^text-decoration-(line|style|color|thickness)$/,
  'list-style': /^list-style-(type|position|image)$/,
};
const name = (prop) => (prop.startsWith('--') ? prop : prop.toLowerCase());
const covers = (later, earlier) => later === earlier || (SHORTHAND[later]?.test(earlier) ?? false);

/**
 * ערך שדפדפן ישן עלול לא להכיר. הגדרה כזאת נזרקת בדפדפן ישן, ואז ההגדרה המוקדמת היא שקובעת,
 * ולכן היא לא נחשבת "דורסת" (ייתכן שהמוקדמת היא בכוונה ערך גיבוי).
 */
const RISKY_VALUE = new RegExp(
  [
    '\\d(dvh|svh|lvh|dvw|svw|lvw|dvb|dvi|svb|svi|lvb|lvi|cqw|cqh|cqi|cqb|cqmin|cqmax|rlh|lh|cap|ric|ic)\\b',
    '(color-mix|oklch|oklab|lch|lab|light-dark|image-set|anchor|anchor-size|round|mod|rem|sin|cos|tan|linear|calc-size|fit-content)\\(',
    '-(webkit|moz|ms)-',
    '\\b(balance|pretty|stable|clip|subgrid|revert-layer|allow-discrete|stretch|from)\\b',
  ].join('|'),
  'g',
);
/** היכולות החדשות שהערך משתמש בהן (בלי הספרה שלפני יחידת מידה) */
const risks = (value) => new Set([...value.matchAll(RISKY_VALUE)].map((m) => m[0].replace(/^\d/, '')));
/** בורר בלי תכונות חדשות. כלל עם כמה בוררים נזרק כולו אם הדפדפן לא מכיר אחד מהם. */
const OLD_PSEUDO =
  /::?(before|after|first-child|last-child|first-of-type|last-of-type|only-child|nth-child\([^()]*\)|nth-of-type\([^()]*\)|hover|active|focus|checked|disabled|enabled|empty|root|target|link|visited|placeholder|not\([^():]*\))(?![\w-])/g;
const plain = (selector) => !selector.replace(/\[[^\]]*\]/g, '').replace(OLD_PSEUDO, '').includes(':');

const css = fs.readFileSync(FILE, 'utf8');
const root = postcss.parse(css, { from: FILE });
const stats = { deadRules: 0, deadSelectors: 0, keyframes: 0, overridden: 0, fallback: 0, emptied: 0, comments: 0 };
const deadNames = new Set();
const short = (s) => s.replace(/\s+/g, ' ').trim();

// הערה שייכת לכללים שאחריה, עד ההערה הבאה. אם כולם יוסרו, גם ההערה תוסר.
const sections = [];
root.walkComments((c) => {
  const nodes = [];
  for (let n = c.next(); n && n.type !== 'comment'; n = n.next()) nodes.push(n);
  if (nodes.length) sections.push([c, nodes]);
});

// ---------- צעד 1: כללים מתים ----------
if (run('dead')) {
  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    const alive = rule.selectors.filter((sel) => {
      if (!isDead(sel)) return true;
      for (const n of required(sel)) if (!used.has(n)) deadNames.add(n);
      return false;
    });
    if (alive.length === rule.selectors.length) return;
    if (alive.length === 0) {
      stats.deadRules++;
      log(`מת      ${short(rule.selector)}`);
      rule.remove();
    } else {
      stats.deadSelectors += rule.selectors.length - alive.length;
      log(`מת חלקי ${short(rule.selector)}  →  ${alive.map(short).join(', ')}`);
      rule.selectors = alive;
    }
  });
}

// ---------- צעד 2: אנימציות שאף אחד לא מפעיל, או שמוגדרות שוב בהמשך ----------
if (run('keyframes')) {
  const valueWords = new Set();
  root.walkDecls((d) => {
    for (const m of d.value.matchAll(/[A-Za-z_][\w-]*/g)) valueWords.add(m[0]);
  });
  const frames = [];
  root.walkAtRules('keyframes', (at) => frames.push(at));
  const later = new Set();
  for (let i = frames.length - 1; i >= 0; i--) {
    const at = frames[i];
    const key = at.params.trim();
    const referenced = valueWords.has(key) || used.has(key);
    // הגדרה מאוחרת יותר ברמה העליונה תמיד מנצחת
    if (!referenced || later.has(key)) {
      stats.keyframes++;
      log(`אנימציה ${key}  (${referenced ? 'מוגדרת שוב בהמשך' : 'אף אחד לא מפעיל'})`);
      at.remove();
    } else if (at.parent.type === 'root') later.add(key);
  }
}

// ---------- צעד 3: הגדרות שנדרסות על ידי אותו בורר בהמשך ----------
if (run('overridden')) {
  const groups = new Map();
  root.walkRules((rule) => {
    if (inKeyframes(rule) || context(rule) === null) return;
    for (const sel of rule.selectors) {
      const key = short(sel);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rule);
    }
  });
  for (const [selector, rules] of groups) {
    if (rules.length < 2) continue;
    /** @type {{ prop: string, value: string, ctx: string, important: boolean, reliable: boolean, risks: Set<string> }[]} */
    const later = [];
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i];
      const ctx = context(rule);
      const single = rule.selectors.length === 1;
      // כלל מאוחר נחשב "דורס" רק אם ודאי שהדפדפן לא יזרוק אותו בגלל בורר אחר ברשימה
      const reliable = single || rule.selectors.every(plain);
      const own = [];
      for (const decl of [...rule.nodes]) {
        if (decl.type !== 'decl') continue;
        const prop = name(decl.prop);
        const mine = risks(decl.value);
        const same = (l) => covers(l.prop, prop) && (l.ctx === '' || l.ctx === ctx) && (l.important || !decl.important);
        // ערך שדפדפן ישן לא מכיר דורס רק הגדרה שמשתמשת באותן יכולות (ואז שתיהן נזרקות יחד)
        const counts = (l) => l.reliable && [...l.risks].every((r) => mine.has(r));
        const by = later.find((l) => counts(l) && same(l));
        // מסירים רק מכלל עם בורר יחיד: בכלל עם כמה בוררים ההגדרה עדיין משרתת את האחרים
        if (by && single) {
          stats.overridden++;
          log(`נדרס    ${selector}${ctx ? `  [${ctx}]` : ''}  ${decl.prop}: ${short(decl.value)}  ←  ${by.prop}: ${short(by.value)}${by.ctx !== ctx ? '  ⚠ תנאי שנדרס על ידי כלל בלי תנאי' : ''}`);
          decl.remove();
          continue;
        }
        if (!by && single && later.some((l) => !counts(l) && same(l))) {
          stats.fallback++;
          log(`נשאר    ${selector}  ${decl.prop}: ${short(decl.value)}  (ייתכן ערך גיבוי לדפדפן ישן)`);
        }
        own.push({ prop, value: decl.value, ctx, important: !!decl.important, reliable, risks: mine });
      }
      later.push(...own);
    }
  }
}

// ---------- כללים ותנאים שהתרוקנו, והערות שנשארו בלי כללים ----------
for (let again = true; again; ) {
  again = false;
  root.walk((node) => {
    if (node.type !== 'rule' && !(node.type === 'atrule' && ['media', 'supports', 'starting-style'].includes(node.name))) return;
    if (!node.nodes || node.nodes.some((n) => n.type !== 'comment')) return;
    stats.emptied++;
    node.remove();
    again = true;
  });
}
const gone = (node) => {
  for (let n = node; n; n = n.parent) if (n === root) return false;
  return true;
};
for (const [comment, nodes] of sections) {
  if (!gone(comment) && nodes.every(gone)) {
    stats.comments++;
    log(`הערה    ${short(comment.text).slice(0, 90)}`);
    comment.remove();
  }
}

const out = root.toString().replace(/(\r?\n)(?:[ \t]*\r?\n){2,}/g, '$1$1');
console.log(`כללים מתים: ${stats.deadRules} (ועוד ${stats.deadSelectors} בוררים מתים בתוך כללים חיים)`);
console.log(`מחלקות ומזהים שלא בשימוש: ${[...deadNames].sort().join(', ') || 'אין'}`);
console.log(`אנימציות שלא בשימוש: ${stats.keyframes}`);
console.log(`הגדרות שנדרסות בהמשך: ${stats.overridden} (ועוד ${stats.fallback} שנשארו כי ייתכן שהן ערך גיבוי)`);
console.log(`כללים שהתרוקנו: ${stats.emptied}, הערות שנשארו בלי כללים: ${stats.comments}`);
console.log(`גודל: ${css.length} → ${out.length} תווים (${Math.round((1 - out.length / css.length) * 100)}% פחות), ${css.split('\n').length} → ${out.split('\n').length} שורות`);

// משתני CSS שאף אחד לא קורא (לדיווח בלבד: הם חלק מהסגנון המחושב, ולכן לא מוסרים אוטומטית)
const declared = new Set();
root.walkDecls(/^--/, (d) => declared.add(d.prop));
const unusedVars = [...declared].filter((v) => !out.includes(`var(${v}`) && !haystack.includes(v)).sort();
console.log(`משתני CSS שאף אחד לא קורא: ${unusedVars.join(', ') || 'אין'}`);

if (write) {
  fs.writeFileSync(FILE, out);
  console.log('נכתב. עכשיו: build, צילום סגנונות והשוואה.');
}
