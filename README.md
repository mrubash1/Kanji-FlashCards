# 漢字 Kanji Flash

Learn JLPT N5 & N4 kanji with a two-step flashcard quiz and Leitner spaced repetition — offline-ready, no account, all your data stays on your device.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

**Live demo:** _coming soon_ <!-- TODO: add Vercel URL after first deploy -->

<!-- TODO: screenshots
Capture three screens and drop the PNGs in docs/screenshots/, then embed them here:
  1. The level picker (N5 / N4 / My Decks).
  2. The two-step quiz mid-question (phase 1 meaning, or phase 2 reading).
  3. The deck editor with a couple of custom card rows filled in.
-->

## Features

Kanji Flash is a rebuild of a single-file vanilla app into a production React PWA.
The headline features:

- **Leitner spaced repetition (SRS).** Cards live in 5 boxes; getting one right
  promotes it (longer wait before it returns), getting one wrong sends it back to
  box 1 to review soon.
- **Two-step quiz.** Step 1 asks the *meaning*, step 2 asks the *reading*. A card
  only counts as mastered if you clear both steps.
- **Meaning-only & reading-only modes.** Pick a simpler single-step quiz, handy for
  custom decks.
- **Custom decks.** Build your own decks in the editor; choose the quiz style per deck.
- **Study list.** Browse every kanji for a level, grouped by topic, before you quiz.
- **Audio.** Hear the reading spoken aloud using a Japanese (`ja-JP`) voice when your
  browser has one.
- **Forgiving reading input.** Type romaji (`mizu`) and it converts to kana (`みず`)
  live; katakana and long-vowel variants are accepted too.
- **Export / import.** Download your progress as JSON and restore it on another device.
- **Responsive, mobile-first.** Thumb-friendly layout that scales from phone to desktop.
- **Offline PWA.** Installable to your home screen; works offline after the first load.
- **Accessibility.** Keyboard-friendly, screen-reader labels, and AA-contrast text
  (checked with axe in the e2e suite).

## Tech stack

- **React 18** + **TypeScript** (strict mode)
- **Vite 6** for dev/build
- **vite-plugin-pwa** (Workbox) for the manifest + offline service worker
- **wanakana** for romaji ⇄ kana conversion
- **Vitest** for unit tests, **Playwright** + **@axe-core/playwright** for e2e and
  accessibility tests
- No backend — all data is bundled JSON plus the browser's `localStorage`.

## Local development

```bash
npm install
npm run dev      # start the Vite dev server (hot reload)
```

### Build & preview

```bash
npm run build    # typecheck (tsc --noEmit) then build to dist/ (PWA assets generated)
npm run preview  # serve the production build locally
```

## Testing

```bash
npm run test       # unit tests (Vitest)
npm run test:e2e   # end-to-end + a11y tests (Playwright)
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
```

`npm run test:e2e` builds the app and serves the preview automatically, so you don't
need a dev server running. The **first** time you run it, install the browsers it
drives:

```bash
npx playwright install chromium webkit
```

## Project structure

```
src/
  lib/         scheduler, storage, kana, speech — framework-free logic, unit-tested
  data/        cards.json + topics.json (the kanji content) and the cards.ts loader
  context/     AppContext — app-wide state (the typed showScreen model)
  components/  small reusable UI pieces (header, score bar, inputs, toast, …)
  screens/     one component per full-screen view (level, quiz, deck editor, …)
  styles/      design tokens + global and component CSS
  types.ts     shared domain types (Card, Deck, Progress, Screen, …)
tests/
  unit/        Vitest unit tests for the lib modules
  e2e/         Playwright flows + axe accessibility helpers
docs/          architecture, deployment, and the feature-parity inventory
```

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 Jon Rubashkin.
