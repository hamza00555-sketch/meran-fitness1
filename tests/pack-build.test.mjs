// Specs for the self-hosted art pack.
//
//   node --test tests/pack-build.test.mjs
//
// `npm run build` builds the pack from assets-cut into dist/pack, and
// the site serves it at /pack/. This builds the real pack the same way
// into a temp dir and checks what the phone will download: every file
// the manifest names is there with the hash it promises, the version
// only moves when the art does, nothing of it is precached, and the
// site serves it with the right headers.

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, copyFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CUT = path.join(ROOT, 'assets-cut')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const tmp = await mkdtemp(path.join(os.tmpdir(), 'meran-pack-'))
test.after(() => rm(tmp, { recursive: true, force: true }))

function buildPack(src, out) {
  return spawnSync(process.execPath, [
    'scripts/build-manifest.mjs', '--src', src, '--out', out, '--base', '/pack/',
  ], { cwd: ROOT, encoding: 'utf8' })
}

// The real pack, built once for the specs below — into a dist-shaped
// folder, so the precache spec can run Workbox over it.
const DIST = path.join(tmp, 'dist')
const OUT = path.join(DIST, 'pack')
const t0 = Date.now()
const run = buildPack(CUT, OUT)
const buildMs = Date.now() - t0
const manifest = run.status === 0 ? JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8')) : null

const { ALL_SLOT_IDS, allSlots } = await import(pathToFileURL(path.join(ROOT, 'src/assets/slots.js')).href)
const SOURCES = JSON.parse(await readFile(path.join(ROOT, 'scripts/pack-sources.json'), 'utf8'))

// ══ the pack ══════════════════════════════════════════════════

test('the pack builds from assets-cut, every slot filled, based at /pack/', () => {
  assert.equal(run.status, 0, run.stderr || run.stdout)
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.baseUrl, '/pack/')
  assert.deepEqual(manifest.assets.map(a => a.id).sort(), [...ALL_SLOT_IDS].sort())
  // Fast enough to run on every deploy (≈5s on a 4-core machine).
  assert.ok(buildMs < 60_000, `${buildMs}ms`)
})

test('every manifest entry is on disk, with the sha256 and size it promises', async () => {
  for (const a of manifest.assets) {
    const file = path.join(OUT, a.file)
    assert.ok(existsSync(file), `${a.id}: ${a.file} missing`)
    const buf = await readFile(file)
    assert.equal(sha256(buf), a.sha256, `${a.id}: hash`)
    assert.equal(buf.length, a.bytes, `${a.id}: size`)
    // Content-addressed: the name is the hash.
    assert.equal(a.file, `i/${a.sha256}.${a.type === 'video/mp4' ? 'mp4' : 'webp'}`, a.id)
  }
  assert.equal(manifest.totalBytes, manifest.assets.reduce((n, a) => n + a.bytes, 0))
})

test('nothing ships unconverted, and nothing ships that the manifest does not name', async () => {
  const files = (await readdir(path.join(OUT, 'i'))).map(f => `i/${f}`).sort()
  const named = [...new Set(manifest.assets.map(a => a.file))].sort()
  assert.deepEqual(files, named)
  assert.deepEqual(files.filter(f => !/\.(webp|mp4)$/.test(f)), [])
  // Loops are typed so the app hands them to <video>; stills are not.
  for (const a of manifest.assets) {
    if (a.id.startsWith('exa_')) assert.equal(a.type, 'video/mp4', a.id)
    else assert.equal(a.type, undefined, a.id)
  }
})

test('every still is WebP at its slot\'s own frame', async () => {
  const { default: sharp } = await import('sharp')
  const dims = new Map(allSlots().map(s => [s.id, s]))
  for (const a of manifest.assets.filter(x => !x.type)) {
    const meta = await sharp(path.join(OUT, a.file)).metadata()
    assert.equal(meta.format, 'webp', a.id)
    assert.deepEqual([meta.width, meta.height], [dims.get(a.id).w, dims.get(a.id).h], a.id)
  }
})

// ══ the version ═══════════════════════════════════════════════

test('the version is the newest source date plus a hash of the content', () => {
  let newest = ''
  for (const id of ALL_SLOT_IDS) {
    const m = /hf_(\d{4})(\d{2})(\d{2})_/.exec(SOURCES.slots[id]?.url || '')
    if (m && `${m[1]}.${m[2]}.${m[3]}` > newest) newest = `${m[1]}.${m[2]}.${m[3]}`
  }
  assert.match(manifest.packVersion, /^\d{4}\.\d{2}\.\d{2}-[0-9a-f]{6}$/)
  assert.equal(manifest.packVersion.slice(0, 10), newest)
  // Nothing in it depends on the clock: a deploy of the same art is
  // byte-for-byte the same manifest.
  assert.equal(manifest.generatedAt, undefined)
})

test('the same art keeps its version on every build; changed art moves it', async () => {
  const pick = ['ach_a1.png', 'cover_01.png', 'ex_bench_press.png', 'exa_bench_press.mp4']
  const src = path.join(tmp, 'src-small')
  await mkdir(src, { recursive: true })
  for (const f of pick) await copyFile(path.join(CUT, f), path.join(src, f))

  const version = async (out) => {
    const r = buildPack(src, path.join(tmp, out))
    // A partial pack is fine here; only the version is under test.
    const m = JSON.parse(await readFile(path.join(tmp, out, 'manifest.json'), 'utf8'))
    return { m, raw: await readFile(path.join(tmp, out, 'manifest.json'), 'utf8'), r }
  }
  const a = await version('v-a')
  const b = await version('v-b')
  assert.equal(a.m.packVersion, b.m.packVersion, 'an unchanged pack must not look like an update')
  assert.equal(a.raw, b.raw, 'the manifest is byte-identical')

  // One picture redrawn → a new version.
  await copyFile(path.join(CUT, 'ex_deadlift.png'), path.join(src, 'ex_bench_press.png'))
  const c = await version('v-c')
  assert.notEqual(c.m.packVersion, a.m.packVersion)

  // One picture removed → a new version.
  await rm(path.join(src, 'cover_01.png'))
  const d = await version('v-d')
  assert.notEqual(d.m.packVersion, c.m.packVersion)
})

// ══ the service worker ════════════════════════════════════════

const viteConfig = await import(pathToFileURL(path.join(ROOT, 'vite.config.js')).href)

test('no pack file is precached; only Vite\'s hashed files go without a revision', async () => {
  // Run Workbox's own globbing — what generateSW does — with the app's
  // precache settings over a dist that holds the built pack next to an
  // ordinary WebP (as public/assets puts it), a Vite chunk and the page.
  await mkdir(path.join(DIST, 'assets'), { recursive: true })
  await copyFile(path.join(OUT, manifest.assets.find(a => !a.type).file), path.join(DIST, 'assets/hero.webp'))
  await writeFile(path.join(DIST, 'assets/medal3d-Ab3_x-9Z.js'), 'export {}')
  await writeFile(path.join(DIST, 'index.html'), '<!doctype html>')
  const { getManifest } = await import('workbox-build')
  const { manifestEntries } = await getManifest({ globDirectory: DIST, ...viteConfig.PRECACHE })
  const urls = manifestEntries.map(e => e.url)
  assert.deepEqual(urls.filter(u => u.startsWith('pack/')), [])
  assert.ok(urls.includes('assets/hero.webp'), 'the glob still takes ordinary WebP')
  assert.ok(urls.includes('index.html'))
  // The name of a Vite chunk changes with its content, so it needs no
  // revision; a public picture keeps the same name when redrawn, so it
  // must carry one — with none, a phone that has the old one keeps it.
  const rev = (u) => manifestEntries.find(e => e.url === u)?.revision
  assert.equal(rev('assets/medal3d-Ab3_x-9Z.js'), null)
  assert.match(rev('assets/hero.webp'), /^[0-9a-f]{32}$/)
  // No file in public/ looks like a Vite chunk to that rule.
  const pub = (await readdir(path.join(ROOT, 'public'), { recursive: true })).map(f => f.split(path.sep).join('/'))
  assert.deepEqual(pub.filter(f => viteConfig.PRECACHE.dontCacheBustURLsMatching.test(f)), [])
})

const { readPrecache, precacheProblems } = await import(pathToFileURL(path.join(ROOT, 'scripts/precache.mjs')).href)

test('the build refuses a precache that would stop the worker at install', () => {
  // Three entries from the root sw.js as it was deployed up to 41ff44d:
  // public/assets went in twice (globPatterns with no revision,
  // includeAssets with one) and the fonts twice. Workbox throws
  // add-to-cache-list-conflicting-entries on the first, so the worker
  // cached nothing at all.
  const sw = 'e.precacheAndRoute([{url:"assets/ach_consistency.webp",revision:null},{url:"assets/index-CsSlpdIa.js",revision:null},'
    + '{url:"fonts/meran-latin.woff2",revision:"9a1"},{url:"assets/ach_consistency.webp",revision:"55c51aab"},'
    + '{url:"fonts/meran-latin.woff2",revision:"9a1"}],{})'
  const list = readPrecache(sw)
  assert.equal(list.entries.length, 5)
  const isPublic = (u) => !/index-/.test(u)
  const problems = precacheProblems(list, { name: 'dist/sw.js', isPublic })
  assert.equal(problems.length, 3, problems.join('\n'))
  assert.match(problems[0], /ach_consistency\.webp under 2 revisions \(none, 55c51aab\) .* throws at install/)
  assert.match(problems[1], /meran-latin\.woff2 2 times/)
  assert.match(problems[2], /ach_consistency\.webp, a public\/ file, with no revision/)
  // A pack file, and an entry the reader cannot parse, are refused too.
  assert.match(precacheProblems(readPrecache('[{url:"pack/i/ab.webp",revision:"1"}]'), { name: 'x' })[0], /a pack file/)
  assert.match(precacheProblems(readPrecache('[{url:"a.js",revision:1}]'), { name: 'x' })[0], /read 0 of 1/)
})

test('the last real build: every URL once, revisions on public files, no pack file', async (t) => {
  const sw = path.join(ROOT, 'dist/sw.js')
  if (!existsSync(sw) || !existsSync(path.join(ROOT, 'dist/pack/manifest.json'))) {
    return t.skip('no build in dist/ — run npm run build')
  }
  for (const f of ['dist/sw.js', 'dist/classic/sw.js']) {
    const text = await readFile(path.join(ROOT, f), 'utf8')
    const list = readPrecache(text)
    assert.ok(list.entries.length > 0, f)
    const isPublic = f === 'dist/sw.js' ? (u) => existsSync(path.join(ROOT, 'public', u)) : () => false
    assert.deepEqual(precacheProblems(list, { name: f, isPublic }), [], f)
  }
  // The root worker leaves the other caches on this origin alone:
  // Workbox's cleanupOutdatedCaches() matches any cache whose name
  // contains the scope, and https://host/ is inside the old design's
  // meran-classic-precache-v2-https://host/classic/.
  assert.doesNotMatch(await readFile(sw, 'utf8'), /cleanupOutdatedCaches\(\)/)
})

test('stills are CacheFirst from this site, the manifest NetworkFirst, nothing else', () => {
  const rules = viteConfig.PACK_RUNTIME_CACHING
  // Workbox copies each urlPattern into sw.js as source text, so each
  // must work with nothing from vite.config.js around it.
  const patterns = rules.map(r => new Function(`return (${r.urlPattern.toString()})`)())
  const which = (href, sameOrigin = true) => {
    const url = new URL(href)
    const i = patterns.findIndex(p => p({ url, sameOrigin }))
    return i < 0 ? null : rules[i].handler
  }
  const hash = 'a'.repeat(64)
  assert.equal(which(`https://meran.app/pack/i/${hash}.webp`), 'CacheFirst')
  assert.equal(which('https://meran.app/pack/manifest.json'), 'NetworkFirst')
  // Loops play from the downloaded pack; a video is not CacheFirst work.
  assert.equal(which(`https://meran.app/pack/i/${hash}.mp4`), null)
  assert.equal(which(`https://other.site/pack/i/${hash}.webp`, false), null)
  assert.equal(which('https://meran.app/assets/hero.webp'), null)
  // The bucket is no longer where the stills come from.
  assert.equal(which(`https://pub-189be0412bdd4092aa44be319badfd91.r2.dev/i/${hash}.webp`, false), null)
  const cfg = rules.find(r => r.handler === 'CacheFirst').options
  assert.deepEqual(cfg.cacheableResponse.statuses, [200])
})

// ══ the site ══════════════════════════════════════════════════

// A small model of Vercel's `routes`: each src is anchored, headers
// collect on rules marked continue, `filesystem` serves a file that
// exists, the first other match ends it.
async function serve(pathname, files) {
  const { routes } = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'))
  const headers = {}
  for (const r of routes) {
    if (r.handle === 'filesystem') {
      if (files.has(pathname)) return { file: pathname, headers }
      continue
    }
    if (!new RegExp(`^${r.src}$`).test(pathname)) continue
    Object.assign(headers, r.headers || {})
    if (r.continue) continue
    if (r.status) return { status: r.status, headers }
    return { dest: r.dest, headers }
  }
  return { status: 404, headers }
}

test('vercel.json serves the pack: files immutable, manifest fresh, misses a real 404', async () => {
  const file = `/pack/${manifest.assets[0].file}`
  const files = new Set(['/index.html', '/pack/manifest.json', file, '/classic/index.html'])

  const img = await serve(file, files)
  assert.equal(img.file, file)
  assert.match(img.headers['Cache-Control'], /max-age=31536000/)
  assert.match(img.headers['Cache-Control'], /immutable/)

  const man = await serve('/pack/manifest.json', files)
  assert.equal(man.file, '/pack/manifest.json')
  assert.match(man.headers['Cache-Control'], /no-cache/)
  assert.doesNotMatch(man.headers['Cache-Control'], /immutable|max-age=[1-9]/)

  // A file a newer deploy no longer has must not come back as the app's
  // index page with a 200 — the downloader would hash HTML forever.
  assert.equal((await serve(`/pack/i/${'0'.repeat(64)}.webp`, files)).status, 404)
  assert.equal((await serve('/pack/', files)).status, 404)

  // …and the app's own routes are as they were.
  assert.equal((await serve('/progress', files)).dest, '/')
  assert.equal((await serve('/classic/settings', files)).dest, '/classic/index.html')
  assert.match((await serve('/sw.js', files)).headers['Cache-Control'], /no-store/)
})

// ══ the sources ═══════════════════════════════════════════════

test('assets-cut and pack-sources.json name exactly the same slots', async () => {
  const cut = (await readdir(CUT)).filter(f => /\.(png|webp|jpe?g|mp4)$/i.test(f)).map(f => f.replace(/\.[^.]+$/, '')).sort()
  assert.deepEqual(cut, Object.keys(SOURCES.slots).sort())
  assert.deepEqual(cut, [...ALL_SLOT_IDS].sort())
})

// The corrected stills (made 2026-10-11, approved by حمزة) by their
// number in his review, and the slot each went to. The eleventh, #44,
// is the leg curl below.
const CORRECTED = {
  26: 'ex_machine_pullover', 34: 'ex_cable_lateral_raise', 37: 'ex_db_shoulder_press',
  39: 'ex_reverse_fly', 46: 'ex_hip_thrust', 54: 'ex_hip_abduction', 57: 'ex_hip_adduction',
  67: 'ex_barbell_reverse_curl', 78: 'ex_cable_overhead_triceps', 79: 'ex_cable_triceps_kickback',
}

test('the corrected stills are recorded, and framed like their neighbours', async () => {
  const { default: sharp } = await import('sharp')
  for (const [n, id] of Object.entries(CORRECTED)) {
    const rec = SOURCES.slots[id]
    assert.equal(rec.approved, true, `#${n} ${id}`)
    assert.equal(rec.cut, 'square-688', `#${n} ${id}`)
    assert.match(rec.url, /hf_20261011_/, `#${n} ${id}`)
    assert.ok(rec.replaces && rec.replaces !== rec.job, `#${n} ${id}`)
    // A keyed square, like every other still in assets-cut; 688 so the
    // pack's 1024×688 frame shows it 1:1 instead of upscaling it.
    const meta = await sharp(path.join(CUT, `${id}.png`)).metadata()
    assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [688, 688, true], id)
  }
  assert.ok(SOURCES.cuts['square-688'])
})

test('«مرجحة خلفية جهاز» (Leg Curl, #44) is the lying machine', async () => {
  const [a, b] = await Promise.all(['ex_leg_curl', 'ex_lying_leg_curl'].map(id => readFile(path.join(CUT, `${id}.png`))))
  assert.ok(a.equals(b), 'the same picture as the lying leg curl')
  assert.equal(SOURCES.slots.ex_leg_curl.sameAs, 'ex_lying_leg_curl')
  assert.equal(SOURCES.slots.ex_leg_curl.url, SOURCES.slots.ex_lying_leg_curl.url)
  // One file in the pack, published to both slots.
  const sh = id => manifest.assets.find(x => x.id === id).sha256
  assert.equal(sh('ex_leg_curl'), sh('ex_lying_leg_curl'))
})
