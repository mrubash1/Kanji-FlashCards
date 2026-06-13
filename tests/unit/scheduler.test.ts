import { describe, it, expect } from 'vitest'
import type { CardState } from '../../src/types'
import {
  BOX_INTERVALS_DAYS,
  MAX_BOX,
  initialCardState,
  gradeCard,
  getDueCards,
  summarize,
} from '../../src/lib/scheduler'

/** A fixed epoch (2021-01-01T00:00:00Z) so all date math is deterministic. */
const NOW = 1_609_459_200_000
const DAY = 86_400_000

describe('scheduler constants', () => {
  it('has the expected interval table and max box', () => {
    expect(BOX_INTERVALS_DAYS).toEqual([0, 1, 2, 4, 8])
    expect(MAX_BOX).toBe(5)
  })
})

describe('initialCardState', () => {
  it('starts in box 1, due now, never reviewed', () => {
    expect(initialCardState(NOW)).toEqual({ box: 1, due: NOW, lastReviewed: 0 })
  })
})

describe('gradeCard — promotion', () => {
  it('promotes 1→2→3→4→5 and caps at 5', () => {
    let state = initialCardState(NOW)
    const expectedBoxes = [2, 3, 4, 5, 5, 5]
    for (const expectedBox of expectedBoxes) {
      state = gradeCard(state, true, NOW)
      expect(state.box).toBe(expectedBox)
    }
  })
})

describe('gradeCard — reset on miss', () => {
  it('drops any box back to 1 on an incorrect answer', () => {
    const inBox4: CardState = { box: 4, due: NOW + 99 * DAY, lastReviewed: NOW }
    const after = gradeCard(inBox4, false, NOW)
    expect(after.box).toBe(1)
    expect(after.due).toBe(NOW) // box 1 interval = 0 days
  })
})

describe('gradeCard — due-date math per box', () => {
  it('computes due = now + interval(newBox) for each promotion', () => {
    // box1 correct → box2 → +1 day
    const b2 = gradeCard({ box: 1, due: NOW, lastReviewed: 0 }, true, NOW)
    expect(b2).toEqual({ box: 2, due: NOW + 1 * DAY, lastReviewed: NOW })

    // box2 correct → box3 → +2 days
    const b3 = gradeCard({ box: 2, due: NOW, lastReviewed: 0 }, true, NOW)
    expect(b3.due).toBe(NOW + 2 * DAY)

    // box3 correct → box4 → +4 days
    const b4 = gradeCard({ box: 3, due: NOW, lastReviewed: 0 }, true, NOW)
    expect(b4.due).toBe(NOW + 4 * DAY)

    // box4 correct → box5 → +8 days
    const b5 = gradeCard({ box: 4, due: NOW, lastReviewed: 0 }, true, NOW)
    expect(b5.due).toBe(NOW + 8 * DAY)
  })
})

describe('gradeCard — purity', () => {
  it('does not mutate its input', () => {
    const input: CardState = { box: 2, due: NOW, lastReviewed: 0 }
    const snapshot = { ...input }
    const result = gradeCard(input, true, NOW + 5)
    expect(input).toEqual(snapshot) // unchanged
    expect(result).not.toBe(input) // new object
  })

  it('is idempotent for the same inputs', () => {
    const input: CardState = { box: 3, due: NOW, lastReviewed: 0 }
    expect(gradeCard(input, true, NOW)).toEqual(gradeCard(input, true, NOW))
  })
})

describe('getDueCards', () => {
  it('returns keys with due <= now in Object.keys order', () => {
    const states: Record<string, CardState> = {
      a: { box: 1, due: NOW - 1, lastReviewed: 0 }, // due
      b: { box: 3, due: NOW + DAY, lastReviewed: 0 }, // not due
      c: { box: 1, due: NOW, lastReviewed: 0 }, // due (exactly now)
    }
    expect(getDueCards(states, NOW)).toEqual(['a', 'c'])
  })

  it('returns empty when nothing is due', () => {
    const states: Record<string, CardState> = {
      x: { box: 5, due: NOW + DAY, lastReviewed: 0 },
    }
    expect(getDueCards(states, NOW)).toEqual([])
  })
})

describe('summarize', () => {
  it('counts cards per box and dueToday = box-1 count', () => {
    const states: Record<string, CardState> = {
      a: { box: 1, due: NOW, lastReviewed: 0 },
      b: { box: 1, due: NOW, lastReviewed: 0 },
      c: { box: 2, due: NOW, lastReviewed: 0 },
      d: { box: 5, due: NOW, lastReviewed: 0 },
    }
    const { perBox, dueToday } = summarize(states)
    expect(perBox).toEqual([2, 1, 0, 0, 1])
    expect(dueToday).toBe(2)
  })

  it('handles an empty collection', () => {
    expect(summarize({})).toEqual({ perBox: [0, 0, 0, 0, 0], dueToday: 0 })
  })
})
