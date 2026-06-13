/**
 * kana.ts — a thin, forgiving wrapper around the `wanakana` library.
 *
 * The original app accepted an answer if it matched the reading OR the romaji
 * exactly: `userAnswer === word.reading || userAnswer === word.romaji`. That is
 * brittle: a learner who types "mizu" instead of "みず", or pastes katakana
 * "ミズ", or leaves a stray space, was marked wrong even though they knew it.
 *
 * This module replaces that single comparison with a small "tolerance layer".
 * It still accepts plain hiragana and plain romaji (so nothing the old app
 * accepted is lost), and additionally accepts romaji that wanakana can convert
 * to the expected kana, katakana spellings, and long-vowel variants.
 *
 * The rules here are deliberately SIMPLE and predictable rather than perfect —
 * it's better that a learner can reason about why an answer was accepted than
 * for us to chase every edge case.
 */

import { toHiragana, toKatakana, isKana } from 'wanakana'

// `toKatakana` / `isKana` aren't used by the public functions below, but they
// are imported (and re-exported) as the documented surface of this wrapper so
// callers have one place to reach wanakana from. Referencing them here keeps
// `noUnusedLocals` happy and makes the intent explicit.
export { toHiragana, toKatakana, isKana }

/**
 * Normalise romaji/katakana input to hiragana.
 *
 * `wanakana.toHiragana` handles the heavy lifting: romaji like "mizu" → "みず",
 * katakana "ミズ" → "みず", and existing hiragana passes through unchanged. We
 * only trim surrounding whitespace first.
 */
export function toHiraganaReading(input: string): string {
  return toHiragana(input.trim())
}

/**
 * Collapse Japanese long-vowel spellings to a single canonical form so that
 * variants compare equal.
 *
 * The long-vowel mark "ー" (chōonpu) and a doubled vowel ("おう" vs "おー")
 * represent the same sound but different code points. Helpfully, wanakana's
 * `toHiragana` already EXPANDS the mark to the matching vowel when it converts
 * katakana — e.g. "カー" → "かあ", "キュー" → "きゅう". That expansion is exactly
 * the normalisation we want, and it means a katakana reading written with "ー"
 * lines up with the doubled-vowel hiragana spelling.
 *
 * We keep this function deliberately SIMPLE: after the conversion we just strip
 * any stray "ー" that survived (e.g. a "ー" typed amid already-hiragana text,
 * which wanakana leaves alone). Predictability over completeness — see
 * `normalizeReading` for the combined pipeline.
 */
function stripLongVowelMark(s: string): string {
  return s.replace(/ー/g, '')
}

/**
 * Normalise a reading for comparison: trim, convert to hiragana, and remove the
 * long-vowel mark. Two readings that normalise to the same string are treated
 * as equal by `isReadingCorrect`.
 */
export function normalizeReading(s: string): string {
  return stripLongVowelMark(toHiragana(s.trim()))
}

/**
 * The tolerance check that decides whether a typed answer matches a card's
 * reading. Returns true if ANY of these hold:
 *
 *   1. Exact hiragana match           — input (trimmed) === card.reading
 *   2. Romaji match                   — input lowercased === card.romaji
 *   3. wanakana-converted input       — toHiragana(input) === card.reading
 *   4. Normalised (katakana / long-   — normalizeReading(input) ===
 *      vowel) equivalence                normalizeReading(card.reading)
 *
 * Rules 1 and 2 preserve exactly what the original app accepted; rules 3 and 4
 * are the new tolerance. The card only needs `reading` and `romaji`, so this
 * works for both built-in cards and custom-deck cards.
 */
export function isReadingCorrect(input: string, card: { reading: string; romaji: string }): boolean {
  const trimmed = input.trim()

  // A blank answer is never correct — and never let an empty expected reading
  // (e.g. a custom meaning-only card with no reading) make "" match "".
  if (trimmed === '' || card.reading === '') return false

  // 1. Exact hiragana (what the learner usually types on a JP keyboard).
  if (trimmed === card.reading) return true

  // 2. Plain romaji, case-insensitive (e.g. "Mizu" === "mizu").
  if (card.romaji && trimmed.toLowerCase() === card.romaji.toLowerCase()) return true

  // 3. Romaji/katakana the learner typed, converted to hiragana by wanakana.
  if (toHiragana(trimmed) === card.reading) return true

  // 4. Long-vowel / katakana normalised equivalence on both sides.
  if (normalizeReading(trimmed) === normalizeReading(card.reading)) return true

  return false
}
