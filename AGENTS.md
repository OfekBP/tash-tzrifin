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

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
