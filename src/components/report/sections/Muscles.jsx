// ── Chapter 04: where the work went ───────────────────────────
// Each muscle's share of the month, drawn as exactly that: a bar whose
// length IS the percentage beside it, on one track that stands for the
// whole month. (The old bars were scaled to the top muscle, so the
// leader always filled its track while its label said 45%.) Neutral
// ink — orange belongs to the streak and green to the next action.
//
// Then push against pull as a balance, not a progress ring: a scale on
// log2 from «pull ×2» to «push ×2», the balanced band shaded, a marker
// where the month landed. The band is the tips engine's own, so the
// two can never disagree about whether a split is lopsided.

import { Num } from '../../kit/index.jsx'
import { formatRatio, describeRatio, PUSH_PULL_BAND } from '../../../monthReport.js'
import { Chapter, AR } from '../parts.jsx'

// 0.5 … 2 on log2, mapped to 0 … 1 from the LEFT edge, so push-heavy
// (a ratio above 1) moves toward «دفع» on the right.
const pos = (r) => {
  const c = Math.min(2, Math.max(0.5, r))
  return 0.5 + Math.log2(c) / 2
}

function Balance({ ratio }) {
  const balanced = ratio >= PUSH_PULL_BAND[0] && ratio <= PUSH_PULL_BAND[1]
  const at = pos(ratio)
  const lo = pos(PUSH_PULL_BAND[0])
  const hi = pos(PUSH_PULL_BAND[1])
  const label = formatRatio(ratio)
  const extreme = label.startsWith('×')
  return (
    <div className="rp-block rp-in" style={{ '--i': 3 }}>
      <div className="rp-block-h">
        <span className="rp-eyebrow">الدفع والسحب</span>
        <span className={`rp-verdict${balanced ? '' : ' is-warn'}`}>
          <Num>{extreme ? label : `${label} : 1`}</Num> · {balanced ? 'متوازن' : 'مايل'}
        </span>
      </div>
      <div className="rp-scale" role="img"
           aria-label={`${describeRatio(ratio)} — ${balanced ? 'متوازن' : 'مايل'}`}>
        <div className="rp-scale-track">
          <i className="rp-scale-band" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
          <i className="rp-scale-mid" />
          <i className="rp-scale-mark" style={{ left: `${at * 100}%` }} />
        </div>
        <div className="rp-scale-ends" aria-hidden="true">
          <span>دفع</span>
          <span>سحب</span>
        </div>
      </div>
      <p className="rp-caption">
        {balanced
          ? 'حجم الدفع والسحب متقارب — هذا اللي يحمي الأكتاف على المدى الطويل.'
          : ratio > 1
            ? 'الدفع (صدر · أكتاف · ترايسبس) غالب على السحب (ظهر · بايسبس) — زِد تمرين ظهر.'
            : 'السحب غالب على الدفع — أضف تمرين صدر أو أكتاف لين يتقاربون.'}
      </p>
    </div>
  )
}

export default function Muscles({ report, n = 4, id = 'rp-muscles' }) {
  const { muscles, balance } = report
  if (!muscles.length) return null
  const ratio = balance.pushPull

  return (
    <Chapter id={id} n={n} title="العضلات" note="حصة كل عضلة من حجم الشهر.">
      <ul className="rp-share rp-in" style={{ '--i': 1 }}>
        {muscles.map((m, i) => (
          <li key={m.key} className="rp-share-row">
            <span className="rp-share-l">{m.label}</span>
            <span className="rp-share-track" aria-hidden="true">
              <i className="rp-share-fill" style={{ width: `${Math.max(1.5, Math.min(100, m.pct))}%`, '--i': i }} />
            </span>
            <span className="rp-share-v"><Num>{m.pct}%</Num></span>
          </li>
        ))}
      </ul>

      {balance.neglected && balance.dominant && balance.neglected.key !== balance.dominant.key && (
        <p className="rp-caption rp-in" style={{ '--i': 2 }}>
          الأكثر: <b>{balance.dominant.label}</b> (<Num>{AR(balance.dominant.volume)}</Num> كجم) · الأقل: <b>{balance.neglected.label}</b> (<Num>{AR(balance.neglected.volume)}</Num> كجم)
        </p>
      )}

      {ratio !== null && <Balance ratio={ratio} />}
    </Chapter>
  )
}
