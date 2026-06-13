/**
 * Results — the topic-complete screen (the original's end-screen). Shows the
 * accuracy-based emoji/message, final score, the personal-best strip with its
 * new-record variants, time taken, and retry / choose-another actions.
 */
import { useApp } from '../context/AppContext'
import { formatTime, resultTier } from '../lib/game'

export default function Results() {
  const { result, session, startSession, navigate, goHome } = useApp()

  if (!result) {
    // Shouldn't happen, but never render a blank screen.
    return (
      <main className="screen">
        <div className="empty-state">No results to show.</div>
        <button type="button" className="btn btn-primary" onClick={goHome}>
          Back to levels →
        </button>
      </main>
    )
  }

  const { score, total, timeSec, topicName, uniqueCount, pb, isFirstAttempt, newBestScore, newBestTime } =
    result
  const pct = total > 0 ? score / total : 0
  const { emoji, message } = resultTier(pct)
  const isCustom = result.levelKey.startsWith('custom:')

  const scoreStr = `${pb.bestScore} / ${pb.bestTotal} (${Math.round((pb.bestScore / pb.bestTotal) * 100)}%)`
  const timeStr = formatTime(pb.bestTime)

  let pbText: string | null = null
  if (!isFirstAttempt) {
    if (newBestScore && newBestTime) {
      pbText = `🏅 New best score ${scoreStr} AND new best time ${timeStr}!`
    } else if (newBestScore) {
      pbText = `🏅 New best score: ${scoreStr} — best time to beat: ${timeStr}`
    } else if (newBestTime) {
      pbText = `⚡ New best time: ${timeStr} — best score to beat: ${scoreStr}`
    } else {
      pbText = `Best: ${scoreStr} in ${timeStr} — can you beat it?`
    }
  }

  return (
    <main className="screen" id="end-screen" style={{ gap: '1.25rem' }}>
      <div className="end-emoji" aria-hidden="true">
        {emoji}
      </div>
      <h2 className="title">Topic complete!</h2>
      <div className="end-topic-label">
        {topicName} · {uniqueCount} unique card{uniqueCount === 1 ? '' : 's'}
      </div>
      <div className="final-score">
        {score} / {total}
      </div>
      <div className="final-label">
        points scored <span style={{ color: 'var(--text-dim-aa)', fontSize: '0.8rem' }}>(2 pts per card)</span>
      </div>
      <div className="score-message">{message}</div>

      {pbText && (
        <div className={`personal-best${newBestScore || newBestTime ? ' new-record' : ''}`}>
          {pbText}
        </div>
      )}

      <div style={{ fontSize: '0.85rem', color: 'var(--text-dim-aa)' }}>
        Time: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatTime(timeSec)}</span>
      </div>

      <div className="action-bar" style={{ maxWidth: 300 }}>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => session && startSession(session)}
        >
          Try this topic again →
        </button>
        <button
          type="button"
          className="btn btn-outline btn-block"
          onClick={() => navigate(isCustom ? 'deckList' : 'topic')}
        >
          {isCustom ? 'Back to My Decks →' : 'Choose another topic →'}
        </button>
      </div>
    </main>
  )
}
