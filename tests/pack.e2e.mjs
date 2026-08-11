// End-to-end checks for the art pack, on an iPhone-shaped context.
// Requires a preview server and two built test packs:
//
//   node tests/make-test-pack.mjs /tmp/src  0
//   node tests/make-test-pack.mjs /tmp/srcb 7
//   node scripts/build-manifest.mjs --src /tmp/src  --out /tmp/pack  --version test.1
//   node scripts/build-manifest.mjs --src /tmp/srcb --out /tmp/pack2 --version test.2
//   npm run build && npx vite preview --port 4173 &
//   PACK=/tmp/pack PACK2=/tmp/pack2 node tests/pack.e2e.mjs
//
// The CDN is intercepted rather than served, so every scenario can
// count requests, drop the network mid-flight, and corrupt a file.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Seeded so the version notice never covers the pack prompt, and so a
// version bump doesn't quietly break every scenario below.
const { APP_VERSION } = await import(pathToFileURL(new URL('../src/constants.js', import.meta.url).pathname).href)

const PACK  = process.env.PACK  || '/tmp/pack'
const PACK2 = process.env.PACK2 || null
const APP   = process.env.APP   || 'http://localhost:4173/'
const HOST  = 'https://assets.meran.app/'

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

const manifest = JSON.parse(await readFile(path.join(PACK, 'manifest.json'), 'utf8'))
const TOTAL = manifest.assets.length
// Two slots may share one picture, and content-addressing stores it
// once. Transfers and stored blobs are counted in distinct hashes;
// only the progress figures are counted in slots.
const UNIQUE = new Set(manifest.assets.map(a => a.sha256)).size

const browser = await chromium.launch()
const errors = []

/**
 * Serves the pack from disk. `plan` can break it on purpose:
 *   { abortAfter: 20 }         drop everything past the 20th file
 *   { corrupt: ['i/xx.webp'] } return garbage bytes for these
 *   { dead: true }             fail every request
 */
async function serve(page, dir, plan = {}) {
  const state = { files: 0, manifests: 0, urls: [] }
  await page.route(`${HOST}**`, async (route) => {
    const rel = route.request().url().slice(HOST.length).split('?')[0]
    if (plan.dead) return route.abort('internetdisconnected')

    if (rel === 'manifest.json') {
      state.manifests++
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: await readFile(path.join(dir, 'manifest.json')),
      })
    }

    state.files++
    state.urls.push(rel)
    if (plan.abortAfter && state.files > plan.abortAfter) return route.abort('internetdisconnected')
    if (plan.corrupt?.includes(rel)) {
      return route.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.from('not an image') })
    }
    try {
      return route.fulfill({
        status: 200,
        contentType: rel.endsWith('.png') ? 'image/png' : 'image/webp',
        body: await readFile(path.join(dir, rel)),
      })
    } catch { return route.fulfill({ status: 404, body: '' }) }
  })
  return state
}

async function newPage(ctx) {
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(e.message))
  return page
}

const ctxOpts = { ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh' }

async function boot(page) {
  await page.addInitScript((v) => {
    if (localStorage.getItem('__s')) return
    localStorage.setItem('__s', '1')
    localStorage.setItem('hf_weights_reset_v2', 'true')
    localStorage.setItem('hf_seen_version', JSON.stringify(v))
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة', goal: 'muscle' }))
    // Unlocked achievements are where the artwork actually shows.
    localStorage.setItem('hf_unlocked', JSON.stringify(['a1', 'a2', 'a3', 'b1', 'c1', 'd1']))
  }, APP_VERSION)
  await page.goto(APP, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
}

const blobCount = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('meran-assets')
  req.onsuccess = () => {
    const db = req.result
    if (!db.objectStoreNames.contains('blobs')) return resolve(0)
    const c = db.transaction('blobs', 'readonly').objectStore('blobs').count()
    c.onsuccess = () => resolve(c.result)
    c.onerror = () => resolve(-1)
  }
  req.onerror = () => resolve(0)
}))

const pointer = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('hf_pack') || 'null'))

const openSettings = async (page) => {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')]
    ;(btns[1] || btns[0]).click()
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => document.querySelector('[data-pack="install"],[data-pack="cancel"]')?.scrollIntoView())
  await page.waitForTimeout(200)
}

const packBtn = async (page, which) => {
  const hit = await page.evaluate((w) => {
    const b = document.querySelector(`[data-pack="${w}"]`)
    if (!b) return false
    b.scrollIntoView(); b.click(); return true
  }, which)
  await page.waitForTimeout(400)
  return hit
}

const clickText = async (page, text) => {
  const hit = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(t))
    if (!b) return false
    b.scrollIntoView(); b.click(); return true
  }, text)
  await page.waitForTimeout(400)
  return hit
}

const phase = (page) => page.evaluate(() =>
  document.querySelector('[data-pack-phase]')?.getAttribute('data-pack-phase') || null)

const waitPhase = async (page, want, ms = 60000) => {
  const t0 = Date.now()
  for (;;) {
    const p = await phase(page)
    if (Array.isArray(want) ? want.includes(p) : p === want) return p
    if (Date.now() - t0 > ms) return `timeout(last=${p})`
    await page.waitForTimeout(250)
  }
}

// ══ 1. First run offers the pack; installing it works ═══════════
{
  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  const net = await serve(page, PACK)
  await boot(page)

  ok('first run offers the pack',
    await page.evaluate(() => !!document.querySelector('[data-pack-prompt]')))
  ok('the offer starts the download', await packBtn(page, 'offer-accept'))

  await openSettings(page)
  ok('installs and reports ready', await waitPhase(page, 'ready') === 'ready')

  ok('every distinct picture is stored', await blobCount(page) === UNIQUE, `${await blobCount(page)}/${UNIQUE}`)
  const p = await pointer(page)
  ok('the pointer records the version', p?.packVersion === manifest.packVersion, JSON.stringify(p))
  ok('one manifest fetch', net.manifests === 1, String(net.manifests))
  ok('each distinct file fetched exactly once', net.files === UNIQUE, `${net.files}/${UNIQUE}`)

  // The point of the whole exercise: the awards page now draws the
  // downloaded artwork instead of emoji.
  const gotoAwards = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('nav button')].find(x => x.textContent.includes('جوائز'))
      b && b.click()
    })
    await page.waitForTimeout(900)
  }
  await gotoAwards()
  const painted = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[data-art]')]
    return {
      art: imgs.length,
      blobs: imgs.filter(i => i.src.startsWith('blob:')).length,
      ids: imgs.slice(0, 3).map(i => i.getAttribute('data-art')),
    }
  })
  ok('awards repainted as downloaded art', painted.art > 5 && painted.blobs === painted.art,
    JSON.stringify(painted))
  ok('each award draws its own slot', painted.ids.every(i => i.startsWith('ach_')),
    JSON.stringify(painted.ids))

  const before = net.files
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  ok('a reload re-uses the stored pack', net.files === before, `${net.files} vs ${before}`)
  await gotoAwards()
  const afterReload = await page.evaluate(() => document.querySelectorAll('img[data-art]').length)
  ok('artwork is still there after a reload', afterReload > 5, String(afterReload))
  ok('a reload does not re-offer',
    !await page.evaluate(() => !!document.querySelector('[data-pack-prompt]')))
  await ctx.close()
}

// ══ 2. Offline is a state, not a crash ══════════════════════════
{
  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  await serve(page, PACK, { dead: true })
  await boot(page)
  await packBtn(page, 'offer-later')
  await ctx.setOffline(true)
  await openSettings(page)
  await packBtn(page, 'install')
  const got = await waitPhase(page, 'offline', 20000)
  ok('offline is reported, not thrown', got === 'offline', got)
  ok('nothing was stored while offline', await blobCount(page) === 0)

  // Back online, the same button completes the job.
  await ctx.setOffline(false)
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const net = await serve(page, PACK)
  await packBtn(page, 'install')
  ok('coming back online installs cleanly', await waitPhase(page, 'ready') === 'ready')
  ok('a full pack after reconnect', net.files === UNIQUE, `${net.files}/${UNIQUE}`)
  await ctx.close()
}

// ══ 3. Network dropped mid-download resumes where it stopped ════
{
  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  await serve(page, PACK, { abortAfter: 20 })
  await boot(page)
  await packBtn(page, 'offer-accept')
  await openSettings(page)
  const got = await waitPhase(page, ['offline', 'error'], 60000)
  ok('a mid-download drop stops and reports', got === 'offline' || got === 'error', got)

  const stored = await blobCount(page)
  ok('what arrived before the drop is kept', stored >= 15 && stored < UNIQUE, `${stored}/${UNIQUE}`)

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const net2 = await serve(page, PACK)
  await packBtn(page, 'install')
  ok('the retry completes', await waitPhase(page, 'ready') === 'ready')
  ok('the retry fetches only what was missing',
    net2.files === UNIQUE - stored, `asked ${net2.files}, missing was ${UNIQUE - stored}`)
  ok('all files present after resume', await blobCount(page) === UNIQUE)
  await ctx.close()
}

// ══ 4. A corrupt file is rejected and never stored ══════════════
{
  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  const victim = manifest.assets[3]
  await serve(page, PACK, { corrupt: [victim.file] })
  await boot(page)
  await packBtn(page, 'offer-accept')
  await openSettings(page)
  ok('a hash mismatch ends in an error state', await waitPhase(page, 'error') === 'error')
  ok('the failure is named as a corrupt file',
    await page.evaluate(() => document.body.innerText.includes('ملف تالف')))

  const stored = await blobCount(page)
  ok('the rest of the pack still installs', stored === UNIQUE - 1, `${stored}/${UNIQUE - 1}`)
  const hasVictim = await page.evaluate((sha) => new Promise((resolve) => {
    const req = indexedDB.open('meran-assets')
    req.onsuccess = () => {
      const g = req.result.transaction('blobs', 'readonly').objectStore('blobs').get(sha)
      g.onsuccess = () => resolve(!!g.result)
      g.onerror = () => resolve(false)
    }
  }), victim.sha256)
  ok('the corrupt blob is absent from the database', !hasVictim)
  ok('a partial pack is not recorded as installed', (await pointer(page)) === null)
  await ctx.close()
}

// ══ 5. An update transfers only what changed ════════════════════
if (PACK2) {
  const m2 = JSON.parse(await readFile(path.join(PACK2, 'manifest.json'), 'utf8'))
  const oldShas = new Set(manifest.assets.map(a => a.sha256))
  const changed = new Set(m2.assets.filter(a => !oldShas.has(a.sha256)).map(a => a.sha256)).size
  const unique2 = new Set(m2.assets.map(a => a.sha256)).size

  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  await serve(page, PACK)
  await boot(page)
  await packBtn(page, 'offer-accept')
  await openSettings(page)
  await waitPhase(page, 'ready')

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const net2 = await serve(page, PACK2)
  await packBtn(page, 'install')
  ok('the update completes', await waitPhase(page, 'ready') === 'ready')
  ok('an update fetches only the changed files',
    net2.files === changed, `asked ${net2.files}, changed ${changed}`)
  ok('superseded blobs are collected', await blobCount(page) === unique2,
    `${await blobCount(page)} vs ${unique2}`)
  const p = await pointer(page)
  ok('the pointer moves to the new version', p?.packVersion === m2.packVersion, JSON.stringify(p))
  await ctx.close()
}

// ══ 6. The pack is per device, not per profile ══════════════════
{
  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  const net = await serve(page, PACK)
  await boot(page)
  await packBtn(page, 'offer-accept')
  await openSettings(page)
  await waitPhase(page, 'ready')
  const before = net.files

  await page.evaluate(() => {
    localStorage.setItem('hf_users', JSON.stringify([
      { id: 'default', name: 'حمزة' }, { id: 'u2', name: 'ضيف' },
    ]))
    localStorage.setItem('hf_current_user', 'u2')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)

  ok('a second profile does not re-download', net.files === before, `${net.files} vs ${before}`)
  ok('a second profile is not re-asked',
    !await page.evaluate(() => !!document.querySelector('[data-pack-prompt]')))
  await ctx.close()
}

// ══ 7. Deleting the pack really clears it ═══════════════════════
{
  const ctx = await browser.newContext(ctxOpts)
  const page = await newPage(ctx)
  await serve(page, PACK)
  await boot(page)
  await packBtn(page, 'offer-accept')
  await openSettings(page)
  await waitPhase(page, 'ready')

  await packBtn(page, 'delete')
  ok('the delete sheet warns first',
    await page.evaluate(() => document.body.innerText.includes('حذف حزمة الصور؟')))
  await packBtn(page, 'delete-confirm')
  await page.waitForTimeout(1000)
  ok('delete empties the database', await blobCount(page) === 0)
  ok('delete clears the pointer', (await pointer(page)) === null)
  ok('delete returns to the idle state', await phase(page) === 'idle')
  await ctx.close()
}

ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, e ? `— ${e}` : '')
await browser.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
