import { MUSCLE_GROUPS } from '../constants.js'

export default function ExerciseInfoModal({ exercise, onClose }) {
  const group   = MUSCLE_GROUPS[exercise.muscle] || {}
  const color   = group.color || 'var(--cyan)'
  const label   = group.label || exercise.muscle
  const emoji   = group.emoji || '🏋️'

  // Find video/animation meta from constants
  const exDef = (group.exercises || []).find(e => e.name === exercise.name) || {}
  const { videoUrl, animationUrl } = exDef

  // Extract YouTube video ID for thumbnail
  const ytId = videoUrl ? (() => {
    const m = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)
    return m ? m[1] : null
  })() : null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg2)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          overflow: 'hidden',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Color bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, transparent)`, flexShrink: 0 }} />

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
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: color + '20', border: `1px solid ${color}50`,
              borderRadius: 20, padding: '3px 10px',
              fontSize: 12, color,
            }}>
              {emoji} {label}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '50%', width: 32, height: 32,
              color: 'var(--text3)', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '0 18px 32px', WebkitOverflowScrolling: 'touch' }}>

          {/* Video / Animation Section */}
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden', marginBottom: 16,
          }}>
            {animationUrl ? (
              /* Future: user-provided animation */
              <div style={{ position: 'relative', aspectRatio: '16/9' }}>
                {animationUrl.match(/\.(mp4|webm)$/i) ? (
                  <video
                    src={animationUrl} autoPlay loop muted playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : animationUrl.match(/\.gif$/i) ? (
                  <img src={animationUrl} alt={exercise.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '16/9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ fontSize: 32 }}>🎬</div>
                    <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
                      الأنيميشن
                    </div>
                  </div>
                )}
              </div>
            ) : ytId ? (
              /* YouTube: show thumbnail + open button */
              <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', position: 'relative', textDecoration: 'none' }}>
                <img
                  src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt={exercise.name}
                  style={{ width: '100%', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.35)',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 0, height: 0,
                      borderTop: '11px solid transparent',
                      borderBottom: '11px solid transparent',
                      borderLeft: '18px solid white',
                      marginRight: -3,
                    }} />
                  </div>
                </div>
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,0.7)', borderRadius: 6,
                  padding: '3px 8px', fontFamily: 'var(--font-ar)',
                  fontSize: 11, color: 'white',
                }}>
                  افتح على YouTube
                </div>
              </a>
            ) : (
              /* Placeholder — no video yet */
              <div style={{
                aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 36 }}>🎬</div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
                  لا يوجد فيديو بعد<br/>
                  <span style={{ fontSize: 11 }}>سيُضاف لاحقاً</span>
                </div>
              </div>
            )}
          </div>

          {/* Source label */}
          {(videoUrl || animationUrl) && (
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)',
              textAlign: 'center', marginBottom: 16,
            }}>
              {animationUrl ? '🎬 أنيميشن مخصص' : '▶ فيديو من YouTube — اضغط للمشاهدة'}
            </div>
          )}

          {/* Animation placeholder notice */}
          {!animationUrl && (
            <div style={{
              background: 'rgba(155,89,182,0.08)', border: '1px solid rgba(155,89,182,0.25)',
              borderRadius: 10, padding: '10px 14px',
              fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)',
              lineHeight: 1.6, marginBottom: 4,
            }}>
              <span style={{ color: 'var(--purple)', fontWeight: 700 }}>🎨 قادماً: </span>
              سيُستبدل الفيديو بأنيميشن مخصص للتمرين
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
