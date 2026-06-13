# Architecture

This doc is written for someone newer to the codebase (or to React/TypeScript). It
explains the big picture, what each folder does, how data moves through the app, and
the two pieces of logic worth understanding first: the Leitner scheduler and the
storage layer. For the line-by-line feature-parity checklist against the original app,
see [FEATURE_INVENTORY.md](./FEATURE_INVENTORY.md) — this doc won't repeat it.

## The big picture

Kanji Flash is a **single-page app (SPA) built with Vite**. There is **no backend and
no database**. Everything the app needs is either:

- **bundled into the build** — the kanji content lives in plain JSON files
  (`src/data/cards.json`, `src/data/topics.json`), or
- **stored on the user's own device** — your progress and custom decks are saved in the
  browser's `localStorage`.

That means the whole app is just static files. Open it once and it runs forever, even
offline (see the PWA note at the end).

### Why the kanji live in JSON

The card content is data, not code. Keeping it in JSON means a **contributor can add or
fix a kanji by editing one JSON file** — no React, no TypeScript, no rebuild logic to
understand. The trade-off with hand-edited data is that a typo (a missing field, a wrong
level) could silently break the quiz later. So `src/data/cards.ts` **validates every
card at load time** and throws immediately, naming the bad entry, if anything is off.
Bad data fails *loudly and early* instead of crashing the quiz far from its cause.

## What each part does

| Path | Responsibility |
|------|----------------|
| `src/types.ts` | The shared vocabulary: `Card`, `Deck`, `Progress`, `CardState`, the `Screen` union, etc. Every module imports its types from here, so a `Card` means exactly one thing everywhere. |
| `src/data/` | The content. `cards.json` (244 cards) + `topics.json` hold the data; `cards.ts` imports, **validates**, and enriches it (it derives each card's accepted-answer list, `meaningAlts`). |
| `src/lib/scheduler.ts` | The Leitner spaced-repetition logic. Pure functions only — see below. |
| `src/lib/storage.ts` | Versioned `localStorage` read/write, migration of older saves, and export/import. Never throws on bad data. |
| `src/lib/kana.ts` | A forgiving wrapper around `wanakana`: converts romaji/katakana to hiragana and decides whether a typed reading is "close enough" to be correct. |
| `src/lib/speech.ts` | A wrapper around the browser's speech synthesis that reliably finds a Japanese (`ja-JP`) voice — including on Safari, which never fires the usual "voices ready" event. |
| `src/context/AppContext.tsx` | The app's shared brain: current screen, progress, decks, and the small methods that mutate them. The typed equivalent of the original app's `showScreen()` + module-level state. |
| `src/components/` | Small reusable UI pieces (header, score bar, quiz input, speaker button, toast…). |
| `src/screens/` | One component per full-screen view (level picker, topic picker, study list, quiz, results, deck list, deck editor). One is visible at a time. |
| `src/styles/` | `tokens.css` (design variables), plus global and component CSS. |

## How data flows

One screen is visible at a time. Which one is decided by the typed `Screen` union in
`types.ts` (`'onboarding' | 'level' | 'topic' | 'study' | 'quiz' | 'results' |
'deckList' | 'deckEditor'`). This directly replaces the original app's `showScreen(id)`
trick of toggling an `.active` CSS class — now it's a single value in state that React
renders from.

```
  cards.json / topics.json        (the bundled content)
            │
            ▼
  src/data/cards.ts               (imports + VALIDATES + enriches → Card[])
            │
            ▼
  AppContext  ◄───────────────────────────────────────────┐
   (screen, progress, decks, session — the app's state)    │
            │                                               │
            ▼                                               │ context methods
  screens/ + components/          render the current state  │ (selectLevel,
            │                                               │  resolveCard,
            │  user input (taps, typed answers)             │  finishGame, …)
            ▼                                               │
  context mutators ───────────────────────────────────────┘
            │
            ├──► scheduler.ts   (grade a card → new Leitner box + due date)
            │
            ▼
  storage.ts  ──►  localStorage   (auto-saved by an effect on every change)
```

Read it top-to-bottom for a fresh load, and follow the loop on the right during play:
the user answers, a context method updates `progress` (often by calling the scheduler),
and an effect quietly writes the new state back to `localStorage`.

## The Leitner scheduler

`src/lib/scheduler.ts` is a tiny spaced-repetition system. Every function is **pure** —
given the same inputs it returns the same output and never mutates its arguments, and it
takes the current time (`now`) as a parameter rather than reading the clock. That makes
it trivial to unit-test.

The idea: each card sits in one of **5 boxes**. When a card is due, you review it.

- **Get it right →** the card moves **up one box** (capped at box 5).
- **Get it wrong →** the card drops **all the way back to box 1**.

The box decides how long until the card is due again, in whole days:

| Box | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|
| Days until due | 0 | 1 | 2 | 4 | 8 |

Box 1 is `0` days — "due immediately" — so brand-new and just-missed cards come straight
back.

**The review queue.** This is what makes the SRS real rather than decorative.
`scheduler.getDueCards(states, now)` returns the cards whose `due` date has passed;
`game.buildDueSession(level, cardStates, now)` turns those into a play session; and the
topic screen shows a **"🔁 Review N due cards"** button that starts it. Studying any
topic still works at any time, but graded results always update the schedule, and the
review button routes you to exactly what's due.

**Two-step rule.** In the default `both` mode a card counts as correct only if you pass
*both* the meaning step and the reading step. The screen enforces that and then calls
the scheduler with a single boolean; the scheduler itself stays dumb about phases.

**Tiny example.** A new card 水 starts in box 1, due now.

1. You answer it correctly → it moves to **box 2**, due in **1 day**.
2. A day later it's due again; correct again → **box 3**, due in **2 days**.
3. Two days later you slip → straight back to **box 1**, due **now**, to drill again.

## The storage layer

`src/lib/storage.ts` persists the whole app state as one JSON blob under a single
`localStorage` key (`kanjiflash-progress`). The blob carries a **`schemaVersion`**
(currently `1`). The version is the seam for the future: when the saved shape needs to
change, you bump `SCHEMA_VERSION` and add a forward-migration step, so an existing user's
data upgrades in place instead of being lost. The loader already does this for the
**original app's legacy save** (which had no version at all): it detects the old flat
shape, maps its fields into the new one, and starts everyone fresh in box 1 (the old app
had no Leitner history). Throughout, the layer is defensive — corrupt JSON, a quota
error, or a save written by a *newer* app version all degrade gracefully to an empty
state and a console warning, so one bad write can never brick the app.

## Accessibility & contrast note

The design tokens in `src/styles/tokens.css` were **ported verbatim** from the original
single-file app's `:root` block — same dark-indigo "night sky" theme, same coral-red
"ink stamp" accent — with **one deliberate exception** for accessibility.

The original secondary-text colour `--text-dim` (`#8892a4`) on the `--surface`
background (`#16213e`) measures roughly **3.9:1** contrast. That's just under the
**WCAG AA threshold of 4.5:1** required for normal-size body text, so small dim copy was
technically failing AA. Rather than retint everything, a new token was added:

```css
--text-dim-aa: #9aa6ba;  /* ~4.6:1 on --surface — passes AA for normal text */
```

`--text-dim` is kept for large or genuinely secondary text, while `--text-dim-aa` is
used for the small body copy that must pass AA. Both the original tokens and this added
one are documented inline in `tokens.css`.
