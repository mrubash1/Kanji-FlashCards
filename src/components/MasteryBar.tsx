/**
 * MasteryBar — the green/yellow progress bar from the topic picker, extended
 * with the Leitner per-box distribution and a "due today" pill (F1).
 *
 *   green  = cards cleared cleanly
 *   yellow = cards cleared with a slip
 *   empty  = not yet cleared
 *
 * `perBox` (optional) is the 5-element Leitner distribution from
 * scheduler.summarize(); `due` is how many cards are due now.
 */
interface MasteryBarProps {
  green: number
  yellow: number
  total: number
  perBox?: number[]
  due?: number
}

export default function MasteryBar({ green, yellow, total, perBox, due }: MasteryBarProps) {
  const empty = Math.max(0, total - green - yellow)
  const gPct = total > 0 ? (green / total) * 100 : 0
  const yPct = total > 0 ? (yellow / total) * 100 : 0
  const maxBox = perBox && perBox.length > 0 ? Math.max(1, ...perBox) : 1

  return (
    <div className="mastery-wrap">
      <div className="mastery-bar" role="img" aria-label={`${green} cleared, ${yellow} with slips, ${empty} to go`}>
        <div className="mastery-green" style={{ width: `${gPct}%` }} />
        <div className="mastery-yellow" style={{ width: `${yPct}%` }} />
      </div>
      <div className="mastery-legend">
        <span className="ml-item">
          <span className="ml-dot green" /> {green} perfect
        </span>
        <span className="ml-item">
          <span className="ml-dot yellow" /> {yellow} with slips
        </span>
        <span className="ml-item">
          <span className="ml-dot empty" /> {empty} to go
        </span>
      </div>

      {perBox && (
        <>
          <div className="box-strip" aria-hidden="true">
            {perBox.map((count, i) => (
              <span key={i} className="box-seg">
                <span className={`box-fill${count > 0 ? ' has' : ''}`} style={{ opacity: 0.35 + 0.65 * (count / maxBox) }} />
                <span>
                  B{i + 1}: {count}
                </span>
              </span>
            ))}
          </div>
          {due !== undefined && due > 0 && (
            <div className="due-pill">📅 {due} due for review</div>
          )}
        </>
      )}
    </div>
  )
}
