// The self-hosted pack, installed the way حمزة installs it.
//
//   npm run build && npx vite preview --port 4173 &
//   APP=http://localhost:4173/ node tests/pack-install.e2e.mjs
//
// Nothing is intercepted: the preview serves dist/pack at /pack/ exactly
// as the site does, and the service worker runs — checked, not assumed:
// its precache is filled, and its two pack rules have each answered a
// request (the manifest NetworkFirst, a still CacheFirst) before the
// pack is downloaded. Settings → «حزمة الصور» → download; then the
// player shows, for exercises on screen:
//
//   - a corrected still where its old loop is on hold (Cable Triceps
//     Kickback faces the machine now, and is not the bucket's picture),
//   - the lying machine for «مرجحة خلفية جهاز» (Leg Curl),
//   - an October Push Pull Legs loop (Cable Fly) where one is expected.
//
// Then the old design opens on the same phone — the switch set to it,
// and its own bundle seen running — and must neither fetch nor delete
// anything: both designs read the same manifest. Last, offline in the
// gym: the app reloads from the worker and the stage still comes out
// of the downloaded pack.
//
// This Chromium has no H.264 decoder, so a loop cannot actually play
// here: the app mounts the <video>, the decode fails, and it falls back
// to the still. So the loop is checked as mounted — a <video> on the
// stage whose blob hashes to the loop in the manifest — and the stage
// screenshots are written to OUT for a person to look at.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync, readFileSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS, MUSCLE_GROUPS } from '../src/constants.js'
import { offlineOrigin } from './offline-origin.mjs'

// Through an origin that can be taken down: offline must stop the
// service worker's own requests too (see tests/offline-origin.mjs).
const origin = await offlineOrigin(process.env.APP || 'http://localhost:4173/')
const APP = origin.url
const OUT = process.env.OUT || '/tmp/meran-pack-install-e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

const manifest = await (await fetch(new URL('pack/manifest.json', APP))).json()
const byId = new Map(manifest.assets.map(a => [a.id, a]))
const unique = new Set(manifest.assets.map(a => a.sha256)).size
const sources = JSON.parse(readFileSync(new URL('../scripts/pack-sources.json', import.meta.url), 'utf8')).slots

// What the bucket served for this slot (pack 2026.08.30-1): the still
// that showed the wrong movement.
const OLD_KICKBACK = 'c5e4f24fee75b2a8ab1d9b5f9f985b82dca8647199c6c6d050e10b4508a54fcb'

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const packFetches = []
page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/pack/i/')) packFetches.push(u.pathname) })

await ctx.addInitScript(([version, unlocked]) => {
  // Seeded once; later loads see what the app itself wrote.
  try {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('hf_weights_reset_v2', 'true')
      localStorage.setItem('hf_seen_version', JSON.stringify(version))
      localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
      localStorage.setItem('hf_onboarded', 'true')
      localStorage.setItem('hf_pack_prompted', '1')
      localStorage.setItem('hf_unlocked', JSON.stringify(unlocked))
    }
  } catch { /* the browser's own error page, when a load fails offline */ }
  // Every <video> the app mounts, with its source and where it sits,
  // caught before a decode failure can take it down again.
  window.__videos = []
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) {
      const vids = n.nodeType === 1 ? (n.tagName === 'VIDEO' ? [n] : [...n.querySelectorAll('video')]) : []
      for (const v of vids) window.__videos.push({ src: v.src, stage: !!v.closest('[data-testid="exercise-stage"]') })
    }
  }).observe(document, { childList: true, subtree: true })
}, [APP_VERSION, ACHIEVEMENTS.map(a => a.id)])

const blobCount = () => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('meran-assets')
  req.onsuccess = () => {
    const db = req.result
    if (!db.objectStoreNames.contains('blobs')) return resolve(0)
    const c = db.transaction('blobs', 'readonly').objectStore('blobs').count()
    c.onsuccess = () => resolve(c.result)
  }
  req.onerror = () => resolve(0)
}))
const shaOf = (url) => page.evaluate(async (u) => {
  const buf = await (await fetch(u)).arrayBuffer()
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('')
}, url)

const cacheNames = () => page.evaluate(() => caches.keys())
const cached = (cacheName, url) => page.evaluate(async ([n, u]) => !!(await (await caches.open(n)).match(u)), [cacheName, url])
const muscleOf = (name) => Object.entries(MUSCLE_GROUPS).find(([, g]) => g.exercises?.some(e => e.name === name))?.[0]
async function onStage(name) {
  await page.evaluate(([n, muscle]) => {
    localStorage.setItem('hf_active', JSON.stringify({
      id: Date.now() - 60000, date: new Date().toISOString(), name: 'Pack — اختبار',
      exercises: [{ id: 'x', muscle, name: n, sets: [{ weight: '20', reps: '12', done: false }] }],
    }))
  }, [name, muscleOf(name)])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="session"]').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const stage = page.locator('[data-testid="exercise-stage"]').first()
  const img = await page.evaluate(() => document.querySelector('[data-testid="exercise-stage"] img')?.src || null)
  const videos = await page.evaluate(() => window.__videos.filter(v => v.stage))
  return { stage, img, videos }
}

// ── The service worker, running ───────────────────────────────
await page.goto(APP, { waitUntil: 'networkidle' })
await page.evaluate(() => navigator.serviceWorker.ready)
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {})
{
  const names = await cacheNames()
  ok('the service worker installed: its precache is filled', names.some(n => n.startsWith('meran-v1-precache-')), names.join(', '))
}
// Now under the worker: the boot's manifest request and a still shown
// before any download both go through its pack rules.
const kickback = await onStage('Cable Triceps Kickback')
ok('before the download, the stage still comes off the site\'s /pack/i/',
  kickback.img === new URL(`pack/${byId.get('ex_cable_triceps_kickback').file}`, APP).href, kickback.img)
ok('the worker kept that still (CacheFirst, meran-pack-remote)', await cached('meran-pack-remote', kickback.img))
ok('and the manifest (NetworkFirst, meran-pack-manifest)', await cached('meran-pack-manifest', new URL('pack/manifest.json', APP).href))
await page.evaluate(() => localStorage.removeItem('hf_active'))
await page.reload({ waitUntil: 'networkidle' })

// ── Install from Settings ─────────────────────────────────────
await page.waitForTimeout(700)
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => document.querySelector('nav.f-tabs button')?.click())
  await page.waitForTimeout(300)
  await page.evaluate(() => document.querySelector('button[aria-label="الإعدادات"]')?.click())
  await page.waitForTimeout(500)
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('حزمة الصور'))?.click())
  await page.waitForTimeout(600)
  if (await page.locator('[data-pack="install"]').count()) break
}
const offer = await page.locator('[data-pack="install"]').innerText().catch(() => '')
ok('Settings → «حزمة الصور» offers the download, with its size', /نزّل الحزمة/.test(offer) && /ميجا/.test(offer), offer)
const t0 = Date.now()
await page.locator('[data-pack="install"]').click()
let phase = null
for (let i = 0; i < 240; i++) {
  phase = await page.locator('[data-pack-phase]').getAttribute('data-pack-phase').catch(() => null)
  if (['ready', 'error', 'offline', 'nospace'].includes(phase)) break
  await page.waitForTimeout(500)
}
const took = ((Date.now() - t0) / 1000).toFixed(1)
ok('it installs from the site\'s own /pack/', phase === 'ready', `phase=${phase} in ${took}s`)
await page.waitForTimeout(800)
ok('every distinct file verified and stored', (await blobCount()) === unique, `${await blobCount()}/${unique}`)
// The download keeps its own copy of every file; the worker's stills
// cache must not keep a second (~10 MB): it holds only what was shown
// before the download (the one still above).
const remoteKept = await page.evaluate(async () => (await (await caches.open('meran-pack-remote')).keys()).length)
ok('the download leaves no second copy in the worker\'s stills cache', remoteKept <= 3, `${remoteKept} stills cached by the worker`)
const pointer = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_pack') || 'null'))
ok('the installed version is the deployed one', pointer?.packVersion === manifest.packVersion && pointer?.count === manifest.assets.length,
  JSON.stringify(pointer))
ok('Settings shows that version', (await page.evaluate(() => document.body.innerText)).includes(`v${manifest.packVersion}`))
await page.screenshot({ path: `${OUT}/settings-ready.png` })

// ── The player, one exercise on the stage at a time ──────────
{
  const s = await onStage('Cable Triceps Kickback')
  const sha = s.img?.startsWith('blob:') ? await shaOf(s.img) : null
  ok('kickback: the stage shows the downloaded still', !!sha, s.img)
  ok('kickback: it is the corrected picture, not the bucket\'s', sha === byId.get('ex_cable_triceps_kickback').sha256 && sha !== OLD_KICKBACK, sha)
  ok('kickback: its old loop is not played', s.videos.length === 0, JSON.stringify(s.videos))
  await s.stage.screenshot({ path: `${OUT}/stage-cable-triceps-kickback.png` })
}

{
  const s = await onStage('Leg Curl')
  const sha = s.img?.startsWith('blob:') ? await shaOf(s.img) : null
  ok('leg curl: «مرجحة خلفية جهاز» shows the lying machine', sha && sha === byId.get('ex_lying_leg_curl').sha256, sha)
  ok('leg curl: and not the seated loop it used to play', s.videos.length === 0, JSON.stringify(s.videos))
  await s.stage.screenshot({ path: `${OUT}/stage-leg-curl.png` })
}

{
  const s = await onStage('Cable Fly')
  const loop = byId.get('exa_cable_fly')
  const v = s.videos.find(x => x.src.startsWith('blob:'))
  const sha = v ? await shaOf(v.src) : null
  ok('cable fly: an October loop (Push Pull Legs batch)', /hf_202610/.test(sources.exa_cable_fly?.url || ''), sources.exa_cable_fly?.url)
  ok('cable fly: its loop is mounted on the stage, from the downloaded pack', sha === loop.sha256, `${sha} vs ${loop.sha256}`)
  await s.stage.screenshot({ path: `${OUT}/stage-cable-fly.png` })
}

// ── The old design, same phone ────────────────────────────────
{
  await page.evaluate(() => localStorage.removeItem('hf_active'))
  const before = packFetches.length
  // The switch in Settings, set to the old design: without it,
  // classic/index.html sends /classic/ straight back to / before the
  // old bundle runs, and this would test the new design twice.
  await page.evaluate(() => localStorage.setItem('meran_design', 'classic'))
  await page.goto(new URL('classic/', APP).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const bundle = await page.evaluate(() => [...document.scripts].map(s => s.src).find(s => /\/classic\/assets\/index-[^/]+\.js$/.test(s)) || null)
  ok('the old design is the one running', new URL(page.url()).pathname === '/classic/' && !!bundle, `${page.url()} · ${bundle}`)
  ok('the old design fetches nothing: the pack it reads is already here', packFetches.length === before,
    packFetches.slice(before, before + 3).join(', '))
  ok('and deletes nothing', (await blobCount()) === unique, `${await blobCount()}/${unique}`)
  await page.evaluate(() => localStorage.setItem('meran_design', 'new'))
  await page.goto(APP, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  ok('back in the new design, still installed and nothing refetched',
    new URL(page.url()).pathname === '/' && (await blobCount()) === unique && packFetches.length === before,
    `${page.url()} · ${await blobCount()}/${unique}, ${packFetches.length - before} fetches`)
}

// ── Offline, in the gym ───────────────────────────────────────
origin.setDown(true)
await ctx.setOffline(true)
{
  let s = null, err = ''
  try { s = await onStage('Cable Triceps Kickback') } catch (e) { err = e.message.split('\n')[0] }
  const sha = s?.img?.startsWith('blob:') ? await shaOf(s.img) : null
  ok('offline, the app reloads from the service worker', !err && await page.locator('[data-testid="session"]').count() > 0, err)
  ok('offline, the stage still comes out of the downloaded pack', sha === byId.get('ex_cable_triceps_kickback').sha256, sha)
  await page.evaluate(() => localStorage.removeItem('hf_active')).catch(() => {})
}
origin.setDown(false)
await ctx.setOffline(false)

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, e ? `— ${e}` : '')
await browser.close()
await origin.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
