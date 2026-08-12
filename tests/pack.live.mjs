// Checks the pack that is actually published, over the actual network.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/pack.live.mjs
//
// pack.e2e.mjs serves a pack from disk so it can drop the network,
// corrupt a file and count requests. This one uses no fixtures at all:
// every byte comes from the live bucket, and the app has to verify it
// against the published manifest before it will store it.
//
// One sandbox accommodation, stated plainly. In a hardened runner all
// egress goes through an inspecting proxy that Chromium will not use,
// so the browser has no route to the internet. Requests to the bucket
// are therefore fulfilled by Node — which does have a route — passing
// the real status, type and body straight through. What that means for
// the result: the URLs, the bytes, the hashes and the install are
// genuinely the published ones; only the CORS negotiation happens in
// Node rather than Chromium, so it is asserted directly against the
// real response headers first.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const APP = process.env.APP || 'http://localhost:4173/'
const { MANIFEST_URL } = await import(pathToFileURL(new URL('../src/assets/pack.js', import.meta.url).pathname).href)
const { APP_VERSION } = await import(pathToFileURL(new URL('../src/constants.js', import.meta.url).pathname).href)
const ORIGIN = MANIFEST_URL.replace(/manifest\.json$/, '')
const AS_BROWSER = { Origin: 'https://meran.example' }

const results = []
const ok = (n, c, e = '') => results.push([n, !!c, e])

// ── The bucket itself, before any browser is involved ─────────
const manRes = await fetch(MANIFEST_URL, { headers: AS_BROWSER })
ok('the published manifest is reachable', manRes.ok, `HTTP ${manRes.status}`)
const manifest = await manRes.json()
ok('it lists the whole pack', manifest?.assets?.length === 48, `${manifest?.assets?.length} assets`)
ok('the manifest is kept short-lived',
  /max-age=60/.test(manRes.headers.get('cache-control') || ''), manRes.headers.get('cache-control'))

const one = manifest.assets[0]
const imgRes = await fetch(manifest.baseUrl + one.file, { headers: AS_BROWSER })
ok('an asset is publicly readable', imgRes.ok, `HTTP ${imgRes.status}`)
ok('the bucket sends CORS, so the bytes can be hashed in a browser',
  !!imgRes.headers.get('access-control-allow-origin'),
  `ACAO: ${imgRes.headers.get('access-control-allow-origin')}`)
ok('hashed files are served immutable',
  /immutable/.test(imgRes.headers.get('cache-control') || ''), imgRes.headers.get('cache-control'))
ok('the delivered bytes match the published hash',
  createHash('sha256').update(Buffer.from(await imgRes.arrayBuffer())).digest('hex') === one.sha256)

// ── The app, installing from that bucket ──────────────────────
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh' })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', e => errors.push(e.message))

let hits = 0
await page.route(`${ORIGIN}**`, async (route) => {
  hits++
  const res = await fetch(route.request().url(), { headers: AS_BROWSER })
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
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')]
    ;(btns[1] || btns[0])?.click()
  })
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
ok('it installs from the live bucket', last === 'ready', `phase=${last}`)

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
ok('the manifest and each distinct file were fetched once',
  hits === unique + 1, `${hits} requests, expected ${unique + 1}`)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('nav button')].find(x => x.textContent.includes('جوائز'))
  b && b.click()
})
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
ok('a reload re-uses local storage and touches the network zero times',
  hits === before, `${hits} vs ${before}`)

ok('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, e ? `— ${e}` : '')
await browser.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed — against the live bucket`)
process.exit(failed ? 1 : 0)
