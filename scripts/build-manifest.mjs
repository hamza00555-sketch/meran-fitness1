#!/usr/bin/env node
// ── Turn a folder of generated art into a publishable pack ────
//
//   node scripts/build-manifest.mjs [--src assets-src] [--out pack]
//                                   [--base https://assets.meran.app/]
//                                   [--size 512] [--version 2026.08.11-1]
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
const VERSION = arg('version', new Date().toISOString().slice(0, 10).replace(/-/g, '.') + '-1')
const SCHEMA  = 1

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// sharp is optional. Without it the source files are published as-is,
// which still produces a valid pack — just a heavier one.
let sharp = null
try { sharp = (await import('sharp')).default } catch {
  console.warn('! sharp not installed — publishing source files unchanged')
}

// The slot list is the contract; anything outside it is a typo.
const slotsUrl = pathToFileURL(path.resolve('src/assets/slots.js')).href
const { ALL_SLOT_IDS } = await import(slotsUrl)
const KNOWN = new Set(ALL_SLOT_IDS)

if (!existsSync(SRC)) {
  console.error(`✗ no source folder at ${SRC}`)
  console.error('  Put one <id>.png per slot there. `node scripts/prompts.mjs` lists them.')
  process.exit(1)
}

await rm(OUT, { recursive: true, force: true })
await mkdir(path.join(OUT, 'i'), { recursive: true })

const files = (await readdir(SRC)).filter(f => /\.(png|webp|jpe?g)$/i.test(f))
const seen = new Set()
const assets = []
const problems = []

const fit = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }

const todo = []
for (const file of files.sort()) {
  const id = file.replace(/\.[^.]+$/, '')
  if (!KNOWN.has(id)) { problems.push(`unknown slot "${id}" (not in src/assets/slots.js)`); continue }
  if (seen.has(id)) { problems.push(`duplicate source for "${id}"`); continue }
  seen.add(id)
  todo.push({ id, file })
}

async function convert({ id, file }) {
  const source = await readFile(path.join(SRC, file))

  const webp = sharp
    ? await sharp(source).resize(SIZE, SIZE, fit).webp({ quality: 88, effort: 4 }).toBuffer()
    : source

  const webpSha = sha256(webp)
  await writeFile(path.join(OUT, 'i', `${webpSha}.webp`), webp)

  return {
    id,
    file: `i/${webpSha}.webp`,
    sha256: webpSha,
    bytes: webp.length,
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

const manifest = {
  schemaVersion: SCHEMA,
  packVersion: VERSION,
  baseUrl: BASE.endsWith('/') ? BASE : BASE + '/',
  totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
  generatedAt: new Date().toISOString(),
  assets,
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

const mb = (manifest.totalBytes / 1048576).toFixed(2)
console.log(`✓ ${assets.length} assets · ${mb} MB · v${VERSION}`)
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
