// ── «إضافة مجموعة» on a plan exercise: for good? ─────────────
//
// A set more than his plan has for it, added from ⋯: a small line under
// the sets asks — «دايماً بخطتي» writes the plan's row with this many
// (WorkoutPage: setRowSets, App's editPlan, free for the streak); ×, or
// nothing at all, leaves it to this session («بس هالمرة», the default:
// the line goes by itself). Answered, it says what his plan has now, a
// moment, and goes.

import { useLayoutEffect, useRef } from 'react'
import { Button, IconButton, Num } from '../kit/index.jsx'
import { X, CheckCircle } from '../kit/icons.js'
import { animate, reducedMotion, rise } from '../../motion.js'
import { setsPhrase } from './sessionWords.js'

function Sets({ n }) {
  const p = setsPhrase(n)
  return <>{p.num != null && <><Num>{p.num}</Num> </>}{p.word}</>
}

export default function SetAsk({ ask, onAlways, onClose }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
    if (reducedMotion()) animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 160, e: 'linear' })
    else animate(el, rise(10), { spring: 'smooth' })
  }, [])
  return (
    <div ref={ref} className="s-ask" role="status" data-testid="set-ask" data-done={ask.done ? '1' : undefined}>
      {ask.done ? (
        <p className="s-ask-text">
          <CheckCircle size={20} weight="fill" className="s-ask-ok" aria-hidden="true" />
          <span>صارت <Sets n={ask.n} /> بخطتك</span>
        </p>
      ) : (
        <>
          <p className="s-ask-text">
            <span>زدت مجموعة لهالجلسة. خطتك فيها <Sets n={ask.from} />.</span>
          </p>
          <Button variant="secondary" size="sm" onClick={onAlways} data-testid="set-ask-always">دايماً بخطتي</Button>
          <IconButton icon={X} label="بس هالمرة" size={40} iconSize={18} weight="bold" onClick={onClose} data-testid="set-ask-close" />
        </>
      )}
    </div>
  )
}
