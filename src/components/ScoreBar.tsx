/**
 * ScoreBar — the cards-left / timer / score strip shown above the card during
 * play. The timer changes colour at 2 min (warn) and 5 min (hot), exactly like
 * the original. The live score is wrapped in an aria-live region (F8) so screen
 * readers hear it update.
 */
import { formatTime } from '../lib/game'

interface ScoreBarProps {
  cardsLeft: number
  timerSec: number
  score: number
  total: number
  prevBestTime?: string
  prevBestScore?: string
}

function timerClass(sec: number): string {
  if (sec >= 300) return 'timer-display timer-hot'
  if (sec >= 120) return 'timer-display timer-warn'
  return 'timer-display'
}

export default function ScoreBar({
  cardsLeft,
  timerSec,
  score,
  total,
  prevBestTime,
  prevBestScore,
}: ScoreBarProps) {
  return (
    <div className="score-bar">
      <span className="sb-col" style={{ textAlign: 'left' }}>
        <span>
          {cardsLeft} card{cardsLeft === 1 ? '' : 's'} left
        </span>
      </span>
      <span className="sb-col" style={{ textAlign: 'center' }}>
        <span className={timerClass(timerSec)} aria-label={`Time ${formatTime(timerSec)}`}>
          {formatTime(timerSec)}
        </span>
        <span className="sb-prev">{prevBestTime}</span>
      </span>
      <span className="sb-col" style={{ textAlign: 'right' }}>
        <span aria-live="polite">
          Score:{' '}
          <span className="score-number">
            {score} / {total}
          </span>
        </span>
        <span className="sb-prev">{prevBestScore}</span>
      </span>
    </div>
  )
}
