#!/usr/bin/env node
/**
 * verify-cards.mjs — count check for the extracted card data.
 *
 * This script proves that src/data/cards.json contains exactly as many cards as
 * the original single-file app (kanji-flashcards.html). It does NOT compare
 * field-by-field; it's a fast structural guard so we notice if a card was
 * dropped or duplicated during extraction.
 *
 * No dependencies — plain Node ESM. Run with:  node scripts/verify-cards.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const html = readFileSync(join(root, 'kanji-flashcards.html'), 'utf8')
const cards = JSON.parse(readFileSync(join(root, 'src/data/cards.json'), 'utf8'))

/**
 * Count the card objects inside a named deck array in the HTML source.
 *
 * We slice the text from `const <name> = [` up to its closing `];`, then count
 * how many `kanji:` keys appear in that slice — one per card object.
 */
function countDeck(name) {
  const start = html.indexOf(`const ${name} = [`)
  if (start === -1) throw new Error(`Could not find ${name} in HTML`)
  const end = html.indexOf('];', start)
  if (end === -1) throw new Error(`Could not find end of ${name}`)
  const slice = html.slice(start, end)
  const matches = slice.match(/kanji:/g)
  return matches ? matches.length : 0
}

const origN5 = countDeck('N5_DECK')
const origN4 = countDeck('N4_DECK')

const jsonN5 = cards.filter((c) => c.level === 'N5').length
const jsonN4 = cards.filter((c) => c.level === 'N4').length

const n5Pass = origN5 === jsonN5
const n4Pass = origN4 === jsonN4
const totalPass = origN5 + origN4 === cards.length

const pad = (s, n) => String(s).padEnd(n)
console.log('')
console.log(`${pad('Level', 8)}${pad('Original', 10)}${pad('JSON', 8)}${pad('Result', 8)}`)
console.log('-'.repeat(34))
console.log(`${pad('N5', 8)}${pad(origN5, 10)}${pad(jsonN5, 8)}${n5Pass ? 'PASS' : 'FAIL'}`)
console.log(`${pad('N4', 8)}${pad(origN4, 10)}${pad(jsonN4, 8)}${n4Pass ? 'PASS' : 'FAIL'}`)
console.log('-'.repeat(34))
console.log(`${pad('Total', 8)}${pad(origN5 + origN4, 10)}${pad(cards.length, 8)}${totalPass ? 'PASS' : 'FAIL'}`)
console.log('')

if (n5Pass && n4Pass && totalPass) {
  console.log('All counts match. PASS.')
  process.exit(0)
} else {
  console.error('Count mismatch. FAIL.')
  process.exit(1)
}
