/**
 * storage.ts — versioned localStorage persistence, migration, and export/import.
 *
 * Goals:
 *  - Persist the whole app state as one JSON blob under a single key.
 *  - Carry a `schemaVersion` so future shape changes can migrate old saves
 *    forward without losing a learner's data.
 *  - Read the ORIGINAL app's legacy save (which had no `schemaVersion`) and
 *    upgrade it losslessly.
 *  - Never throw on bad data: corrupt JSON, quota errors, or a save written by a
 *    newer app version all degrade gracefully (warn + fall back to empty), so a
 *    single bad write can never brick the app.
 *
 * Storage is injected (`storage?: Storage`) rather than reaching for the global
 * `localStorage` directly. That keeps every function pure-ish and lets tests
 * pass a tiny in-memory fake — no real browser storage required.
 */

import type {
  CardState,
  Deck,
  DeckCard,
  PersonalBest,
  Progress,
  StorageBlob,
} from '../types'

/** The single localStorage key. Unchanged from the original app on purpose, so
 * an existing install's legacy data is found and migrated in place. */
export const STORAGE_KEY = 'kanjiflash-progress'

/** Current schema version. Bump this whenever `StorageBlob`'s shape changes and
 * add a forward migration step in `loadBlob`. */
export const SCHEMA_VERSION = 1

/** Resolve the Storage to use, preferring the injected one. Falls back to the
 * global `localStorage` when present (browser), else `undefined` (e.g. SSR or a
 * test that passed nothing) — callers handle `undefined` by no-opping. */
function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return (globalThis as { localStorage?: Storage }).localStorage
  }
  return undefined
}

/** A fresh, empty Progress: every map empty, every counter zero. */
export function emptyProgress(): Progress {
  return {
    cardStates: {},
    cardStatus: {},
    seenByLevel: {},
    mistakeByLevel: {},
    personalBests: {},
    globalTotalScore: 0,
    globalTotalAsked: 0,
    globalSessions: 0,
  }
}

/** A fresh, empty StorageBlob at the current schema version. */
export function emptyBlob(): StorageBlob {
  return {
    schemaVersion: SCHEMA_VERSION,
    progress: emptyProgress(),
    decks: [],
    savedAt: 0,
  }
}

// ---------------------------------------------------------------------------
// Small runtime helpers for defensive parsing. The data may have been written
// by an older app, hand-edited, or imported from a file, so we never trust its
// shape — we check before we read.
// ---------------------------------------------------------------------------

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function asNumber(x: unknown, fallback = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback
}

function asStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
}

/** Coerce an unknown value into a record of string[] (for seen/mistake maps). */
function asStringArrayMap(x: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (isObject(x)) {
    for (const key of Object.keys(x)) out[key] = asStringArray(x[key])
  }
  return out
}

/** Validate one CardState, returning null if it doesn't look right. */
function asCardState(x: unknown): CardState | null {
  if (!isObject(x)) return null
  if (typeof x.box !== 'number' || typeof x.due !== 'number') return null
  return {
    box: x.box,
    due: x.due,
    lastReviewed: asNumber(x.lastReviewed, 0),
  }
}

function asCardStatesMap(x: unknown): Record<string, CardState> {
  const out: Record<string, CardState> = {}
  if (isObject(x)) {
    for (const key of Object.keys(x)) {
      const state = asCardState(x[key])
      if (state) out[key] = state
    }
  }
  return out
}

function asPersonalBestsMap(x: unknown): Record<string, PersonalBest> {
  const out: Record<string, PersonalBest> = {}
  if (isObject(x)) {
    for (const key of Object.keys(x)) {
      const v = x[key]
      if (isObject(v)) {
        out[key] = {
          bestScore: asNumber(v.bestScore),
          bestTotal: asNumber(v.bestTotal),
          bestTime: asNumber(v.bestTime),
        }
      }
    }
  }
  return out
}

/** Coerce an unknown value into a `Record<string, 'green'|'yellow'>`. */
function asCardStatusMap(x: unknown): Record<string, 'green' | 'yellow'> {
  const out: Record<string, 'green' | 'yellow'> = {}
  if (isObject(x)) {
    for (const key of Object.keys(x)) {
      const v = x[key]
      if (v === 'green' || v === 'yellow') out[key] = v
    }
  }
  return out
}

/** Build a clean Progress from an unknown object, defaulting anything missing. */
function coerceProgress(x: unknown): Progress {
  const base = emptyProgress()
  if (!isObject(x)) return base
  return {
    cardStates: asCardStatesMap(x.cardStates),
    cardStatus: asCardStatusMap(x.cardStatus),
    seenByLevel: asStringArrayMap(x.seenByLevel),
    mistakeByLevel: asStringArrayMap(x.mistakeByLevel),
    personalBests: asPersonalBestsMap(x.personalBests),
    globalTotalScore: asNumber(x.globalTotalScore),
    globalTotalAsked: asNumber(x.globalTotalAsked),
    globalSessions: asNumber(x.globalSessions),
  }
}

/** Coerce one deck card. New shape is `{ kanji, meaning, reading }`. */
function coerceDeckCard(x: unknown): DeckCard | null {
  if (!isObject(x)) return null
  // Legacy deck cards used `english` for the meaning (and also carried `romaji`,
  // which the new shape drops). Accept either `meaning` or legacy `english`.
  const meaning =
    typeof x.meaning === 'string'
      ? x.meaning
      : typeof x.english === 'string'
        ? x.english
        : ''
  return {
    kanji: typeof x.kanji === 'string' ? x.kanji : '',
    meaning,
    reading: typeof x.reading === 'string' ? x.reading : '',
  }
}

/** Coerce one deck, mapping its cards through `coerceDeckCard`. */
function coerceDeck(x: unknown): Deck | null {
  if (!isObject(x)) return null
  const phaseMode = x.phaseMode
  return {
    id: typeof x.id === 'string' ? x.id : '',
    name: typeof x.name === 'string' ? x.name : '',
    phaseMode:
      phaseMode === 'meaning' || phaseMode === 'reading' ? phaseMode : 'both',
    cards: Array.isArray(x.cards)
      ? x.cards.map(coerceDeckCard).filter((c): c is DeckCard => c !== null)
      : [],
  }
}

function coerceDecks(x: unknown): Deck[] {
  return Array.isArray(x)
    ? x.map(coerceDeck).filter((d): d is Deck => d !== null)
    : []
}

/**
 * Migrate the ORIGINAL flat save (no `schemaVersion`) into a `StorageBlob`.
 *
 * Legacy shape (the fields we care about):
 *   { personalBests, globalTotalScore, globalTotalAsked, globalSessions,
 *     seenByLevel, mistakeByLevel, cardStatus,
 *     customDecks: [{ id, name, phaseMode, cards: [{kanji,english,reading,romaji}] }],
 *     savedAt }
 *
 * Mapping decisions:
 *  - All progress fields move under `progress`.
 *  - `customDecks` → `decks`, with each card's `english` → `meaning` and
 *    `romaji` dropped (handled in `coerceDeckCard`).
 *  - `cardStates` starts empty: the legacy app had no Leitner history, so every
 *    card simply begins in box 1 the next time it's reviewed.
 *  - Missing fields default sensibly via the coercers above.
 */
export function migrateLegacy(raw: unknown): StorageBlob {
  const src = isObject(raw) ? raw : {}
  // `coerceProgress` already reads personalBests/global*/seen/mistake/cardStatus
  // straight off the legacy object, since those field names are unchanged.
  const progress = coerceProgress(src)
  // Legacy had no Leitner history — start fresh.
  progress.cardStates = {}
  return {
    schemaVersion: SCHEMA_VERSION,
    progress,
    decks: coerceDecks(src.customDecks),
    savedAt: asNumber(src.savedAt, 0),
  }
}

/**
 * Runtime type guard for a *current-shape* StorageBlob. Checks the structural
 * essentials: a numeric schemaVersion, an object progress, an array of decks,
 * and a numeric savedAt. Deep field validation is handled by the coercers when
 * we actually build a blob; this guard is the cheap gate used by importers.
 */
export function isValidBlob(x: unknown): x is StorageBlob {
  return (
    isObject(x) &&
    typeof x.schemaVersion === 'number' &&
    isObject(x.progress) &&
    Array.isArray(x.decks) &&
    typeof x.savedAt === 'number'
  )
}

/**
 * Run forward migrations on a blob whose schemaVersion is older than current.
 * Today SCHEMA_VERSION is 1 and there are no v0→v1 steps (v0 had no version, so
 * it goes through `migrateLegacy` instead). This is the seam where future
 * `if (version < 2) { ... }` steps will live.
 */
function migrateForward(blob: StorageBlob): StorageBlob {
  // No-op for now; clamp the version up so the result is current.
  return { ...blob, schemaVersion: SCHEMA_VERSION }
}

/**
 * Turn arbitrary parsed JSON into a clean, current-version StorageBlob,
 * choosing the right migration path. Returns `null` only when the input is so
 * malformed it isn't even an object (callers map that to `emptyBlob`).
 */
function normalizeParsed(parsed: unknown): StorageBlob | null {
  if (!isObject(parsed)) return null

  // Legacy save: no schemaVersion at all → run the legacy migration.
  if (typeof parsed.schemaVersion !== 'number') {
    return migrateLegacy(parsed)
  }

  // Future save (written by a newer app): we can't understand it. Refuse rather
  // than risk silently dropping fields — callers fall back to empty.
  if (parsed.schemaVersion > SCHEMA_VERSION) return null

  // Build a clean blob from the (possibly partial) current/older-versioned data.
  const blob: StorageBlob = {
    schemaVersion: parsed.schemaVersion,
    progress: coerceProgress(parsed.progress),
    decks: coerceDecks(parsed.decks),
    savedAt: asNumber(parsed.savedAt, 0),
  }
  return blob.schemaVersion < SCHEMA_VERSION ? migrateForward(blob) : blob
}

/**
 * Load and normalise the saved blob. Never throws: on missing data, parse
 * errors, or corruption it logs a warning and returns `emptyBlob()`.
 */
export function loadBlob(storage?: Storage): StorageBlob {
  const store = resolveStorage(storage)
  if (!store) return emptyBlob()

  let text: string | null
  try {
    text = store.getItem(STORAGE_KEY)
  } catch (err) {
    console.warn('storage.loadBlob: getItem failed, returning empty blob.', err)
    return emptyBlob()
  }
  if (text == null) return emptyBlob()

  try {
    const parsed: unknown = JSON.parse(text)
    const blob = normalizeParsed(parsed)
    if (!blob) {
      console.warn('storage.loadBlob: unrecognised data shape, returning empty blob.')
      return emptyBlob()
    }
    return blob
  } catch (err) {
    console.warn('storage.loadBlob: corrupt JSON, returning empty blob.', err)
    return emptyBlob()
  }
}

/**
 * Persist a blob. Stamps the current SCHEMA_VERSION but preserves the caller's
 * `savedAt` (the caller owns the clock; tests pass a fixed value). Wrapped in
 * try/catch so quota or serialization errors degrade to a warning, never a
 * thrown exception that could break the UI.
 */
export function saveBlob(blob: StorageBlob, storage?: Storage): boolean {
  const store = resolveStorage(storage)
  if (!store) return false
  try {
    const toSave: StorageBlob = { ...blob, schemaVersion: SCHEMA_VERSION }
    store.setItem(STORAGE_KEY, JSON.stringify(toSave))
    return true
  } catch (err) {
    // Most likely a quota error. We don't throw (that would break the UI), but
    // we DO report failure so the caller can warn the user their data didn't
    // save, rather than losing progress silently.
    console.warn('storage.saveBlob: setItem failed (quota?), not saved.', err)
    return false
  }
}

/**
 * Serialise a blob as pretty JSON for the "Download my data" feature. Two-space
 * indent so the downloaded file is human-readable.
 */
export function exportToJson(blob: StorageBlob): string {
  return JSON.stringify({ ...blob, schemaVersion: SCHEMA_VERSION }, null, 2)
}

/**
 * Parse and validate text from an imported file. Returns a discriminated result
 * rather than throwing, so the import-with-confirm UI can show a friendly error.
 *
 * Accepts current and older schema versions (migrating as needed) and both the
 * legacy flat shape and the new shape. Rejects: non-JSON, non-objects, a future
 * schemaVersion, or a current-shape blob missing required fields (e.g. progress).
 */
export function parseImport(
  text: string,
): { ok: true; blob: StorageBlob } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' }
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'That file doesn’t contain a saved data object.' }
  }

  // Reject a future schema explicitly with a clear message.
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This file was saved by a newer version (schema ${parsed.schemaVersion}). Please update the app to import it.`,
    }
  }

  // For a current-shape file we require the core fields up front, so we don't
  // silently accept e.g. a settings file that happens to be JSON.
  if (typeof parsed.schemaVersion === 'number') {
    if (!isObject(parsed.progress) || !Array.isArray(parsed.decks)) {
      return {
        ok: false,
        error: 'That file is missing its progress or decks data.',
      }
    }
  }

  const blob = normalizeParsed(parsed)
  if (!blob || !isValidBlob(blob)) {
    return { ok: false, error: 'That file couldn’t be read as Kanji Flash data.' }
  }
  return { ok: true, blob }
}
