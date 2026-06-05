import { useState } from 'react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { ACHIEVEMENTS, ACHIEVEMENT_CATS, RARITY_COLORS } from '../constants.js'
import { calcStreak } from '../utils.js'

export default function AchievementsPage({ sessions, xp, streak, unlockedAchievements, level }) {
  const [catFilter, setCatFilter] = useState('all')

  const unlocked = unlockedAchievements || []

  // Check which achievements are currently satisfied
  const satisfiedIds = new Set(
    ACHIEVEMENTS.filter(a => {
      try { return a.check(sessions, xp, streak) } catch { return false }
    }).map(a => a.id)
  )

  const filtered = catFilter === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(a => a.cat === catFilter)

  const unlockedCount = ACHIEVEMENTS.filter(a => unlocked.includes(a.id) || satisfiedIds.has(a.id)).length

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 14 }} topColor="var(--gold)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
              جوائز 🏆
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
              أنجازاتك ومكافآتك
            </div>
          </div>
          {/* Circle */}
          <AchievCircle done={unlockedCount} total={40} />
        </div>
      </Card>

      {/* ── Category Filter ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {ACHIEVEMENT_CATS.map(cat => {
          const CAT_IMGS = {
            sessions: '/assets/ach_consistency.png',
            strength: '/assets/ach_strength.png',
            streak:   '/assets/ach_master.png',
            volume:   '/assets/ach_volume.png',
          }
          const catImg = CAT_IMGS[cat.id]
          return (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              style={{
                background: catFilter === cat.id ? 'var(--gold-lo)' : 'var(--bg2)',
                border: `1px solid ${catFilter === cat.id ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 20, padding: '6px 16px',
                color: catFilter === cat.id ? 'var(--gold)' : 'var(--text3)',
                fontFamily: 'var(--font-ar)', fontSize: 13,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {catImg && (
                <img src={catImg} alt="" style={{ width: 108, height: 108, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }} />
              )}
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* ── Achievement Cards ─────────────────────────────────── */}
      {filtered.map(a => {
        const isUnlocked = unlocked.includes(a.id) || satisfiedIds.has(a.id)
        const rarity     = RARITY_COLORS[a.rarity] || RARITY_COLORS.common
        return (
          <AchievCard
            key={a.id}
            achievement={a}
            isUnlocked={isUnlocked}
            rarity={rarity}
          />
        )
      })}
    </div>
  )
}

// ── Achievement Card ──────────────────────────────────────────
function AchievCard({ achievement: a, isUnlocked, rarity }) {
  return (
    <Card
      style={{
        padding: 14, marginBottom: 10,
        opacity: isUnlocked ? 1 : 0.55,
        borderColor: isUnlocked ? rarity.color + '40' : undefined,
        background: isUnlocked ? rarity.color + '08' : undefined,
        transition: 'all 0.3s',
      }}
      topColor={isUnlocked ? rarity.color : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        {/* Big Icon */}
        <div style={{
          width: 144, height: 144, borderRadius: 28, flexShrink: 0,
          background: isUnlocked ? rarity.color + '18' : 'var(--bg3)',
          border: `2px solid ${isUnlocked ? rarity.color + '50' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 72,
          filter: isUnlocked ? `drop-shadow(0 0 16px ${rarity.color})` : 'none',
          boxShadow: isUnlocked ? `0 4px 24px ${rarity.color}20` : 'none',
        }}>
          {isUnlocked ? a.icon : '🔒'}
        </div>

        {/* Content */}
        <div style={{ width: '100%' }}>
          {/* Rarity badge */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <span style={{
              background: rarity.color + '20', color: rarity.color,
              border: `1px solid ${rarity.color}38`,
              borderRadius: 12, padding: '2px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            }}>{rarity.label}</span>
            {isUnlocked && (
              <span style={{
                background: 'var(--green-lo)', color: 'var(--green)',
                border: '1px solid #22C55E38',
                borderRadius: 12, padding: '2px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              }}>✓ محقق</span>
            )}
          </div>

          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700,
            color: isUnlocked ? 'var(--text)' : 'var(--text3)', marginBottom: 4,
          }}>
            {a.title}
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
            {a.desc}
          </div>
        </div>

        {/* XP reward */}
        <div style={{
          background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
          borderRadius: 10, padding: '4px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--gold)', fontWeight: 700,
          flexShrink: 0,
        }}>
          +{a.xp} XP
        </div>
      </div>
    </Card>
  )
}

// ── Achievement Circle ────────────────────────────────────────
function AchievCircle({ done, total }) {
  const pct  = total > 0 ? done / total : 0
  const R    = 28; const CX = 36; const CY = 36
  const circ = 2 * Math.PI * R

  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border2)" strokeWidth={6} />
      <circle
        cx={CX} cy={CY} r={R} fill="none"
        stroke="var(--gold)" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={CX} y={CY + 5} textAnchor="middle" fill="var(--gold)"
        style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
        {done}/{total}
      </text>
    </svg>
  )
}
