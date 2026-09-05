#!/usr/bin/env node
// Send the design system to Miswadah.
//
//   MISWADAH_TOKEN=ms_live_… node scripts/push-design-system.mjs
//   node scripts/push-design-system.mjs --dry     # print the payload, send nothing
//   node scripts/push-design-system.mjs --current # read back what is up there now
//   MISWADAH_TOKEN=… node scripts/push-design-system.mjs --verify src/index.css
//
// The key is read from the environment and never from a file in this
// repo. Anyone holding it can read and replace the design system, so it
// belongs in .env (gitignored) beside the R2 credentials.
//
// design-system/design-system.json is this repo's own, richer record:
// it carries `modes` (how the deload week rewrites the accent) and
// `debt` (what the code does not yet honour), neither of which has a
// home in Miswadah's schema. This script is the translation — it maps
// what fits and drops what does not, rather than bending our record to
// someone else's shape.

import { readFileSync } from 'node:fs'

const API   = process.env.MISWADAH_API || 'https://design-system-web-9mj4.vercel.app'
const TOKEN = process.env.MISWADAH_TOKEN
const argv  = process.argv.slice(2)
const has   = (f) => argv.includes('--' + f)

const src = JSON.parse(readFileSync('design-system/design-system.json', 'utf8'))

// ── Shape ─────────────────────────────────────────────────────
//
// Ours nests (color.surface.card); theirs is one level of named
// tokens per category. Flatten with a camelCase join, and rename our
// `use` to their `usage`.

const flatten = (node, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(node)) {
    const key = k === 'DEFAULT' ? prefix
      : prefix ? prefix + k[0].toUpperCase() + k.slice(1)
      : k
    if (v && typeof v === 'object' && 'value' in v) {
      out[key] = v.use ? { value: String(v.value), usage: v.use } : { value: String(v.value) }
    } else if (v && typeof v === 'object') {
      flatten(v, key, out)
    }
  }
  return out
}

// Borders are a category of their own in their schema; in ours they sit
// under colour, which is where they live in the stylesheet.
const { border: borderColors, ...restColor } = src.color
const color = { ...flatten(restColor), ...flatten({ gradient: src.gradient }) }

// The mode dials are not colours and not type. They are the two knobs a
// mode turns instead of restating its rules, and they belong with the
// system or they vanish — so they ride along in `border`'s neighbour
// category where a reader will still meet them.
const tokens = {
  color,
  typography: {
    families: flatten(src.font),
    sizes: flatten(src.fontSize),
    weights: flatten(src.fontWeight),
    lineHeights: flatten(src.lineHeight),
    // Not in our record because it is not declared as a custom property —
    // read out of the JSX, where two steps account for every use: 2px on
    // Latin labels and chips, 6px on the report's spaced-out headings.
    letterSpacing: {
      wide:  { value: '2px', usage: 'Latin labels and small caps chips — never applied to Arabic, which joins' },
      wider: { value: '6px', usage: 'the month report’s display headings, Latin only' },
    },
  },
  spacing: flatten(src.space),
  radius: flatten(src.radius),
  shadow: { ...flatten(src.elevation), ...flatten(src.dial) },
  border: flatten(borderColors),
}

// ── Rules ─────────────────────────────────────────────────────
//
// Ours are twelve sentences. Theirs want an id and a severity. `must`
// is for the ones that break something when ignored — the mode
// mechanism, the contrast floor, bidi. `should` is for the ones that
// only make the app worse.

const RULE_META = [
  ['accent-through-triplet',   'must'],
  ['depth-from-surface-steps', 'should'],
  ['primary-is-action',        'must'],
  ['danger-is-destructive',    'must'],
  ['success-is-not-action',    'should'],
  ['numbers-are-mono',         'should'],
  ['contrast-floor',           'must'],
  ['modes-turn-dials',         'should'],
  ['rtl-logical-properties',   'must'],
  ['isolate-latin-runs',       'must'],
  ['fluid-space-tokens',       'should'],
  ['only-primary-glows',       'must'],
]

const rules = src.rules.map((statement, i) => ({
  id: RULE_META[i]?.[0] || `rule-${i + 1}`,
  statement,
  severity: RULE_META[i]?.[1] || 'should',
}))

const system = {
  schemaVersion: 1,
  meta: { name: src.name, source: 'code' },
  stylePrompt: src.stylePrompt,
  tokens,
  components: src.components,
  rules,
}

const countTokens = (n) =>
  n && typeof n === 'object'
    ? ('value' in n ? 1 : Object.values(n).reduce((t, v) => t + countTokens(v), 0))
    : 0

// ── Read-back and verify ──────────────────────────────────────

const call = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: res.ok, status: res.status, body: parsed }
}

if (!TOKEN && !has('dry')) {
  console.error(`
  MISWADAH_TOKEN is not set.

      MISWADAH_TOKEN=ms_live_… node scripts/push-design-system.mjs

  The key comes from the project page in the Miswadah dashboard.
`)
  process.exit(1)
}

if (has('current')) {
  const r = await call('/api/systems/current', {})
  console.log(JSON.stringify(r.body, null, 2).slice(0, 6000))
  process.exit(r.ok ? 0 : 1)
}

const vi = argv.indexOf('--verify')
if (vi !== -1) {
  const paths = argv.slice(vi + 1).filter(a => !a.startsWith('--'))
  const files = paths.map(p => ({ path: p, content: readFileSync(p, 'utf8') }))
  const r = await call('/api/systems/verify', { files })
  console.log(JSON.stringify(r.body, null, 2).slice(0, 8000))
  process.exit(r.ok ? 0 : 1)
}

// ── Push ──────────────────────────────────────────────────────

console.log(`
  ${system.meta.name} @ ${src.source.split('@ ').pop()}
  tokens      ${countTokens(tokens)}
  components  ${system.components.length}
  rules       ${rules.length}  (${rules.filter(r => r.severity === 'must').length} must)
  stylePrompt ${system.stylePrompt.split(/\s+/).length} words
`)

if (has('dry')) {
  console.log(JSON.stringify({ system }, null, 2))
  console.error('\n  --dry: nothing sent.\n')
  process.exit(0)
}

const r = await call('/api/systems/push', { system })

if (!r.ok) {
  console.error(`\n  ${r.status}\n`)
  console.error(typeof r.body === 'string' ? r.body.slice(0, 3000) : JSON.stringify(r.body, null, 2).slice(0, 3000))
  console.error()
  process.exit(1)
}

console.log('  pushed.\n')
console.log(JSON.stringify(r.body, null, 2))
console.log()
