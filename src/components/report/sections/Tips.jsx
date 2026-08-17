// ── Section 1: what to do about it ────────────────────────────
// Placed first because advice is what he asked for first. Each card
// carries the number that produced it, so the tip can be argued with
// rather than merely believed.

import { useReveal } from '../../../hooks/useMotion.js'
import { Heading } from '../parts.jsx'

const TONE = {
  alert:  { color: '#EF4444', glyph: '⚠️', label: 'انتبه' },
  nudge:  { color: 'var(--gold)', glyph: '↗️', label: 'اضبط' },
  praise: { color: 'var(--cyan)', glyph: '✅', label: 'أحسنت' },
  info:   { color: 'var(--purple)', glyph: '💡', label: 'ملاحظة' },
}

export default function Tips({ tips = [] }) {
  const [ref, run, active] = useReveal()
  if (!tips.length) return null

  return (
    <section ref={ref} className={`mr-section${active ? '' : ' mr-idle'}`} style={{ marginBottom: 34 }}>
      <Heading run={run} note="مبنية على أرقام شهرك، لا على قوالب عامة">
        نصائح هذا الشهر
      </Heading>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tips.map((t, i) => {
          const tone = TONE[t.severity] || TONE.info
          return (
            <div
              key={t.id}
              className={run ? 'mr-rise mr-shine' : undefined}
              style={{
                '--i': i + 1,
                position: 'relative', overflow: 'hidden',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRight: `3px solid ${tone.color}`,
                borderRadius: 14, padding: 14,
                opacity: run ? undefined : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1.2 }}>{tone.glyph}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexWrap: 'wrap', marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-ar)', fontWeight: 800,
                      fontSize: 15, color: 'var(--text)',
                    }}>{t.title}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: tone.color,
                      background: `${tone.color}1A`, border: `1px solid ${tone.color}44`,
                      borderRadius: 99, padding: '2px 7px', fontFamily: 'var(--font-ar)',
                    }}>{tone.label}</span>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ar)', fontSize: 13,
                    color: 'var(--text2)', lineHeight: 1.6,
                  }}>{t.body}</p>
                  {t.evidence && (
                    <div style={{
                      marginTop: 7, fontSize: 11, color: 'var(--text3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      الدليل: <span style={{ color: tone.color, fontWeight: 700 }}>{t.evidence}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
