/**
 * scheduler.ts — a tiny Leitner spaced-repetition system (SRS).
 *
 * The Leitner system sorts cards into a small number of "boxes". A card you get
 * right moves up a box (and so won't be shown again for longer); a card you get
 * wrong drops straight back to box 1 (shown again immediately). The further up
 * the boxes a card climbs, the longer the gap before its next review — which is
 * exactly the spacing effect we want.
 *
 * Everything here is a *pure* function: given the same inputs it returns the
 * same output and never mutates its arguments. That makes the scheduler trivial
 * to unit-test (we feed it a fixed `now`) and safe to call from React without
 * surprising side effects.
 */

import type { CardState } from '../types'

/**
 * Interval (in whole days) a card waits before becoming due again, indexed by
 * `box - 1`. Box 1 is `0` days — i.e. due immediately, so freshly-missed or
 * brand-new cards come straight back. Each subsequent box roughly doubles.
 *
 *   box 1 → 0 days   (due now)
 *   box 2 → 1 day
 *   box 3 → 2 days
 *   box 4 → 4 days
 *   box 5 → 8 days
 */
export const BOX_INTERVALS_DAYS = [0, 1, 2, 4, 8] as const

/** The highest (and final) Leitner box. Cards cap here; they don't fall off. */
export const MAX_BOX = 5

/** Milliseconds in a day — pulled out so the date math below reads cleanly. */
const MS_PER_DAY = 86_400_000

/**
 * The state a card starts life in: box 1, due right now, never reviewed.
 *
 * @param now epoch milliseconds "now" (passed in, never read from the clock
 *            here, so callers/tests stay deterministic).
 */
export function initialCardState(now: number): CardState {
  return { box: 1, due: now, lastReviewed: 0 }
}

/**
 * Grade a single review and return the *new* state. Does not mutate `state`.
 *
 * Correct → promote one box (capped at MAX_BOX).
 * Incorrect → demote all the way back to box 1.
 * Either way we recompute `due` from the new box's interval and stamp
 * `lastReviewed`.
 *
 * NOTE on the app's two-step quiz rule (enforced by the screen layer, not here):
 * in `both` mode a card counts as correct only if BOTH the meaning step AND the
 * reading step passed. A miss on either step means the screen calls
 * `gradeCard(state, false, now)`, resetting the card to box 1. The scheduler
 * itself is intentionally dumb about phases — it just takes a single boolean.
 *
 * @param state     the card's current Leitner state (left untouched)
 * @param isCorrect whether the learner answered correctly
 * @param now       epoch milliseconds "now"
 */
export function gradeCard(state: CardState, isCorrect: boolean, now: number): CardState {
  const newBox = isCorrect ? Math.min(state.box + 1, MAX_BOX) : 1
  const intervalDays = BOX_INTERVALS_DAYS[newBox - 1]
  return {
    box: newBox,
    due: now + intervalDays * MS_PER_DAY,
    lastReviewed: now,
  }
}

/**
 * Return the keys of every card that is due at or before `now`, in the natural
 * `Object.keys` order (stable for a given object), so callers get a predictable
 * review queue.
 */
export function getDueCards(states: Record<string, CardState>, now: number): string[] {
  return Object.keys(states).filter((key) => states[key].due <= now)
}

/**
 * Summarise a collection of card states for the progress UI.
 *
 * `perBox` is a length-5 array where index 0 counts box-1 cards, index 1 counts
 * box-2 cards, and so on.
 *
 * `dueToday` — a deliberate design choice. A truly "due today" count needs the
 * current time, but this function takes no `now` parameter and we want it to
 * stay pure (reading `Date.now()` inside would make it non-deterministic and
 * awkward to test). So we define `dueToday` as "the number of cards sitting in
 * box 1". Box-1 cards always have a 0-day interval — they're due immediately —
 * so this is the meaningful, time-independent stand-in for "needs review now".
 */
export function summarize(states: Record<string, CardState>): { perBox: number[]; dueToday: number } {
  const perBox = [0, 0, 0, 0, 0]
  let dueToday = 0
  for (const key of Object.keys(states)) {
    const box = states[key].box
    // Guard against out-of-range boxes from corrupt data; clamp into 1..MAX_BOX.
    const idx = Math.min(Math.max(box, 1), MAX_BOX) - 1
    perBox[idx] += 1
    if (box === 1) dueToday += 1
  }
  return { perBox, dueToday }
}
