#!/usr/bin/env node
// ── Re-download the generated originals ───────────────────────
//
//   node scripts/fetch-sources.mjs [out-dir]        # default assets-src
//
// The pixels are not in this repo — scripts/pack-sources.json is,
// and it names the model and the URL behind every slot. That makes
// the whole pack reproducible from a clean checkout:
//
//   node scripts/fetch-sources.mjs assets-src
//   node scripts/cut-white.mjs     assets-src assets-cut
//   npm run pack:build -- --src assets-cut --base https://<domain>/
//   npm run pack:publish
//
// Re-running is cheap: a slot already on disk is skipped, so an
// interrupted fetch resumes rather than starting over.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = path.resolve(process.argv[2] || 'assets-src')
const root = path.resolve(new URL('..', import.meta.url).pathname)

const sources = JSON.parse(await readFile(path.join(root, 'scripts/pack-sources.json'), 'utf8'))
const { ALL_SLOT_IDS } = await import(pathToFileURL(path.join(root, 'src/assets/slots.js')).href)

const missing = ALL_SLOT_IDS.filter(id => !sources.slots[id])
if (missing.length) {
  console.error(`✗ pack-sources.json has no entry for: ${missing.join(', ')}`)
  process.exit(1)
}

await mkdir(OUT, { recursive: true })

const already = async (p) => { try { return (await stat(p)).size > 0 } catch { return false } }

let fetched = 0, skipped = 0
const failed = []

const CONCURRENCY = 6
let cursor = 0
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const i = cursor++
    if (i >= ALL_SLOT_IDS.length) return
    const id = ALL_SLOT_IDS[i]
    const dest = path.join(OUT, `${id}.png`)
    if (await already(dest)) { skipped++; continue }
    try {
      const res = await fetch(sources.slots[id].url)
      if (!res.ok) throw new Error(`http ${res.status}`)
      await writeFile(dest, Buffer.from(await res.arrayBuffer()))
      fetched++
    } catch (e) {
      failed.push(`${id}: ${e.message}`)
    }
  }
}))

console.log(`✓ ${fetched} fetched, ${skipped} already present → ${OUT}`)
if (failed.length) {
  console.error(`\n✗ ${failed.length} failed:`)
  for (const f of failed) console.error('  ' + f)
  process.exitCode = 1
}
