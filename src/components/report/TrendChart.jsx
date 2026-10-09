// ── The month, day by day ─────────────────────────────────────
// One slot for every day of the month on a real calendar axis, day 1
// at the right (the start edge, like every progress bar in the app),
// a bar on each day that has a session and a small tick on each day
// that has none — so rest stretches and gaps are visible instead of
// being squeezed out by spacing sessions evenly.
//
// The scale always starts at zero: a flat month must look flat, not be
// magnified into a slope. Gridlines at 0, the middle and a rounded top
// give it a size. The day the month peaked is the one bar drawn in full
// ink; deload days are drawn in the deload blue under one shaded band.
//
// Drawn in real pixels (the width is measured) so the 12px labels are
// 12px on every phone rather than scaled with a viewBox.

import { useEffect, useRef, useState } from 'react'
import { useReveal } from '../../hooks/useMotion.js'
import { AR } from './parts.jsx'

// The deload colour as a literal: the report is usually read after the
// period ended, when the app's accent is green again, and this band has
// to mean «deload» wherever it is seen.
export const DELOAD_INK = '#5CC9EE'

const H = 172
const TOP = 10
const AXIS = 24      // room under the baseline for the day labels
const GUTTER = 46    // the value labels, on the end (left) side
const EDGE = 2
const TICKS = [1, 8, 15, 22, 29]

const daysIn = (month) => {
  const [y, m] = String(month).split('-').map(Number)
  return new Date(y, m, 0).getDate() || 31
}

// A top that reads as a round number: 6,833 → 7,000; 1,070 → 1,500.
const niceTop = (max) => {
  if (!(max > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(max))
  const step = mag / 2
  return Math.ceil(max / step) * step
}

/**
 * Which way the month moved, judged on the axis the chart is drawn on.
 * A least-squares line through the ordinary days (deload days are light
 * on purpose and left out), and its change across the month as a share
 * of the average day. Inside ±5% the month was steady — a slope of a few
 * kilos is noise, and calling it «up» over a flat row of bars was the
 * thing that made the old chart unbelievable.
 */
export function monthVerdict(series = []) {
  const pts = series
    .filter(p => !p.deload)
    .map(p => ({ x: Number(String(p.date).slice(8, 10)), y: p.value }))
  if (pts.length < 3) return null
  const n = pts.length
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  let num = 0, den = 0
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
  if (!den || !my) return { dir: 'flat', pct: 0 }
  const span = pts[n - 1].x - pts[0].x
  const pct = Math.round(((num / den) * span / my) * 1000) / 10
  return { dir: pct >= 5 ? 'up' : pct <= -5 ? 'down' : 'flat', pct }
}

export const VERDICT_WORD = { up: 'صاعد', down: 'نازل', flat: 'ثابت' }

function useWidth(ref, initial = 320) {
  const [w, setW] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(Math.max(200, Math.round(el.clientWidth)))
    read()
    if (typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// A bar with its top corners rounded and its foot square on the baseline.
const barPath = (x, y, w, base, r) => {
  const rr = Math.min(r, w / 2, Math.max(0, base - y))
  return `M${x},${base}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${base}Z`
}

export default function TrendChart({ series = [], month, verdict }) {
  const box = useRef(null)
  const width = useWidth(box)
  const [ref, run] = useReveal({ threshold: 0.2 })
  if (!series.length) return null

  const days = daysIn(month || String(series[0].date).slice(0, 7))
  const byDay = new Map(series.map(p => [Number(String(p.date).slice(8, 10)), p]))
  const values = series.map(p => p.value)
  const max = Math.max(...values)
  const top = niceTop(max)

  const plotW = width - GUTTER - EDGE
  const plotH = H - TOP - AXIS
  const base = TOP + plotH
  const pitch = plotW / days
  const barW = Math.max(3, Math.min(10, pitch * 0.62))
  // Day d's slot centre, counting from the right edge.
  const cxOf = (d) => width - EDGE - (d - 0.5) * pitch
  const yOf = (v) => base - (v / top) * plotH

  // Contiguous stretches of deload sessions become one shaded band each.
  const bands = []
  for (let i = 0; i < series.length; i++) {
    if (!series[i].deload) continue
    const from = i
    while (i + 1 < series.length && series[i + 1].deload) i++
    bands.push([Number(String(series[from].date).slice(8, 10)), Number(String(series[i].date).slice(8, 10))])
  }

  const peak = series.reduce((a, p) => (p.value > a.value ? p : a), series[0])
  const word = VERDICT_WORD[verdict?.dir || 'flat']

  let order = 0
  return (
    <div ref={box} className="rp-chart">
      <svg
        ref={ref}
        width="100%"
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        preserveAspectRatio="none"
        className={run ? 'rp-chart-svg rp-on' : 'rp-chart-svg rp-off'}
        role="img"
        aria-label={`حجم التمرين لكل يوم خلال الشهر، الاتجاه ${word}`}
      >
        {/* Deload stretches, behind everything. */}
        {bands.map(([a, b]) => {
          const x0 = cxOf(b) - pitch / 2
          const x1 = cxOf(a) + pitch / 2
          return (
            <rect key={`band-${a}`} x={x0} y={TOP} width={Math.max(2, x1 - x0)} height={plotH}
                  fill="#5CC9EE" fillOpacity="0.10" />
          )
        })}

        {/* Gridlines: zero, the middle, the rounded top. */}
        {[0, top / 2, top].map((v, i) => (
          <g key={v}>
            <line x1={GUTTER} x2={width - EDGE} y1={yOf(v)} y2={yOf(v)}
                  className={i === 0 ? 'rp-chart-base' : 'rp-chart-grid'} />
            <text x={GUTTER - 6} y={yOf(v) + 4} textAnchor="end" className="rp-chart-label">
              {AR(v)}
            </text>
          </g>
        ))}

        {/* Every day of the month: a bar where there was a session, a
            tick on the baseline where there was not. */}
        {Array.from({ length: days }, (_, k) => {
          const d = k + 1
          const p = byDay.get(d)
          const x = cxOf(d) - barW / 2
          if (!p) {
            return <rect key={d} x={x} y={base - 2} width={barW} height={2} rx={1} className="rp-chart-empty" />
          }
          const cls = p.deload ? 'rp-chart-bar is-deload' : p === peak ? 'rp-chart-bar is-peak' : 'rp-chart-bar'
          return (
            <path key={d} d={barPath(x, yOf(p.value), barW, base, 2)} className={cls}
                  style={{ '--i': order++ }} />
          )
        })}

        {/* Day ticks, under their own slots. */}
        {TICKS.filter(d => d <= days).map(d => (
          <text key={d} x={cxOf(d)} y={H - 6} textAnchor="middle" className="rp-chart-label">{d}</text>
        ))}
      </svg>
    </div>
  )
}
