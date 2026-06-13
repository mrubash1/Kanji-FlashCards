/**
 * Toast — the slide-up confirmation message from the original, now also an
 * `aria-live` region (F8) so screen readers announce saves, deletes, and
 * validation errors. Rendered once at the app root; `message` comes from
 * context. When null the toast slides back off-screen.
 */
interface ToastProps {
  message: string | null
}

export default function Toast({ message }: ToastProps) {
  return (
    <div className={`toast${message ? ' show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
