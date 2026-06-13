import { describe, it, expect } from 'vitest'
import {
  toHiraganaReading,
  normalizeReading,
  isReadingCorrect,
} from '../../src/lib/kana'

const mizu = { reading: 'みず', romaji: 'mizu' }
const kyuu = { reading: 'きゅう', romaji: 'kyuu' }

describe('toHiraganaReading', () => {
  it('converts romaji to hiragana and trims', () => {
    expect(toHiraganaReading('  mizu  ')).toBe('みず')
  })

  it('converts katakana to hiragana', () => {
    expect(toHiraganaReading('ミズ')).toBe('みず')
  })

  it('passes hiragana through unchanged', () => {
    expect(toHiraganaReading('みず')).toBe('みず')
  })
})

describe('normalizeReading', () => {
  it('normalises a katakana long vowel to its expanded hiragana form', () => {
    // wanakana expands the chōonpu: カー → かあ. Any leftover "ー" is stripped.
    expect(normalizeReading('カー')).toBe('かあ')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeReading('  みず ')).toBe('みず')
  })
})

describe('isReadingCorrect — accepts the original cases', () => {
  it('accepts romaji "mizu" for みず', () => {
    expect(isReadingCorrect('mizu', mizu)).toBe(true)
  })

  it('accepts plain hiragana "みず"', () => {
    expect(isReadingCorrect('みず', mizu)).toBe(true)
  })
})

describe('isReadingCorrect — tolerance layer', () => {
  it('accepts katakana "ミズ"', () => {
    expect(isReadingCorrect('ミズ', mizu)).toBe(true)
  })

  it('accepts surrounding whitespace "  mizu  "', () => {
    expect(isReadingCorrect('  mizu  ', mizu)).toBe(true)
  })

  it('trims romaji " a " for a card reading あ', () => {
    expect(isReadingCorrect(' a ', { reading: 'あ', romaji: 'a' })).toBe(true)
  })

  it('is case-insensitive for romaji', () => {
    expect(isReadingCorrect('Mizu', mizu)).toBe(true)
  })
})

describe('isReadingCorrect — rejects wrong answers', () => {
  it('rejects "neko" for みず', () => {
    expect(isReadingCorrect('neko', mizu)).toBe(false)
  })

  it('rejects empty input', () => {
    expect(isReadingCorrect('', mizu)).toBe(false)
  })

  it('rejects whitespace-only input', () => {
    expect(isReadingCorrect('   ', mizu)).toBe(false)
  })

  it('rejects a blank answer even when the card has no reading', () => {
    // Regression: a custom meaning-only card has reading "". An empty answer
    // must NOT score correct just because "" === "".
    expect(isReadingCorrect('', { reading: '', romaji: '' })).toBe(false)
    expect(isReadingCorrect('anything', { reading: '', romaji: '' })).toBe(false)
  })
})

describe('isReadingCorrect — long vowels', () => {
  it('accepts romaji "kyuu" for きゅう', () => {
    expect(isReadingCorrect('kyuu', kyuu)).toBe(true)
  })

  it('accepts hiragana "きゅう"', () => {
    expect(isReadingCorrect('きゅう', kyuu)).toBe(true)
  })
})

describe('isReadingCorrect — romaji conversion edge cases', () => {
  it('"shi" → し', () => {
    expect(isReadingCorrect('shi', { reading: 'し', romaji: 'shi' })).toBe(true)
  })

  it('"tsu" → つ', () => {
    expect(isReadingCorrect('tsu', { reading: 'つ', romaji: 'tsu' })).toBe(true)
  })

  it('"n" → ん', () => {
    expect(isReadingCorrect('n', { reading: 'ん', romaji: 'n' })).toBe(true)
  })
})
