import { describe, it, expect } from 'vitest'
import { CARDS, TOPICS, LEVELS, getCardsByLevel, buildMeaningAlts } from '../../src/data/cards'

describe('card data integrity', () => {
  it('ships 244 cards (80 N5 + 164 N4)', () => {
    expect(getCardsByLevel('N5')).toHaveLength(80)
    expect(getCardsByLevel('N4')).toHaveLength(164)
    expect(CARDS).toHaveLength(244)
  })

  it('has unique ids', () => {
    const ids = CARDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every topic key resolves to a real card of that level', () => {
    for (const level of LEVELS) {
      const kanji = new Set(getCardsByLevel(level).map((c) => c.kanji))
      for (const topic of TOPICS[level]) {
        for (const key of topic.keys) {
          expect(kanji.has(key), `${level} "${topic.name}" → ${key}`).toBe(true)
        }
      }
    }
  })

  it('every card belongs to exactly one topic of its level', () => {
    for (const level of LEVELS) {
      const topicKeys = TOPICS[level].flatMap((t) => t.keys)
      for (const card of getCardsByLevel(level)) {
        const matches = topicKeys.filter((k) => k === card.kanji).length
        expect(matches, `${card.id}`).toBe(1)
      }
    }
  })
})

describe('buildMeaningAlts', () => {
  it('splits on / and adds "to " variants, de-duped', () => {
    expect(buildMeaningAlts('see / look')).toEqual(['see / look', 'see', 'look', 'to see', 'to look'])
  })
  it('handles a single meaning', () => {
    expect(buildMeaningAlts('water')).toEqual(['water', 'to water'])
  })
})
