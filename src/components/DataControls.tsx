/**
 * DataControls (F4) — "Download my data" + "Import" buttons.
 *
 * Export serializes all progress + custom decks to a versioned JSON file via a
 * Blob download (handled in context). Import reads a file, asks for confirmation
 * before overwriting, and shows a friendly toast if the file is malformed.
 */
import { useRef } from 'react'
import { useApp } from '../context/AppContext'

/** Reject imports larger than this before reading them into memory. A real data
 * backup is a few KB; anything past 5 MB is malformed or hostile (a JSON-bomb
 * that could hang the tab parsing it), so we refuse it up front. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024 // 5 MB — far above any real backup

export default function DataControls() {
  const { exportData, importData, showToast } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file later
    if (!file) return
    // Cap the size BEFORE reading the file into memory, so a giant/hostile file
    // can't hang the tab in `file.text()` / `JSON.parse`.
    if (file.size > MAX_IMPORT_BYTES) {
      showToast('⚠ That file is too large to import')
      return
    }
    const text = await file.text()
    // Confirm before clobbering existing progress.
    if (!window.confirm('Import this file? It will replace your current progress and decks.')) {
      return
    }
    const res = importData(text)
    showToast(res.ok ? '✓ Data imported' : `⚠ ${res.error ?? 'Could not import that file'}`)
  }

  return (
    <div className="action-bar" aria-label="Your data">
      <button type="button" className="header-btn" onClick={exportData}>
        ⤓ Download my data
      </button>
      <button type="button" className="header-btn" onClick={() => fileRef.current?.click()}>
        ⤒ Import data
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="sr-only"
        aria-label="Import data file"
      />
    </div>
  )
}
