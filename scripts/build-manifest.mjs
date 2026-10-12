#!/usr/bin/env node
// ── Turn a folder of generated art into a publishable pack ────
//
//   node scripts/build-manifest.mjs [--src assets-src] [--out pack]
//                                   [--base https://assets.meran.app/]
//                                   [--size 512] [--version 2026.08.11-1]
//
// `npm run build` runs this on every deploy (scripts/build.mjs):
//   --src assets-cut --out dist/pack --base /pack/
// so the pack is served from the app's own site, next to the app.
//
// --version is optional and normally left out. Without it the version
// is derived from the content: the newest generation date among the
// sources (from scripts/pack-sources.json) plus a short hash of what
// goes in — each slot's source bytes, its frame and the encoder
// settings. The same assets-cut gives the same version on every
// deploy, so the app never offers an update that changes nothing; any
// changed, added or removed piece gives a new one.
//
// --size is only a fallback: each slot in src/assets/slots.js states its
// own width and height, and that is what a piece is resized to.
//
// Input : assets-src/<id>.png — one file per slot in src/assets/slots.js
// Output: pack/i/<sha>.webp   — content-addressed, so a changed piece
//                               is a different URL and everything can
//                               be served immutable
//         pack/manifest.json
//
// The filename being the hash is what makes updates cheap: the app
// diffs hashes, so republishing 48 pieces with 5 changed transfers 5.

import { createHash } from 'node:crypto'
import { readdir, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}

const SRC     = path.resolve(arg('src', 'assets-src'))
const OUT     = path.resolve(arg('out', 'pack'))
const BASE    = arg('base', process.env.ASSETS_BASE_URL || 'https://assets.meran.app/')
const SIZE    = Number(arg('size', 512))
const VERSION_ARG = arg('version', null)
const SCHEMA  = 1
const started = Date.now()

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// sharp is required. The sources are ~50 MB of PNG; publishing them
// unconverted would make a 14 MB download four times heavier on the
// phone, so a machine without sharp stops here instead. It is a
// devDependency with its prebuilt binaries for every platform in the
// lockfile, so `npm ci` on the deploy machine installs it.
let sharp = null
try { sharp = (await import('sharp')).default } catch (e) {
  console.error('✗ sharp is not installed — refusing to publish unconverted PNGs')
  console.error(`  ${e.message}`)
  console.error('  Run `npm ci` (sharp is in devDependencies).')
  process.exit(1)
}

// The slot list is the contract; anything outside it is a typo. It also
// carries each slot's dimensions: badges are square and keyed out of
// white, covers are wide full-bleed banners, and forcing one shape on
// both would letterbox the covers into transparent bars.
const slotsUrl = pathToFileURL(path.resolve('src/assets/slots.js')).href
const { ALL_SLOT_IDS, allSlots } = await import(slotsUrl)
const KNOWN = new Set(ALL_SLOT_IDS)
const DIMS = new Map(allSlots().map(s => [s.id, { w: s.w, h: s.h, kind: s.kind }]))

if (!existsSync(SRC)) {
  console.error(`✗ no source folder at ${SRC}`)
  console.error('  Put one <id>.png per slot there. `node scripts/prompts.mjs` lists them.')
  process.exit(1)
}

await rm(OUT, { recursive: true, force: true })
await mkdir(path.join(OUT, 'i'), { recursive: true })

const files = (await readdir(SRC)).filter(f => /\.(png|webp|jpe?g|mp4)$/i.test(f))
const seen = new Set()
const assets = []
const problems = []

// A badge is padded to its square so nothing is cropped off it. A cover
// is a banner: it fills the frame and the overflow is trimmed, because
// bars down the side of a full-bleed image are worse than a tighter crop.
const CONTAIN = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
const COVER   = { fit: 'cover', position: 'centre' }
const ENCODE  = { still: { quality: 88, effort: 4 }, cover: { quality: 82, effort: 4 } }

const todo = []
for (const file of files.sort()) {
  const id = file.replace(/\.[^.]+$/, '')
  if (!KNOWN.has(id)) { problems.push(`unknown slot "${id}" (not in src/assets/slots.js)`); continue }
  if (seen.has(id)) { problems.push(`duplicate source for "${id}"`); continue }
  seen.add(id)
  todo.push({ id, file })
}

// What the version is derived from: per slot, the source bytes and the
// frame they are fitted to. Filled in by convert().
const inputs = new Map()

async function convert({ id, file }) {
  const source = await readFile(path.join(SRC, file))
  const dim = DIMS.get(id) || {}
  inputs.set(id, `${id}\t${path.extname(file)}\t${sha256(source)}\t${dim.w || SIZE}x${dim.h || SIZE}\t${dim.kind || ''}`)
  const w = dim.w || SIZE
  const h = dim.h || SIZE
  const isCover = dim.kind === 'cover'

  // Video passes through byte-for-byte: it was encoded by a pipeline
  // that already made the size/quality calls, and sharp cannot touch
  // it anyway. Its record carries a `type` so the client knows to hand
  // it to <video> rather than <img>; images stay untyped, which is
  // what older builds silently expect.
  if (/\.mp4$/i.test(file)) {
    const vidSha = sha256(source)
    await writeFile(path.join(OUT, 'i', `${vidSha}.mp4`), source)
    return { id, file: `i/${vidSha}.mp4`, sha256: vidSha, bytes: source.length, w, h, type: 'video/mp4' }
  }

  const webp = await sharp(source)
    .resize(w, h, isCover ? COVER : CONTAIN)
    .webp(isCover ? ENCODE.cover : ENCODE.still)
    .toBuffer()

  const webpSha = sha256(webp)
  await writeFile(path.join(OUT, 'i', `${webpSha}.webp`), webp)

  return {
    id,
    file: `i/${webpSha}.webp`,
    sha256: webpSha,
    bytes: webp.length,
    w, h,
  }
}

// Encoding dominates the run time, so the files go through in
// parallel and the results are re-sorted afterwards to keep the
// manifest byte-identical between runs of the same input.
const CONCURRENCY = Math.max(2, (availableParallelism?.() || 4))
let cursor = 0
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const i = cursor++
    if (i >= todo.length) return
    try { assets.push(await convert(todo[i])) }
    catch (e) { problems.push(`${todo[i].id}: ${e.message}`) }
  }
}))
assets.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

const missing = ALL_SLOT_IDS.filter(id => !seen.has(id))

// Nothing but WebP and MP4 leaves this script: a PNG in the output
// would mean a source slipped through unconverted.
const stray = assets.filter(a => !/\.(webp|mp4)$/.test(a.file))
for (const a of stray) problems.push(`${a.id}: published as ${a.file}, not converted`)

// ── The version, from the content ─────────────────────────────
// The date is when the newest piece was generated, read from the
// Higgsfield URL recorded for it (hf_YYYYMMDD_…) — not the clock and
// not file times, which a fresh clone resets. The hash covers the
// inputs rather than the encoded bytes, so a deploy machine whose
// encoder rounds a pixel differently still announces the same version.
async function sourceDate(ids) {
  try {
    const rec = JSON.parse(await readFile(path.resolve('scripts/pack-sources.json'), 'utf8'))
    let newest = ''
    for (const id of ids) {
      const m = /hf_(\d{4})(\d{2})(\d{2})_/.exec(rec.slots?.[id]?.url || '')
      if (m && `${m[1]}-${m[2]}-${m[3]}` > newest) newest = `${m[1]}-${m[2]}-${m[3]}`
    }
    return newest || null
  } catch { return null }
}

const DATE = await sourceDate(assets.map(a => a.id))
const RECIPE = JSON.stringify({ SCHEMA, CONTAIN, COVER, ENCODE })
const contentHash = sha256([RECIPE, ...[...inputs.keys()].sort().map(id => inputs.get(id))].join('\n')).slice(0, 6)
const VERSION = VERSION_ARG || `${(DATE || '1970-01-01').replace(/-/g, '.')}-${contentHash}`

const manifest = {
  schemaVersion: SCHEMA,
  packVersion: VERSION,
  baseUrl: BASE.endsWith('/') ? BASE : BASE + '/',
  totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
  ...(DATE ? { sourceDate: DATE } : {}),
  assets,
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

const mb = (manifest.totalBytes / 1048576).toFixed(2)
const secs = ((Date.now() - started) / 1000).toFixed(1)
console.log(`✓ ${assets.length} assets · ${mb} MB · v${VERSION} · ${secs}s`)
console.log(`  ${path.join(OUT, 'manifest.json')}`)

// A partial pack publishes fine — the app falls back per icon — but
// it should never be a surprise.
if (missing.length) {
  console.log(`\n· ${missing.length} slots have no art yet (they fall back in-app):`)
  console.log('  ' + missing.join(', '))
}
if (problems.length) {
  console.log('\n! problems:')
  for (const p of problems) console.log('  - ' + p)
  process.exitCode = 1
}
