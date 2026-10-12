// ── The medal stage, built before it is needed ────────────────
//
// The 3D medal (medal3d.js) costs something to build: the module itself,
// the medal's pictures (its art decoded or its face composed, the outline
// traced, the back plate engraved), a WebGL context, the relief baked on
// the GPU, and the GPU's own pipelines — built the first time each program
// draws, and on some GPUs only when the canvas is first shown. Built as
// the summary opened, that was up to a second before the medal could
// move, so the medal came in late.
//
// Now it is built ahead, while nobody is looking:
//
//   warmMedals(achievements, { gl, date, variant, queue })
//       gl: false — the module and the pictures only (no context): the
//       session does this at a quiet moment once it would earn a medal,
//       the medal wall as a finger lands on a tile.
//       gl: true  — the whole stage, its pipelines warmed and shown once,
//       parked in a corner pixel (on the page, so the GPU really does
//       the work; 1 px and all but transparent, so nobody sees it): as
//       the session is about to finish (every set done, «إنهاء» asked,
//       saved), and as the medal wall settles.
//   takeStage(key)   the reveal takes the parked stage — its canvas moves
//       into the reveal. Built for exactly its medals (stageKey: ids,
//       pictures, date), it plays as it is; built for others, the reveal
//       prepares its own medals on it, which costs only their pictures —
//       the context and its warm pipelines are reused.
//   giveBack(stage)  the medal sheet, closing, parks its stage again for
//       the next medal opened (the summary frees its own instead).
//
// One stage is kept at most, never one nobody takes: a new one replaces
// it, and it is freed when the app is hidden (iOS drops background
// contexts anyway), after two minutes unused, and when the medal wall
// closes (dropWarm). The pictures go into medal3d.js's own cache, which
// keeps the last four medals' only.
//
// Also here, shared by the reveal and the warm-up so both describe a
// medal the same way: the module loader, the list of medals as the stage
// takes it (medalItems), and the date the summary engraves (summaryDate).

import { mark } from '../../perf.js'
import { reducedMotion } from '../../motion.js'
import { medalFace, achText } from './achievementMeta.js'
import { medalQueue } from './medalQueue.js'
import { achSlot } from '../../assets/slots.js'
import { urlFor } from '../../assets/registry.js'
import { RARITY_COLORS } from '../../constants.js'

export const FONT = "'Meran Latin','Meran Arabic',sans-serif"

// The module, fetched once (a separate chunk: a summary with no medal
// never loads it).
let loader = null
export const loadStage = () => loader || (mark('medal:chunk-request'), loader = import('./medal3d.js')
  .then((m) => { mark('medal:chunk'); return m })
  .catch((e) => { loader = null; throw e }))

/** A Phosphor glyph's outline (the fill weight) as one SVG path string — read from the icon's own definition, no rendering. */
const paths = new Map()
export function glyphPath(G) {
  if (!G) return ''
  if (paths.has(G)) return paths.get(G)
  let d = ''
  try {
    const el = typeof G.render === 'function' ? G.render({ weight: 'fill' }, null) : null
    const out = []
    const walk = (n) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) { n.forEach(walk); return }
      if (typeof n.props?.d === 'string') out.push(n.props.d)
      walk(n.props?.children)
    }
    walk(el?.props?.weights?.get?.('fill'))
    d = out.join(' ')
  } catch { d = '' }
  paths.set(G, d)
  return d
}

/** The medals as the stage draws them. */
export const medalItems = (items) => items.map((a) => {
  const f = medalFace(a)
  return {
    id: a.id,
    title: achText(a).title,
    word: RARITY_COLORS[a.rarity]?.label || 'عادي',
    rarity: a.rarity || 'common',
    art: urlFor(achSlot(a.id)) || null,
    glyph: glyphPath(f.glyph),
    n: f.mark?.n || '',
  }
})

const LOCALE = 'ar-u-ca-gregory-nu-latn'
/** Today, as the summary engraves it on the back of a medal. */
export const summaryDate = () => {
  try { return new Date().toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' }
}

/** What a prepared stage is good for: these medals, these pictures, this date. */
export const stageKey = (list, date) => `${list.map(it => `${it.id}:${it.art || ''}`).join(',')}|${date}`

// ── The one stage kept ready ──
let held = null
const KEEP_MS = 120000

// Where a stage waits: a corner pixel, on the page but not to be seen.
let corner = null
function park(stage) {
  if (!corner || !corner.isConnected) {
    corner = document.createElement('div')
    corner.setAttribute('aria-hidden', 'true')
    corner.dataset.medalPark = ''
    corner.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:.01;pointer-events:none;z-index:2147483647;contain:strict'
    document.body.append(corner)
  }
  const spot = document.createElement('div')
  spot.style.cssText = 'position:absolute;inset:0'
  corner.append(spot)
  if (stage) stage.mount(spot)
  return spot
}

function drop(h) {
  if (!h || h.dropped) return
  h.dropped = true
  clearTimeout(h.timer)
  if (held === h) held = null
  try { h.stage?.destroy() } catch { /* already gone */ }
  h.stage = null
  try { h.spot?.remove() } catch { /* gone with the page */ }
}

let watching = false
function watch() {
  if (watching || typeof document === 'undefined') return
  watching = true
  document.addEventListener('visibilitychange', () => { if (document.hidden) drop(held) })
}

function hold(h) {
  if (held && held !== h) drop(held)
  held = h
  watch()
  clearTimeout(h.timer)
  h.timer = setTimeout(() => drop(h), KEEP_MS)
}

/**
 * Build ahead for these achievements (the summary's order and pair:
 * medalQueue, unless `queue: false`). Repeating the same call is free.
 */
export function warmMedals(achievements, { gl = true, date = summaryDate(), variant = 'summary', queue = true } = {}) {
  try {
    const items = queue ? medalQueue(achievements || []).stage : (achievements || [])
    if (!items.length || typeof document === 'undefined') return
    const list = medalItems(items)
    if (!gl) {
      loadStage().then(m => m.preload(list, { font: FONT, date })).catch(() => {})
      return
    }
    const key = stageKey(list, date)
    if (held && held.key === key) return
    const h = { key, stage: null, spot: null, dropped: false }
    hold(h)
    mark('medal:warm-start')
    h.ready = loadStage().then((m) => {
      if (h.dropped) return null
      h.spot = park(null)
      const s = m.default(h.spot, {
        font: FONT, date, reduced: reducedMotion, labels: variant !== 'sheet',
        // lost while parked: nothing to hand over
        onFallback: () => drop(h),
      })
      if (!s.webgl) { try { s.destroy() } catch { /* nothing */ } drop(h); return null }
      h.stage = s
      return s.prepare(list, { warm: true }).then(() => {
        if (h.dropped) return null
        mark('medal:warm')
        return s
      })
    }).catch(() => { drop(h); return null })
  } catch { /* a warm-up never breaks anything */ }
}

/**
 * The stage kept ready, now the caller's: { ready → the stage or null,
 * fresh — prepared for exactly `key`, dispose() if not wanted after all }
 * — or null when there is none.
 */
export function takeStage(key) {
  const h = held
  if (!h || h.dropped || !h.ready) return null
  held = null
  clearTimeout(h.timer)
  return {
    fresh: h.key === key,
    ready: h.ready.then(s => (s && !h.dropped ? s : null), () => null),
    dispose: () => drop(h),
    release: () => { try { h.spot?.remove() } catch { /* gone */ } },
  }
}

/** A stage done with (the medal sheet closing), parked for the next one — or freed if one is kept already. */
export function giveBack(stage) {
  if (!stage || typeof document === 'undefined') return
  if (held || !stage.webgl) { try { stage.destroy() } catch { /* gone */ } return }
  try {
    stage.reset()
    const h = { key: null, stage, spot: null, dropped: false }
    h.spot = park(stage)
    stage.set({ onLand: null, onFallback: () => drop(h) })
    h.ready = Promise.resolve(stage)
    hold(h)
  } catch { try { stage.destroy() } catch { /* gone */ } }
}

/** Free whatever is kept (the medal wall closing; a session thrown away). */
export const dropWarm = () => drop(held)
