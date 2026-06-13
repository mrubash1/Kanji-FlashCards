/**
 * DeckList — "My Decks" (the original's deck-list-screen). Lists custom decks
 * with a combined mastery bar, a per-deck Play/Edit row, and a friendly empty
 * state. Creating, editing, and playing decks all route through context.
 */
import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import AppHeader from '../components/AppHeader'
import MasteryBar from '../components/MasteryBar'
import { buildDeckSession, validateDeck } from '../lib/game'
import type { PhaseMode } from '../types'

const STYLE_LABEL: Record<PhaseMode, string> = {
  both: 'meaning + reading',
  meaning: 'meaning only',
  reading: 'reading only',
}

export default function DeckList() {
  const { decks, progress, goHome, openNewDeck, openDeck, startSession, showToast } = useApp()

  // Combined mastery across every card in every deck, keyed custom:<id>:<kanji>.
  const mastery = useMemo(() => {
    let total = 0
    let green = 0
    let yellow = 0
    for (const d of decks) {
      for (const c of d.cards) {
        if (!c.kanji) continue
        total++
        const st = progress.cardStatus[`custom:${d.id}:${c.kanji}`]
        if (st === 'green') green++
        else if (st === 'yellow') yellow++
      }
    }
    return { total, green, yellow }
  }, [decks, progress])

  const playDeck = (id: string) => {
    const deck = decks.find((d) => d.id === id)
    if (!deck) return
    const err = validateDeck(deck, true)
    if (err) {
      showToast(`⚠ ${err}`)
      return
    }
    startSession(buildDeckSession(deck))
  }

  return (
    <>
      <AppHeader
        title="My Decks"
        onBack={goHome}
        backLabel="Levels"
        right={
          <button type="button" className="header-btn" onClick={openNewDeck}>
            ＋ New
          </button>
        }
      />
      <main className="screen" id="deck-list-screen">
        <p className="subtitle">Your own subjects and cards</p>

        {mastery.total > 0 && (
          <MasteryBar green={mastery.green} yellow={mastery.yellow} total={mastery.total} />
        )}

        {decks.length === 0 ? (
          <div className="empty-state">
            <span className="es-emoji" aria-hidden="true">
              🗂️
            </span>
            You haven’t made any decks yet.
            <br />
            Tap <strong>＋ New</strong> above to create your first one.
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            {decks.map((d) => (
              <div key={d.id} className="deck-row">
                <div className="dr-info">
                  <div className="dr-name">{d.name || 'Untitled deck'}</div>
                  <div className="dr-meta">
                    {d.cards.length} card{d.cards.length === 1 ? '' : 's'} · {STYLE_LABEL[d.phaseMode]}
                  </div>
                </div>
                <button
                  type="button"
                  className="dr-btn dr-play"
                  onClick={() => playDeck(d.id)}
                  disabled={d.cards.length === 0}
                >
                  ▶ Play
                </button>
                <button type="button" className="dr-btn dr-edit" onClick={() => openDeck(d.id)}>
                  ✏ Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
