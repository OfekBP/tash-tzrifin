## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Before pushing

Run the full check. It type-checks, checks the content, runs the unit tests, builds, and runs the browser tests against the built site at 320/375/390px:

```
npm run verify
```

- `npm run check:content` lists content gaps (warnings) and fails on broken references (errors).
- The browser tests live in `tests/e2e`. They run against `dist`, so build first when running `npx playwright test` on its own.
- Accessibility findings and tap targets under 44px are ratcheted in `tests/e2e/allow/`. After fixing some, refresh the lists with `UPDATE_ALLOW=1 npx playwright test tests/e2e/a11y.spec.ts`.
- Vercel builds with `npm run build:checked` (content check, unit tests, build), so a failing check keeps the previous version live.

## CSS cleanup

`src/styles/global.css` grows by appending overrides. To clean it without changing anything visible:

```
npm run build
STYLES=before npx playwright test tests/e2e/styles.spec.ts
node scripts/css-audit.mjs --list     # what would go: dead rules, unused animations, overridden declarations
node scripts/css-audit.mjs --write
npm run build
STYLES=after npx playwright test tests/e2e/styles.spec.ts
node scripts/compare-styles.mjs before after
```

The last command must report that the snapshots are identical. Never remove the `--dark` variable: `Base.astro` reads it to detect that the stylesheet has loaded.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
