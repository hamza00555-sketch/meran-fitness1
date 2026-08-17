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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                borderRadius: 14, padding: 16,
                opacity: run ? undefined : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* The left border colour + this glyph already say how
                    serious the tip is. A second, text badge repeated
                    the same signal a third time and was what wrapped
                    onto its own line on a narrow phone. */}
                <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{tone.glyph}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-ar)', fontWeight: 800,
                    fontSize: 14, color: 'var(--text)', marginBottom: 5,
                  }}>{t.title}</div>
                  <p style={{
                    fontFamily: 'var(--font-ar)', fontSize: 13,
                    color: 'var(--text2)', lineHeight: 1.65,
                  }}>{t.body}</p>
                  {t.evidence && (
                    <div style={{
                      marginTop: 8, fontSize: 11, color: 'var(--text3)',
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
