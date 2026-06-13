/**
 * AppHeader (F5) — the ONE header used by every screen.
 *
 * The original had three different back affordances ("← Levels", "← My Decks",
 * "← Back"). This single component takes a `title`, an optional back action with
 * a consistent label, and an optional right-hand action, so navigation looks and
 * behaves the same everywhere. Rendered as a semantic <header> landmark (F8).
 */
import type { ReactNode } from 'react'

interface AppHeaderProps {
  title: string
  /** Back handler. When omitted, the left slot is an invisible spacer. */
  onBack?: () => void
  /** Accessible + visible label for the back button. Defaults to "Back". */
  backLabel?: string
  /** Optional control on the right (e.g. Save, New deck). */
  right?: ReactNode
}

export default function AppHeader({ title, onBack, backLabel = 'Back', right }: AppHeaderProps) {
  return (
    <header className="app-header">
      {onBack ? (
        <button type="button" className="header-btn" onClick={onBack} aria-label={backLabel}>
          <span aria-hidden="true">←</span> {backLabel}
        </button>
      ) : (
        <span className="header-spacer" aria-hidden="true" />
      )}
      <h1 className="app-header__title">{title}</h1>
      {right ?? <span className="header-spacer" aria-hidden="true" />}
    </header>
  )
}
