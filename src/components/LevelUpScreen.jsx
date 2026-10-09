import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShareFat } from '@phosphor-icons/react'
import { getRank } from '../utils.js'
import { Button, Sheet, Num } from './kit/index.jsx'
import RankCrest from './progress/RankCrest.jsx'
import RankLadder from './progress/RankLadder.jsx'
import { shareLevelCard } from './progress/levelCard.js'
import '../styles/screens/celebrate.css'

// ── مستوى جديد ────────────────────────────────────────────────
//
// One beat, then still. The screen wipes in from the start edge, the
// eyebrow says what happened in Arabic, the old number rolls up and out
// as the new one rolls in, the crest and the ladder arrive, then the two
// answers: «كمّل» and «شارك». Nothing glows and nothing loops.
//
// When the level opens a new rank (5, 10, 20, 35, 50, 75) the crest is
// the hero instead of the number, and the eyebrow says so.
//
// Props: level (required), onDismiss; `from` when the caller knows the
// level before (defaults to level − 1); `onShare` to replace the
// built-in card share.

export default function LevelUpScreen({ level, from, onDismiss, onShare }) {
  const rank = getRank(level)
  const promoted = level > 1 && rank.minLevel === level
  const before = from != null && from < level ? from : Math.max(0, level - 1)
  const [inline, setInline] = useState(null)
  const [sharing, setSharing] = useState(false)
  const foot = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && document.activeElement?.classList?.contains('cel'))) onDismiss?.()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the dialog itself (screen readers land on it, Enter/Escape
    // work) without drawing a focus ring round the button.
    const t = setTimeout(() => foot.current?.closest('.cel')?.focus({ preventScroll: true }), 0)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; clearTimeout(t) }
  }, [onDismiss])

  useEffect(() => () => { if (inline) URL.revokeObjectURL(inline) }, [inline])

  const share = async () => {
    if (onShare) { onShare({ level, rank }); return }
    if (sharing) return
    setSharing(true)
    try { await shareLevelCard({ level, rank, onInline: setInline }) } catch { /* nothing to say */ }
    setSharing(false)
  }

  return createPortal(
    <div className={`cel${promoted ? ' cel-promoted' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lu-title" data-testid="level-up" tabIndex={-1}>
      <div className="cel-body">
        <span className="cel-eyebrow cel-beat" style={{ '--b': 0 }} id="lu-title">
          {promoted ? 'رتبة جديدة' : 'مستوى جديد'}
        </span>

        {promoted ? (
          <>
            <RankCrest rank={rank} size={168} className="cel-crest cel-crest-hero" />
            <div className="cel-rank cel-beat" style={{ '--b': 2 }}>
              <bdi dir="ltr" className="cel-rank-letter">{rank.tier}</bdi>
              <span className="cel-rank-name">{rank.label}</span>
            </div>
            <p className="cel-sub cel-beat" style={{ '--b': 3 }}>المستوى <Num>{level}</Num></p>
          </>
        ) : (
          <>
            <Roll from={before} to={level} />
            <div className="cel-crest-row cel-beat" style={{ '--b': 2 }}>
              <RankCrest rank={rank} size={56} className="cel-crest" />
              <span className="cel-crest-text">
                <bdi dir="ltr" className="cel-crest-letter">{rank.tier}</bdi>
                <span>{rank.label}</span>
              </span>
            </div>
          </>
        )}

        <RankLadder level={level} className="cel-ladder cel-beat" />
      </div>

      <div className="cel-foot cel-beat" style={{ '--b': 4 }} ref={foot}>
        <Button variant="primary" size="lg" full onClick={onDismiss}>كمّل</Button>
        <Button variant="secondary" size="lg" full icon={ShareFat} onClick={share} disabled={sharing}>شارك</Button>
      </div>

      <Sheet open={!!inline} onClose={() => setInline(null)} title="صورة المستوى">
        {inline && (
          <div className="cel-inline">
            <img src={inline} alt={`مستوى جديد ${level}`} />
            <p>اضغط على الصورة مطوّلاً واحفظها، أو شاركها من هناك.</p>
          </div>
        )}
      </Sheet>
    </div>,
    document.body,
  )
}

// The number rolls like an odometer: each digit that changes slides up
// out of its window as the new one slides in, the last digit first.
function Roll({ from, to }) {
  const a = String(from)
  const b = String(to)
  const len = Math.max(a.length, b.length)
  const A = a.padStart(len, ' ')
  const B = b.padStart(len, ' ')
  return (
    <div className="cel-roll cel-beat" style={{ '--b': 1 }} aria-label={`المستوى ${to}`} role="img">
      <bdi dir="ltr" className="cel-roll-n" aria-hidden="true">
        {B.split('').map((ch, i) => {
          const old = A[i]
          const order = len - 1 - i
          if (old === ch) return <span key={i} className="cel-digit">{ch}</span>
          return (
            <span key={i} className="cel-digit">
              <span className="cel-strip" style={{ '--d': order }}>
                <span>{old === ' ' ? ' ' : old}</span>
                <span>{ch}</span>
              </span>
            </span>
          )
        })}
      </bdi>
    </div>
  )
}
