import { MUSCLE_GROUPS } from '../constants.js'

export default function ExerciseInfoModal({ exercise, onClose }) {
  const group = MUSCLE_GROUPS[exercise.muscle] || {}
  const color = group.color || 'var(--cyan)'
  const label = group.label || exercise.muscle
  const emoji = group.emoji || '🏋️'

  const exDef = (group.exercises || []).find(e => e.name === exercise.name) || {}
  const { videoUrl, animationUrl, tips } = exDef

  const ytId = videoUrl ? (() => {
    const m = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)
    return m ? m[1] : null
  })() : null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.80)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
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

          {/* Video / Animation */}
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden', marginBottom: 14,
          }}>
            {animationUrl ? (
              <div style={{ position: 'relative', aspectRatio: '16/9' }}>
                {animationUrl.match(/\.(mp4|webm)$/i) ? (
                  <video
                    src={animationUrl} autoPlay loop muted playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img src={animationUrl} alt={exercise.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            ) : ytId ? (
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
                  background: 'rgba(0,0,0,0.32)',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: '#FF0000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                }}>افتح على YouTube</div>
              </a>
            ) : (
              <div style={{
                aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 36 }}>🎬</div>
                <div style={{
                  fontFamily: 'var(--font-ar)', fontSize: 13,
                  color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6,
                }}>
                  لا يوجد فيديو بعد<br/>
                  <span style={{ fontSize: 11 }}>سيُضاف لاحقاً</span>
                </div>
              </div>
            )}
          </div>

          {/* Tips */}
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
              background: 'rgba(155,92,255,0.06)', border: '1px solid rgba(155,92,255,0.20)',
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
    </div>
  )
}
