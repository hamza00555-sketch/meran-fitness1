import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// What the service worker precaches, handed straight to Workbox.
// Exported, with the pack's runtime rules below, for
// tests/pack-build.test.mjs.
export const PRECACHE = {
  // The sounds (public/sounds, ~100 KB for both formats) are
  // precached too: the gym is where the app is used offline.
  globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,otf,woff,woff2}', 'sounds/*.{m4a,mp3}'],
  // The old design lives at /classic/ with a service worker of its
  // own; this one must not answer its pages with the new app. The
  // heavy PNG art is the old design's; the new one ships WebP copies
  // (~12× lighter), so the PNGs stay out of this precache.
  //
  // The art pack (dist/pack, ~14 MB, built by scripts/build.mjs) is
  // downloaded on request into IndexedDB. It must never ride along in
  // the precache, which every visitor installs in full — and its
  // stills are WebP, which globPatterns would otherwise take.
  globIgnores: [
    'classic/**', 'pack/**',
    'assets/muscle_*.png', 'assets/rank_*.png', 'assets/hero_*.png', 'assets/ach_*.png',
    'assets/goalc_*.png', 'assets/challenge_*.png', 'assets/cardio.png',
    'fonts/Zanjabeel-*.otf',
  ],
}

// Two runtime rules look after the pack, which this site serves at
// /pack/. Workbox copies each urlPattern into sw.js as source text, so
// they use nothing from this file.
export const PACK_RUNTIME_CACHING = [
  {
    // Exercise stills render straight off /pack/i/ for anyone who
    // never downloaded the pack. Content-addressed filenames make
    // CacheFirst exactly right: a URL's bytes can never change,
    // so the first view is also the last fetch. Stills only — the
    // loops play from the downloaded pack, and a video's range
    // requests are no job for CacheFirst. The cache name is the
    // one the bucket's stills used, so its size cap retires them.
    urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/pack\/i\/[0-9a-f]{64}\.webp$/.test(url.pathname),
    handler: 'CacheFirst',
    options: {
      cacheName: 'meran-pack-remote',
      expiration: { maxEntries: 220, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true },
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    // The manifest is the one file that changes: always ask the
    // network first, and keep the last copy so the stills above
    // still find their URLs offline in the gym.
    urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/pack/manifest.json',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'meran-pack-manifest',
      networkTimeoutSeconds: 6,
      expiration: { maxEntries: 1 },
      cacheableResponse: { statuses: [200] },
    },
  },
]

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/**/*', 'fonts/**/*'],
      manifest: {
        name: 'مران | MERAN',
        short_name: 'مران',
        description: 'تطبيق مران لتتبع التمارين والوصول إلى قمة اللياقة',
        start_url: '/',
        display: 'standalone',
        background_color: '#030404',
        theme_color: '#030404',
        orientation: 'portrait',
        lang: 'ar',
        icons: [
          { src: '/assets/meran-app-icon-transparent-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/assets/meran-app-icon-transparent-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cacheId: 'meran-v1',
        ...PRECACHE,
        navigateFallbackDenylist: [/^\/classic\//, /^\/pack\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          ...PACK_RUNTIME_CACHING,
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
    outDir: 'dist',
    sourcemap: false,
  },
})
