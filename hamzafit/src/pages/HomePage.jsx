import { Card, Btn, StatBox, Badge } from '../components/ui.jsx'
import CalendarHeatmap from '../components/CalendarHeatmap.jsx'
import { calcStreak, fmtDate, sessionVolume, toAr } from '../utils.js'
import { MUSCLE_GROUPS } from '../constants.js'

export default function HomePage({ sessions, active, greeting, onNewSession, onShowRoutines, onShowAI, onGoToToday }) {
  const streak = calcStreak(sessions)
  const thisWeek = sessions.filter(s => (Date.now() - new Date(s.date)) < 7 * 86400000).length
  const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0)
  const lastSession = sessions[0]

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Hero greeting */}
      <div style={{
        background: 'linear-gradient(135deg,#160a04,var(--bg2))',
        border: '1px solid #FF6B3520',
        borderRadius: 16, padding: '22px 20px', marginBottom: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow blob */}
        <div style={{
          position: 'absolute', top: -30, left: -30,
          width: 160, height: 160,
          background: '#FF6B3510',
          borderRadius: '50%', filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: 3, color: 'var(--text4)', marginBottom: 8,
          }}>HAMZAFIT · WORKOUT TRACKER</div>

          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 22,
            fontWeight: 900, lineHeight: 1.3, marginBottom: 12,
          }}>{greeting}</div>

          {streak > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge color="var(--orange)">🔥 يومك الـ {toAr(streak)} على التوالي</Badge>
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
              ابدأ جلسة اليوم لتبدأ streak 🔥
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {sessions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <StatBox label="إجمالي الجلسات" value={sessions.length} color="var(--orange)" />
          <StatBox label="هذا الأسبوع" value={thisWeek} color="var(--green)" />
          <StatBox
            label="الحجم (طن)"
            value={`${(totalVol / 1000).toFixed(1)}`}
            color="var(--gold)"
          />
        </div>
      )}

      {/* Active session banner */}
      {active && (
        <div style={{
          background: 'var(--orange-lo)',
          border: '1px solid var(--orange-md)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, color: 'var(--orange)' }}>
              <span className="pulse-dot" style={{ display: 'inline-block', marginLeft: 6, fontSize: 10 }}>●</span>
              جلسة نشطة
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text4)', marginTop: 3 }}>
              {active.exercises.length} تمرين · {Math.round((Date.now() - active.id) / 60000)} دقيقة
            </div>
          </div>
          <Btn onClick={onGoToToday} style={{ fontSize: 13, padding: '8px 16px' }}>
            متابعة ←
          </Btn>
        </div>
      )}

      {/* Calendar heatmap */}
      {sessions.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 12 }}>
            📅 نشاطك — ١٤ أسبوع أخير
          </div>
          <CalendarHeatmap sessions={sessions} />
        </Card>
      )}

      {/* Last session preview */}
      {lastSession && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
            آخر جلسة
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            {fmtDate(lastSession.date)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[...new Set(lastSession.exercises.map(e => e.muscle))].map(m => (
              <Badge key={m} color={MUSCLE_GROUPS[m]?.color || 'var(--orange)'}>
                {MUSCLE_GROUPS[m]?.emoji} {m}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* CTA Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!active ? (
          <>
            <Btn onClick={onNewSession} full style={{ padding: 15, fontSize: 16 }}>
              🚀 جلسة جديدة
            </Btn>
            <Btn onClick={onShowRoutines} variant="secondary" full style={{ padding: 13, fontSize: 15 }}>
              📋 ابدأ بروتين جاهز
            </Btn>
          </>
        ) : (
          <Btn onClick={onGoToToday} full style={{ padding: 15, fontSize: 16 }}>
            🔥 متابعة الجلسة
          </Btn>
        )}
        <Btn onClick={onShowAI} variant="gold" full style={{ padding: 13, fontSize: 15 }}>
          🤖 ساعدني بالـ AI
        </Btn>
      </div>
    </div>
  )
}
