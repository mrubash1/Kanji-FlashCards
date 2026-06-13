# Parity Audit — original `kanji-flashcards.html` → React rebuild

Every line of [FEATURE_INVENTORY.md](./FEATURE_INVENTORY.md) audited against the
rebuilt app. Verified by unit tests (54), Playwright e2e (11), and manual smoke
runs. **Result: every feature PASS.** Items intentionally changed by the brief
are marked PASS (changed) with a pointer to the deviation.

## A. Screens

| # | Status | Where it lives now |
|---|--------|--------------------|
| A1 Welcome/splash | PASS (folded into onboarding) | `src/screens/Onboarding.tsx` step 0 |
| A2 Level picker | PASS | `src/screens/LevelPicker.tsx` |
| A3 Deck list | PASS | `src/screens/DeckList.tsx` |
| A4 Deck editor | PASS | `src/screens/DeckEditor.tsx` |
| A5 Topic picker | PASS | `src/screens/TopicPicker.tsx` |
| A6 Study list | PASS | `src/screens/StudyList.tsx` |
| A7 Game screen | PASS | `src/screens/Quiz.tsx` |
| A8 End screen | PASS | `src/screens/Results.tsx` |
| A9 Score bar | PASS | `src/components/ScoreBar.tsx` |
| A10 Progress line | PASS | `Quiz.tsx` `.progress-fill` |
| A11 Toast | PASS | `src/components/Toast.tsx` + context `showToast` |

## B. Data

| # | Status | Where |
|---|--------|-------|
| B1 N5 deck (80, 8 topics) | PASS | `src/data/cards.json` + `topics.json` (verified by `scripts/verify-cards.mjs`) |
| B2 N4 deck (164, 9 topics) | PASS | same |
| B3 Card shape (244 total) | PASS | `Card` in `src/types.ts`; loader `src/data/cards.ts` |
| B4 meaningAlts derivation | PASS | `buildMeaningAlts` in `src/data/cards.ts` (same split-on-/ + "to " rule) |
| B5 Topic shape | PASS | `Topic` in `src/types.ts`; `topics.json` |
| B6 Level registry / active pointers | PASS | `TOPICS`/`getCardsByLevel` + `level`/`levelKey` in context |

## C. Quiz engine

| # | Status | Where |
|---|--------|-------|
| C1 Two-step (both) | PASS | `Quiz.tsx` meaning→reading |
| C2 Meaning-only | PASS | `Quiz.tsx` (`phaseMode` 'meaning') |
| C3 Reading-only | PASS | `Quiz.tsx` (English kept hidden) |
| C4 Meaning check | PASS | `isMeaningCorrect` in `src/lib/game.ts` |
| C5 Reading check (+romaji) | PASS (improved) | `isReadingCorrect` in `src/lib/kana.ts` (F3 tolerance) |
| C6 Correct feedback | PASS | `Quiz.tsx` `.feedback.correct` + `flash-correct` |
| C7 Wrong feedback (+romaji) | PASS | `Quiz.tsx` `.feedback.wrong` |
| C8 Mistake re-insertion | PASS (replaced) | Replaced by Leitner SRS (F1) — see `src/lib/scheduler.ts`; missed cards reset to box 1, return next session |
| C9 Scoring (2/1 pts) | PASS | `pointsPerCard` in `game.ts`; `Quiz.tsx` total math |
| C10 Shuffle | PASS | `shuffle` in `game.ts` (Fisher–Yates copy) |
| C11 Cards-left counter | PASS | `Quiz.tsx` `cardsLeft` |
| C12 Progress fill | PASS | `Quiz.tsx` `progressPct` |
| C13 Phase labels | PASS | `Quiz.tsx` `phaseLabel` |
| C14 Next/Finish wording | PASS | `Quiz.tsx` `nextLabel` |
| C15 Enter-to-advance | PASS | `QuizInput` onEnter + focus-Next effect (`Quiz.tsx`) |
| C16 Card entrance animation | PASS (slide-only) | `components.css` `@keyframes slideIn` (opacity fade dropped for AA) |
| C17 Seen tracking | PASS | `markSeen` (context) per card |
| C18 Session mistakes → mastery | PASS | `missedRef` + `resolveCard` (green/yellow) |

## D. Topic picker

| # | Status | Where |
|---|--------|-------|
| D1 Standard grid | PASS | `TopicPicker.tsx` |
| D2 Cards seen tile | PASS | `TopicPicker.tsx` DynamicTile (seen) |
| D3 Mistakes tile | PASS | `TopicPicker.tsx` DynamicTile (mistakes) |
| D4 All-cards button | PASS | `TopicPicker.tsx` `.all-card` |
| D5 Level mastery bar | PASS (extended) | `MasteryBar.tsx` + Leitner box strip + due pill (F1) |
| D6 Global stats banner | PASS | `TopicPicker.tsx` `.global-stats` |
| D7 Level label | PASS | `AppHeader` title `Topics · N5` |
| D8 Study-first link | PASS | `TopicPicker.tsx` study link |
| D9 Save progress | PASS (automatic) | Auto-persist effect in context; manual backup via `DataControls` |

## E. Study list

| # | Status | Where |
|---|--------|-------|
| E1 Sections per topic | PASS | `StudyList.tsx` |
| E2 Per-kanji rows | PASS | `StudyList.tsx` |
| E3 Speak button per row | PASS | `SpeakerButton variant="round"` |
| E4 Build-once caching | PASS (React render) | Rendered on demand from data; no manual cache needed |

## F. Custom decks

| # | Status | Where |
|---|--------|-------|
| F1 Deck list rows | PASS | `DeckList.tsx` |
| F2 Combined custom mastery | PASS | `DeckList.tsx` `useMemo` + `MasteryBar` |
| F3 New deck | PASS | `openNewDeck` (context) |
| F4 Edit deck | PASS | `openDeck` (context) |
| F5 Deck name | PASS | `DeckEditor.tsx` |
| F6 Quiz-style select + hint | PASS | `DeckEditor.tsx` `PHASE_HINT` |
| F7 Card rows | PASS | `DeckEditor.tsx` |
| F8 Field dimming | PASS | `DeckEditor.tsx` `ce-dim` |
| F9 Add card row | PASS | `DeckEditor.tsx` `addCard` |
| F10 Remove card row | PASS | `DeckEditor.tsx` `removeCard` |
| F11 Validate | PASS | `validateDeck` in `game.ts` |
| F12 Save deck | PASS | `DeckEditor.tsx` `save` |
| F13 Save & play | PASS | `DeckEditor.tsx` `saveAndPlay` |
| F14 Play from list | PASS | `DeckList.tsx` `playDeck` |
| F15 Delete deck (confirm) | PASS | `DeckEditor.tsx` `remove` |
| F16 Launch as level | PASS | `buildDeckSession` (`custom:<id>`) |
| F17 Custom meaningAlts | PASS | `finalizeDeckCards` → `buildMeaningAlts` |
| F18 Per-deck unique id | PASS | `makeDeckId` in `game.ts` |

## G. Mastery & progress model

| # | Status | Where |
|---|--------|-------|
| G1 cardStatus (green/yellow) | PASS | `Progress.cardStatus`, key via `src/lib/keys.ts` |
| G2 seenByLevel | PASS | `Progress.seenByLevel` |
| G3 mistakeByLevel | PASS | `Progress.mistakeByLevel` |
| G4 Personal bests | PASS | `finishGame` (context) |
| G5 Global totals | PASS | `finishGame` (context) |
| — Leitner cardStates (new) | PASS (new, F1) | `Progress.cardStates` + `scheduler.ts` |

## H. Timer & score bar

| # | Status | Where |
|---|--------|-------|
| H1 Timer count-up | PASS | `Quiz.tsx` interval |
| H2 Timer colour tiers | PASS | `ScoreBar.tsx` `timerClass` |
| H3 Prev-best lines | PASS | `ScoreBar.tsx` `prevBestTime/Score` |
| H4 Tabular numerals | PASS | `.timer-display` CSS |

## I. End screen

| # | Status | Where |
|---|--------|-------|
| I1 Emoji + message tiers | PASS | `resultTier` in `game.ts` |
| I2 Final score | PASS | `Results.tsx` |
| I3 Topic label | PASS | `Results.tsx` |
| I4 Personal-best strip (variants) | PASS | `Results.tsx` `pbText` |
| I5 Time taken | PASS | `Results.tsx` |
| I6 Retry topic | PASS | `Results.tsx` `startSession(session)` |
| I7 Choose another (custom vs built-in) | PASS | `Results.tsx` navigate |
| I8 Auto-save on finish | PASS | persist effect (every progress change) |

## J. Audio

| # | Status | Where |
|---|--------|-------|
| J1 ja voice detection | PASS (hardened) | `src/lib/speech.ts` (voiceschanged + Safari polling, F2) |
| J2 Speak current card | PASS | `SpeakerButton` + `speech.speak` |
| J3 Speak arbitrary word | PASS | `SpeakerButton` on study rows |
| J4 Playing visual state | PASS | `.playing` pulse in `SpeakerButton` |
| — Hidden when unavailable (new) | PASS (F2) | `SpeakerButton` returns null; e2e-verified |

## K. Persistence

| # | Status | Where |
|---|--------|-------|
| K1 Storage key | PASS | `STORAGE_KEY` unchanged (`kanjiflash-progress`) |
| K2 Saved shape | PASS (versioned) | `StorageBlob` + `schemaVersion` (F + constraint 6) |
| K3 Set serialization | PASS | seen/mistake stored as arrays |
| K4 Load on init | PASS | `loadBlob` in context init |
| K5 Graceful failure | PASS | `storage.ts` try/catch, never throws |
| K6 Legacy migration | PASS (improved) | `migrateLegacy` maps the original flat shape (english→meaning), unit-tested |
| — Export/import (new) | PASS (F4) | `DataControls.tsx` + `exportToJson`/`parseImport` |

## L. Theming / visual design

| # | Status | Where |
|---|--------|-------|
| L1 Design tokens | PASS (verbatim + 2 a11y tokens) | `src/styles/tokens.css` |
| L2 Fonts (Noto Sans JP + Inter) | PASS | `index.html` Google Fonts |
| L3 Dark indigo theme | PASS | tokens unchanged |
| L4 Component styles | PASS | `src/styles/components.css` (same class names) |
| L5 Mobile tweak | PASS (extended, F6) | `components.css` mobile-first + thumb-zone |

## New features added (the brief's F1–F10)

| Feature | Status | Where |
|---------|--------|-------|
| F1 Leitner SRS | PASS | `src/lib/scheduler.ts` (+ box strip, due count) |
| F2 Audio reliability | PASS | `src/lib/speech.ts` |
| F3 Kana input + tolerance | PASS | `src/lib/kana.ts` + `QuizInput.tsx` |
| F4 Export/import | PASS | `DataControls.tsx` + `storage.ts` |
| F5 Consistent navigation | PASS | `AppHeader.tsx` |
| F6 Responsive, mobile-first | PASS | `components.css` |
| F7 Onboarding / empty states | PASS | `Onboarding.tsx`, empty states in DeckList/TopicPicker/Quiz |
| F8 Accessibility (WCAG AA) | PASS | landmarks, aria-live, focus rings, contrast fixes; axe-clean |
| F9 PWA / offline | PASS | `vite.config.ts` VitePWA + icons; SW active in preview |
| F10 Repo hygiene | PASS | README, LICENSE, ARCHITECTURE, DEPLOYMENT, .gitignore |
