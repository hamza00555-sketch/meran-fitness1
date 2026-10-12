// Checks the pack that is actually published, over the actual network.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/pack.live.mjs                       # the production site
//   LIVE=https://<preview>.vercel.app/ node tests/pack.live.mjs
//
// The pack is built with the site and served from it at /pack/
// (scripts/build.mjs), so "published" means "deployed": this reads the
// manifest and files from the live site, checks the headers vercel.json
// promises, then has the local preview install them.
//
// pack.e2e.mjs serves a pack from disk so it can drop the network,
// corrupt a file and count requests. This one uses no fixtures at all:
// every byte comes from the live site, and the app has to verify it
// against the published manifest before it will store it.
//
// One sandbox accommodation, stated plainly. In a hardened runner all
// egress goes through an inspecting proxy that Chromium will not use,
// so the browser has no route to the internet. The preview's /pack/
// requests are therefore fulfilled by Node — which does have a route —
// from the live site, passing the real status, type and body straight
// through. The URLs' paths, the bytes, the hashes and the install are
// genuinely the published ones; the headers are asserted directly
// against the real responses first.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const APP = process.env.APP || 'http://localhost:4173/'
const LIVE = process.env.LIVE || 'https://meran-fitness1.vercel.app/'
const { MANIFEST_URL } = await import(pathToFileURL(new URL('../src/assets/pack.js', import.meta.url).pathname).href)
const { APP_VERSION } = await import(pathToFileURL(new URL('../src/constants.js', import.meta.url).pathname).href)
const { ALL_SLOT_IDS } = await import(pathToFileURL(new URL('../src/assets/slots.js', import.meta.url).pathname).href)
const { readPrecache, precacheProblems } = await import(pathToFileURL(new URL('../scripts/precache.mjs', import.meta.url).pathname).href)
const LIVE_MANIFEST = new URL(MANIFEST_URL, LIVE).href
const AS_BROWSER = { Origin: 'https://meran.example' }

const results = []
const ok = (n, c, e = '') => results.push([n, !!c, e])

// ── The site itself, before any browser is involved ──────────
const manRes = await fetch(LIVE_MANIFEST, { headers: AS_BROWSER })
ok('the published manifest is reachable', manRes.ok, `HTTP ${manRes.status} ${LIVE_MANIFEST}`)
const manifest = await manRes.json()
ok('it lists the whole pack', manifest?.assets?.length === ALL_SLOT_IDS.length,
  `${manifest?.assets?.length} assets, ${ALL_SLOT_IDS.length} slots`)
ok('it is the self-hosted pack', manifest?.baseUrl === '/pack/', manifest?.baseUrl)
ok('the manifest is never cached stale',
  /no-cache/.test(manRes.headers.get('cache-control') || ''), manRes.headers.get('cache-control'))

const one = manifest.assets[0]
const base = new URL(manifest.baseUrl, LIVE_MANIFEST).href
const imgRes = await fetch(base + one.file, { headers: AS_BROWSER })
ok('an asset is publicly readable', imgRes.ok, `HTTP ${imgRes.status}`)
ok('hashed files are served immutable',
  /immutable/.test(imgRes.headers.get('cache-control') || ''), imgRes.headers.get('cache-control'))
ok('the delivered bytes match the published hash',
  createHash('sha256').update(Buffer.from(await imgRes.arrayBuffer())).digest('hex') === one.sha256)
const gone = await fetch(`${base}i/${'0'.repeat(64)}.webp`)
ok('a file that is not there is a 404, not the app\'s page', gone.status === 404, `HTTP ${gone.status}`)

// The deployed service worker: each precache URL once (one URL under two
// revisions stops it at install, and then nothing is cached and nothing
// works offline), and no Workbox cleanup that would take the old
// design's precache with it (scripts/precache.mjs, vite.config.js).
{
  const swRes = await fetch(new URL('sw.js', LIVE))
  const text = swRes.ok ? await swRes.text() : ''
  const list = readPrecache(text)
  const problems = precacheProblems(list, { name: 'the live sw.js' })
  ok('the deployed service worker precaches each URL once, and no pack file', swRes.ok && list.entries.length > 0 && problems.length === 0,
    `${list.entries.length} entries · ${problems.length} problems: ${problems.slice(0, 2).join(' | ')}`)
  ok('…and leaves the old design\'s precache alone', !/cleanupOutdatedCaches\(\)/.test(text))
}

// ── The app, installing from that site ────────────────────────
const browser = await chromium.launch()
// No service worker here: what it fetches never reaches a route, so the
// stills would come from the local preview instead of the live site. The
// worker has its own suites (offline, pack-install) and its deployed
// sw.js is read directly below.
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', serviceWorkers: 'block' })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', e => errors.push(e.message))

let hits = 0
const seen = []
let fileHits = 0
await page.route(u => u.pathname.startsWith('/pack/'), async (route) => {
  hits++
  const { pathname, search } = new URL(route.request().url())
  seen.push(pathname)
  if (pathname.startsWith('/pack/i/')) fileHits++
  const res = await fetch(new URL(pathname + search, LIVE), { headers: AS_BROWSER })
  await route.fulfill({
    status: res.status,
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    body: Buffer.from(await res.arrayBuffer()),
  })
})

await page.addInitScript((v) => {
  localStorage.setItem('hf_weights_reset_v2', 'true')
  localStorage.setItem('hf_seen_version', JSON.stringify(v))
  localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة', goal: 'muscle' }))
  localStorage.setItem('hf_onboarded', 'true')
  localStorage.setItem('hf_unlocked', JSON.stringify(['a1', 'a2', 'a3', 'b1', 'c1', 'd1']))
}, APP_VERSION)

await page.goto(APP, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

ok('the app offers the pack on first run',
  await page.evaluate(() => !!document.querySelector('[data-pack-prompt]')))
await page.evaluate(() => document.querySelector('[data-pack="offer-accept"]')?.click())
await page.waitForTimeout(600)

// The download is already running; Settings is only where its state
// is visible. Retry the gear, the offer sheet takes a moment to go.
for (let i = 0; i < 10; i++) {
  // The new frame: the gear sits on Home, and the pack has its own
  // page inside Settings.
  await page.evaluate(() => document.querySelector('nav.f-tabs button')?.click())
  await page.waitForTimeout(400)
  await page.evaluate(() => document.querySelector('button[aria-label="الإعدادات"]')?.click())
  await page.waitForTimeout(600)
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('حزمة الصور'))?.click())
  await page.waitForTimeout(600)
  if (await page.evaluate(() => !!document.querySelector('[data-pack-phase]'))) break
}

const phase = () => page.evaluate(() =>
  document.querySelector('[data-pack-phase]')?.getAttribute('data-pack-phase') || null)

let last = null
for (let i = 0; i < 240; i++) {
  last = await phase()
  if (['ready', 'error', 'offline', 'nospace'].includes(last)) break
  await page.waitForTimeout(500)
}
ok('it installs from the live site', last === 'ready', `phase=${last}`)

const stored = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('meran-assets')
  req.onsuccess = () => {
    const db = req.result
    if (!db.objectStoreNames.contains('blobs')) return resolve(0)
    const c = db.transaction('blobs', 'readonly').objectStore('blobs').count()
    c.onsuccess = () => resolve(c.result)
  }
  req.onerror = () => resolve(0)
}))
const unique = new Set(manifest.assets.map(a => a.sha256)).size
// Nothing reaches the database without passing SHA-256 against the
// manifest, so this count is also the integrity result.
ok('every picture downloaded and verified', stored === unique, `${stored}/${unique}`)
ok('each distinct file was fetched once',
  fileHits === unique, `${fileHits} file requests, expected ${unique}`)

  // Achievements are a view inside the progress tab now.
  await page.evaluate(() => document.querySelectorAll('nav.f-tabs button')[2]?.click())
  await page.waitForTimeout(500)
  await page.evaluate(() => [...document.querySelectorAll('[role="radio"],[role="tab"],button')]
    .find(x => x.textContent.trim() === 'الإنجازات')?.click())
await page.waitForTimeout(1200)
const painted = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img[data-art]')]
  return { art: imgs.length, blobs: imgs.filter(i => i.src.startsWith('blob:')).length }
})
ok('the awards page draws the downloaded art', painted.art > 5 && painted.blobs === painted.art,
  JSON.stringify(painted))
await page.screenshot({ path: `${process.env.OUT || '/tmp'}/live-awards.png` })

const before = hits
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
// The one request a reload may make is syncPack's quiet look at the
// published version (src/assets/pack.js, since 45ad962): no file moves.
const after = seen.slice(before)
ok('a reload re-uses local storage: no pack file is fetched again, only the version check',
  after.every(p => p === '/pack/manifest.json') && after.length <= 1, `${after.length} requests: ${after.join(' ')}`)

ok('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, e ? `— ${e}` : '')
await browser.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed — against ${LIVE}`)
process.exit(failed ? 1 : 0)
