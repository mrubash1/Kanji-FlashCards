/**
 * DataControls (F4) — "Download my data" + "Import" buttons.
 *
 * Export serializes all progress + custom decks to a versioned JSON file via a
 * Blob download (handled in context). Import reads a file, asks for confirmation
 * before overwriting, and shows a friendly toast if the file is malformed.
 */
import { useRef } from 'react'
import { useApp } from '../context/AppContext'

export default function DataControls() {
  const { exportData, importData, showToast } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file later
    if (!file) return
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
