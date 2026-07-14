import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MUSCLE_GROUPS } from '../constants.js'

export default function ExerciseInfoModal({ exercise, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const group = MUSCLE_GROUPS[exercise.muscle] || {}
  const color = group.color || 'var(--cyan)'
  const label = group.label || exercise.muscle
  const emoji = group.emoji || '🏋️'

  const exDef = (group.exercises || []).find(e => e.name === exercise.name) || {}
  const videoUrl    = exDef.videoUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name + ' proper form')}`
  const { animationUrl, tips } = exDef

  const ytId = videoUrl ? (() => {
    const m = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)
    return m ? m[1] : null
  })() : null

  // Portal to body: page containers keep a transform from the enter
  // animation, which would trap position:fixed inside the page.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.80)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: '12px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500,
          background: 'var(--bg2)',
          borderRadius: 20,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: color, flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: '16px 18px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              {exercise.name}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: color + '18', border: `1px solid ${color}40`,
              borderRadius: 20, padding: '3px 10px',
              fontSize: 12, color,
            }}>
              {emoji} {label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '50%', width: 34, height: 34,
              color: 'var(--text3)', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '0 18px 40px', WebkitOverflowScrolling: 'touch' }}>

          {/* Tips — shown first */}
          {tips && tips.length > 0 && (
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 12,
            }}>
              <div style={{
                fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700,
                color: 'var(--text2)', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>⚡</span> نصائح مهمة
              </div>
              {tips.map((tip, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  marginBottom: i < tips.length - 1 ? 8 : 0,
                }}>
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: '50%',
                    background: color + '20', border: `1px solid ${color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    color, flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</span>
                  <span style={{
                    fontFamily: 'var(--font-ar)', fontSize: 13,
                    color: 'var(--text2)', lineHeight: 1.55,
                  }}>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* Compact YouTube link */}
          {(videoUrl || animationUrl) && (
            <a
              href={videoUrl || animationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,0,0,0.25)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 12,
                textDecoration: 'none',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#FF0000', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 0, height: 0,
                  borderTop: '7px solid transparent',
                  borderBottom: '7px solid transparent',
                  borderLeft: '12px solid white',
                  marginRight: -2,
                }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: '#FF4444', marginBottom: 2 }}>
                  شاهد الشرح على YouTube
                </div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
                  {exercise.name}
                </div>
              </div>
            </a>
          )}

          {/* Muscle group info */}
          <div style={{
            background: color + '0D', border: `1px solid ${color}25`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 12,
          }}>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700,
              color, marginBottom: 4,
            }}>
              {emoji} المجموعة العضلية: {label}
            </div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)',
              lineHeight: 1.6,
            }}>
              سجّل وزنك وتكراراتك في كل سيت لمتابعة تقدمك وتجاوز أرقامك القياسية.
            </div>
          </div>

          {/* Coming soon notice */}
          {!animationUrl && (
            <div style={{
              background: 'var(--cyan-lo)', border: '1px solid rgba(94,195,42,0.18)',
              borderRadius: 10, padding: '10px 14px',
              fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)',
              lineHeight: 1.6,
            }}>
              <span style={{ color: 'var(--purple)', fontWeight: 700 }}>🎨 قادماً: </span>
              سيُستبدل بأنيميشن مخصص للتمرين
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
