# Feature Inventory — original `kanji-flashcards.html`

This is the parity checklist for the React rebuild. Every item here must survive
the migration. Each line is audited PASS/FAIL in Phase 5 with a note on where the
feature now lives.

Source: single-file vanilla app, 2,904 lines (CSS `:root` tokens + 8 `<section>`
screens + ~1,750 lines of JS). Screen switching is done by `showScreen(id)` which
toggles an `.active` class — the mental model the React `screen` union mirrors.

---

## A. Screens (8 `.screen` sections + 2 floating bars)

| # | Screen id | Purpose |
|---|-----------|---------|
| A1 | `welcome-screen` | Splash: 漢字 logo, title "Kanji Flash", value subtitle, "Get started →". |
| A2 | `level-screen` | JLPT level picker: N5, N4 unlocked; N3/N2/N1 locked; "My Decks" entry. |
| A3 | `deck-list-screen` | "My Decks" — list of custom decks, combined mastery bar, New/Save/Levels actions. |
| A4 | `deck-editor-screen` | Create/edit one custom deck: name, quiz-style select, card rows, save/play/delete. |
| A5 | `topic-screen` | Topic picker for active level: mastery bar, global stats, study link, dynamic + standard + all-cards grids. |
| A6 | `study-screen` | Reference study list grouped by topic, each row speakable. |
| A7 | `game-screen` | The flashcard quiz (phase 1 meaning / phase 2 reading). |
| A8 | `end-screen` | Topic-complete results: emoji, score, message, personal best, time, retry/choose-another. |
| A9 | `#score-bar` (floating) | Cards-left counter, timer (with warn/hot color tiers), live score, prev-best lines. |
| A10 | `#progress-wrap` (floating) | Thin progress line under score bar showing unique cards cleared. |
| A11 | `#toast` (floating) | Slide-up confirmation toast (save/delete/validation). |

## B. Data

| # | Feature | Detail |
|---|---------|--------|
| B1 | N5 deck | 80 cards, 8 topics (Numbers, Time, Nature, People, Directions, Study, Verbs, Adjectives). |
| B2 | N4 deck | 164 cards, 9 topics (Time, People, Body, Places, Movement, Actions, Adjectives, Nature, Study). |
| B3 | Card shape | `{ kanji, english, reading, romaji }` + derived `englishAlts`. Total 244 built-in cards. |
| B4 | `englishAlts` derivation | Split `english` on `/`, trim/lowercase each part, add full string, add `"to "+part` forms; de-duped. |
| B5 | Topic shape | `{ name, sample, keys: [kanji...] }`. Topics reference cards by `kanji` string. |
| B6 | Level registry | `LEVELS = { N5, N4 }`; `deck`/`topics` are active pointers swapped by `setActiveLevel`. |

## C. Quiz engine (`game-screen`)

| # | Feature | Detail |
|---|---------|--------|
| C1 | Two-step quiz ("both") | Phase 1 asks meaning (kanji shown, English hidden); phase 2 asks reading (English revealed). |
| C2 | Meaning-only mode | Single phase asking meaning only (custom decks). |
| C3 | Reading-only mode | Single phase asking reading only; English stays hidden so it isn't a giveaway. |
| C4 | Meaning check | `checkMeaning()` — accepts any `englishAlts` member; case-insensitive, trimmed. |
| C5 | Reading check | `checkReading()` — accepts exact hiragana `reading` OR `romaji`; trimmed/lowercased. |
| C6 | Correct feedback | "✓ Correct!", green feedback + `flash-correct` card border, score++. |
| C7 | Wrong feedback | Shows correct answer; reading wrong also shows romaji in parens; red `flash-wrong`. |
| C8 | Mistake re-insertion | `reinsertCurrent()` splices a repeat copy 3–8 cards ahead (or appends if last); "coming back in N cards" message. |
| C9 | Scoring | 2 pts/card in "both" (1 meaning + 1 reading), 1 pt in single modes. `score / totalAsked`. |
| C10 | Shuffle | Fisher-Yates copy of the topic's cards at game start. |
| C11 | Cards-left counter | Counts UNIQUE remaining kanji from current index onward (duplicates don't inflate). |
| C12 | Progress fill | `(uniqueCleared / uniqueTopicCount) * 100`% width. |
| C13 | Phase labels | "Phase 1 · Meaning" / "Phase 2 · Reading" for both-mode; "Meaning"/"Reading" for single. |
| C14 | Next/Finish button | Last card shows "Finish →"; wrong answer shows "Got it — next card →". |
| C15 | Enter-to-advance | Global keydown: Enter triggers Check (in input) then the visible Next button (input disabled). |
| C16 | Card entrance animation | `slideIn` re-triggered each `renderCard`. |
| C17 | Seen tracking | Each rendered card's kanji added to current level's `seenSet`. |
| C18 | Session mistakes | Per-game `Set` deciding green vs yellow mastery on clear. |

## D. Topic picker (`topic-screen`)

| # | Feature | Detail |
|---|---------|--------|
| D1 | Standard topic grid | 2-col grid, one card per topic, sample kanji + name + card count; click starts game. |
| D2 | Dynamic "Cards seen" | Built from `seenSet`; locked when empty; click plays all seen cards. |
| D3 | Dynamic "Mistakes" | Built from `mistakeSet`; locked when empty; click plays all missed cards. |
| D4 | All-cards button | Full-width card (全) starting a game over the whole deck. |
| D5 | Level mastery bar | Green (cleared no-slip) / yellow (cleared with slip) / empty segments + legend counts. |
| D6 | Global stats banner | Total score, sessions played, best accuracy across sessions. |
| D7 | Level label | "Choose a topic N5/N4" colored badge. |
| D8 | Study-first link | "📚 Study the kanji first" → study screen. |
| D9 | Save progress button | 💾 manual save with toast. |

## E. Study list (`study-screen`)

| # | Feature | Detail |
|---|---------|--------|
| E1 | Sections per topic | Heading "Topic · N kanji". |
| E2 | Per-kanji rows | Big kanji, English meaning, reading + romaji. |
| E3 | Speak button per row | 🔊 plays the reading; pulses while playing. |
| E4 | Build-once caching | Built on first open, reused; cleared when level changes. |

## F. Custom decks (`deck-list-screen` + `deck-editor-screen`)

| # | Feature | Detail |
|---|---------|--------|
| F1 | Deck list | Rows with name, card count, quiz-style label, Play + Edit buttons; empty state message. |
| F2 | Combined custom mastery bar | Green/yellow/empty across all custom decks' cards; hidden when no cards. |
| F3 | New deck | Creates blank `{id,name:'',phaseMode:'both',cards:[]}`, opens editor. |
| F4 | Edit deck | Loads deck into editor by id. |
| F5 | Deck name field | Free text. |
| F6 | Quiz-style select | both / meaning / reading, with live hint text. |
| F7 | Card rows | Front (kanji/word), Meaning, Reading inputs; per-row remove ✕; numbered. |
| F8 | Field dimming | Meaning dimmed in reading-mode; reading dimmed in meaning-mode. |
| F9 | Add card row | Appends blank row, focuses it, syncs unsaved edits first. |
| F10 | Remove card row | Splices row, syncs first. |
| F11 | Validate | Name required; play requires ≥1 complete card per the mode's required fields. |
| F12 | Save deck | Stays on editor, persists, toast. |
| F13 | Save & play | Validates for play, persists, launches. |
| F14 | Play from list | Validates, launches without editing. |
| F15 | Delete deck | `confirm()` then remove + persist + toast + back to list. |
| F16 | Launch as level | Custom deck becomes active `deck`, `currentLevel = "custom:<id>"`, single all-cards topic. |
| F17 | Custom `englishAlts` | Built via `buildAlts` (same rule as built-ins). |
| F18 | Per-deck unique id | `deck_<timestamp>_<rand>`. |

## G. Mastery & progress model

| # | Feature | Detail |
|---|---------|--------|
| G1 | `cardStatus` map | Keyed `"<level>:<kanji>"` → `'green' | 'yellow'`; most-recent-clear semantics. |
| G2 | `seenByLevel` | Per-level `Set` of seen kanji (incl. `custom:<id>`). |
| G3 | `mistakeByLevel` | Per-level `Set` of missed kanji. |
| G4 | Personal bests | Keyed `"<level>:<topic>"` → `{bestScore,bestTotal,bestTime}`; best score AND best time tracked separately. |
| G5 | Global totals | `globalTotalScore`, `globalTotalAsked`, `globalSessions`. |

## H. Timer & score bar

| # | Feature | Detail |
|---|---------|--------|
| H1 | Timer | Counts up per second from game start; `m:ss`. |
| H2 | Timer color tiers | `timer-warn` ≥120s (gold), `timer-hot` ≥300s (coral). |
| H3 | Prev-best lines | "best m:ss" and "best X / Y" under timer & score when a PB exists. |
| H4 | Tabular numerals | Timer digits don't shift width. |

## I. End screen (`end-screen`)

| # | Feature | Detail |
|---|---------|--------|
| I1 | Emoji + message tiers | 🏆 100%, 🎉 ≥80%, 👍 ≥60%, 📚 ≥40%, 💪 below. |
| I2 | Final score | `score / total` (2 pts/card note). |
| I3 | Topic label | "Topic · N unique cards". |
| I4 | Personal-best strip | New-best-score / new-best-time / both / neither variants; gold border on new record. |
| I5 | Time taken | This run's elapsed time. |
| I6 | Retry topic | Replays same topic. |
| I7 | Choose another | Custom → deck list; built-in → topic picker (refreshing mastery bar). |
| I8 | Auto-save on finish | `saveProgress(true)` silently persists. |

## J. Audio (speech synthesis)

| # | Feature | Detail |
|---|---------|--------|
| J1 | Japanese voice detection | `getVoices().find(v => v.lang.startsWith('ja'))`; listens `voiceschanged`. |
| J2 | Speak current card | Reading spoken at rate 0.85, lang ja-JP; cancels in-flight; pins `wordToSpeak`. |
| J3 | Speak arbitrary word | Study-list rows; pulses the passed button. |
| J4 | Playing visual state | `.playing` class on sound buttons while audio active. |

## K. Persistence (localStorage)

| # | Feature | Detail |
|---|---------|--------|
| K1 | Storage key | `kanjiflash-progress`. |
| K2 | Saved shape | `{personalBests, globalTotalScore, globalTotalAsked, globalSessions, seenByLevel(arrays), mistakeByLevel(arrays), cardStatus, customDecks, savedAt}`. |
| K3 | Set serialization | Sets → arrays on save, arrays → Sets on load. |
| K4 | Load on init | Restores all of the above; refreshes UI. |
| K5 | Graceful failure | try/catch on save & load; toast on save error; silent on load miss. |
| K6 | Legacy drop | Old flat seen/mistake lists with no level info are dropped, not mis-attributed. |

## L. Theming / visual design

| # | Feature | Detail |
|---|---------|--------|
| L1 | Design tokens | `:root` vars: bg/surface/surface2/accent/accent-soft/gold/text/text-dim/correct/wrong/radius/radius-sm. |
| L2 | Fonts | Noto Sans JP (kanji) + Inter (UI), via Google Fonts. |
| L3 | Dark indigo theme | bg `#1a1a2e`, surface `#16213e`, accent `#e94560`. |
| L4 | Component styles | Buttons, cards, topic cards (seen/mistake/all/custom color variants), mastery bar, etc. |
| L5 | Mobile tweak | `@media (max-width:480px)` shrinks kanji + button padding. |

---

## Behaviors that change in the rebuild (explicitly allowed by the prompt)

- **C8 mistake re-insertion → Leitner SRS (F1).** The 3–8-card splice is replaced by
  5-box spaced repetition; the *re-show-misses* intent is preserved, scheduling improves.
- **Navigation back-labels** unified into one `AppHeader` (F5) — original had "← Levels",
  "← My Decks", "← Back" inconsistently.
- **Persistence gains `schemaVersion`** and export/import (F4); session-only personal-bests
  and global stats become durable.
- **Audio** hardened with Safari polling + explicit `isAvailable:false` UI (F2).
- **Reading input** gains live wanakana romaji→kana conversion + tolerance rules (F3).
- New: onboarding flow (F7), PWA/offline (F9), responsive thumb-zone layout (F6), a11y (F8).
