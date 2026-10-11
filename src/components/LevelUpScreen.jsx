import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShareFat } from '@phosphor-icons/react'
import { getRank } from '../utils.js'
import { Button, Sheet, Num } from './kit/index.jsx'
import RankCrest, { crestSrc } from './progress/RankCrest.jsx'
import RankLadder from './progress/RankLadder.jsx'
import { reachedNewRank } from './progress/ladder.js'
import RollNumber from './RollNumber.jsx'
import { animate, reducedMotion, EASE } from '../motion.js'
import { shareLevelCard } from './progress/levelCard.js'
import '../styles/screens/celebrate.css'
import { lockScroll } from '../scrollLock.js'

// ── مستوى جديد ────────────────────────────────────────────────
//
// The screen wipes in from the start edge, the eyebrow says what
// happened in Arabic, the old number rolls up and out as the new one
// rolls in, the crest and the ladder arrive, then the two answers:
// «كمّل» and «شارك». Since motion phase 4 it lands harder, each step
// once and never looping:
//
//      0ms  the wipe (320ms)
//    320ms  the crest drops in from above and grows to size on a spring
//    820ms  one sheen crosses the crest; one ring leaves from behind it
//   1100ms  the ladder climbs from the old level to the new (800ms)
//   1200ms  a new rank only: confetti in the rank's colour, both sides
//
// Under two seconds, and a tap anywhere (not on a button) jumps to the
// end. Reduced motion: the screen fades in with the crest and the ladder
// already in place — no sheen, no ring, no confetti.
//
// When the level opens a new rank (5, 10, 20, 35, 50, 75) the crest is
// the hero instead of the number, and the eyebrow says so.
//
// Props: level (required), onDismiss; `from` when the caller knows the
// level before (defaults to level − 1); `onShare` to replace the
// built-in card share.

const DROP_AT = 320
const SHEEN_AT = 820
const LADDER_AT = 1100
const CONFETTI_AT = 1200

export default function LevelUpScreen({ level, from, onDismiss, onShare }) {
  const rank = getRank(level)
  const before = from != null && from < level ? from : Math.max(0, level - 1)
  const promoted = reachedNewRank(before, level)
  const [inline, setInline] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const foot = useRef(null)
  const root = useRef(null)
  const crest = useRef(null)
  const canvas = useRef(null)
  const conf = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && document.activeElement?.classList?.contains('cel'))) onDismiss?.()
    }
    window.addEventListener('keydown', onKey)
    const release = lockScroll()
    // Focus the dialog itself (screen readers land on it, Enter/Escape
    // work) without drawing a focus ring round the button.
    const t = setTimeout(() => foot.current?.closest('.cel')?.focus({ preventScroll: true }), 0)
    return () => { window.removeEventListener('keydown', onKey); release(); clearTimeout(t) }
  }, [onDismiss])

  useEffect(() => () => { if (inline) URL.revokeObjectURL(inline) }, [inline])

  // The crest's drop, sheen and ring; the confetti on a new rank.
  useLayoutEffect(() => {
    if (reducedMotion()) return
    const anims = []
    const add = (a) => { if (a) anims.push(a) }
    const wrap = crest.current
    const q = (s) => wrap?.querySelector(s)
    // the small crest beside the number arrives with its row (beat 2)
    const drop = promoted ? DROP_AT : DROP_AT + 2 * 260
    add(animate(wrap, [
      { opacity: 0, transform: 'translateY(-16px) scale(.6)' },
      { opacity: 1, transform: 'none' },
    ], { spring: 'bouncy', delay: drop }))
    const shine = promoted ? SHEEN_AT : drop + 480
    add(animate(q('.cel-sheen'), [
      { opacity: 1, backgroundPosition: '100% 0' }, { opacity: 1, backgroundPosition: '0% 0' },
    ], { d: 600, delay: shine, e: EASE.io, fill: 'none' }))
    add(animate(q('.cel-wave'), [
      { opacity: 0.5, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(1.8)' },
    ], { d: 700, delay: shine, e: EASE.out, fill: 'none' }))

    let alive = true
    const timers = []
    if (promoted) {
      import('canvas-confetti').then((m) => {
        if (!alive || !canvas.current) return
        try { conf.current = m.default.create(canvas.current, { resize: true, useWorker: false, disableForReducedMotion: true }) } catch {}
      }, () => {})
      timers.push(setTimeout(() => {
        const c = conf.current
        if (!c) return
        const colors = [rank.color, rank.color, '#FFFFFF', '#F4F6F8']
        const base = { particleCount: 46, spread: 60, startVelocity: 46, gravity: 1.05, ticks: 180, scalar: 0.95, colors, disableForReducedMotion: true }
        try {
          c({ ...base, angle: 62, origin: { x: 0.06, y: 0.7 } })
          c({ ...base, angle: 118, origin: { x: 0.94, y: 0.7 } })
        } catch {}
      }, CONFETTI_AT))
    }
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      anims.forEach(a => { try { a.cancel() } catch {} })
      try { conf.current?.reset?.() } catch {}
      conf.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A tap anywhere but a button: everything where it ends.
  const skip = (e) => {
    if (skipped || e.target.closest?.('button, a, .k-sheet')) return
    setSkipped(true)
    try { root.current?.getAnimations?.({ subtree: true }).forEach(a => { try { a.finish() } catch {} }) } catch {}
    try { conf.current?.reset?.() } catch {}
  }

  const share = async () => {
    if (onShare) { onShare({ level, rank }); return }
    if (sharing) return
    setSharing(true)
    try { await shareLevelCard({ level, rank, onInline: setInline }) } catch { /* nothing to say */ }
    setSharing(false)
  }

  const crestEl = (size, cls) => (
    <span className={`cel-crest-wrap ${cls}`} ref={crest} style={{ '--crest': `url(${crestSrc(rank)})`, '--cs': `${size}px` }}>
      <i className="cel-wave" aria-hidden="true" />
      <RankCrest rank={rank} size={size} className="cel-crest" />
      <i className="cel-sheen" aria-hidden="true" />
    </span>
  )

  return createPortal(
    <div className={`cel${promoted ? ' cel-promoted' : ''}${skipped ? ' cel-skip' : ''}`} ref={root} onClick={skip}
      role="dialog" aria-modal="true" aria-labelledby="lu-title" data-testid="level-up" tabIndex={-1}>
      <div className="cel-body">
        <span className="cel-eyebrow cel-beat" style={{ '--b': 0 }} id="lu-title">
          {promoted ? 'رتبة جديدة' : 'مستوى جديد'}
        </span>

        {promoted ? (
          <>
            {crestEl(168, 'cel-crest-hero')}
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
              {crestEl(56, 'cel-crest-small')}
              <span className="cel-crest-text">
                <bdi dir="ltr" className="cel-crest-letter">{rank.tier}</bdi>
                <span>{rank.label}</span>
              </span>
            </div>
          </>
        )}

        <RankLadder level={level} className="cel-ladder cel-beat" fillFrom={before} fillDelay={LADDER_AT} />
      </div>

      <div className="cel-foot cel-beat" style={{ '--b': 4 }} ref={foot}>
        <Button variant="primary" size="lg" full onClick={onDismiss}>كمّل</Button>
        <Button variant="secondary" size="lg" full icon={ShareFat} onClick={share} disabled={sharing}>شارك</Button>
      </div>

      {promoted && <canvas className="cel-conf" ref={canvas} aria-hidden="true" />}

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
// out of its window as the new one slides in, the last digit first —
// after the screen's wipe and eyebrow (700ms), 30ms apart, 280ms each.
function Roll({ from, to }) {
  return (
    <div className="cel-roll cel-beat" style={{ '--b': 1 }} aria-label={`المستوى ${to}`} role="img">
      <bdi dir="ltr" className="cel-roll-n" aria-hidden="true">
        <RollNumber from={from} to={to} delay={700} stagger={30} duration={280} easing={EASE.out} up
          style={{ '--roll-h': '1em' }} />
      </bdi>
    </div>
  )
}
