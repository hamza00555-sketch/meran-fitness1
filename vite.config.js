import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,otf,woff,woff2}'],
        // The old design lives at /classic/ with a service worker of its
        // own; this one must not answer its pages with the new app. The
        // heavy PNG art is the old design's; the new one ships WebP copies
        // (~12× lighter), so the PNGs stay out of this precache.
        globIgnores: [
          'classic/**',
          'assets/muscle_*.png', 'assets/rank_*.png', 'assets/hero_*.png', 'assets/ach_*.png',
          'assets/goalc_*.png', 'assets/challenge_*.png', 'assets/cardio.png',
          'fonts/Zanjabeel-*.otf',
        ],
        navigateFallbackDenylist: [/^\/classic\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Exercise stills render straight off the bucket for anyone
            // who never downloaded the pack. Content-addressed filenames
            // make CacheFirst exactly right: a URL's bytes can never
            // change, so the first view is also the last fetch.
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
    outDir: 'dist',
    sourcemap: false,
  },
})
