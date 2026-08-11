#!/usr/bin/env node
// Builds a pack for the browser tests out of artwork that already
// exists in public/assets. Nothing here is drawn for the occasion —
// the tests need real image bytes with real hashes, and the app's own
// shipped art is the honest source for that.
//
//   node tests/make-test-pack.mjs <out-src-dir> [offset]
//
// `offset` rotates which existing file lands on which slot, so a
// second pack differs from the first and exercises the update path.

import { readdir, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = process.argv[2]
const OFFSET = Number(process.argv[3] || 0)
if (!OUT) { console.error('usage: make-test-pack.mjs <out-dir> [offset]'); process.exit(1) }

const root = path.resolve(new URL('..', import.meta.url).pathname)
const { ALL_SLOT_IDS } = await import(pathToFileURL(path.join(root, 'src/assets/slots.js')).href)

const srcDir = path.join(root, 'public/assets')
const pool = (await readdir(srcDir)).filter(f => f.endsWith('.png')).sort()
if (!pool.length) { console.error('no source art in public/assets'); process.exit(1) }

await mkdir(OUT, { recursive: true })
for (const [i, id] of ALL_SLOT_IDS.entries()) {
  await copyFile(path.join(srcDir, pool[(i + OFFSET) % pool.length]), path.join(OUT, `${id}.png`))
}
console.log(`${ALL_SLOT_IDS.length} slots filled from ${pool.length} existing images (offset ${OFFSET})`)
