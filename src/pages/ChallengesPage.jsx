import { useState } from 'react'
import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import { DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES } from '../constants.js'

export default function ChallengesPage({ sessions, challengeState, onCompleteChallenge, xp }) {
  const [filter, setFilter] = useState('الكل')

  // Resolve challenge IDs to full objects
  const dailyIds  = challengeState?.dailyIds  || []
  const weeklyIds = challengeState?.weeklyIds || []
  const bossId    = challengeState?.bossId

  const dailyChallenges  = dailyIds.map(id => DAILY_CHALLENGE_POOL.find(c => c.id === id)).filter(Boolean)
  const weeklyChallenges = weeklyIds.map(id => WEEKLY_CHALLENGE_POOL.find(c => c.id === id)).filter(Boolean)
  const bossChallenges   = bossId ? [BOSS_CHALLENGES.find(c => c.id === bossId)].filter(Boolean) : []

  const allChallenges = [...dailyChallenges, ...weeklyChallenges, ...bossChallenges]
  const completed     = challengeState?.completed || []
  const completedCount = allChallenges.filter(c => completed.includes(c.id)).length
  const totalCount    = allChallenges.length

  const FILTERS = ['الكل', 'يومي', 'أسبوعي', 'تحدي الزعيم']

  const filteredChallenges = filter === 'الكل' ? allChallenges
    : filter === 'يومي'         ? dailyChallenges
    : filter === 'أسبوعي'       ? weeklyChallenges
    : bossChallenges

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── Header Card ───────────────────────────────────────── */}
      <Card style={{ padding: 12, marginBottom: 8 }} topColor="var(--cyan)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
              تحديات ⚡
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
              أكمل التحديات واكسب XP
            </div>
          </div>
          {/* Progress circle */}
          <ProgressCircle done={completedCount} total={totalCount} />
        </div>
      </Card>

      {/* ── Filter Tabs ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--cyan-lo)' : 'var(--bg2)',
              border: `1px solid ${filter === f ? 'var(--cyan)' : 'var(--border)'}`,
              borderRadius: 20, padding: '6px 16px',
              color: filter === f ? 'var(--cyan)' : 'var(--text3)',
              fontFamily: 'var(--font-ar)', fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >{f}</button>
        ))}
      </div>

      {/* ── Challenge Cards ───────────────────────────────────── */}
      {filteredChallenges.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, color: 'var(--text3)' }}>
            لا توجد تحديات في هذا القسم
          </div>
        </div>
      )}

      {filteredChallenges.map(c => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          sessions={sessions}
          isCompleted={completed.includes(c.id)}
          onComplete={() => onCompleteChallenge(c.id, c.xp)}
        />
      ))}
    </div>
  )
}

// ── Challenge Card ────────────────────────────────────────────
function ChallengeCard({ challenge: c, sessions, isCompleted, onComplete }) {
  const progress = c.check ? c.check(sessions) : 0
  const pct = Math.min(100, (progress / c.target) * 100)
  const isDone = isCompleted || pct >= 100

  const typeConfig = {
    daily: { color: '#22C55E',  icon: '⚡', label: 'يومي',    img: '/assets/challenge_daily.png' },
    weekly:{ color: '#3B9DE8', icon: '📅', label: 'أسبوعي',  img: '/assets/challenge_weekly.png' },
    boss:  { color: '#EF4444', icon: '👹', label: 'الزعيم',  img: '/assets/challenge_boss.png' },
  }
  const cfg = typeConfig[c.type] || typeConfig.daily

  return (
    <Card
      style={{
        padding: 8, marginBottom: 6,
        borderColor: c.type === 'boss' ? 'var(--red-md)' : undefined,
        background: c.type === 'boss' ? 'rgba(239,68,68,0.04)' : undefined,
      }}
      topColor={cfg.color}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', marginBottom: 6 }}>
        {/* Big icon */}
        <img
          src={cfg.img}
          alt={cfg.label}
          style={{
            width: 132, height: 132, objectFit: 'contain',
            filter: isDone ? 'grayscale(1)' : `drop-shadow(0 4px 12px ${cfg.color}60)`,
          }}
        />

        {/* Badges row */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{
            background: cfg.color + '20', color: cfg.color,
            border: `1px solid ${cfg.color}38`,
            borderRadius: 12, padding: '2px 8px',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          }}>{cfg.label}</span>
          {isDone && (
            <span style={{
              background: 'var(--green-lo)', color: 'var(--green)',
              border: '1px solid #22C55E38',
              borderRadius: 12, padding: '2px 8px',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            }}>✓ مكتمل</span>
          )}
          {/* XP Badge */}
          <div style={{
            background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
            borderRadius: 12, padding: '2px 8px',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--gold)', fontWeight: 700,
          }}>
            +{c.xp} XP
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {c.title}
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            {c.desc}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
                {Math.round(progress)} / {c.target}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: cfg.color }}>
                {Math.round(pct)}%
              </span>
            </div>
            <ProgressBar value={progress} max={c.target} color={cfg.color} height={6} />
          </div>
        </div>
      </div>

      {/* Complete button */}
      {!isDone && pct >= 100 && (
        <button
          onClick={onComplete}
          className="btn-cyan"
          style={{ fontSize: 13 }}
        >
          🎉 استلم المكافأة
        </button>
      )}
    </Card>
  )
}

// ── Progress Circle ───────────────────────────────────────────
function ProgressCircle({ done, total }) {
  if (total === 0) return null
  const pct  = done / total
  const R    = 28; const CX = 36; const CY = 36
  const circ = 2 * Math.PI * R

  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border2)" strokeWidth={6} />
      <circle
        cx={CX} cy={CY} r={R} fill="none"
        stroke="var(--cyan)" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={CX} y={CY + 5} textAnchor="middle" fill="var(--text)"
        style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
        {done}/{total}
      </text>
    </svg>
  )
}
