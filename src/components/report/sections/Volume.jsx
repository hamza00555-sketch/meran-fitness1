// ── Section 2: what you moved ─────────────────────────────────
// The month's tonnage as the headline, then the figures behind it, then
// every weight that beat a previous best. Records get the app's own
// celebration vocabulary, because that is what they are.

import { useReveal } from '../../../hooks/useMotion.js'
import { Heading, Hero, Tile, AR } from '../parts.jsx'

export default function Volume({ report }) {
  const [ref, run, active] = useReveal()
  const { volume, sets, reps, time, prs, sessionCount } = report

  const trend = volume.trendPct
  const trendColor = trend === null ? 'var(--text3)' : trend >= 0 ? 'var(--cyan)' : '#EF4444'

  return (
    <section ref={ref} className={`mr-section${active ? '' : ' mr-idle'}`} style={{ marginBottom: 34 }}>
      <Heading run={run} note="مجموع ما رفعته: الوزن × التكرارات، لكل مجموعة">
        الحجم والأرقام
      </Heading>

      <Hero
        value={volume.total}
        run={run}
        unit="كيلوغرام هذا الشهر"
        caption={
          trend === null
            ? `بمعدل ${AR(volume.perSession)} كجم لكل جلسة`
            : `${trend >= 0 ? '▲' : '▼'} ٪${Math.abs(trend)} عن الشهر السابق (${AR(volume.prevTotal)} كجم)`
        }
      />

      {trend !== null && (
        <div
          className={run ? 'mr-rise' : undefined}
          style={{
            '--i': 1, textAlign: 'center', marginBottom: 14,
            opacity: run ? undefined : 0,
          }}
        >
          <span style={{
            display: 'inline-block', fontFamily: 'var(--font-ar)', fontSize: 12,
            color: trendColor, background: `${trendColor}14`,
            border: `1px solid ${trendColor}40`, borderRadius: 99, padding: '4px 12px',
          }}>
            {trend >= 0 ? 'ارتفاع' : 'انخفاض'} عن {AR(volume.prevTotal)} كجم
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <Tile value={sessionCount} label="جلسة" run={run} i={2} color="var(--cyan)" />
        <Tile value={sets.completed} label="مجموعة مكتملة" run={run} i={3} />
        <Tile value={reps.total} label="تكرار" run={run} i={4} />
      </div>

      {/* The averages are only shown when the month actually recorded
          durations — an imported session has no length to average. */}
      {time.known && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
          <Tile value={time.totalMinutes} label="دقيقة في الجيم" run={run} i={5} color="var(--purple)" />
          <Tile value={time.avgMinutes} label="متوسط الجلسة (د)" run={run} i={6} color="var(--purple)" />
        </div>
      )}

      {sets.untrackedPct > 0 && (
        <div
          className={run ? 'mr-rise' : undefined}
          style={{
            '--i': 7, fontSize: 11, color: 'var(--text3)',
            fontFamily: 'var(--font-ar)', textAlign: 'center', marginTop: 4,
            opacity: run ? undefined : 0,
          }}
        >
          ٪{sets.untrackedPct} من مجموعاتك بلا علامة إكمال ولم تُحتسب في التكرارات
        </div>
      )}

      {/* ── Records ── */}
      {prs.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div
            className={run ? 'mr-rise' : undefined}
            style={{
              '--i': 8, fontFamily: 'var(--font-ar)', fontWeight: 800,
              fontSize: 15, color: 'var(--gold)', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 7,
              opacity: run ? undefined : 0,
            }}
          >
            <span style={{ fontSize: 18 }}>🏆</span>
            {prs.length === 1 ? 'رقم قياسي جديد' : `${AR(prs.length)} أرقام قياسية جديدة`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prs.slice(0, 6).map((pr, i) => (
              <div
                key={`${pr.exercise}-${pr.date}`}
                className={run ? 'mr-fly mr-shine' : undefined}
                style={{
                  '--i': i, '--fy': '26px', '--fr': i % 2 ? '3deg' : '-3deg',
                  position: 'relative', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'linear-gradient(90deg, var(--gold-lo), var(--bg2))',
                  border: '1px solid var(--gold-md)',
                  borderRadius: 12, padding: '10px 12px',
                  opacity: run ? undefined : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-ar)', fontWeight: 700, fontSize: 13,
                    color: 'var(--text)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{pr.exercise}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    من {AR(pr.prevBest)} كجم
                    {pr.steps > 1 ? ` على ${AR(pr.steps)} جلسات` : ''}
                    {' · +'}{AR(Math.round((pr.weight - pr.prevBest) * 10) / 10)} كجم
                  </div>
                </div>
                <div style={{
                  fontSize: 19, fontWeight: 900, color: 'var(--gold)',
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}>
                  {AR(pr.weight)} <span style={{ fontSize: 11 }}>كجم</span>
                </div>
              </div>
            ))}
          </div>

          {prs.length > 6 && (
            <div style={{
              fontSize: 11, color: 'var(--text3)', textAlign: 'center',
              marginTop: 8, fontFamily: 'var(--font-ar)',
            }}>
              و{AR(prs.length - 6)} غيرها
            </div>
          )}
        </div>
      )}
    </section>
  )
}
