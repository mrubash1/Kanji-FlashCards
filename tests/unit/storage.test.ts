import { describe, it, expect, beforeEach } from 'vitest'
import type { StorageBlob } from '../../src/types'
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  emptyProgress,
  emptyBlob,
  loadBlob,
  saveBlob,
  migrateLegacy,
  exportToJson,
  parseImport,
  isValidBlob,
} from '../../src/lib/storage'

/**
 * A tiny in-memory Storage implementation so tests never touch real
 * localStorage. Backed by a Map and implementing the full Storage interface.
 */
function makeFakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
  }
}

let storage: Storage
beforeEach(() => {
  storage = makeFakeStorage()
})

describe('emptyProgress / emptyBlob', () => {
  it('emptyProgress zeroes everything', () => {
    expect(emptyProgress()).toEqual({
      cardStates: {},
      cardStatus: {},
      seenByLevel: {},
      mistakeByLevel: {},
      personalBests: {},
      globalTotalScore: 0,
      globalTotalAsked: 0,
      globalSessions: 0,
    })
  })

  it('emptyBlob is a valid current-version blob', () => {
    const blob = emptyBlob()
    expect(blob.schemaVersion).toBe(SCHEMA_VERSION)
    expect(blob.decks).toEqual([])
    expect(isValidBlob(blob)).toBe(true)
  })
})

describe('save → load round-trip', () => {
  it('round-trips an equal blob', () => {
    const blob: StorageBlob = {
      schemaVersion: SCHEMA_VERSION,
      progress: {
        ...emptyProgress(),
        globalTotalScore: 42,
        cardStates: { 'N5:水': { box: 2, due: 1000, lastReviewed: 500 } },
        cardStatus: { 'N5:水': 'green' },
      },
      decks: [
        { id: 'd1', name: 'Mine', phaseMode: 'both', cards: [{ kanji: '火', meaning: 'fire', reading: 'ひ' }] },
      ],
      savedAt: 123456,
    }
    saveBlob(blob, storage)
    expect(loadBlob(storage)).toEqual(blob)
  })

  it('saveBlob stamps the current schema version', () => {
    const blob = { ...emptyBlob(), schemaVersion: 999, savedAt: 7 } as StorageBlob
    saveBlob(blob, storage)
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!)
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION)
  })
})

describe('loadBlob — empty / missing', () => {
  it('returns emptyBlob when nothing is stored', () => {
    expect(loadBlob(storage)).toEqual(emptyBlob())
  })
})

describe('migrateLegacy', () => {
  const legacy = {
    personalBests: { 'N5:Numbers': { bestScore: 8, bestTotal: 10, bestTime: 30 } },
    globalTotalScore: 100,
    globalTotalAsked: 120,
    globalSessions: 5,
    seenByLevel: { N5: ['水', '火'] },
    mistakeByLevel: { N5: ['火'] },
    cardStatus: { 'N5:水': 'green', 'N5:火': 'yellow' },
    customDecks: [
      {
        id: 'deck-1',
        name: 'My Deck',
        phaseMode: 'meaning',
        cards: [{ kanji: '木', english: 'tree', reading: 'き', romaji: 'ki' }],
      },
    ],
    savedAt: 999,
  }

  it('maps english→meaning and drops romaji', () => {
    const blob = migrateLegacy(legacy)
    expect(blob.decks[0].cards[0]).toEqual({ kanji: '木', meaning: 'tree', reading: 'き' })
    expect('romaji' in blob.decks[0].cards[0]).toBe(false)
  })

  it('preserves decks, progress, and adds schemaVersion + empty cardStates', () => {
    const blob = migrateLegacy(legacy)
    expect(blob.schemaVersion).toBe(SCHEMA_VERSION)
    expect(blob.progress.cardStates).toEqual({})
    expect(blob.progress.globalTotalScore).toBe(100)
    expect(blob.progress.seenByLevel).toEqual({ N5: ['水', '火'] })
    expect(blob.progress.cardStatus).toEqual({ 'N5:水': 'green', 'N5:火': 'yellow' })
    expect(blob.progress.personalBests['N5:Numbers'].bestScore).toBe(8)
    expect(blob.decks[0].name).toBe('My Deck')
    expect(blob.savedAt).toBe(999)
  })

  it('loadBlob auto-migrates a stored legacy object', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const blob = loadBlob(storage)
    expect(blob.schemaVersion).toBe(SCHEMA_VERSION)
    expect(blob.decks[0].cards[0].meaning).toBe('tree')
  })

  it('defaults sensibly for a sparse legacy object', () => {
    const blob = migrateLegacy({})
    expect(blob).toEqual(emptyBlob())
  })
})

describe('loadBlob — corruption handling', () => {
  it('returns emptyBlob on non-JSON, no throw', () => {
    storage.setItem(STORAGE_KEY, '{not json')
    expect(() => loadBlob(storage)).not.toThrow()
    expect(loadBlob(storage)).toEqual(emptyBlob())
  })

  it('treats an empty object {} as a (legacy) empty blob', () => {
    storage.setItem(STORAGE_KEY, '{}')
    expect(loadBlob(storage)).toEqual(emptyBlob())
  })

  it('returns emptyBlob for a future schemaVersion', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 999, progress: {}, decks: [], savedAt: 0 }))
    expect(loadBlob(storage)).toEqual(emptyBlob())
  })
})

describe('exportToJson / parseImport round-trip', () => {
  it('round-trips through export and import', () => {
    const blob: StorageBlob = {
      ...emptyBlob(),
      progress: { ...emptyProgress(), globalSessions: 3 },
      decks: [{ id: 'x', name: 'X', phaseMode: 'reading', cards: [] }],
      savedAt: 555,
    }
    const json = exportToJson(blob)
    const result = parseImport(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.blob).toEqual(blob)
  })

  it('exportToJson is pretty-printed', () => {
    expect(exportToJson(emptyBlob())).toContain('\n')
  })
})

describe('parseImport — rejections', () => {
  it('rejects non-JSON with a friendly message', () => {
    const r = parseImport('{not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(typeof r.error).toBe('string')
  })

  it('rejects a current-shape blob missing progress', () => {
    const r = parseImport(JSON.stringify({ schemaVersion: 1, decks: [], savedAt: 0 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/progress|decks/i)
  })

  it('rejects a future schemaVersion', () => {
    const r = parseImport(JSON.stringify({ schemaVersion: 999, progress: {}, decks: [], savedAt: 0 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/newer/i)
  })

  it('accepts and migrates an imported legacy file', () => {
    const r = parseImport(
      JSON.stringify({ customDecks: [{ id: 'a', name: 'A', phaseMode: 'both', cards: [{ kanji: '日', english: 'sun', reading: 'ひ', romaji: 'hi' }] }] }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.blob.schemaVersion).toBe(SCHEMA_VERSION)
      expect(r.blob.decks[0].cards[0]).toEqual({ kanji: '日', meaning: 'sun', reading: 'ひ' })
    }
  })
})

describe('isValidBlob', () => {
  it('accepts a well-formed blob and rejects junk', () => {
    expect(isValidBlob(emptyBlob())).toBe(true)
    expect(isValidBlob(null)).toBe(false)
    expect(isValidBlob({ schemaVersion: 1 })).toBe(false)
    expect(isValidBlob('nope')).toBe(false)
  })
})
