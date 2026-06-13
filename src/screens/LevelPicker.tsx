/**
 * LevelPicker — the JLPT level menu (the original's level-screen). N5 and N4 are
 * unlocked; N3–N1 are locked placeholders; "My Decks" opens the custom-deck
 * manager. This is the app's home screen after onboarding.
 */
import { useApp } from '../context/AppContext'
import AppHeader from '../components/AppHeader'
import DataControls from '../components/DataControls'
import { getCardsByLevel } from '../data/cards'
import { cardKey } from '../lib/keys'
import { summarize } from '../lib/scheduler'
import type { Level } from '../types'

const LOCKED = [
  { badge: 'N3', name: 'Intermediate' },
  { badge: 'N2', name: 'Upper intermediate' },
  { badge: 'N1', name: 'Advanced' },
]

export default function LevelPicker() {
  const { selectLevel, navigate, progress } = useApp()

  // SRS snapshot for an unlocked level: how many cards are due now, and how many
  // have been mastered (status green). Belongs on the level screen per spec; we
  // only surface it when there's something to show, so a fresh user sees nothing.
  function levelSummary(level: Level): { due: number; learned: number } {
    const prefix = `${level}:`
    const levelStates = Object.fromEntries(
      Object.entries(progress.cardStates).filter(([k]) => k.startsWith(prefix)),
    )
    const { dueToday } = summarize(levelStates, Date.now())
    const learned = getCardsByLevel(level).filter(
      (c) => progress.cardStatus[cardKey(level, c.kanji)] === 'green',
    ).length
    return { due: dueToday, learned }
  }

  const n5 = levelSummary('N5')
  const n4 = levelSummary('N4')

  return (
    <>
      <AppHeader title="Kanji Flash" />
      <main className="screen" id="level-screen">
        <h2 className="title">Choose your level</h2>
        <p className="subtitle">JLPT levels go from N5 (easiest) to N1 (hardest)</p>

        <nav aria-label="Levels" className="level-grid">
          <button type="button" className="level-card" onClick={() => selectLevel('N5')}>
            <span className="lvl-badge">N5</span>
            <span className="lvl-info">
              <span className="lvl-name">Beginner</span>
              <span className="lvl-desc">80 essential kanji · 8 topics</span>
              {(n5.due > 0 || n5.learned > 0) && (
                <span className="lvl-desc">🔁 {n5.due} due · {n5.learned} learned</span>
              )}
            </span>
            <span className="lvl-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" className="level-card" onClick={() => selectLevel('N4')}>
            <span className="lvl-badge">N4</span>
            <span className="lvl-info">
              <span className="lvl-name">Elementary</span>
              <span className="lvl-desc">164 kanji · 9 topics</span>
              {(n4.due > 0 || n4.learned > 0) && (
                <span className="lvl-desc">🔁 {n4.due} due · {n4.learned} learned</span>
              )}
            </span>
            <span className="lvl-arrow" aria-hidden="true">→</span>
          </button>

          {LOCKED.map((l) => (
            <button key={l.badge} type="button" className="level-card locked" disabled aria-disabled="true">
              <span className="lvl-badge">{l.badge}</span>
              <span className="lvl-info">
                <span className="lvl-name">{l.name}</span>
                <span className="lvl-desc">Coming soon</span>
              </span>
              <span className="lvl-lock" aria-hidden="true">🔒</span>
            </button>
          ))}

          <button type="button" className="level-card custom-card" onClick={() => navigate('deckList')}>
            <span className="lvl-badge" aria-hidden="true">✏️</span>
            <span className="lvl-info">
              <span className="lvl-name">My Decks</span>
              <span className="lvl-desc">Create &amp; study your own cards</span>
            </span>
            <span className="lvl-arrow" aria-hidden="true">→</span>
          </button>
        </nav>

        <div className="divider" />
        <DataControls />
      </main>
    </>
  )
}
