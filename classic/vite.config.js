// ── The old design, frozen ────────────────────────────────────
//
// classic/src is the app exactly as it was at commit 0058119 — the
// design حمزة is used to, before the redesign — plus one thing: the
// design switch in Settings (src/design.js, components/DesignSwitch.jsx).
// It is built into dist/classic and served at /classic/ next to the new
// app, on the same origin, so both read the same storage.
//
// It has no public/ of its own: its images and fonts are the root app's
// (absolute /assets/… and /fonts/… paths), and tests/classic.test.mjs
// fails if the new design ever deletes one it needs.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: here,
  base: '/classic/',
  publicDir: false,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // One installed app: the home-screen icon and manifest belong to /.
      manifest: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cacheId: 'meran-classic',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,otf,woff,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // The root app's images and fonts, which this build points at,
            // so the old design keeps working offline once seen.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/(assets|fonts)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'meran-classic-shared',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true },
            },
          },
          {
            urlPattern: /^https:\/\/pub-189be0412bdd4092aa44be319badfd91\.r2\.dev\/i\/.*\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'meran-pack-remote',
              expiration: { maxEntries: 220, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: fileURLToPath(new URL('../dist/classic', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
})
