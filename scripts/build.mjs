#!/usr/bin/env node
// ── npm run build — what Vercel runs on every push ────────────
//
//   1. the new design            → dist/
//   2. the old design (classic/) → dist/classic/
//   3. the art pack              → dist/pack/   (manifest.json + i/<sha>.*)
//   4. checks that fail the deploy rather than ship a broken pack
//
// The pack used to live on a Cloudflare R2 bucket that only a machine
// holding the keys could publish to, so new art sat in the repo for
// weeks without reaching the phone. Built here, it ships with every
// push to main: no keys, no second step.
//
// Both designs must read the SAME manifest. They share one origin, so
// one pack store on the phone, and each one's install ends by deleting
// every stored file its own manifest does not list — two manifests
// would delete each other's art on every switch. So the URL is set
// here, once, in the environment both Vite builds read
// (VITE_ASSETS_MANIFEST_URL), and step 4 reads it back out of both
// bundles. classic/ is frozen, so its code is not touched for this.
//
// Setting VITE_ASSETS_MANIFEST_URL yourself (to a bucket, say) points
// both designs there instead; dist/pack is still built, just unused.

import { spawnSync } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPrecache, precacheProblems } from './precache.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = path.join(root, 'dist')
const SELF_HOSTED = '/pack/manifest.json'
const MANIFEST_URL = process.env.VITE_ASSETS_MANIFEST_URL || SELF_HOSTED
process.env.VITE_ASSETS_MANIFEST_URL = MANIFEST_URL

const vite = path.join(root, 'node_modules/vite/bin/vite.js')
const timings = []

function step(label, args) {
  const t0 = Date.now()
  console.log(`\n── ${label} ──`)
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env })
  timings.push([label.replace(/ →.*/, ''), Date.now() - t0])
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed`)
    process.exit(r.status || 1)
  }
}

console.log(`pack manifest: ${MANIFEST_URL}${MANIFEST_URL === SELF_HOSTED ? ' (self-hosted, dist/pack)' : ' (external — set by VITE_ASSETS_MANIFEST_URL)'}`)

step('new design → dist/', [vite, 'build'])
step('old design → dist/classic/', [vite, 'build', '--config', 'classic/vite.config.js'])
step('art pack → dist/pack/', [
  'scripts/build-manifest.mjs', '--src', 'assets-cut', '--out', 'dist/pack', '--base', '/pack/',
])

// ── Checks ────────────────────────────────────────────────────
const problems = []
const t0 = Date.now()

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(p))
    else out.push(p)
  }
  return out
}
const sizeOf = async (files) => (await Promise.all(files.map(f => stat(f).then(s => s.size)))).reduce((a, b) => a + b, 0)
const mb = (n) => (n / 1048576).toFixed(2) + ' MB'

// The pack: every file the manifest names is there, and nothing in it
// is a PNG that slipped through unconverted.
const manifest = JSON.parse(await readFile(path.join(DIST, 'pack/manifest.json'), 'utf8'))
const packFiles = await walk(path.join(DIST, 'pack'))
for (const a of manifest.assets) {
  if (!existsSync(path.join(DIST, 'pack', a.file))) problems.push(`pack: ${a.id} → ${a.file} is missing`)
}
const unconverted = packFiles.filter(f => !/\.(webp|mp4|json)$/.test(f))
if (unconverted.length) problems.push(`pack: unconverted files: ${unconverted.slice(0, 3).join(', ')}`)

// Precache (scripts/precache.mjs): every URL once, a revision on every
// public/ file, and no pack file — the pack is downloaded on request
// into IndexedDB; 14 MB in every service-worker install would be the
// whole pack forced onto every visitor, twice over.
async function precache(sw, isPublic) {
  const name = path.relative(root, sw)
  const list = readPrecache(await readFile(sw, 'utf8'))
  problems.push(...precacheProblems(list, { name, isPublic }))
  const urls = list.entries.map(e => e.url)
  const files = [...new Set(urls)].map(u => path.join(path.dirname(sw), u)).filter(f => existsSync(f))
  return { urls, bytes: await sizeOf(files) }
}
const pcNew = await precache(path.join(DIST, 'sw.js'), (u) => existsSync(path.join(root, 'public', u)))
// classic/ has no public/ of its own (publicDir: false).
const pcOld = await precache(path.join(DIST, 'classic/sw.js'))

// The manifest URL, read back out of both bundles. Every manifest URL a
// bundle carries must be this one — except the old design's frozen
// fallback, which can only follow it as `"<this>"||"<fallback>"` and so
// is never reached.
async function manifestUrlsIn(dir) {
  const js = (await walk(dir)).filter(f => f.endsWith('.js') && !/(^|\/)(sw|workbox-[^/]*)\.js$/.test(f))
  const found = []
  for (const f of js) {
    const text = await readFile(f, 'utf8')
    const lit = JSON.stringify(MANIFEST_URL)
    const stripped = text.split(lit + '||').map((part, i) => i === 0 ? part : part.replace(/^"[^"]*"/, '""')).join(lit + '||')
    for (const m of stripped.matchAll(/"([^"]*manifest\.json)"/g)) found.push(m[1])
  }
  return [...new Set(found)]
}
const inNew = await manifestUrlsIn(path.join(DIST, 'assets'))
const inOld = await manifestUrlsIn(path.join(DIST, 'classic/assets'))
for (const [name, urls] of [['dist/', inNew], ['dist/classic/', inOld]]) {
  if (!urls.includes(MANIFEST_URL)) problems.push(`${name} bundle does not read ${MANIFEST_URL}`)
  const other = urls.filter(u => u !== MANIFEST_URL)
  if (other.length) problems.push(`${name} bundle can also read ${other.join(', ')}`)
}
timings.push(['checks', Date.now() - t0])

const unique = new Set(manifest.assets.map(a => a.sha256)).size
console.log('\n── summary ──')
console.log(`pack       v${manifest.packVersion} · ${manifest.assets.length} slots · ${unique} files · ${mb(await sizeOf(packFiles))} (dist/pack, ${packFiles.length} files incl. manifest)`)
console.log(`precache   new design ${pcNew.urls.length} entries, ${mb(pcNew.bytes)} · old design ${pcOld.urls.length} entries, ${mb(pcOld.bytes)} · pack files: none`)
console.log(`manifest   dist/ → ${inNew.join(', ')} · dist/classic/ → ${inOld.join(', ')}`)
const total = timings.reduce((n, [, ms]) => n + ms, 0)
console.log(`time       ${timings.map(([l, ms]) => `${l} ${(ms / 1000).toFixed(1)}s`).join(' · ')} · total ${(total / 1000).toFixed(1)}s`)

if (problems.length) {
  console.error('\n✗ build checks failed:')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('✓ build checks passed')
