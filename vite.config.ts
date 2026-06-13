import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vite config. The PWA plugin (F9) generates the manifest + service worker.
// Vitest is configured separately in vitest.config.ts.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kanji Flash',
        short_name: 'Kanji Flash',
        description: 'Learn JLPT kanji with spaced-repetition flashcards.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell so it works fully offline after first
        // load. Note: cards.json/topics.json are imported as ES modules, so Vite
        // inlines them INTO the JS bundle — they ride along in the precached JS
        // rather than as standalone files. The `json` glob covers the generated
        // manifest and any future runtime-fetched JSON.
        globPatterns: ['**/*.{js,css,html,json,svg,png,woff2}'],
      },
    }),
  ],
})
