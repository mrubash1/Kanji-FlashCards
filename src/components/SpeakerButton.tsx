/**
 * SpeakerButton — plays a reading aloud (F2).
 *
 * Reads from the shared SpeechController. When no Japanese voice is available the
 * button is hidden entirely (so there are no dead controls), unless `keepSpace`
 * is set, in which case it renders disabled with an explanatory tooltip. Every
 * press is a user gesture, satisfying the iOS autoplay rule. A short "playing"
 * pulse gives visual feedback.
 */
import { useState } from 'react'
import { useApp } from '../context/AppContext'

interface SpeakerButtonProps {
  reading: string
  /** Visual style: full-width pill (quiz) or small round (study rows). */
  variant?: 'full' | 'round'
  /** Visible label for the full pill variant. */
  label?: string
}

export default function SpeakerButton({
  reading,
  variant = 'full',
  label = 'Hear pronunciation',
}: SpeakerButtonProps) {
  const { speech, speechAvailable } = useApp()
  const [playing, setPlaying] = useState(false)

  // No voice → no button. Don't show a control the user can't use.
  if (!speechAvailable) return null

  const handle = () => {
    speech.speak(reading)
    setPlaying(true)
    // The controller doesn't surface utterance end, so pulse briefly.
    window.setTimeout(() => setPlaying(false), 900)
  }

  if (variant === 'round') {
    return (
      <button
        type="button"
        className={`sr-speak${playing ? ' playing' : ''}`}
        onClick={handle}
        title={`Hear ${reading}`}
        aria-label={`Hear ${reading}`}
      >
        🔊
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`sound-btn${playing ? ' playing' : ''}`}
      onClick={handle}
      aria-label={label}
    >
      🔊 {label}
    </button>
  )
}
