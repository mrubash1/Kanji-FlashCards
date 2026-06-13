/**
 * TopicPicker — the per-level topic grid (the original's topic-screen).
 *
 * Shows: a level mastery bar extended with the Leitner box distribution and a
 * due-today count (F1), a global-stats banner, a "study first" link, the dynamic
 * "Cards seen" / "Mistakes" tiles, the standard topic grid, and an All-cards
 * button. Picking any tile starts a graded session.
 */
import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { cardKey } from '../lib/keys'
import AppHeader from '../components/AppHeader'
import MasteryBar from '../components/MasteryBar'
import { getCardsByLevel, TOPICS } from '../data/cards'
import {
  buildTopicSession,
  buildAllCardsSession,
  buildKanjiSession,
  buildDueSession,
} from '../lib/game'
import { summarize } from '../lib/scheduler'

export default function TopicPicker() {
  const { level, progress, navigate, goHome, startSession } = useApp()

  const stats = useMemo(() => {
    const cards = getCardsByLevel(level)
    const total = cards.length
    let green = 0
    let yellow = 0
    for (const c of cards) {
      const st = progress.cardStatus[cardKey(level, c.kanji)]
      if (st === 'green') green++
      else if (st === 'yellow') yellow++
    }
    // Leitner: pull just this level's states and summarise them.
    const prefix = `${level}:`
    const now = Date.now()
    const levelStates = Object.fromEntries(
      Object.entries(progress.cardStates).filter(([k]) => k.startsWith(prefix)),
    )
    const { perBox, dueToday: due } = summarize(levelStates, now)

    const accuracy =
      progress.globalTotalAsked > 0
        ? `${Math.round((progress.globalTotalScore / progress.globalTotalAsked) * 100)}%`
        : '—'

    return { total, green, yellow, perBox, due, accuracy }
  }, [level, progress])

  const seen = progress.seenByLevel[level] ?? []
  const mistakes = progress.mistakeByLevel[level] ?? []
  const topics = TOPICS[level]
  const levelCards = getCardsByLevel(level)

  return (
    <>
      <AppHeader title={`Topics · ${level}`} onBack={goHome} backLabel="Levels" />
      <main className="screen" id="topic-screen">
        <MasteryBar
          green={stats.green}
          yellow={stats.yellow}
          total={stats.total}
          perBox={stats.perBox}
          due={stats.due}
        />

        {/* The SRS review queue — the heart of spaced repetition. Studying a
            topic still works any time; this routes straight to what's due. */}
        {stats.due > 0 ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => startSession(buildDueSession(level, progress.cardStates, Date.now()))}
          >
            🔁 Review {stats.due} due card{stats.due === 1 ? '' : 's'} →
          </button>
        ) : (
          <p className="subtitle" style={{ margin: 0 }}>
            ✅ Nothing due right now — study a topic below to learn more.
          </p>
        )}

        <div className="global-stats">
          <div>
            <span className="gs-label">Total score</span>
            <span className="gs-val">
              {progress.globalTotalScore} / {progress.globalTotalAsked}
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span className="gs-label">Sessions</span>
            <span className="gs-val">{progress.globalSessions}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="gs-label">Best accuracy</span>
            <span className="gs-val">{stats.accuracy}</span>
          </div>
        </div>

        <button type="button" className="study-link" onClick={() => navigate('study')}>
          📚 Study the kanji first
          <span className="sl-sub">— see all meanings &amp; readings</span>
        </button>

        {/* Dynamic topics: Cards seen / Mistakes */}
        <div className="topic-grid">
          <DynamicTile
            label="Cards seen"
            sample="見る"
            count={seen.length}
            className="seen-card"
            onPlay={() => startSession(buildKanjiSession(level, 'Cards seen', seen))}
          />
          <DynamicTile
            label="Mistakes"
            sample="✗"
            count={mistakes.length}
            className="mistake-card"
            onPlay={() => startSession(buildKanjiSession(level, 'Mistakes', mistakes))}
          />
        </div>

        <div className="divider" />

        {/* Standard topics */}
        <div className="topic-grid">
          {topics.map((topic) => {
            const count = levelCards.filter((c) => topic.keys.includes(c.kanji)).length
            return (
              <button
                key={topic.name}
                type="button"
                className="topic-card"
                onClick={() => startSession(buildTopicSession(level, topic))}
              >
                <div className="topic-kanji">{topic.sample}</div>
                <div className="topic-name">{topic.name}</div>
                <div className="topic-count">{count} cards</div>
              </button>
            )
          })}
        </div>

        <div className="divider" />

        {/* All cards */}
        <div className="topic-grid">
          <button
            type="button"
            className="topic-card all-card"
            onClick={() => startSession(buildAllCardsSession(level))}
          >
            <div className="topic-kanji">全</div>
            <div className="topic-name">All cards</div>
            <div className="topic-count">{stats.total} cards</div>
          </button>
        </div>
      </main>
    </>
  )
}

/** One "Cards seen" / "Mistakes" tile — locked (disabled) when empty (F7). */
function DynamicTile({
  label,
  sample,
  count,
  className,
  onPlay,
}: {
  label: string
  sample: string
  count: number
  className: string
  onPlay: () => void
}) {
  const locked = count === 0
  return (
    <button
      type="button"
      className={`topic-card ${className}${locked ? ' locked' : ''}`}
      onClick={onPlay}
      disabled={locked}
      aria-disabled={locked}
    >
      <div className="topic-kanji">{locked ? '？' : sample}</div>
      <div className="topic-name">{label}</div>
      <div className="topic-count">
        {count} card{count === 1 ? '' : 's'}
      </div>
    </button>
  )
}
