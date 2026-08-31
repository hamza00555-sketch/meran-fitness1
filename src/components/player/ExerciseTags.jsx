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

const statChip = {
  display: 'inline-flex', alignItems: 'baseline', gap: 5,
  background: 'var(--bg3)', border: '1px solid var(--border2)',
  borderRadius: 20, padding: '2px 10px',
}
const statLabel = { fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)' }
const statValue = {
  fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
}

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

      {/* The mark alone. Everyone already knows what it means, and the
          word beside it was spending a chip's width to say so. The
          link keeps padding around the glyph so the tap target stays
          bigger than the 22px it draws. */}
      {ytUrl && (
        <a
          href={ytUrl} target="_blank" rel="noopener noreferrer"
          aria-label="شاهد الأداء الصحيح على يوتيوب" title="يوتيوب"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '3px 6px', borderRadius: 8, textDecoration: 'none', flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="#FF0000"
              d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
            />
            <path fill="#fff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>
      )}

      {/* Last and best: the two numbers you actually look at mid-set.
          They were 10px muted text run together with their labels; now
          the label is small and the weight is the size it deserves. */}
      {lastWeight != null && (
        <span style={statChip}>
          <span style={statLabel}>آخر</span>
          <b style={{ ...statValue, color: 'var(--text)' }}>{lastWeight}kg</b>
        </span>
      )}
      {lastWeight != null && maxWeight != null && (
        <span style={{ ...statChip, borderColor: 'var(--gold-md)' }}>
          <span style={statLabel}>أعلى</span>
          <b style={{ ...statValue, color: 'var(--gold)' }}>{maxWeight}kg</b>
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
