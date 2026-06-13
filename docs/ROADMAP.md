# Roadmap & open decisions

Captured from a multi-disciplinary review (frontend, backend, design/learning,
product). The **critical and high-priority code fixes have shipped** (see the
git history: SRS review-due flow, quiz re-entrancy, kana/empty-reading, storage
quota + persist, topics validation, deck-editor keys, a11y/nav polish). What
remains is product/content work and smaller polish, tracked here.

## Decision: persistence stays local (for now)

**Browser `localStorage` is the right choice today.** This is a free, no-account,
single-user-per-device study PWA with no sensitive data — "local-first, no
backend" is a deliberate design tenet, not a shortcut.

- Already mitigated: versioned schema + migration (`storage.ts`), full
  export/import (F4), and a `navigator.storage.persist()` request to resist
  mobile eviction.
- Real limits to keep in mind: ~5 MB cap (we use a few KB), mobile browsers can
  evict an unused PWA's storage, and there's no cross-device sync.
- **Upgrade path, only if needed — and still local:** move the storage backend to
  **IndexedDB** (larger, more eviction-resistant) behind the existing `storage.ts`
  seam. The module already isolates persistence, so this is a contained change.
- A server/account-based persistence layer is **not** justified: it would add
  auth, a backend to run, privacy/GDPR obligations, and hosting cost for little
  user benefit at this stage. Revisit only if users demand cross-device sync —
  and even then, prefer user-owned storage (export to their own Drive/Dropbox)
  over running infrastructure.

## Next 3 (highest leverage)

1. **Daily streak + "N due today" on the home screen.** The retention hook; rides
   on the now-wired due-card data. (S–M)
2. **Deploy + fill README** (live URL, 3 screenshots) and post to r/LearnJapanese
   / r/JLPT — the entire GTM channel for this audience. (S)
3. **Privacy-friendly analytics** (Plausible/Umami) or a local "your stats" view,
   so prioritization isn't blind. Track D1/D7 return, onboarding completion,
   cards reviewed/day, % of due cards cleared. (S)

## Next 10 (build the habit + reach)

4. Author **N3 content** (JSON-as-content design makes this code-free). (L)
5. **Verify/attribute kanji data** accuracy + licensing (KANJIDIC cross-check;
   add a source note). Some meanings are pragmatic/lossy. (S–M)
6. **Leech handling**: track lapse count in `CardState`; flag/suspend chronically
   missed cards instead of resetting forever. (M)
7. **Bias topic sessions toward due + new cards** instead of re-quizzing mastered
   ones (today a topic replays everything). (M)
8. **Search/filter** on the study list. (M)
9. **Light theme** via the existing token system (`tokens.css`). (S–M)
10. **Per-deck export / share-as-link** (encode a deck in a URL) for study groups. (M)
11. **Return reminders** (PWA notifications / "X cards due" on launch). (M)
12. **CONTRIBUTING.md / "your first change" walkthrough** — the JSON-content design
    is ideal for a guided first PR (teaching artifact value). (S)

## Someday / explicitly deferred

- Cross-device **sync** — only if demanded, and via user-owned storage, never a
  bespoke backend.
- **N2/N1 content**; a **meaning→kanji production** quiz mode (recall, not just
  recognition); stroke-order / mnemonics (or a deliberate decision not to compete
  with WaniKani/Kanji Study there).

## Product/pedagogy questions to validate with users (not changed unilaterally)

These came up in review but conflict with shipped spec choices, so they're left
as deliberate decisions to revisit with real usage data:

- **Reset-to-box-1 on any miss** (current, per spec F1) vs. demoting only one box
  when just one of the two steps slips — the latter is gentler on partial
  knowledge.
- **The count-up timer + "best time"** framing — motivating for some, anxiety-
  inducing / speed-over-retention for beginners. Consider making it optional.
- **"Points" framing** on Results vs. "cards advanced / mastered" (aligning the
  celebration with the SRS goal).
