// ── The report's charts, drawn by us ──────────────────────────
// No chart library: an SVG that stretches to its box, framed by HTML
// labels in the app's own type, so the numbers are real text in the
// real font. The geometry comes from reportStory.js (pure, tested);
// this only draws it. Time runs right to left: the start of the month
// sits on the right, its end on the left.

import { useSvgId } from './bits.jsx'

const pc = (n) => `${n}%`

/**
 * One lift, week by week (reportStory.jumpChart). With `gold` the part
 * above the old best is drawn gold — a new weight — and the record's dot
 * pulses with its weight and day over it. `refLabel` names the line.
 */
export function LineChart({ chart, label, refLabel, gold = true, height = '68cqw', prTag = null, unit = 'كجم' }) {
  const id = useSvgId('lc')
  if (!chart) return null
  const { pts, line, area, refY, ticks, pr, sep, labels, deloads } = chart
  return (
    <div className="lc" style={{ '--lh': height }} role="img" aria-label={label}>
      <div className="plot">
        {ticks.map(t => (
          <span key={`t${t.v}`}>
            <i className="gl" style={{ top: pc(t.y) }} />
            <span className="yl" style={{ top: pc(t.y) }}>{t.v}</span>
          </span>
        ))}
        <span className="yu">{unit}</span>
        {deloads.map(b => (
          <span key={`d${b.x}`} className="dlb" style={{ left: pc(b.x), width: pc(b.w) }}><em>تخفيف</em></span>
        ))}
        {refY != null && <i className="gl ref" style={{ top: pc(refY) }} />}
        {refY != null && refLabel && (
          <span className="refl lo" style={{ top: pc(refY), ...(deloads.length ? { left: '22%' } : null) }}>{refLabel}</span>
        )}
        <svg className="lsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--ink)', stopOpacity: .14 }} />
              <stop offset="1" style={{ stopColor: 'var(--ink)', stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--raise)', stopOpacity: .34 }} />
              <stop offset="1" style={{ stopColor: 'var(--raise)', stopOpacity: .04 }} />
            </linearGradient>
            {refY != null && (
              <clipPath id={`${id}c`}><rect x="-5" y="-20" width="110" height={refY + 20} /></clipPath>
            )}
          </defs>
          {area && <path d={area} fill={`url(#${id}a)`} />}
          {area && gold && refY != null && <path d={area} clipPath={`url(#${id}c)`} fill={`url(#${id}g)`} />}
          {line && <path className={`ln${gold ? '' : ' ink'}`} d={line} vectorEffect="non-scaling-stroke" />}
          {line && gold && refY != null && <path className="ln gold" d={line} clipPath={`url(#${id}c)`} vectorEffect="non-scaling-stroke" />}
        </svg>
        {pts.filter(p => p.kind !== 'pr').map(p => (
          <i key={`p${p.i}`} className={`pt${p.kind === 'dl' ? ' dl' : p.kind === 'up' && gold ? ' up' : ''}`}
             style={{ left: pc(p.x), top: pc(p.y), '--t': p.t }} />
        ))}
        {pr && (
          <>
            <i className={`pulse${gold ? '' : ' ink'}`} style={{ left: pc(pr.x), top: pc(pr.y), '--t': pr.t }} />
            <i className={`pt ${gold ? 'prd' : 'hit'}`} style={{ left: pc(pr.x), top: pc(pr.y), '--t': pr.t }} />
            {prTag && (
              <span className="ptag" style={{ left: pc(pr.x), top: pc(pr.y), '--t': pr.t }}>
                <b>{prTag.v}</b><small>{prTag.when}</small>
              </span>
            )}
          </>
        )}
        {labels.map(l => <span key={l.text} className="xl" style={{ left: pc(l.x) }}>{l.text}</span>)}
        {sep != null && <i className="xsep" style={{ left: pc(sep) }} />}
      </div>
    </div>
  )
}

/** Sessions adding up through the month, a step each (reportStory.goalSteps). */
export function StepChart({ steps, label, goalLabel }) {
  const id = useSvgId('gc')
  if (!steps) return null
  return (
    <div className="lc" style={{ '--lh': '40cqw', '--w0': '.5s', '--wd': '1.6s' }} role="img" aria-label={label}>
      <div className="plot">
        {steps.ticks.map(t => (
          <span key={`t${t.v}`}>
            <i className="gl" style={{ top: pc(t.y) }} />
            <span className="yl" style={{ top: pc(t.y) }}>{t.v}</span>
          </span>
        ))}
        <span className="yl on" style={{ top: pc(steps.goalY) }}>{steps.target}</span>
        <i className="gl goal" style={{ top: pc(steps.goalY) }} />
        <span className="refl" style={{ top: pc(steps.goalY) }}>{goalLabel}</span>
        <svg className="lsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--ink)', stopOpacity: .2 }} />
              <stop offset="1" style={{ stopColor: 'var(--ink)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={steps.area} fill={`url(#${id})`} />
          <path className="ln ink" d={steps.path} vectorEffect="non-scaling-stroke" />
        </svg>
        {steps.hit && (
          <>
            <i className="pulse ink" style={{ left: pc(steps.hit.x), top: pc(steps.hit.y), '--t': steps.hit.t }} />
            <i className="pt hit" style={{ left: pc(steps.hit.x), top: pc(steps.hit.y), '--t': steps.hit.t }} />
          </>
        )}
        {steps.xTicks.map(t => (
          <span key={`x${t.d}`}>
            <i className="xt" style={{ left: pc(t.x) }} />
            <span className="xl n" style={{ left: pc(t.x) }}>{t.d}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
