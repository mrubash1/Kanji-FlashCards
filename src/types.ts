/**
 * Shared domain types for Kanji Flash.
 *
 * These are the vocabulary of the whole app. Every module imports the names it
 * needs from here rather than redefining them, so a `Card` means exactly one
 * thing everywhere. The types are deliberately plain interfaces — easy to read
 * for someone newer to TypeScript — not clever generics.
 */

/** JLPT levels that ship with a built-in deck. */
export type Level = 'N5' | 'N4'

/**
 * How a quiz grades a card.
 * - `both`    → step 1 asks the meaning, step 2 asks the reading (default).
 * - `meaning` → single step, meaning only.
 * - `reading` → single step, reading only.
 */
export type PhaseMode = 'both' | 'meaning' | 'reading'

/**
 * The fields every *playable* flashcard shares. The quiz engine only ever reads
 * these, so both built-in cards and finalized custom-deck cards satisfy it.
 */
export interface CardCore {
  /** Stable unique id, e.g. "N5-水" or "custom-<deckId>-0". */
  id: string
  /** The character(s) shown on the front of the card. */
  kanji: string
  /** Primary English meaning, as displayed. */
  meaning: string
  /** Correct reading in hiragana. */
  reading: string
  /** Romanised reading (also accepted as a correct answer). May be "". */
  romaji: string
  /** All accepted meaning answers (lowercased), derived from `meaning`. */
  meaningAlts: string[]
}

/** A built-in card loaded from `src/data/cards.json`. */
export interface Card extends CardCore {
  level: Level
  /** Topic name this card belongs to, e.g. "Numbers". */
  topic: string
}

/** A grouping of built-in cards on the topic picker. */
export interface Topic {
  name: string
  /** A representative kanji shown on the topic tile. */
  sample: string
  /** The `kanji` strings of the cards in this topic. */
  keys: string[]
}

/** One card inside a user-created deck, exactly as typed in the editor. */
export interface DeckCard {
  kanji: string
  meaning: string
  reading: string
}

/** A user-created custom deck. */
export interface Deck {
  id: string
  name: string
  phaseMode: PhaseMode
  cards: DeckCard[]
}

/**
 * Leitner spaced-repetition state for one card.
 * Boxes are 1..5; higher box = longer interval before the card is due again.
 */
export interface CardState {
  /** Current Leitner box, 1 (due immediately) through 5. */
  box: number
  /** Epoch milliseconds when this card next becomes due. */
  due: number
  /** Epoch milliseconds of the last grading (0 if never reviewed). */
  lastReviewed: number
}

/** Mastery colour for the progress bars: cleared cleanly vs cleared with a slip. */
export type Mastery = 'green' | 'yellow'

/** A per-topic personal best. */
export interface PersonalBest {
  bestScore: number
  bestTotal: number
  bestTime: number
}

/**
 * Everything we remember about a learner's progress. Keys that namespace by
 * level use `"<level>:<kanji>"`, or `"custom:<deckId>:<kanji>"` for custom decks
 * — the same scheme the original app used, so migration is lossless.
 */
export interface Progress {
  /** Leitner scheduling state, keyed by card key. */
  cardStates: Record<string, CardState>
  /** Most-recent mastery colour per card key (drives the mastery bars). */
  cardStatus: Record<string, Mastery>
  /** Kanji the learner has seen, keyed by level. */
  seenByLevel: Record<string, string[]>
  /** Kanji the learner has missed, keyed by level. */
  mistakeByLevel: Record<string, string[]>
  /** Personal bests keyed by `"<level>:<topic>"`. */
  personalBests: Record<string, PersonalBest>
  globalTotalScore: number
  globalTotalAsked: number
  globalSessions: number
}

/**
 * The single versioned object persisted to localStorage. `schemaVersion` lets
 * `storage.ts` migrate older saves forward without losing data.
 */
export interface StorageBlob {
  schemaVersion: number
  progress: Progress
  decks: Deck[]
  savedAt: number
}

/** Everything needed to play one quiz session. */
export interface SessionConfig {
  /** 'N5' | 'N4' | 'custom:<deckId>' — namespaces progress keys. */
  levelKey: string
  topicName: string
  phaseMode: PhaseMode
  cards: CardCore[]
}

/** The outcome of a finished game, used by the Results screen. */
export interface GameResult {
  levelKey: string
  topicName: string
  score: number
  total: number
  timeSec: number
  uniqueCount: number
  pb: PersonalBest
  isFirstAttempt: boolean
  newBestScore: boolean
  newBestTime: boolean
}

/**
 * The set of full-screen views. Mirrors the original `showScreen(id)` model so
 * the diff is teachable: one screen visible at a time, chosen by this union.
 */
export type Screen =
  | 'onboarding'
  | 'level'
  | 'topic'
  | 'study'
  | 'quiz'
  | 'results'
  | 'deckList'
  | 'deckEditor'
