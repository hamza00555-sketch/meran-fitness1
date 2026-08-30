// ── Day Preview bottom sheet ──────────────────────────────────
// The tappable preview of a plan day: every exercise with its muscle,
// last/best weights, swap cycling and YouTube link, plus start/skip.
// Lived inside HomePage until the Today hero needed it too.

import { createPortal } from 'react-dom'
import { MUSCLE_GROUPS, EXERCISE_ALTERNATIVES } from '../constants.js'
import { substitutedName, nextSubIndex, getExerciseStats } from '../utils.js'

export function findVideoUrl(name) {
  for (const group of Object.values(MUSCLE_GROUPS)) {
    const ex = group.exercises?.find(e => e.name === name)
    if (ex?.videoUrl) return ex.videoUrl
  }
  return null
}

// ── Day Preview bottom sheet ──────────────────────────────────────────
export default function DayPreviewSheet({ day, sessions, exerciseMapping, exerciseSubs = {}, onCycleSub, onStart, onSkip, onClose }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 750,
        background: 'rgba(0,0,0,0.68)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg2)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid var(--border2)',
          borderBottom: 'none',
          maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '14px 20px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 3 }}>
            تمارين اليوم
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>
            {day.name}
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {day.exercises.map((ex, i) => {
            const muscle   = MUSCLE_GROUPS[ex.muscle]
            const shownName = substitutedName(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES)
            const swapped   = shownName !== ex.name
            const alts      = EXERCISE_ALTERNATIVES[ex.name] || []
            const subIdx    = exerciseSubs[ex.name] || 0
            const videoUrl = findVideoUrl(shownName)
            const { lastWeight, maxWeight } = getExerciseStats(sessions, shownName, exerciseMapping)
            const color = muscle?.color || '#5EC32A'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px',
                borderBottom: i < day.exercises.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Muscle emoji box */}
                <div style={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: 12,
                  background: color + '1A',
                  border: `1px solid ${color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>{muscle?.emoji || '💪'}</div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                    color: swapped ? 'var(--gold)' : 'var(--text)', marginBottom: 4,
                    lineHeight: 1.35, overflowWrap: 'anywhere',
                  }}>{swapped && '⇄ '}{shownName}</div>

                  {swapped && (
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)',
                      marginBottom: 4, lineHeight: 1.35, overflowWrap: 'anywhere',
                    }}>بدلاً من {ex.name}</div>
                  )}

                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Muscle label tag */}
                    <span style={{
                      background: color + '1A', border: `1px solid ${color}40`,
                      borderRadius: 20, padding: '2px 10px',
                      fontFamily: 'var(--font-ar)', fontSize: 13, color, fontWeight: 700,
                    }}>{muscle?.label || ex.muscle}</span>

                    {/* Sets */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
                      ×{ex.sets || 3} سيت
                    </span>

                    {/* Weight history */}
                    {lastWeight != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
                        آخر <span style={{ color: 'var(--text2)' }}>{lastWeight}kg</span>
                        {maxWeight != null && maxWeight !== lastWeight && (
                          <> · <span style={{ color: 'var(--gold)' }}>🏆{maxWeight}kg</span></>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Swap exercise (machine unavailable) */}
                {alts.length > 0 && (
                  <button
                    onClick={() => onCycleSub?.(ex.name, nextSubIndex(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES))}
                    title={subIdx < alts.length ? `التالي: ${alts[subIdx]}` : 'رجوع للتمرين الأصلي'}
                    style={{
                      flexShrink: 0, height: 36, borderRadius: 10, padding: '0 10px',
                      background: swapped ? 'var(--gold-lo)' : 'var(--bg3)',
                      border: `1px solid ${swapped ? 'var(--gold-md)' : 'var(--border2)'}`,
                      color: swapped ? 'var(--gold)' : 'var(--text3)',
                      display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>⇄</span>
                    {swapped ? `${subIdx}/${alts.length}` : 'استبدال'}
                  </button>
                )}

                {/* YouTube button */}
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.28)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textDecoration: 'none', fontSize: 16,
                    }}
                  >▶️</a>
                )}
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{ padding: '12px 20px calc(var(--safe-bottom) + 12px)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onStart} style={{
              flex: 1, padding: '14px',
              background: 'var(--grad-primary)', border: 'none', borderRadius: 14,
              color: 'white', fontFamily: 'var(--font-ar)', fontWeight: 800, fontSize: 16,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(var(--cyan-rgb),0.35)',
            }}>⚡ ابدأ التمرين</button>
            <button onClick={onSkip} style={{
              padding: '14px 16px',
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 14, color: 'var(--text3)',
              fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
            }}>⏭️ تخطي</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
