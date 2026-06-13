import { describe, it, expect } from 'vitest'
import {
  buildDueSession,
  dueKanjiForLevel,
  buildTopicSession,
  finalizeDeckCards,
  validateDeck,
  cardPassed,
} from '../../src/lib/game'
import { gradeCard, initialCardState } from '../../src/lib/scheduler'
import { TOPICS } from '../../src/data/cards'
import type { CardState, Deck } from '../../src/types'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const state = (box: number, due: number): CardState => ({ box, due, lastReviewed: 0 })

describe('dueKanjiForLevel / buildDueSession', () => {
  const states: Record<string, CardState> = {
    'N5:水': state(2, NOW - DAY), // overdue
    'N5:一': state(3, NOW + DAY), // not due yet
    'N5:火': state(1, NOW), // due now
    'N4:朝': state(1, NOW - DAY), // due, but different level
  }

  it('returns only this level’s cards that are due at/before now', () => {
    const due = dueKanjiForLevel('N5', states, NOW).sort()
    expect(due).toEqual(['水', '火'].sort())
  })

  it('builds a review session containing exactly the due cards', () => {
    const session = buildDueSession('N5', states, NOW)
    expect(session.topicName).toBe('Review')
    expect(session.levelKey).toBe('N5')
    expect(session.phaseMode).toBe('both')
    expect(session.cards.map((c) => c.kanji).sort()).toEqual(['水', '火'].sort())
  })

  it('is empty when nothing is due', () => {
    expect(buildDueSession('N5', { 'N5:一': state(3, NOW + DAY) }, NOW).cards).toHaveLength(0)
  })
})

describe('cardPassed — the both-steps-correct rule (F1)', () => {
  it('two-step "both": passes only when meaning AND reading are correct', () => {
    expect(cardPassed('both', true, true)).toBe(true)
    expect(cardPassed('both', true, false)).toBe(false)
    expect(cardPassed('both', false, true)).toBe(false)
    expect(cardPassed('both', false, false)).toBe(false)
    // meaning wrong → reading never reached (null): still a fail.
    expect(cardPassed('both', false, null)).toBe(false)
  })

  it('single modes are decided by the one asked step', () => {
    expect(cardPassed('meaning', true, null)).toBe(true)
    expect(cardPassed('meaning', false, null)).toBe(false)
    expect(cardPassed('reading', null, true)).toBe(true)
    expect(cardPassed('reading', null, false)).toBe(false)
  })

  it('composes with the scheduler: pass meaning but miss reading → box 1', () => {
    const now = 1_000
    // A card already promoted to box 3.
    const state: CardState = { box: 3, due: now, lastReviewed: 0 }
    const passed = cardPassed('both', true, false) // got meaning, missed reading
    expect(passed).toBe(false)
    expect(gradeCard(state, passed, now).box).toBe(1) // resets all the way down
  })

  it('composes with the scheduler: pass both → promote', () => {
    const now = 1_000
    const state = initialCardState(now) // box 1
    expect(gradeCard(state, cardPassed('both', true, true), now).box).toBe(2)
  })
})

describe('buildTopicSession', () => {
  it('includes every card of the topic, in deck order', () => {
    const numbers = TOPICS.N5.find((t) => t.name === 'Numbers')!
    const session = buildTopicSession('N5', numbers)
    expect(session.cards.length).toBe(numbers.keys.length)
    expect(session.cards.every((c) => numbers.keys.includes(c.kanji))).toBe(true)
  })
})

describe('finalizeDeckCards / validateDeck', () => {
  const deck: Deck = {
    id: 'd1',
    name: 'Kitchen',
    phaseMode: 'both',
    cards: [
      { kanji: '水', meaning: 'water', reading: 'みず' },
      { kanji: '', meaning: 'incomplete', reading: '' }, // dropped
    ],
  }

  it('drops incomplete rows and derives meaningAlts', () => {
    const cards = finalizeDeckCards(deck)
    expect(cards).toHaveLength(1)
    expect(cards[0].meaningAlts).toContain('water')
  })

  it('validates name + at-least-one-complete-card for play', () => {
    expect(validateDeck(deck, true)).toBeNull()
    expect(validateDeck({ ...deck, name: '' }, false)).toMatch(/name/i)
    expect(validateDeck({ ...deck, cards: [] }, true)).toMatch(/complete card/i)
  })
})
