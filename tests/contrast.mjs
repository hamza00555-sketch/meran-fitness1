// ── Contrast, measured in the page ────────────────────────────
//
// For e2e suites (tests/plan-view.e2e.mjs): every text run in view under
// some roots, its colour (with the opacity of everything above it) over
// the real pixels behind its glyphs. Two screenshots — as drawn, and with
// all text made transparent — tell which pixels are glyphs (they differ)
// and what is behind them (the second). A run's ratio is the 10th
// percentile over its glyph pixels, so text over a picture or a gradient
// is judged where it is hardest to read. WCAG AA: 4.5:1; 3:1 for large
// text (24px, or 18.66px at 700+). Disabled controls are exempt.
//
//   const { measure, neighbours, ratioOf, rgbOf } = await makeContrast(browser, page)
//   const r = await measure('[data-testid="plan-view"]', { scroller: '.pv-page' })
//   r → { runs, min, minAt, fails: ['«شيله» .xs-act 13px/800 4.10:1 < 4.5', …] }
//
// For graphics (the body figure), `neighbours(box, part)` compares a part
// with the colours that really touch it on screen (see below).

export const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
export const ratioOf = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const rgbOf = (s) => (String(s).match(/[\d.]+/g) || [0, 0, 0]).map(Number)

/** What text is in view under `roots`, with its colour, opacity, size and visible rects. */
function collect(roots) {
  const vw = innerWidth, vh = innerHeight
  const clipOf = (el) => {
    let L = 0, T = 0, R = vw, B = vh
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
      const r = a.getBoundingClientRect()
      if (cs.overflowX !== 'visible') { L = Math.max(L, r.left); R = Math.min(R, r.right) }
      if (cs.overflowY !== 'visible') { T = Math.max(T, r.top); B = Math.min(B, r.bottom) }
    }
    return { L, T, R, B }
  }
  const out = []
  for (const root of document.querySelectorAll(roots)) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue
      const el = n.parentElement
      if (el.closest('[disabled]')) continue
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible') continue
      let op = 1
      for (let a = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity)
      const m = (cs.color.match(/[\d.]+/g) || []).map(Number)
      const color = [m[0], m[1], m[2], m[3] ?? 1]
      if (op < 0.05 || color[3] * op < 0.05) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const c = clipOf(el)
      const rects = [...range.getClientRects()]
        .map(r => ({ x: Math.max(r.left, c.L), y: Math.max(r.top, c.T), x2: Math.min(r.right, c.R), y2: Math.min(r.bottom, c.B) }))
        .filter(r => r.x2 - r.x > 2 && r.y2 - r.y > 2)
      if (!rects.length) continue
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10)
      out.push({
        text: n.textContent.trim().slice(0, 32), cls: String(el.className?.baseVal ?? el.className ?? '') || el.tagName,
        color, op, fs, fw, large: fs >= 24 || (fs >= 18.66 && fw >= 700), rects,
      })
    }
  }
  return out
}

/** In a blank page: per run, the background pixels under its glyphs. */
async function sample({ a, b, items, dpr }) {
  const load = async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d')
    g.drawImage(bmp, 0, 0)
    return g.getImageData(0, 0, bmp.width, bmp.height)
  }
  const A = await load(a), B = await load(b)
  return items.map(it => {
    const glyph = [], all = []
    for (const r of it.rects) {
      for (let y = Math.floor(r.y * dpr); y < Math.min(B.height, Math.ceil(r.y2 * dpr)); y++) {
        for (let x = Math.floor(r.x * dpr); x < Math.min(B.width, Math.ceil(r.x2 * dpr)); x++) {
          const i = (y * B.width + x) * 4
          const bg = [B.data[i], B.data[i + 1], B.data[i + 2]]
          all.push(bg)
          const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]))
          if (d > 24) glyph.push(bg)
        }
      }
    }
    return glyph.length >= 6 ? glyph : all
  })
}

/** In a blank page: the colours of the pixels just outside the marked ones
 *  (those that differ between `a`, as drawn, and `b`, the part painted
 *  magenta), within `r` device pixels, grouped by colour with their share. */
async function ring({ a, b, r }) {
  const load = async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d')
    g.drawImage(bmp, 0, 0)
    return g.getImageData(0, 0, bmp.width, bmp.height)
  }
  const A = await load(a), B = await load(b)
  const W = A.width, H = A.height
  const mark = new Uint8Array(W * H)
  let marked = 0
  for (let i = 0; i < W * H; i++) {
    const j = i * 4
    if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) > 24) { mark[i] = 1; marked++ }
  }
  const seen = new Uint8Array(W * H)
  const counts = new Map()
  let total = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mark[y * W + x]) continue
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const X = x + dx, Y = y + dy
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue
          const q = Y * W + X
          if (mark[q] || seen[q]) continue
          seen[q] = 1
          const k = `${A.data[q * 4]},${A.data[q * 4 + 1]},${A.data[q * 4 + 2]}`
          counts.set(k, (counts.get(k) || 0) + 1)
          total++
        }
      }
    }
  }
  return {
    marked, total,
    groups: [...counts].map(([k, n]) => ({ rgb: k.split(',').map(Number), share: n / (total || 1) })).sort((p, q) => q.share - p.share),
  }
}

const HIDE = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }'

export async function makeContrast(browser, page) {
  const helper = await browser.newPage()
  const settle = (ms) => page.waitForTimeout(ms)

  async function measureHere(roots) {
    const items = await page.evaluate(collect, roots)
    if (!items.length) return []
    const shown = await page.screenshot({ animations: 'disabled' })
    await page.evaluate((css) => {
      const s = document.createElement('style')
      s.id = 'contrast-probe'
      s.textContent = css
      document.head.appendChild(s)
    }, HIDE)
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    const hidden = await page.screenshot({ animations: 'disabled' })
    await page.evaluate(() => document.getElementById('contrast-probe')?.remove())
    const dpr = await page.evaluate(() => devicePixelRatio)
    const pools = await helper.evaluate(sample, { a: shown.toString('base64'), b: hidden.toString('base64'), items, dpr })
    return items.map((it, k) => {
      const pool = pools[k]
      if (!pool.length) return null
      const alpha = it.color[3] * it.op
      const rs = pool.map(bg => ratioOf(it.color.slice(0, 3).map((c, j) => c * alpha + bg[j] * (1 - alpha)), bg)).sort((p, q) => p - q)
      return { ...it, ratio: rs[Math.floor(rs.length * 0.1)] }
    }).filter(Boolean)
  }

  /** Measure every text run under `roots`; `scroller` is stepped through its whole
   *  height. `aaa`: hold it to 7:1 (4.5:1 large) — for the text he reads to
   *  understand a card, where «faint grey» was the complaint. */
  async function measure(roots, { scroller = null, aaa = false } = {}) {
    const steps = scroller
      ? await page.locator(scroller).first().evaluate(el => {
        const out = []
        const h = el.clientHeight * 0.75
        for (let y = 0; y < el.scrollHeight - el.clientHeight + h; y += h) out.push(Math.min(y, el.scrollHeight - el.clientHeight))
        return [...new Set(out)]
      })
      : [null]
    const res = { runs: 0, min: Infinity, minAt: '', fails: [] }
    for (const y of steps) {
      if (y != null) { await page.locator(scroller).first().evaluate((el, y) => el.scrollTo(0, y), y); await settle(350) }
      for (const it of await measureHere(roots)) {
        res.runs += 1
        if (it.ratio < res.min) { res.min = it.ratio; res.minAt = `«${it.text}» .${it.cls}` }
        const need = aaa ? (it.large ? 4.5 : 7) : (it.large ? 3 : 4.5)
        if (it.ratio < need) res.fails.push(`«${it.text}» .${it.cls} ${it.fs}px/${it.fw} ${it.ratio.toFixed(2)}:1 < ${need}`)
      }
    }
    if (scroller) await page.locator(scroller).first().evaluate(el => el.scrollTo(0, 0))
    return res
  }

  /** A graphic's part against what really touches it: `part` (a selector
   *  inside `box`) is painted magenta for a second screenshot; the pixels
   *  that changed are the part, and the colours within 1.5 CSS px outside
   *  it are its neighbours. Each neighbour colour holding at least `floor`
   *  of them (blends at the edges hold little) is compared with the part's
   *  own colour (its fill, or its stroke when it has no fill).
   *  → { color, marked, neighbours: [{ rgb, share, ratio }], min } */
  async function neighbours(box, part, { floor = 0.03 } = {}) {
    const b = await page.locator(box).first().boundingBox()
    if (!b) return null
    const pad = 6
    const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad }
    const info = await page.evaluate(([box, part]) => {
      const el = document.querySelector(box)?.querySelector(part)
      if (!el) return null
      const cs = getComputedStyle(el)
      const stroked = cs.fill === 'none'
      return { color: stroked ? cs.stroke : cs.fill, prop: stroked ? 'stroke' : 'fill' }
    }, [box, part])
    if (!info) return null
    const shown = await page.screenshot({ clip, animations: 'disabled' })
    await page.evaluate(([css]) => {
      const s = document.createElement('style')
      s.id = 'contrast-mark'
      s.textContent = css
      document.head.appendChild(s)
    }, [`${box} ${part} { ${info.prop}: #ff00ff !important; transition: none !important; }`])
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    const marked = await page.screenshot({ clip, animations: 'disabled' })
    await page.evaluate(() => document.getElementById('contrast-mark')?.remove())
    const dpr = await page.evaluate(() => devicePixelRatio)
    const res = await helper.evaluate(ring, { a: shown.toString('base64'), b: marked.toString('base64'), r: Math.round(1.5 * dpr) })
    const color = rgbOf(info.color)
    const list = res.groups.filter(g => g.share >= floor).map(g => ({ ...g, ratio: ratioOf(color, g.rgb) }))
    return { color, marked: res.marked, neighbours: list, min: list.length ? Math.min(...list.map(g => g.ratio)) : Infinity }
  }

  return { measure, neighbours, ratioOf, rgbOf, close: () => helper.close() }
}
