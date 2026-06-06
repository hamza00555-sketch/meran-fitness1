import { useState } from 'react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { ACHIEVEMENTS, ACHIEVEMENT_CATS, RARITY_COLORS } from '../constants.js'
import { calcStreak } from '../utils.js'

export default function AchievementsPage({ sessions, xp, streak, unlockedAchievements, level }) {
  const [catFilter, setCatFilter] = useState('all')

  const unlocked = unlockedAchievements || []

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

      {/* ── Header ──────────────────────────────────────────────── */}
      <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)' }} topColor="var(--gold)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 20, fontWeight: 900, marginBottom: 3 }}>
              جوائز 🏆
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
              أنجازاتك ومكافآتك
            </div>
          </div>
          <AchievCircle done={unlockedCount} total={40} />
        </div>
      </Card>

      {/* ── Category Tabs ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {ACHIEVEMENT_CATS.map(cat => {
          const isActive = catFilter === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              className="ap-tab"
              style={{
                background: isActive ? 'var(--gold-lo)' : 'var(--bg2)',
                borderColor: isActive ? 'var(--gold)' : 'var(--border)',
                color: isActive ? 'var(--gold)' : 'var(--text3)',
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* ── Achievement Cards ────────────────────────────────────
          Horizontal: text RIGHT (RTL-first) · icon LEFT           */}

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

// Map achievement category/rarity → illustration image
function getAchImg(a) {
  if (a.rarity === 'legendary' || a.rarity === 'epic') return '/assets/ach_master.png'
  const map = { sessions: '/assets/ach_consistency.png', streak: '/assets/ach_consistency.png', strength: '/assets/ach_strength.png', volume: '/assets/ach_volume.png' }
  return map[a.cat] || '/assets/ach_consistency.png'
}

// ── Achievement Card ──────────────────────────────────────────
function AchievCard({ achievement: a, isUnlocked, rarity }) {
  return (
    <Card
      style={{
        padding: 0,
        marginBottom: 'var(--hp-card-mb)',
        opacity: isUnlocked ? 1 : 0.55,
        borderColor: isUnlocked ? rarity.color + '40' : undefined,
        background: isUnlocked ? rarity.color + '07' : undefined,
        transition: 'all 0.3s',
      }}
      topColor={isUnlocked ? rarity.color : undefined}
    >
      {/* ── Inner horizontal row ── */}
      <div className="ap-row">

        {/* TEXT SIDE — right in RTL (first child) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{
              background: rarity.color + '20', color: rarity.color,
              border: `1px solid ${rarity.color}38`,
              borderRadius: 10, padding: '2px 8px',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            }}>{rarity.label}</span>
            {isUnlocked && (
              <span style={{
                background: 'var(--green-lo)', color: 'var(--green)',
                border: '1px solid #22C55E38',
                borderRadius: 10, padding: '2px 8px',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              }}>✓ محقق</span>
            )}
          </div>

          <div className="ap-title" style={{
            fontFamily: 'var(--font-ar)',
            color: isUnlocked ? 'var(--text)' : 'var(--text3)',
            marginBottom: 3,
          }}>{a.title}</div>

          <div className="ap-sub" style={{ fontFamily: 'var(--font-ar)', marginBottom: 7 }}>
            {a.desc}
          </div>

          <div style={{
            display: 'inline-block',
            background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
            borderRadius: 8, padding: '2px 8px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gold)', fontWeight: 700,
          }}>+{a.xp} XP</div>
        </div>

        {/* ICON SIDE — left in RTL (second child) */}
        <div className="ap-icon" style={{
          background: isUnlocked ? rarity.color + '18' : 'var(--bg3)',
          border: `2px solid ${isUnlocked ? rarity.color + '50' : 'var(--border)'}`,
          filter: isUnlocked ? `drop-shadow(0 0 10px ${rarity.color}80)` : 'none',
          boxShadow: isUnlocked ? `0 4px 18px ${rarity.color}20` : 'none',
          position: 'relative', overflow: 'visible',
        }}>
          {isUnlocked
            ? <span style={{ fontSize: 'clamp(30px,8vw,44px)' }}>{a.icon}</span>
            : (
              <>
                <img
                  src={getAchImg(a)}
                  alt=""
                  style={{ width: '78%', height: '78%', objectFit: 'contain', filter: 'grayscale(1)', opacity: 0.35 }}
                />
                <div style={{
                  position: 'absolute', bottom: -4, right: -4,
                  fontSize: 15, lineHeight: 1,
                  background: 'var(--bg2)', border: '1px solid var(--border2)',
                  borderRadius: '50%', width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>🔒</div>
              </>
            )
          }
        </div>

      </div>
    </Card>
  )
}

// ── Achievement Circle ────────────────────────────────────────
function AchievCircle({ done, total }) {
  const pct  = total > 0 ? done / total : 0
  const R    = 24; const CX = 30; const CY = 30
  const circ = 2 * Math.PI * R

  return (
    <svg width={60} height={60} viewBox="0 0 60 60">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border2)" strokeWidth={5} />
      <circle
        cx={CX} cy={CY} r={R} fill="none"
        stroke="var(--gold)" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={CX} y={CY + 4} textAnchor="middle" fill="var(--gold)"
        style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700 }}>
        {done}/{total}
      </text>
    </svg>
  )
}
