# valkravchenko

Personal portfolio site. Single page with three sections (home, projects, contacts) linked by anchors.

## Stack

Vite, React, TypeScript (strict), Tailwind CSS 4, Vitest and Testing Library. Fonts (IBM Plex Sans, IBM Plex Mono, Silkscreen) are bundled locally through `@fontsource`.

## Run

```sh
npm install
npm run dev        # dev server
npm test -- --run  # tests
npm run lint       # lint
npm run build      # production build into dist/
```

## Structure

- `src/components/` UI components, each with a test next to it.
- `src/i18n/` text dictionaries (`ru.ts`; add `en.ts` with the same `Dictionary` shape).
- `src/index.css` design tokens (`@theme`), fonts, focus and reduced-motion rules.

Contacts and numbers are placeholders in square brackets until publication.
