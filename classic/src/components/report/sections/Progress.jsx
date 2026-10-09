// ── Section 5: where it left you ──────────────────────────────
// Rank, level, and the achievements that actually unlocked inside this
// month — read from unlockedAt, so it is the month they were earned in
// and not merely the ones held.

import Art from '../../../assets/Art.jsx'
import { achSlot } from '../../../assets/slots.js'
import { RARITY_COLORS } from '../../../constants.js'
import { useReveal } from '../../../hooks/useMotion.js'
import { Heading, AR } from '../parts.jsx'

export default function Progress({ report }) {
  const [ref, run, active] = useReveal()
  const { level, rank, achievements } = report.progress

  return (
    <section ref={ref} className={`mr-section${active ? '' : ' mr-idle'}`} style={{ marginBottom: 34 }}>
      <Heading run={run} note="رتبتك ومستواك في نهاية الشهر">
        التقدم والإنجازات
      </Heading>

      <div
        className={run ? 'mr-rise mr-shine' : undefined}
        style={{
          '--i': 1, position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', gap: 14,
          background: `linear-gradient(100deg, ${rank?.color || 'var(--cyan)'}1A, var(--bg2))`,
          border: `1px solid ${rank?.color || 'var(--border)'}55`,
          borderRadius: 16, padding: 16, marginBottom: 14,
          opacity: run ? undefined : 0,
        }}
      >
        <div style={{
          width: 62, height: 62, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${rank?.color || 'var(--cyan)'}22`,
          border: `2px solid ${rank?.color || 'var(--cyan)'}`,
          boxShadow: `0 0 16px ${rank?.color || 'var(--cyan)'}55`,
          fontSize: 24, fontWeight: 900, color: rank?.color || 'var(--cyan)',
        }}>
          {rank?.tier || '★'}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ar)' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>
            {rank?.label || 'مبتدئ'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            المستوى {AR(level)}
          </div>
        </div>
      </div>

      {achievements.length > 0 ? (
        <>
          <div
            className={run ? 'mr-rise' : undefined}
            style={{
              '--i': 2, fontFamily: 'var(--font-ar)', fontWeight: 800,
              fontSize: 14, color: 'var(--text)', marginBottom: 10,
              opacity: run ? undefined : 0,
            }}
          >
            {achievements.length === 1
              ? 'إنجاز فتحته هذا الشهر'
              : `${AR(achievements.length)} إنجازات فتحتها هذا الشهر`}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 10,
          }}>
            {achievements.map((a, i) => {
              const color = RARITY_COLORS[a.rarity]?.color || 'var(--cyan)'
              return (
                <div
                  key={a.id}
                  className={run ? 'mr-fly' : undefined}
                  style={{
                    '--i': i, '--fy': '30px', '--fr': i % 2 ? '5deg' : '-5deg',
                    background: 'var(--bg2)',
                    border: `1px solid ${color}55`,
                    borderRadius: 14, padding: '12px 8px', textAlign: 'center',
                    opacity: run ? undefined : 0,
                  }}
                >
                  <Art
                    id={achSlot(a.id)}
                    size={44}
                    alt=""
                    fallback={<span style={{ fontSize: 32, lineHeight: 1 }}>{a.icon}</span>}
                  />
                  <div style={{
                    fontFamily: 'var(--font-ar)', fontSize: 11, fontWeight: 700,
                    color: 'var(--text2)', marginTop: 6, lineHeight: 1.3,
                  }}>{a.title}</div>
                  <div style={{
                    fontSize: 10, color, marginTop: 3, fontWeight: 700,
                  }}>+{AR(a.xp)} XP</div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div
          className={run ? 'mr-rise' : undefined}
          style={{
            '--i': 2, textAlign: 'center', padding: '18px 12px',
            background: 'var(--bg2)', border: '1px dashed var(--border2)',
            borderRadius: 14, fontFamily: 'var(--font-ar)',
            fontSize: 12, color: 'var(--text3)',
            opacity: run ? undefined : 0,
          }}
        >
          لم يُفتح إنجاز جديد هذا الشهر — الإنجازات القادمة تحتاج وقتاً أطول قليلاً.
        </div>
      )}
    </section>
  )
}
