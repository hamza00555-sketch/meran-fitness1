import { useState } from 'react'
import ExerciseMedia from '../../assets/ExerciseMedia.jsx'
import ExerciseTags from './ExerciseTags.jsx'
import ExerciseInfoModal from '../ExerciseInfoModal.jsx'
import { arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'

// ── One exercise, presented ───────────────────────────────────
//
// The carousel slide: names (English over Arabic, like the reference),
// the media area at a fixed 3:2 so the page never jumps while an image
// arrives, the muscle art in the corner, the shared tag row, and the
// swipe hint. Everything the old card could do that isn't set-logging
// lives behind the ⋯ sheet — info, swap, add/remove set, move set,
// copy, remove — so no feature died in the move to slides.

export default function ExerciseHero({
  ex, ytUrl, progression, lastWeight, maxWeight, isComplete, deloadPct,
  isActive, canSwap, swapTitle,
  onSwap, onRemove, onAddSet, onRemoveSet, onMoveSet, moveTargets = [],
}) {
  const [showInfo, setShowInfo] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const group = MUSCLE_GROUPS[ex.muscle] || {}
  const color = group.color || 'var(--cyan)'
  const ar = arabicName(ex.name)

  const menuRow = {
    width: '100%', textAlign: 'right', padding: '13px 16px',
    background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
    color: 'var(--text2)', fontFamily: 'var(--font-ar)', fontSize: 14,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
  }

  const menu = (action) => () => { setShowMenu(false); action() }

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${isActive ? 'var(--cyan-md)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      opacity: isActive ? 1 : 0.55,
      transition: 'opacity 0.25s, border-color 0.25s',
    }}>
      <div style={{ height: 3, background: color }} />
      <div style={{ padding: '12px 14px 14px' }}>

        {/* Names + corner: muscle art and the ⋯ menu */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 800,
              color: 'var(--text)', lineHeight: 1.3, overflowWrap: 'anywhere',
            }}>{ex.name}</div>
            {ar && (
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                {ar}
              </div>
            )}
            {ex.originalName && ex.originalName !== ex.name && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>
                ⇄ بدلاً من {ex.originalName}
              </div>
            )}
          </div>
          {group.img && (
            <img src={group.img} alt={group.label || ex.muscle} style={{
              width: 44, height: 44, objectFit: 'contain', flexShrink: 0,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
            }} />
          )}
          <button
            onClick={() => setShowMenu(true)}
            aria-label="خيارات التمرين"
            style={{
              width: 34, height: 34, flexShrink: 0, borderRadius: 10,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text3)', fontSize: 17, cursor: 'pointer', lineHeight: 1,
            }}
          >⋯</button>
        </div>

        {/* Media, fixed aspect — the page never reflows around it */}
        <ExerciseMedia name={ex.name} animate={isActive} />

        <div style={{ marginTop: 10 }}>
          <ExerciseTags
            ex={ex} color={color} label={group.label || ex.muscle} emoji={group.emoji || '🏋️'}
            ytUrl={ytUrl} progression={progression}
            lastWeight={lastWeight} maxWeight={maxWeight}
            isComplete={isComplete} deloadPct={deloadPct}
          />
        </div>

        <div style={{
          marginTop: 8, textAlign: 'center',
          fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)', opacity: 0.75,
        }}>
          ← اسحب للتبديل إذا الجهاز مشغول →
        </div>
      </div>

      {/* ── The ⋯ sheet: everything else the old card offered ── */}
      {showMenu && (
        <div
          onClick={() => setShowMenu(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 700,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, background: 'var(--bg2)',
              borderRadius: '20px 20px 0 0', border: '1px solid var(--border2)', borderBottom: 'none',
              paddingBottom: 'calc(var(--safe-bottom) + 8px)',
              animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '10px auto' }} />
            <button style={menuRow} onClick={menu(() => setShowInfo(true))}>ℹ️ معلومات التمرين</button>
            {canSwap && (
              <button style={menuRow} onClick={menu(onSwap)} title={swapTitle}>⇄ استبدال التمرين</button>
            )}
            <button style={menuRow} onClick={menu(onAddSet)}>➕ إضافة سيت</button>
            {ex.sets.length > 1 && (
              <button style={menuRow} onClick={menu(onRemoveSet)}>➖ حذف آخر سيت</button>
            )}
            {moveTargets.length > 0 && ex.sets.length > 0 && (
              <div>
                <div style={{ padding: '10px 16px 4px', fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
                  نقل آخر سيت إلى:
                </div>
                {moveTargets.map(t => (
                  <button key={t.id} style={{ ...menuRow, paddingRight: 28 }} onClick={menu(() => onMoveSet(t.id))}>
                    ↪ {t.name}
                  </button>
                ))}
              </div>
            )}
            <button style={menuRow} onClick={() => {
              navigator.clipboard?.writeText(ex.name).then(() => setCopied(true))
              setTimeout(() => { setCopied(false); setShowMenu(false) }, 700)
            }}>{copied ? '✓ نُسخ' : '⎘ نسخ الاسم'}</button>
            <button style={{ ...menuRow, color: 'var(--red)', borderBottom: 'none' }} onClick={menu(onRemove)}>
              ✕ إزالة التمرين من الجلسة
            </button>
          </div>
        </div>
      )}

      {showInfo && <ExerciseInfoModal exercise={ex} onClose={() => setShowInfo(false)} />}
    </div>
  )
}
