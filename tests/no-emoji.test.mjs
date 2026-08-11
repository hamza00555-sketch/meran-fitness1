// ── The invariant that keeps "no emoji" true ──────────────────
//
//   node --test tests/no-emoji.test.mjs
//
// A one-time sweep decays: the next feature adds a 🔥 and nobody
// notices. This walks src/ and fails if a pictograph appears
// anywhere other than the two places it legitimately belongs:
//
//   • src/assets/ids.js — the vocabulary, where each id declares the
//     character it replaces
//   • an `emoji=` fallback prop on <Ico>
//
// Text symbols (✓ × → ← ▼ ▲ ⇄ ✕ ● ○ − ⎘) are NOT emoji: they inherit
// the font's colour and metrics, and turning them into images would
// make them worse. They are allowed by name below.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = new URL('../src/', import.meta.url).pathname

// One pictograph is genuinely typography: the step marker in the
// plan-day strip alternates between '✓', '▶' and a digit inside the
// same circle, so it has to share their colour and metrics.
const ALLOWED = new Set(['▶'])

// Files whose whole job is to name the emoji they replace.
const EXEMPT = new Set(['assets/ids.js'])

const seg = new Intl.Segmenter('en', { granularity: 'grapheme' })
const PICTO = /\p{Extended_Pictographic}/u

async function walk(dir, base = dir) {
  const out = []
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) out.push(...await walk(full, base))
    else if (/\.(jsx?|css)$/.test(name.name)) out.push({ full, rel: path.relative(base, full) })
  }
  return out
}

test('no emoji survive outside the vocabulary and <Ico> fallbacks', async () => {
  const files = await walk(ROOT)
  assert.ok(files.length > 15, 'expected to find the source tree')

  const strays = []
  for (const f of files) {
    if (EXEMPT.has(f.rel.split(path.sep).join('/'))) continue
    const text = await readFile(f.full, 'utf8')
    const lines = text.split('\n')

    lines.forEach((line, i) => {
      // The one legitimate inline use: telling <Ico> what to draw if
      // the pack isn't installed.
      if (/\bemoji\s*[=:]/.test(line)) return

      for (const { segment } of seg.segment(line)) {
        if (!PICTO.test(segment)) continue
        const bare = segment.replace(/[︎️]/g, '')
        if (ALLOWED.has(bare)) continue
        strays.push(`${f.rel}:${i + 1}  ${segment}  ${line.trim().slice(0, 70)}`)
      }
    })
  }

  assert.deepEqual(strays, [], `\n${strays.join('\n')}\n\n${strays.length} stray emoji`)
})
