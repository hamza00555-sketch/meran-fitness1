// ── Section 4: where the work went ────────────────────────────
// Volume split by muscle group, and the push/pull ratio that says
// whether the split is balanced. Colours come from MUSCLE_GROUPS, so a
// muscle is the same colour here as everywhere else in the app.

import { useReveal } from '../../../hooks/useMotion.js'
import { formatRatio, describeRatio, PUSH_PULL_BAND } from '../../../monthReport.js'
import { Heading, Bar, AR } from '../parts.jsx'
import Ring from '../Ring.jsx'

export default function Muscles({ report }) {
  const [ref, run, active] = useReveal()
  const { muscles, balance } = report
  if (!muscles.length) return null

  const top = muscles[0].volume || 1
  const ratio = balance.pushPull
  // The ring is coloured on the same band the tips engine judges by, so
  // the two can never disagree about whether a split is lopsided.
  const balanced = ratio === null || (ratio >= PUSH_PULL_BAND[0] && ratio <= PUSH_PULL_BAND[1])

  return (
    <section ref={ref} className={`mr-section${active ? '' : ' mr-idle'}`} style={{ marginBottom: 34 }}>
      <Heading run={run} note="حصة كل مجموعة عضلية من حجم الشهر">
        العضلات والتوازن
      </Heading>

      <div
        className={run ? 'mr-rise mr-shine' : undefined}
        style={{
          '--i': 1, position: 'relative', overflow: 'hidden',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 14, marginBottom: 12,
          opacity: run ? undefined : 0,
        }}
      >
        {muscles.map((m, i) => (
          <div key={m.key} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: i === muscles.length - 1 ? 0 : 10,
          }}>
            <span style={{
              width: 62, flexShrink: 0, fontSize: 12, fontWeight: 700,
              color: 'var(--text2)', fontFamily: 'var(--font-ar)',
            }}>{m.label}</span>
            <Bar pct={(m.volume / top) * 100} color={m.color} run={run} i={i} />
            <span style={{
              width: 42, flexShrink: 0, textAlign: 'left',
              fontSize: 11, fontWeight: 700, color: m.color,
              fontVariantNumeric: 'tabular-nums',
            }}>٪{m.pct}</span>
          </div>
        ))}
      </div>

      {ratio !== null && (
        <div
          className={run ? 'mr-rise' : undefined}
          style={{
            '--i': 2, display: 'flex', alignItems: 'center', gap: 14,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 14, opacity: run ? undefined : 0,
          }}
        >
          <Ring
            value={Math.min(ratio, 2)}
            max={2}
            run={run}
            size={92}
            stroke={8}
            label={formatRatio(ratio)}
            sub="دفع/سحب"
            color={balanced ? 'var(--cyan)' : 'var(--gold)'}
          />
          <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ar)' }}>
            <div style={{
              fontWeight: 800, fontSize: 14,
              color: balanced ? 'var(--cyan)' : 'var(--gold)', marginBottom: 4,
            }}>
              {balanced ? 'توازنك جيد' : 'التوازن مائل'}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
              {balanced
                ? 'حجم الدفع والسحب متقارب — هذا ما يحمي الأكتاف على المدى الطويل.'
                : `${describeRatio(ratio)}. ${ratio > 1
                    ? 'الدفع (صدر · أكتاف · ترايسبس) يغلب على السحب (ظهر · بايسبس) — زد صفّاً من تمارين الظهر.'
                    : 'السحب يغلب على الدفع — أضف تمريناً للصدر أو الأكتاف حتى يتقارب الطرفان.'}`}
            </p>
          </div>
        </div>
      )}

      {balance.neglected && balance.dominant && balance.neglected.key !== balance.dominant.key && (
        <div
          className={run ? 'mr-rise' : undefined}
          style={{
            '--i': 3, marginTop: 10, fontSize: 12, textAlign: 'center',
            color: 'var(--text3)', fontFamily: 'var(--font-ar)',
            opacity: run ? undefined : 0,
          }}
        >
          أكثر مجموعة: <b style={{ color: balance.dominant.color }}>{balance.dominant.label}</b>
          {' '}({AR(balance.dominant.volume)} كجم) · أقلّها:{' '}
          <b style={{ color: balance.neglected.color }}>{balance.neglected.label}</b>
          {' '}({AR(balance.neglected.volume)} كجم)
        </div>
      )}
    </section>
  )
}
