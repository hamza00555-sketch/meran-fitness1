// ── The month's shape ─────────────────────────────────────────
// Volume per training day, drawn as a line that traces itself out
// left to right, with the area beneath it filling in behind.
//
// The line is coloured by the direction of the month rather than by
// each step: a session lighter than the one before it is not a
// setback, and colouring it red would say it was. What the colour
// answers is the only question the chart is for — over the month, did
// this go up or down.
//
// The drawing effect is the stroke's own dash offset, which animates
// on the compositor and costs no layout. The dashed trend line and the
// end marker follow once the path has finished, so the eye reads the
// shape before it reads the verdict.

import { useReveal, useReducedMotion } from '../../hooks/useMotion.js'

const W = 320
const H = 132
const PAD = { top: 14, right: 8, bottom: 20, left: 8 }

export default function TrendChart({ series = [], direction = 'flat', color }) {
  const [ref, run, active] = useReveal()
  const reduced = useReducedMotion()

  // Two points is a line, not a trend — below that there is nothing
  // worth drawing and a chart of one dot would only mislead.
  if (series.length < 3) return null

  const values = series.map(p => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  // A flat month should read as flat, not as noise amplified to fill
  // the box, so the scale always includes zero at the bottom.
  const top = max * 1.08 || 1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const x = (i) => PAD.left + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW)
  const y = (v) => PAD.top + plotH - (v / top) * plotH

  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(series.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`

  const stroke = color || (direction === 'down' ? '#EF4444' : direction === 'up' ? 'var(--cyan)' : 'var(--purple)')
  const gid = `mr-trend-${direction}`

  // Path length drives the dash animation. An over-estimate is safe —
  // it only means the line starts further off-screen — so the diagonal
  // bound avoids measuring the DOM.
  const len = Math.round(plotW + plotH * series.length)

  // Contiguous runs of deload days, so the chart can shade the stretch
  // rather than mark each point. The dip inside that band is planned,
  // and a reader who cannot see which days were deliberately light will
  // read the same shape as a slump.
  const bands = []
  for (let i = 0; i < series.length; i++) {
    if (!series[i].deload) continue
    const from = i
    while (i + 1 < series.length && series[i + 1].deload) i++
    bands.push([from, i])
  }

  const last = series[series.length - 1]
  const first = series[0]
  const lo = series.reduce((a, p) => (p.value < a.value ? p : a), series[0])
  const hi = series.reduce((a, p) => (p.value > a.value ? p : a), series[0])

  // The average, drawn. Without a reference the line is a shape with
  // no size: you cannot tell whether the swing between the lowest and
  // highest day is a real difference or the scale magnifying noise.
  // Every point can now be read as above or below a typical day.
  const avg = Math.round(values.reduce((a, v) => a + v, 0) / values.length)
  const avgY = y(avg)

  return (
    <div
      ref={ref}
      className={active ? undefined : 'mr-idle'}
      style={{ position: 'relative' }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`حجم التمرين لكل يوم خلال الشهر، الاتجاه ${direction === 'up' ? 'صاعد' : direction === 'down' ? 'نازل' : 'ثابت'}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.34" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Deload stretches, shaded behind everything. Glacier blue by
            literal rather than by token: the report is usually read
            after the period has ended, when the accent is green again,
            and this band has to mean deload wherever it is seen. */}
        {bands.map(([a, b], n) => {
          // A single-day band would be a zero-width rect, so it gets
          // half a step of padding either side to stay visible.
          const pad = series.length > 1 ? (plotW / (series.length - 1)) * 0.5 : plotW / 2
          const x0 = Math.max(PAD.left, x(a) - pad)
          const x1 = Math.min(W - PAD.right, x(b) + pad)
          return (
            <g key={n} style={{ opacity: run ? 1 : 0, transition: reduced ? 'none' : 'opacity .5s ease .3s' }}>
              <rect
                x={x0} y={PAD.top} width={Math.max(2, x1 - x0)} height={plotH}
                fill="#5CC9EE" fillOpacity="0.10"
              />
              <line
                x1={x0} y1={PAD.top} x2={x1} y2={PAD.top}
                stroke="#5CC9EE" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="3 3"
              />
            </g>
          )
        })}

        {/* The average day, as a quiet rule across the plot. */}
        <g style={{ opacity: run ? 1 : 0, transition: reduced ? 'none' : 'opacity .5s ease .55s' }}>
          <line
            x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY}
            stroke="var(--text3)" strokeWidth="1" strokeOpacity="0.55" strokeDasharray="2 4"
          />
          {/* Anchored at the start edge: at the end it collided with
              the last point's marker and ran past the card's padding.
              direction:ltr keeps the thousands separator in place —
              the surrounding paragraph is RTL. */}
          <text
            x={PAD.left + 2} y={avgY - 4} textAnchor="start"
            fill="var(--text3)" fontSize="9" fontFamily="var(--font-mono)"
            style={{ direction: 'ltr' }}
          >{avg.toLocaleString('en-US')}</text>
        </g>

        {/* Baseline, so a line near the floor still has a floor. */}
        <line
          x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH}
          stroke="var(--border)" strokeWidth="1"
        />

        {/* The area fades in under the line rather than wiping with it:
            two things sweeping at once reads as a glitch. */}
        <path
          d={area}
          fill={`url(#${gid})`}
          style={{
            opacity: run ? 1 : 0,
            transition: reduced ? 'none' : 'opacity .5s ease .55s',
          }}
        />

        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={run && !reduced ? 'mr-draw' : undefined}
          style={{
            '--dash': len,
            '--offset': 0,
            strokeDasharray: len,
            strokeDashoffset: run && !reduced ? 0 : (run ? 0 : len),
            filter: `drop-shadow(0 0 5px ${stroke})`,
          }}
        />

        {/* Highest and lowest day, so the shape has two anchors that can
            be checked against the numbers rather than only admired. */}
        {[hi, lo].map((p, n) => {
          const i = series.indexOf(p)
          return (
            <circle
              key={n}
              cx={x(i)} cy={y(p.value)} r="3"
              fill="var(--bg)" stroke={stroke} strokeWidth="2"
              style={{
                opacity: run ? 1 : 0,
                transition: reduced ? 'none' : `opacity .3s ease ${0.9 + n * 0.1}s`,
              }}
            />
          )
        })}

        {/* Where the month ended. */}
        <circle
          cx={x(series.length - 1)} cy={y(last.value)} r="4.5"
          fill={stroke}
          style={{
            opacity: run ? 1 : 0,
            transition: reduced ? 'none' : 'opacity .3s ease 1.1s',
            filter: `drop-shadow(0 0 6px ${stroke})`,
          }}
        />

        <text
          x={PAD.left} y={H - 5}
          fill="var(--text3)" style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}
        >{first.date.slice(8)}</text>
        <text
          x={W - PAD.right} y={H - 5} textAnchor="end"
          fill="var(--text3)" style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}
        >{last.date.slice(8)}</text>
      </svg>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 4, fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)',
      }}>
        <span>أدنى يوم {Number(min).toLocaleString('en-US')} كجم</span>
        <span>أعلى يوم {Number(max).toLocaleString('en-US')} كجم</span>
      </div>
    </div>
  )
}
