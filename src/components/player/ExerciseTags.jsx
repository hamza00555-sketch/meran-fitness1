import { Badge } from '../ui.jsx'
import { equipLabel } from '../../exerciseMedia.js'

// ── The exercise's tag row, shared ────────────────────────────
//
// Every chip the old ExerciseCard grew over time, in one component the
// card and the player both render: the muscle badge, the single
// progression hint, YouTube, the last/best weights, and the raise
// nudge. Extracted rather than rewritten so the two surfaces can never
// drift apart on what an exercise says about itself. One addition: the
// equipment chip from the media map, which the reference design shows.

const HINTS = {
  raise: { text: '⬆️ ارفع وزنك', color: 'var(--gold)', bg: 'var(--gold-lo)', glow: 'rgba(245,158,11,0.55)' },
  lower: { text: '⬇️ خفف الوزن', color: 'var(--red)', bg: 'rgba(239,68,68,0.12)', glow: 'rgba(239,68,68,0.5)' },
  push:  { text: '💪 اطلع لأعلى المدى', color: 'var(--cyan)', bg: 'var(--cyan-lo)', glow: 'var(--cyan-glow)' },
}

export default function ExerciseTags({
  ex, color, label, emoji, ytUrl,
  progression = null, lastWeight = null, maxWeight = null,
  isComplete = false, deloadPct = 0,
}) {
  const hint = progression?.hint ? HINTS[progression.hint] : null
  const equip = equipLabel(ex.name)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Badge color={color}>{emoji} {label}</Badge>

      {equip && (
        <span style={{
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          borderRadius: 20, padding: '2px 10px',
          fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text2)', fontWeight: 700,
        }}>{equip}</span>
      )}

      {hint && (
        <span className="tag-pulse" style={{
          '--tag-glow': hint.glow,
          background: hint.bg, color: hint.color,
          border: `1px solid ${hint.color}50`,
          borderRadius: 20, padding: '2px 10px',
          fontFamily: 'var(--font-ar)', fontSize: 11, fontWeight: 800,
        }}>{hint.text}</span>
      )}

      {ytUrl && (
        <a href={ytUrl} target="_blank" rel="noopener noreferrer" style={{
          background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.3)',
          borderRadius: 20, padding: '2px 10px', textDecoration: 'none',
          fontFamily: 'var(--font-ar)', fontSize: 11, color: '#FF6B6B', fontWeight: 700,
        }}>▶ يوتيوب</a>
      )}

      {lastWeight != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
          آخر <b style={{ color: 'var(--text2)' }}>{lastWeight}kg</b>
          {maxWeight != null && <> · أعلى <b style={{ color: 'var(--gold)' }}>{maxWeight}kg</b></>}
        </span>
      )}

      {isComplete && !deloadPct && (
        <span style={{
          background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
          borderRadius: 20, padding: '2px 10px',
          fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--gold)', fontWeight: 700,
        }}>⬆️ جرب ارفع الوزن المرة الجاية</span>
      )}
    </div>
  )
}
