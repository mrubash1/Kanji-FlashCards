# Final Report — Kanji Flash rebuild

Kanji Flash was rebuilt from a single 2904-line vanilla `kanji-flashcards.html`
file into a production React 18 + TypeScript (strict) + Vite 6 PWA, client-only
with no backend. This report consolidates the outcome: feature parity, test and
gate status, the deliberate deviations from the original, the known limitations,
and the three manual steps that remain.

## Feature parity

**Every feature of the original survived.** The full line-by-line audit lives in
[PARITY_AUDIT.md](./PARITY_AUDIT.md) (sections A–L plus the new F1–F10); the
summary:

| Area | Result |
|------|--------|
| Screens (welcome → level → decks → topics → study → quiz → results) | PASS — all present, splash folded into onboarding |
| Data (244 built-in cards: N5=80, N4=164; topics; card/meaningAlts derivation) | PASS — verified by `scripts/verify-cards.mjs` |
| Quiz engine (two-step, meaning-only, reading-only, scoring, shuffle, timer, feedback) | PASS — one intentional swap (see below) |
| Topic picker, study list, custom decks | PASS |
| Mastery & progress model, end screen | PASS |
| Audio | PASS — hardened |
| Persistence | PASS — versioned + export/import |
| Theming / visual design (tokens, fonts, dark indigo theme, class names) | PASS — tokens ported verbatim |

Items the brief intentionally changed are marked **PASS (changed)** in the audit
with a pointer to the deviation; see [Intentional deviations](#intentional-deviations)
below.

## Test counts & runtimes

- **73 unit tests** (Vitest, jsdom) across 6 files — `scheduler`, `storage`,
  `kana`, `game`, `cards`, `speech`. Runs in **under 1 second**.
- **13 e2e tests** (Playwright + `@axe-core/playwright`) across 5 files — `smoke`,
  `quiz-flow`, `deck-crud`, `a11y`, `srs`. **~6s on chromium locally**;
  **chromium + webkit in CI**.

## Type-check / lint / build status

All gate steps are **green**:

| Step | Result |
|------|--------|
| `npm run lint` | clean |
| `npm run typecheck` | clean — **no `any`** in `src/lib` or `src/types` (untrusted input is `unknown` + narrowed) |
| `npm run test` | 73 passing |
| `npm run build` | **no warnings**; `tsc --noEmit` passes, then `vite build` emits the PWA **service worker** + **manifest** with a **14-entry precache** |
| `npm run test:e2e` | passing (chromium local; chromium + webkit in CI) |

## Intentional deviations

These differ from the original by design, per the brief:

- **Mistake re-insertion → Leitner SRS.** The original re-queued missed cards
  within the same session; this is replaced by a 5-box Leitner scheduler
  (`src/lib/scheduler.ts`, intervals `[0,1,2,4,8]` days). A miss resets a card to
  box 1 and it returns next session.
- **Manual save → automatic persistence.** Progress now auto-saves on every
  change via a context effect, rather than requiring a "Save progress" tap (which
  remains as an explicit backup via `DataControls`).
- **Durable personal-bests & global stats.** Previously session-only; now
  persisted across sessions.
- **Single `AppHeader`** replaces the original's three separate back-label
  patterns, for consistent navigation.
- **Audio hardened.** When no `ja-JP` voice exists, speaker buttons are
  **disabled with an explanatory tooltip** rather than silently hidden — no
  silent failures.
- **Reading input gains live romaji → kana.** Typing `mizu` converts to `みず`
  live (wanakana); katakana and long-vowel variants are accepted.
- **Versioned storage + export/import.** Added `schemaVersion` (with forward
  migration and a legacy pre-v1 path) and full JSON export/import.
- **Strict CSP + security headers** added for the public deploy
  (`vercel.json`) — defense-in-depth, clickjacking and MIME-sniffing protection.

## Known limitations

- **Local-only persistence.** Data lives in `localStorage` (~5 MB cap; the app
  uses a few KB). Mobile browsers can evict an unused PWA's storage — mitigated by
  full **export/import** and a `navigator.storage.persist()` request — but there
  is **no cross-device sync**. (Upgrade path if needed: swap the backend to
  IndexedDB behind the existing `storage.ts` seam.)
- **N3–N1 locked.** No content data exists for those levels yet; the design makes
  adding them code-free (JSON-as-content).
- **Dev-only npm-audit advisories** in the build toolchain (vite / vitest /
  esbuild). They do not affect the shipped, dependency-free static bundle.
- **Timer is wall-clock but session-bound.** It counts up during a session only;
  it is motivating for some and potentially anxiety-inducing for beginners —
  flagged in [ROADMAP.md](./ROADMAP.md) as an optional-toggle candidate.

## The three remaining manual steps

These are dashboard/content actions that cannot ship in the repo. The full
runbook is [DEPLOYMENT.md](./DEPLOYMENT.md).

1. **Import the repo at [vercel.com/new](https://vercel.com/new).** Confirm the
   auto-detected settings: Framework Preset **Vite**, Build Command
   **`npm run build`**, Output Directory **`dist`**. Deploy and confirm a green
   production build from `main`.
2. **Buy the domain through Vercel** (Settings → Domains → "Buy a domain").
   Because it's Vercel-registered, nameservers/DNS and HTTPS are managed
   automatically — **no external A/CNAME records** to add.
3. **Add README screenshots + the live-demo URL.** Capture the three screens
   noted in the README TODO (level picker, mid-question quiz, deck editor) into
   `docs/screenshots/`, and fill in the live URL.
