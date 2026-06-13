import { describe, it, expect } from 'vitest'
import {
  buildDueSession,
  dueKanjiForLevel,
  buildTopicSession,
  finalizeDeckCards,
  validateDeck,
} from '../../src/lib/game'
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
