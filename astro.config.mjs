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
  build: { format: 'directory' },
});
