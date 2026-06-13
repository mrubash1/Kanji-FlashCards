# CLAUDE.md

Kanji Flash: a JLPT N5/N4 kanji flashcard PWA. Vite 6 + React 18 + TypeScript
(strict), **client-only** — no backend, no router, no state library. Content is
bundled JSON; user progress lives in `localStorage`. It was rebuilt from a single
2904-line vanilla HTML file and is meant as a **teaching reference for a novice**,
so favour plain, well-commented code over clever abstractions.

## Commands

```bash
npm run dev          # Vite dev server, hot reload
npm run build        # tsc --noEmit (both tsconfigs) THEN vite build → dist/
npm run preview      # serve the production build
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit, both tsconfigs
npm run test         # vitest run (unit tests, tests/unit/, jsdom)
npm run test:e2e     # playwright; AUTO builds + previews on :4173 (no dev server needed)
node scripts/verify-cards.mjs   # assert cards.json count matches the original HTML
```

First e2e run only, install browsers: `npx playwright install chromium webkit`.

**Validation gate — run all of these before committing:**
`npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e`

## Architecture (~10 lines)

- Data flow: `cards.json` + `topics.json` → `src/data/cards.ts` (validates +
  derives `meaningAlts`) → `AppContext` → `screens/` render, user input calls
  context mutators → `scheduler.ts` grades → effect auto-saves to `localStorage`.
- **Routing IS the `Screen` union** in `types.ts` (`'onboarding' | 'level' | ...`).
  One screen visible at a time; `navigate(screen)` swaps it. No router lib.
- **One mega `AppContext`** (`src/context/AppContext.tsx`) holds all app state and
  mutators — the typed replacement for the original app's module-level globals.
- **Pure logic lives in `src/lib/`**: `scheduler` (Leitner), `storage` (versioned
  persistence), `kana` (romaji⇄kana + tolerance), `speech`, `game`, `keys`. These
  are framework-free and unit-tested; keep them pure (pass `now` in, don't read it).
- Styling: design tokens (`styles/tokens.css`, ported verbatim from the original)
  + `components.css` using the original class names.

## Conventions & non-obvious gotchas

- **Shared types live ONLY in `src/types.ts`.** Import them; never redefine a
  `Card`/`Deck`/`Progress` etc. inline.
- **No `any`** anywhere in `src/lib` or `src/types` (untrusted input is `unknown` +
  narrowed). Strict tsconfig: `noUnusedLocals`/`noUnusedParameters` are on.
- **Progress keys are `"<levelKey>:<kanji>"`** via `cardKey()` in `src/lib/keys.ts`.
  `levelKey` is `"N5"`, `"N4"`, or `"custom:<deckId>"`. Always build keys with
  `cardKey` — don't hand-concatenate.
- **Storage is versioned.** `StorageBlob.schemaVersion` (`SCHEMA_VERSION`, currently
  `1`). When the saved shape changes: bump `SCHEMA_VERSION` AND add a forward step in
  `migrateForward` (`src/lib/storage.ts`). Loaders never throw — corrupt/newer/quota
  cases warn and fall back to empty. A pre-v1 legacy save (no version) goes through
  `migrateLegacy` (maps `english`→`meaning`, starts everyone in box 1).
- **`QuizInput` is UNCONTROLLED.** wanakana binds to the DOM node and drives its
  `value` live; a controlled React `value` would fight it on every keystroke. Read
  the field via the `QuizInputHandle` ref (`getValue`), never add `value=`.
- **`cards.json` has NO `meaningAlts`** — `cards.ts` derives them with
  `buildMeaningAlts` (split on `/`, lowercase, add `"to "` variants). Don't add the
  field to JSON.
- **`cards.ts` validates every card at load and throws by name** on a bad entry. Do
  not replace `validateCard` with a blind `as RawCard[]` cast.
- **The original HTML is deleted** but lives in git history (commit `bbeb8f8`,
  `kanji-flashcards.html`). `verify-cards.mjs` reads it from there via `git show`.
- **Leitner scheduler** (`src/lib/scheduler.ts`) is pure: 5 boxes, intervals
  `[0,1,2,4,8]` days. Right = +1 box (cap 5); wrong = back to box 1. The two-step
  (`both`) "must pass meaning AND reading" rule is enforced by the Quiz screen, not
  the scheduler — it just takes one boolean.
- **Commits: Conventional Commits** (`feat(lib):`, `fix(a11y):`, `docs:`, `chore:`).

## How-to

- **Add a built-in card:** add an object to `src/data/cards.json` with `id`, `kanji`,
  `meaning`, `reading`, `romaji` (may be `""`), `level` (`"N5"`/`"N4"`), `topic`. If
  it's a new topic value, add it to `src/data/topics.json` under that level. Then run
  `node scripts/verify-cards.mjs` and `npm run test`.
- **Add a level:** extend the `Level` union in `types.ts`, add `LEVELS`/`TOPICS`
  entries in `cards.ts`, add the cards. Touch any screen that hardcodes `'N5' | 'N4'`.
- **Add a persisted field (deck/progress shape change):** add it to the interface in
  `types.ts`, add a coercer/default in `storage.ts`'s `coerceProgress`/`coerceDeck`,
  bump `SCHEMA_VERSION`, and add the migration step. Unit-test the migration.

## Layout

`src/lib/` pure logic · `src/data/` content + loader · `src/context/` AppContext ·
`src/screens/` one per view · `src/components/` reusable UI · `src/styles/` tokens+CSS.
`tests/unit/` Vitest · `tests/e2e/` Playwright + axe. `docs/` has ARCHITECTURE,
PARITY_AUDIT, FEATURE_INVENTORY, DEPLOYMENT — read these for deeper context.
