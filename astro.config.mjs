// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages: https://ofekbp.github.io/tash-tzrifin/
export default defineConfig({
  site: 'https://ofekbp.github.io',
  base: '/tash-tzrifin',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
