import { defineConfig } from 'vitest/config'

// Vitest config kept separate from vite.config.ts so the Vite build never sees
// test-only options. Unit tests live in tests/unit and run in jsdom.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      include: ['src/lib/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
})
