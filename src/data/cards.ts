/**
 * Built-in card data loader.
 *
 * The actual card and topic content lives in two plain JSON files next to this
 * module (`cards.json`, `topics.json`). This file's job is to:
 *   1. import that JSON,
 *   2. validate it at load time (so bad data fails LOUDLY, not silently), and
 *   3. enrich each card with the derived `meaningAlts` list,
 * then expose a small, friendly API the rest of the app uses.
 *
 * Keeping data in JSON and logic in TS means a contributor can add a kanji by
 * editing JSON alone — no code change required.
 */

import type { Card, Level, Topic } from '../types'
import rawCards from './cards.json'
import rawTopics from './topics.json'

/**
 * The shape of a card AS STORED in cards.json — everything a `Card` has EXCEPT
 * `meaningAlts`, which we compute below. We don't trust JSON to already match
 * this; `validateCard` proves it at runtime.
 */
type RawCard = Omit<Card, 'meaningAlts'>

/**
 * Build the list of accepted answers for a meaning.
 *
 * This replicates the ORIGINAL app's rule exactly so grading behaviour is
 * identical. Given a meaning like "see / look" it produces, lowercased and
 * de-duped:
 *   - the full meaning:        "see / look"
 *   - each slash-split part:   "see", "look"
 *   - each part prefixed "to ": "to see", "to look"
 * The "to " variants let a learner type "to see" for the verb 見る and still be
 * marked correct.
 */
export function buildMeaningAlts(meaning: string): string[] {
  const parts = meaning
    .split('/')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0)
  const withTo = parts.map((p) => 'to ' + p)
  // A Set removes duplicates (e.g. a single-word meaning equals its only part).
  return [...new Set([meaning.toLowerCase(), ...parts, ...withTo])]
}

/**
 * Runtime validator for one raw card from JSON.
 *
 * We deliberately do NOT write `rawCards as RawCard[]` — a blind cast would let
 * a typo (missing field, wrong level) slip through to crash the quiz later, far
 * from the real cause. Instead we check every field here and throw immediately,
 * naming the offending entry so the bug is obvious.
 */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function validateCard(value: unknown, index: number): RawCard {
  // Narrow `unknown` to an indexable object before reading fields.
  if (typeof value !== 'object' || value === null) {
    throw new Error(`cards.json[${index}] is not an object: ${JSON.stringify(value)}`)
  }
  const c = value as Record<string, unknown>
  const label = `cards.json[${index}] (id=${String(c.id)})`

  if (!isNonEmptyString(c.id)) throw new Error(`${label}: "id" must be a non-empty string`)
  if (!isNonEmptyString(c.kanji)) throw new Error(`${label}: "kanji" must be a non-empty string`)
  if (!isNonEmptyString(c.reading)) throw new Error(`${label}: "reading" must be a non-empty string`)
  if (!isNonEmptyString(c.meaning)) throw new Error(`${label}: "meaning" must be a non-empty string`)
  // romaji may be "" (some entries legitimately have no romaji), so only check type.
  if (typeof c.romaji !== 'string') throw new Error(`${label}: "romaji" must be a string`)
  if (c.level !== 'N5' && c.level !== 'N4') throw new Error(`${label}: "level" must be "N5" or "N4", got ${String(c.level)}`)
  if (typeof c.topic !== 'string') throw new Error(`${label}: "topic" must be a string`)

  return {
    id: c.id,
    kanji: c.kanji,
    reading: c.reading,
    meaning: c.meaning,
    romaji: c.romaji,
    level: c.level,
    topic: c.topic,
  }
}

/**
 * Every built-in card, fully validated and enriched with `meaningAlts`.
 *
 * `rawCards` is typed `unknown[]` deliberately (it's untrusted JSON); we run it
 * through `validateCard` and then attach the derived alts to make a real `Card`.
 */
export const CARDS: Card[] = (rawCards as unknown[]).map((raw, i) => {
  const card = validateCard(raw, i)
  return { ...card, meaningAlts: buildMeaningAlts(card.meaning) }
})

/** The two JLPT levels we ship, in display order. */
export const LEVELS: Level[] = ['N5', 'N4']

/**
 * Validate one raw topic. Like `validateCard`, this exists so a typo in
 * topics.json fails loudly at load instead of surfacing later as a mysteriously
 * empty quiz.
 */
function validateTopic(value: unknown, level: Level, index: number): Topic {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`topics.json["${level}"][${index}] is not an object`)
  }
  const t = value as Record<string, unknown>
  const label = `topics.json["${level}"][${index}] (name=${String(t.name)})`
  if (!isNonEmptyString(t.name)) throw new Error(`${label}: "name" must be a non-empty string`)
  if (!isNonEmptyString(t.sample)) throw new Error(`${label}: "sample" must be a non-empty string`)
  if (!Array.isArray(t.keys) || !t.keys.every((k) => typeof k === 'string')) {
    throw new Error(`${label}: "keys" must be an array of strings`)
  }
  return { name: t.name, sample: t.sample, keys: t.keys as string[] }
}

/**
 * Validate the whole topics map AND cross-check it against the cards: every key
 * a topic lists must resolve to a real card of that level. This is the "data
 * fails loudly and early" guarantee the architecture promises — it's what would
 * have caught a topic/card drift before it shipped.
 */
function validateTopics(raw: unknown): Record<Level, Topic[]> {
  if (typeof raw !== 'object' || raw === null) throw new Error('topics.json is not an object')
  const byLevel = raw as Record<string, unknown>
  const out = {} as Record<Level, Topic[]>
  for (const level of LEVELS) {
    const list = byLevel[level]
    if (!Array.isArray(list)) throw new Error(`topics.json["${level}"] must be an array`)
    out[level] = list.map((t, i) => validateTopic(t, level, i))

    const levelKanji = new Set(CARDS.filter((c) => c.level === level).map((c) => c.kanji))
    for (const topic of out[level]) {
      for (const key of topic.keys) {
        if (!levelKanji.has(key)) {
          throw new Error(
            `topics.json: ${level} topic "${topic.name}" lists kanji "${key}" with no matching card`,
          )
        }
      }
    }
  }
  return out
}

/** Topics per level, validated and cross-checked against the cards. */
export const TOPICS: Record<Level, Topic[]> = validateTopics(rawTopics)

/** All cards for one level, preserving deck order. */
export function getCardsByLevel(level: Level): Card[] {
  return CARDS.filter((c) => c.level === level)
}
