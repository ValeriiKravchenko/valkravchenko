# valkravchenko

[![CI](https://github.com/ValeriiKravchenko/valkravchenko/actions/workflows/ci.yml/badge.svg)](https://github.com/ValeriiKravchenko/valkravchenko/actions/workflows/ci.yml)

Personal portfolio site: a multi-page React app with client-side routing.

## Sections

Sections are listed in the registry `src/data/sections.ts`. Menu and routes are built from it.

| Section | Path | Status |
|---|---|---|
| home | `/` | enabled |
| about | `/about` | enabled |
| projects | `/projects` | enabled |
| automation | `/automation` | enabled |
| library | `/library` | enabled |
| trainers | `/trainers` | enabled |
| contacts | `/contacts` | enabled |
| java | `/java` | disabled |
| basics | `/basics` | disabled |

The `/trainers` page is a showcase. The trainers themselves are a separate HTML entry, `trainers-app/index.html`, served at `/trainers-app/` (hash router, built as a second page in `vite.config.ts`).

A disabled section has no menu item, no route (its path shows the 404 page) and no link on the home page. A section is published only when it has real content.

### Add a section

1. Add the new `id` to `SECTION_IDS` in `src/data/sections.ts` (a closed list) and its menu label to `nav.labels`.
2. Create the page in `src/pages/` (an `h1` via `PageHeading`, and `useDocumentTitle` with a title built by `pageTitle`).
3. Add its texts to `src/i18n/types.ts` (`Dictionary`) and `src/i18n/ru.ts`.
4. Register the page in `PAGES` in `src/routes.tsx` and set `enabled: true` for the section in `src/data/sections.ts`.
5. Add a test next to the page.

## Stack

Vite, React, React Router 8 (`createBrowserRouter`), TypeScript (strict), Tailwind CSS 4, Vitest and Testing Library. Fonts (IBM Plex Sans, IBM Plex Mono) are bundled locally through `@fontsource`.

## Run

```sh
npm install
npm run dev        # dev server
npm test -- --run  # tests
npm run lint       # lint
npm run build      # production build into dist/
```

## CI

On every push to `main` and every pull request, GitHub Actions runs the type check, lint, tests (fails if none ran or any is skipped) and the production build.

## Static hosting

Routes are client-side, so a static host must serve `index.html` for unknown paths (a fallback to `index.html`). Without it, opening `/projects` directly gives a host-level 404 instead of the app.

## Structure

- `src/data/sections.ts` section registry.
- `src/routes.tsx` route tree built from the registry.
- `src/layout/` root layout (skip link, header, menu, footer, focus handling).
- `src/pages/` one component per page, plus the 404 page.
- `src/components/` UI components, each with a test next to it.
- `src/trainers/` trainer logic and screens (git, english).
- `src/trainers-app/` the separate trainers page (`/trainers-app/`) with its own routes.
- `src/i18n/` text dictionaries (`ru.ts`; add `en.ts` with the same `Dictionary` shape).
- `src/index.css` design tokens (`@theme`), fonts, focus and reduced-motion rules.
