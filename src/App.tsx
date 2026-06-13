/**
 * App shell. For Phase 1 this is a hello-world placeholder so the toolchain
 * (tsc + build) is green. Phase 3 replaces the body with the screen router
 * driven by the typed `Screen` union in context.
 */
export default function App() {
  return (
    <main style={{ margin: 'auto', textAlign: 'center', padding: '2rem' }}>
      <div
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: '4rem',
          color: 'var(--accent)',
        }}
      >
        漢字
      </div>
      <h1>Kanji Flash</h1>
      <p style={{ color: 'var(--text-dim)' }}>Rebuild in progress…</p>
    </main>
  )
}
