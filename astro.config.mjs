// @ts-check
import { defineConfig } from 'astro/config';

// Vercel מגדירה VERCEL=1 בזמן הבנייה: האתר יושב בשורש הדומיין.
// GitHub Pages: https://ofekbp.github.io/tash-tzrifin/
const onVercel = !!process.env.VERCEL;

export default defineConfig({
  site: onVercel
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'localhost'}`
    : 'https://ofekbp.github.io',
  base: onVercel ? '/' : '/tash-tzrifin',
  trailingSlash: 'always',
  // טעינה מוקדמת של עמודים, כדי שהמעבר יהיה כמעט מיידי.
  // קישורי הניווט הראשיים (הסרגל התחתון וכרטיסי דף הבית) נטענים כשהם על המסך (data-astro-prefetch="viewport").
  // שאר הקישורים, למשל 13 הזכויות ברשימה, נטענים רק בתחילת הלחיצה, כדי לא לבזבז גלישה על עמודים שלא ייפתחו.
  prefetch: { prefetchAll: true, defaultStrategy: 'tap' },
  build: { format: 'directory' },
});
