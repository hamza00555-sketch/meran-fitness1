import { Num } from './kit/index.jsx'
import '../styles/screens/charts.css'

// ── A small bar chart, to scale ───────────────────────────────
//
// Hand-rolled — the app carries no chart library and one would dwarf
// everything it draws. HTML, not SVG: the old SVG scaled its own text
// with the width, so labels came out at 7px on a phone and stretched on
// a tablet. Here the bars scale and the text stays 12px.
//
// Rules it keeps:
//   · drawn to scale from zero, with the top gridline at a round number
//     so the eye can read the bars against it;
//   · time runs with the reading direction — oldest on the start edge
//     (right, in Arabic), newest at the end — the same way every
//     progress bar in the app fills;
//   · one lit bar: the latest is the accent, the rest are neutral;
//   · numbers go through <Num> (isolated LTR, tabular).
//
// data: [{ value, label }] in chronological order. `label` is drawn under
// the bars where `showLabel(i, n)` says so; `format` renders a value.

export function niceCeil(v) {
  if (!(v > 0)) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-9) return m * p
  return 10 * p
}

const everyFourth = (i, n) => (n - 1 - i) % 4 === 0

export default function BarChart({
  data = [], valueKey = 'value', labelKey = 'label',
  height = 120, tone = 'accent', format = (v) => v, unit = '',
  showValues = 'last', showLabel = everyFourth, target, targetLabel = 'الهدف',
  animate = false, ariaLabel, max: maxProp,
}) {
  if (!data.length) {
    return <p className="bc-empty">ما فيه أرقام كافية بعد</p>
  }

  const values = data.map(d => Number(d[valueKey]) || 0)
  const top = maxProp || niceCeil(Math.max(...values, target || 0))
  const last = data.length - 1
  const nameOf = (d) => d.aria ?? (typeof d[labelKey] === 'string' ? d[labelKey] : '')
  const summary = ariaLabel || data.map((d, i) => `${nameOf(d)}: ${format(values[i])}${unit ? ' ' + unit : ''}`).join('، ')

  return (
    <figure className={`bc bc-${tone}${animate ? ' bc-anim' : ''}`} role="img" aria-label={summary}>
      <div className="bc-plot" style={{ height }}>
        <div className="bc-grid" style={{ bottom: '100%' }} aria-hidden="true">
          <span><Num>{format(top)}</Num>{unit && <> {unit}</>}</span>
        </div>
        <div className="bc-grid bc-grid-mid" style={{ bottom: '50%' }} aria-hidden="true" />
        {target > 0 && target <= top && (
          <div className="bc-target" style={{ bottom: `${(target / top) * 100}%` }} aria-hidden="true">
            <span>{targetLabel} <Num>{format(target)}</Num></span>
          </div>
        )}
        <div className="bc-bars" aria-hidden="true">
          {values.map((v, i) => {
            const pct = Math.max(0, Math.min(1, v / top)) * 100
            const on = i === last
            // Values over every bar skip the empty weeks — a row of
            // zeros is noise; the stub already says nothing happened.
            const showV = (showValues === 'all' && (v > 0 || on)) || (showValues === 'last' && on)
            return (
              <div key={i} className={`bc-col${on ? ' on' : ''}`} style={{ '--i': i }}>
                {showV && <span className="bc-val" style={{ bottom: `${pct}%` }}><Num>{format(v)}</Num></span>}
                <i className={`bc-bar${v <= 0 ? ' zero' : ''}`} style={{ height: v > 0 ? `max(3px, ${pct}%)` : undefined }} />
              </div>
            )
          })}
        </div>
      </div>
      <div className="bc-axis" aria-hidden="true">
        {data.map((d, i) => (
          <span key={i} className={`bc-lab${i === 0 ? ' first' : ''}${i === last ? ' last' : ''}`}>
            {showLabel(i, data.length) ? d[labelKey] : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}
