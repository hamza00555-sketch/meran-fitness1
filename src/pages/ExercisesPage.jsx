import { useState } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import ExerciseInfoModal from '../components/ExerciseInfoModal.jsx'

export default function ExercisesPage() {
  const [openGroup,  setOpenGroup]  = useState(null)
  const [infoEx,     setInfoEx]     = useState(null)
  const [search,     setSearch]     = useState('')

  const query = search.trim().toLowerCase()

  const groups = Object.entries(MUSCLE_GROUPS).map(([key, g]) => ({
    key,
    ...g,
    filtered: (g.exercises || []).filter(e =>
      !query || e.name.toLowerCase().includes(query)
    ),
  })).filter(g => g.filtered.length > 0)

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث عن تمرين..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '11px 14px',
            color: 'var(--text)', fontFamily: 'var(--font-ar)', fontSize: 14,
            outline: 'none',
          }}
          onFocus={e  => e.target.style.borderColor = 'var(--cyan)'}
          onBlur={e   => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Muscle groups */}
      {groups.map(g => {
        const isOpen = openGroup === g.key || !!query

        return (
          <div key={g.key} style={{ marginBottom: 8 }}>
            {/* Group header */}
            <button
              onClick={() => !query && setOpenGroup(isOpen ? null : g.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg2)', border: `1px solid ${g.color}30`,
                borderRadius: isOpen ? '12px 12px 0 0' : 12,
                padding: '12px 14px', cursor: query ? 'default' : 'pointer',
                transition: 'border-radius 0.2s',
              }}
            >
              {g.img
                ? <img src={g.img} style={{ width: 28, height: 28, objectFit: 'contain' }} alt="" />
                : <span style={{ fontSize: 22 }}>{g.emoji}</span>
              }
              <div style={{ flex: 1, textAlign: 'right' }}>
                <span style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, color: g.color }}>
                  {g.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', marginRight: 8 }}>
                  {g.filtered.length} تمرين
                </span>
              </div>
              {!query && (
                <span style={{ color: 'var(--text3)', fontSize: 12, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                  ▼
                </span>
              )}
            </button>

            {/* Exercise list */}
            {isOpen && (
              <div style={{
                background: 'var(--bg2)', borderRadius: '0 0 12px 12px',
                border: `1px solid ${g.color}30`, borderTop: `1px solid var(--border)`,
                overflow: 'hidden',
              }}>
                {g.filtered.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInfoEx({ ...ex, muscle: g.key })}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none',
                      borderBottom: i < g.filtered.length - 1 ? '1px solid var(--border)' : 'none',
                      padding: '11px 14px', cursor: 'pointer', textAlign: 'right',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
                        {ex.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ex.videoUrl && (
                          <span style={{
                            background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.25)',
                            borderRadius: 6, padding: '1px 7px',
                            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#FF4444',
                          }}>▶ YouTube</span>
                        )}
                        {ex.tips?.length > 0 && (
                          <span style={{
                            background: g.color + '15', border: `1px solid ${g.color}35`,
                            borderRadius: 6, padding: '1px 7px',
                            fontFamily: 'var(--font-mono)', fontSize: 10, color: g.color,
                          }}>⚡ {ex.tips.length} نصائح</span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: 14 }}>ℹ</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {infoEx && (
        <ExerciseInfoModal
          exercise={infoEx}
          onClose={() => setInfoEx(null)}
        />
      )}
    </div>
  )
}
