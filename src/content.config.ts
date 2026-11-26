import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { categories } from './lib/constants';

/**
 * סכמות התוכן. ה-build נכשל אם שדה חובה חסר, כך שאי אפשר לפרסם תוכן שבור.
 * הסבר לעורכים: docs/CONTENT-GUIDE.he.md
 */

const status = z.enum(['draft', 'reviewed', 'approved']);
const origin = z.enum(['official', 'unit-local', 'reference-site', 'provided-by-owner']);

const source = z.object({
  doc: z.string(), // למשל: book
  page: z.number().int().positive(),
  section: z.string().optional(),
});

/** כללי אישור משותפים: תוכן "approved" חייב להיות מתועד ונקי מבעיות פתוחות. */
function approvalRules(
  d: { status: string; approvedBy?: string; approvedOn?: Date; open_issues?: string[]; sources?: unknown[]; origin?: string },
  ctx: z.RefinementCtx,
  opts: { requireSources: boolean },
) {
  if (d.status !== 'approved') return;
  if (!d.approvedBy || !d.approvedOn) {
    ctx.addIssue({ code: 'custom', message: 'תוכן מאושר חייב לכלול approvedBy ו-approvedOn' });
  }
  if (d.open_issues && d.open_issues.length > 0) {
    ctx.addIssue({ code: 'custom', message: 'לא ניתן לאשר תוכן שיש בו open_issues פתוחים' });
  }
  if (opts.requireSources && (!d.sources || d.sources.length === 0) && d.origin !== 'provided-by-owner') {
    ctx.addIssue({ code: 'custom', message: 'תוכן מקצועי מאושר חייב לכלול מקור ועמוד (sources)' });
  }
}

const approvalFields = {
  status,
  origin,
  approvedBy: z.string().optional(),
  approvedOn: z.coerce.date().optional(),
  lastVerified: z.coerce.date().optional(),
  open_issues: z.array(z.string()).default([]),
};


/** זכויות ומענים: קובץ Markdown אחד לנושא. */
const rights = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/rights' }),
  schema: z
    .object({
      title: z.string(),
      category: z.array(z.enum(categories)).min(1),
      summary: z.string(), // שורה אחת למסך הרשימה
      lead: z.string().optional(), // תת כותרת בראש העמוד, שורה אחת (עד ~32 תווים)
      keywords: z.array(z.string()).default([]), // כינויים לחיפוש
      eligibility: z.array(z.string()).default([]),
      conditions: z.array(z.string()).default([]),
      documents: z.array(z.string()).default([]),
      how_to_apply: z.array(z.string()).default([]),
      approver: z.string().optional(),
      exceptions: z.array(z.string()).default([]), // "חשוב לדעת"
      benefits: z.array(z.string()).default([]), // מה מקבלים בפועל
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      related: z.array(reference('rights')).default([]), // זכויות קשורות
      to_verify: z.array(z.string()).default([]), // פרטים לבדיקה לפני פרסום: מוצגים רק בסביבת פיתוח
      figures: z
        .array(
          z.object({
            label: z.string(),
            value: z.union([z.number(), z.string()]),
            unit: z.string().optional(),
            asOf: z.string(), // תוקף המספר, למשל 2026-01
            source: source.optional(),
          }),
        )
        .default([]),
      sources: z.array(source).default([]),
      ...approvalFields,
    })
    .superRefine((d, ctx) => approvalRules(d, ctx, { requireSources: true })),
});

const video = z.url().optional();


const steps = z.object({ pc: z.array(z.string()).default([]), phone: z.array(z.string()).default([]) });

/** בנקים: קובץ YAML אחד לבנק. */
const banks = defineCollection({
  loader: glob({ pattern: '**/[^_]*.yaml', base: './src/content/banks' }),
  schema: z
    .object({
      name: z.string(),
      order: z.number().default(100),
      aliases: z.array(z.string()).default([]),
      logo: z.string().optional(), // נתיב תחת public/logos/banks, אם אין מוצג סמל עם ראשי תיבות
      playlist: video, // פלייליסט YouTube
      playlistNote: z.string().optional(), // למשל: "אותו פלייליסט משותף גם לבנק X"
      guide: z.object({ ownership: steps.optional(), statement: steps.optional(), credit: steps.optional(), balance: steps.optional() }).optional(),
      // המדריך הכתוב מאושר בנפרד מהקישור לפלייליסט. עד אישור הוא לא מוצג באתר.
      guideStatus: status.default('draft'),
      guideVerified: z.coerce.date().optional(), // מתי נבדקו הצעדים מול האפליקציה
      guideApprovedBy: z.string().optional(), // מי אישר את המדריך הכתוב (חלופה ל-guideVerified)
      ...approvalFields,
    })
    .superRefine((d, ctx) => {
      approvalRules(d, ctx, { requireSources: false });
      if (d.guideStatus === 'approved' && !d.guideVerified && !d.guideApprovedBy) {
        ctx.addIssue({ code: 'custom', message: 'מדריך כתוב מאושר חייב לכלול guideVerified (תאריך בדיקה מול האפליקציה) או guideApprovedBy' });
      }
    }),
});

/** מדריכים כלליים (Markdown). */
const guides = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/guides' }),
  schema: z
    .object({
      title: z.string(),
      summary: z.string(),
      lead: z.string().optional(), // תת כותרת בראש העמוד, שורה אחת (עד ~32 תווים)
      order: z.number().default(100),
      keywords: z.array(z.string()).default([]),
      link: z.url().optional(),
      linkLabel: z.string().optional(),
      /** סרטוני הדרכה: file הוא שם קובץ תחת public/videos/<שם-המדריך>/ */
      /** מציג את הסעיפים כשלבים פתוחים לפי סדר */
      steps: z.boolean().default(false),
      videos: z.array(z.object({ title: z.string(), file: z.string(), note: z.string().optional(), width: z.number().default(480), height: z.number().default(672) })).default([]),
      /** מדריך אינטראקטיבי עם צילומי מסך (קבצים תחת public/guides/<שם-המדריך>/) */
      walkthrough: z
        .object({
          stepsTitle: z.string(),
          steps: z.array(z.object({ title: z.string(), text: z.string(), tip: z.string().optional(), shots: z.array(z.object({ file: z.string(), alt: z.string() })).default([]) })).min(1),
          note: z.string().optional(),
          troubleTitle: z.string(),
          trouble: z.array(z.object({ title: z.string(), text: z.string() })),
          rightsTitle: z.string(),
          rightsText: z.string(),
          tags: z.array(z.object({ label: z.string(), text: z.string() })),
          rightsShot: z.object({ file: z.string(), alt: z.string() }).optional(),
          rememberTitle: z.string().optional(),
          remember: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
        })
        .optional(),
      sources: z.array(source).default([]),
      ...approvalFields,
    })
    .superRefine((d, ctx) => approvalRules(d, ctx, { requireSources: true })),
});

/** אנשי קשר: שלושה קבצים. אדם אחד יכול להופיע בכמה שיוכים. */
const people = defineCollection({
  loader: file('src/data/people.yaml'),
  schema: z.object({
    name: z.string(),
    phone: z.string().regex(/^05\d{8}$/, 'מספר טלפון נייד ישראלי: 10 ספרות ללא מקפים, מתחיל ב-05'),
    whatsapp: z.enum(['yes', 'no', 'unknown']).default('unknown'),
    role: z.string().optional(),
    ...approvalFields,
  }),
});

const frameworks = defineCollection({
  loader: file('src/data/frameworks.yaml'),
  schema: z.object({ name: z.string(), order: z.number() }),
});

const assignments = defineCollection({
  loader: file('src/data/assignments.yaml'),
  schema: z.object({
    framework: reference('frameworks'),
    units: z.array(z.string()).min(1),
    person: reference('people'),
  }),
});

/** קישורים למערכות שימושיות. */
const links = defineCollection({
  loader: file('src/data/links.yaml'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.url(),
    ...approvalFields,
  }),
});

/** שאלות נפוצות: src/data/faq.yaml */
const faq = defineCollection({
  loader: file('src/data/faq.yaml'),
  schema: z.object({
    q: z.string(),
    a: z.string(),
    group: z.string(),
    rights: z.array(reference('rights')).default([]), // קישור לעמוד המלא
    order: z.number().default(100),
  }),
});

/** מילון מושגים: src/data/glossary.yaml */
const glossary = defineCollection({
  loader: file('src/data/glossary.yaml'),
  schema: z.object({ term: z.string(), meaning: z.string(), aliases: z.array(z.string()).default([]) }),
});

/** "לא יודע מאיפה להתחיל?": src/data/quiz.yaml. כל ענף הוא קושי עיקרי עם שאלות המשך ותוצאות. */
const quiz = defineCollection({
  loader: file('src/data/quiz.yaml'),
  schema: z.object({
    label: z.string(),
    order: z.number(),
    base: z.array(reference('rights')).default([]), // תוצאות שמוצגות תמיד בענף
    questions: z
      .array(
        z.object({
          q: z.string(),
          options: z.array(z.object({ label: z.string(), add: z.array(reference('rights')).default([]) })).min(2),
        }),
      )
      .default([]),
  }),
});

export const collections = { rights, banks, guides, people, frameworks, assignments, links, faq, glossary, quiz };
