/**
 * Progress keys. Mastery and scheduler state are stored in flat maps keyed by a
 * string that namespaces a kanji to its level (or custom deck), exactly as the
 * original app did: `"<levelKey>:<kanji>"` where levelKey is "N5", "N4", or
 * "custom:<deckId>". Keeping this in one place avoids subtle key mismatches.
 */
export function cardKey(levelKey: string, kanji: string): string {
  return `${levelKey}:${kanji}`
}
