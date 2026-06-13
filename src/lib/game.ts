/**
 * game.ts — small pure helpers shared by the quiz screens. Kept out of the
 * components so they can be reasoned about and (where useful) unit-tested in
 * isolation, exactly like the original's free functions (shuffle, formatTime…).
 */
import type { CardCore, CardState, Deck, Level, PhaseMode, SessionConfig, Topic } from '../types'
import { buildMeaningAlts, getCardsByLevel } from '../data/cards'
import { getDueCards } from './scheduler'

/** Fisher–Yates shuffle returning a NEW array (never mutates the input). */
export function shuffle<T>(array: readonly T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Seconds → "m:ss" (e.g. 83 → "1:23"), matching the original timer format. */
export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Is the typed meaning acceptable? Trims + lowercases, then checks the card's
 * `meaningAlts` — identical rule to the original `englishAlts.includes(...)`.
 */
export function isMeaningCorrect(input: string, card: CardCore): boolean {
  return card.meaningAlts.includes(input.trim().toLowerCase())
}

/** Emoji + message for the end screen, by accuracy — ported tiers. */
export function resultTier(pct: number): { emoji: string; message: string } {
  if (pct === 1) return { emoji: '🏆', message: "Perfect score! You're a kanji master!" }
  if (pct >= 0.8) return { emoji: '🎉', message: 'Excellent! Almost perfect — keep it up!' }
  if (pct >= 0.6) return { emoji: '👍', message: 'Good work! Practice makes perfect.' }
  if (pct >= 0.4) return { emoji: '📚', message: "Keep studying — you're making progress!" }
  return { emoji: '💪', message: "Don't give up! Try again to improve." }
}

/** Whether a phase mode asks the meaning / reading step. */
export function asksMeaning(mode: PhaseMode): boolean {
  return mode === 'both' || mode === 'meaning'
}
export function asksReading(mode: PhaseMode): boolean {
  return mode === 'both' || mode === 'reading'
}

/** Points a single card is worth: 2 for the two-step quiz, 1 otherwise. */
export function pointsPerCard(mode: PhaseMode): number {
  return mode === 'both' ? 2 : 1
}

/**
 * Did the learner pass the WHOLE card? This is the rule the scheduler grades on
 * (F1): in two-step `both` mode the card passes only if BOTH the meaning step
 * AND the reading step were answered correctly; in single modes the one asked
 * step decides. A step that wasn't asked (or wasn't reached) is passed as `null`
 * and ignored. Pure + tested so "miss the reading → reset to box 1" is a
 * sub-millisecond regression, not only an e2e guarantee.
 */
export function cardPassed(
  mode: PhaseMode,
  meaningCorrect: boolean | null,
  readingCorrect: boolean | null,
): boolean {
  const meaningOk = asksMeaning(mode) ? meaningCorrect === true : true
  const readingOk = asksReading(mode) ? readingCorrect === true : true
  return meaningOk && readingOk
}

/**
 * Turn a saved custom deck into playable cards: drop rows that lack the fields
 * the deck's mode requires, then attach `meaningAlts`. Mirrors the original
 * `finalizeDeckCards`, producing the same forgiving grading for custom cards.
 */
export function finalizeDeckCards(deck: Deck): CardCore[] {
  const needMeaning = asksMeaning(deck.phaseMode)
  const needReading = asksReading(deck.phaseMode)
  return deck.cards
    .filter((c) => {
      if (!c.kanji) return false
      if (needMeaning && !c.meaning) return false
      if (needReading && !c.reading) return false
      return true
    })
    .map((c, i) => ({
      id: `custom-${deck.id}-${i}`,
      kanji: c.kanji,
      meaning: c.meaning || c.kanji,
      reading: c.reading || '',
      romaji: '',
      meaningAlts: buildMeaningAlts(c.meaning || c.kanji),
    }))
}

// ── Session builders ────────────────────────────────────────────────────────
// Each returns a ready-to-play SessionConfig. Built-in topics are always the
// two-step ("both") quiz; custom decks carry their own phaseMode.

/** A session for one built-in topic. */
export function buildTopicSession(level: Level, topic: Topic): SessionConfig {
  const cards = getCardsByLevel(level).filter((c) => topic.keys.includes(c.kanji))
  return { levelKey: level, topicName: topic.name, phaseMode: 'both', cards }
}

/** A session over every card in a built-in level. */
export function buildAllCardsSession(level: Level): SessionConfig {
  return { levelKey: level, topicName: 'All cards', phaseMode: 'both', cards: getCardsByLevel(level) }
}

/**
 * The cards in a level that are due for review right now, per the Leitner
 * scheduler — this is what turns the SRS from "computed but unused" into an
 * actual review queue. Card states are keyed `"<level>:<kanji>"`; we read the
 * due keys from `getDueCards` and map them back to full cards (preserving deck
 * order). Cards never reviewed have no state, so they aren't "due" here — they
 * enter the schedule the first time they're studied via a topic.
 */
export function dueKanjiForLevel(
  level: Level,
  cardStates: Record<string, CardState>,
  now: number,
): string[] {
  const prefix = `${level}:`
  const levelStates: Record<string, CardState> = {}
  for (const key of Object.keys(cardStates)) {
    if (key.startsWith(prefix)) levelStates[key] = cardStates[key]
  }
  // Strip the "<level>:" prefix back off to recover the bare kanji.
  return getDueCards(levelStates, now).map((key) => key.slice(prefix.length))
}

/** A "review the cards due now" session for a built-in level. */
export function buildDueSession(
  level: Level,
  cardStates: Record<string, CardState>,
  now: number,
): SessionConfig {
  const due = new Set(dueKanjiForLevel(level, cardStates, now))
  const cards = getCardsByLevel(level).filter((c) => due.has(c.kanji))
  return { levelKey: level, topicName: 'Review', phaseMode: 'both', cards }
}

/** A session from an arbitrary set of kanji within a level (seen / mistakes). */
export function buildKanjiSession(level: Level, topicName: string, kanji: string[]): SessionConfig {
  const wanted = new Set(kanji)
  const cards = getCardsByLevel(level).filter((c) => wanted.has(c.kanji))
  return { levelKey: level, topicName, phaseMode: 'both', cards }
}

/** A session from a finalized custom deck. */
export function buildDeckSession(deck: Deck): SessionConfig {
  return {
    levelKey: `custom:${deck.id}`,
    topicName: deck.name,
    phaseMode: deck.phaseMode,
    cards: finalizeDeckCards(deck),
  }
}

/** Generate a unique-enough id for a new custom deck. */
export function makeDeckId(): string {
  return `deck_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

/**
 * Validate a deck for saving/playing. Returns an error string or null — same
 * rules as the original `validateDeck`.
 */
export function validateDeck(deck: Deck, requireForPlay: boolean): string | null {
  if (!deck.name.trim()) return 'Please give your deck a name.'
  const needMeaning = asksMeaning(deck.phaseMode)
  const needReading = asksReading(deck.phaseMode)
  const complete = deck.cards.filter((c) => {
    if (!c.kanji) return false
    if (needMeaning && !c.meaning) return false
    if (needReading && !c.reading) return false
    return true
  })
  if (requireForPlay && complete.length === 0) {
    return (
      'Add at least one complete card (front' +
      (needMeaning ? ' + meaning' : '') +
      (needReading ? ' + reading' : '') +
      ') to play.'
    )
  }
  return null
}
