/**
 * DeckEditor — create/edit one custom deck (the original's deck-editor-screen).
 *
 * Edits a LOCAL working copy seeded from context's draft deck, so typing doesn't
 * thrash global state. Saving commits the copy via context (which persists it);
 * "Save & play" also launches it; Delete removes it after a confirm. The
 * meaning/reading fields dim when the chosen quiz style doesn't use them.
 */
import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import AppHeader from '../components/AppHeader'
import { validateDeck, buildDeckSession } from '../lib/game'
import { asksMeaning, asksReading } from '../lib/game'
import type { Deck, DeckCard, PhaseMode } from '../types'

const PHASE_HINT: Record<PhaseMode, string> = {
  both: 'Players type the meaning, then the reading. Both fields required.',
  meaning: 'Players type only the meaning. Reading is optional.',
  reading: 'Players type only the reading. Meaning is optional.',
}

function blankCard(): DeckCard {
  return { kanji: '', meaning: '', reading: '' }
}

export default function DeckEditor() {
  const { editingDeck, saveDeck, deleteDeck, startSession, navigate, showToast } = useApp()

  // Seed the working copy, always with at least one row so `deck.cards` and
  // `rowIds` stay in lockstep (no transient blank that would remount on render).
  const seed = editingDeck ?? { id: `deck_${Date.now()}`, name: '', phaseMode: 'both', cards: [] }
  const [deck, setDeck] = useState<Deck>(
    seed.cards.length > 0 ? seed : { ...seed, cards: [blankCard()] },
  )

  // Stable per-row id used as the React key, so removing a middle card doesn't
  // make React reconcile by position and show stale values in the wrong inputs.
  const uidRef = useRef(0)
  const nextUid = () => `row-${uidRef.current++}`
  const [rowIds, setRowIds] = useState<string[]>(() => deck.cards.map(() => nextUid()))

  const cards = deck.cards
  const dimMeaning = !asksMeaning(deck.phaseMode)
  const dimReading = !asksReading(deck.phaseMode)

  const setField = (field: 'name', value: string) => setDeck((d) => ({ ...d, [field]: value }))
  const setMode = (mode: PhaseMode) => setDeck((d) => ({ ...d, phaseMode: mode }))
  const updateCard = (i: number, field: keyof DeckCard, value: string) =>
    setDeck((d) => ({
      ...d,
      cards: d.cards.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }))
  const addCard = () => {
    setDeck((d) => ({ ...d, cards: [...d.cards, blankCard()] }))
    setRowIds((ids) => [...ids, nextUid()])
  }
  const removeCard = (i: number) => {
    // Keep at least one editable row; ids and cards always change together.
    setDeck((d) => {
      const next = d.cards.filter((_, idx) => idx !== i)
      return { ...d, cards: next.length ? next : [blankCard()] }
    })
    setRowIds((ids) => {
      const next = ids.filter((_, idx) => idx !== i)
      return next.length ? next : [nextUid()]
    })
  }

  const save = (): boolean => {
    const err = validateDeck(deck, false)
    if (err) {
      showToast(`⚠ ${err}`)
      return false
    }
    saveDeck(deck)
    showToast('✓ Deck saved')
    return true
  }

  const saveAndPlay = () => {
    const err = validateDeck(deck, true)
    if (err) {
      showToast(`⚠ ${err}`)
      return
    }
    saveDeck(deck)
    startSession(buildDeckSession(deck))
  }

  const remove = () => {
    if (!window.confirm(`Delete the deck "${deck.name || 'Untitled'}"? This cannot be undone.`)) {
      return
    }
    deleteDeck(deck.id)
    showToast('Deck deleted')
    navigate('deckList')
  }

  return (
    <>
      <AppHeader
        title="Edit deck"
        onBack={() => navigate('deckList')}
        backLabel="My Decks"
      />
      <main className="screen" id="deck-editor-screen">
        <div className="editor-field">
          <label className="editor-label" htmlFor="deck-name">
            Deck name
          </label>
          <input
            id="deck-name"
            className="editor-input"
            type="text"
            placeholder="e.g. Kitchen vocabulary"
            autoComplete="off"
            value={deck.name}
            onChange={(e) => setField('name', e.target.value)}
          />
        </div>

        <div className="editor-field">
          <label className="editor-label" htmlFor="deck-style">
            Quiz style
          </label>
          <select
            id="deck-style"
            className="editor-input"
            value={deck.phaseMode}
            onChange={(e) => setMode(e.target.value as PhaseMode)}
          >
            <option value="both">Meaning, then reading (2 steps)</option>
            <option value="meaning">Meaning only (1 step)</option>
            <option value="reading">Reading only (1 step)</option>
          </select>
          <div className="editor-hint">{PHASE_HINT[deck.phaseMode]}</div>
        </div>

        <h3 className="editor-section-title">Cards</h3>
        <div style={{ width: '100%' }}>
          {cards.map((card, i) => (
            <div key={rowIds[i]} className="card-edit">
              <div className="ce-top">
                <span className="ce-num">Card {i + 1}</span>
                <button
                  type="button"
                  className="ce-remove"
                  onClick={() => removeCard(i)}
                  aria-label={`Remove card ${i + 1}`}
                  title="Remove card"
                >
                  ✕
                </button>
              </div>
              <input
                className="ce-kanji"
                placeholder="Front (e.g. 水 or any word)"
                value={card.kanji}
                onChange={(e) => updateCard(i, 'kanji', e.target.value)}
                aria-label={`Card ${i + 1} front`}
              />
              <input
                className={`ce-meaning${dimMeaning ? ' ce-dim' : ''}`}
                placeholder="Meaning (e.g. water). Use / for alternatives"
                value={card.meaning}
                onChange={(e) => updateCard(i, 'meaning', e.target.value)}
                aria-label={`Card ${i + 1} meaning`}
              />
              <input
                className={`ce-reading${dimReading ? ' ce-dim' : ''}`}
                placeholder="Reading (e.g. みず or mizu)"
                value={card.reading}
                onChange={(e) => updateCard(i, 'reading', e.target.value)}
                aria-label={`Card ${i + 1} reading`}
              />
            </div>
          ))}
        </div>
        <button type="button" className="study-link" onClick={addCard}>
          ＋ Add a card
        </button>

        <div className="action-bar" style={{ maxWidth: 320, marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary btn-block" onClick={save}>
            Save deck →
          </button>
          <button type="button" className="btn btn-outline btn-block" onClick={saveAndPlay}>
            Save &amp; play →
          </button>
          <button
            type="button"
            className="header-btn"
            onClick={remove}
            style={{ borderColor: 'rgba(233,69,96,0.4)', color: 'var(--accent-soft)' }}
          >
            🗑 Delete deck
          </button>
        </div>
      </main>
    </>
  )
}
