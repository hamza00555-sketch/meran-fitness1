// ── The plan builder, as a page over any screen ──────────────
//
// Lazy (App.jsx): this chunk carries the page, its styles and the body
// figure's paths, so none of it loads until a door opens it. It mounts
// the page (ui.js) into a portal over the app, holds the app's scroll
// lock (and makes the app behind it inert) while open, and passes what
// the page decides back to App: a plan to put in, the old plan back,
// start the workout, close.
//
// The page reads its inputs once, when it opens: the plan in force, the
// one before it, days a week, the gym. A change made elsewhere while it
// is open (there is no elsewhere — it covers the app) needs no syncing.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createPlanner } from './ui.js'
import { lockScroll } from '../../scrollLock.js'
import './planner.css'

export default function PlannerPage(props) {
  const host = useRef(null)
  // The latest callbacks, so the page (made once) always calls the current ones.
  const live = useRef(props)
  live.current = props

  useEffect(() => {
    const release = lockScroll({ inert: true })
    const p = live.current
    const page = createPlanner(host.current, {
      door: p.door,
      plan: p.plan,
      planIndex: p.planIndex,
      planPrev: p.planPrev,
      recoveryCfg: p.recoveryCfg,
      profile: p.profile,
      changeCooldownLeft: p.changeCooldownLeft,
      currentStreak: p.currentStreak,
      onActivate: (...a) => live.current.onActivate?.(...a),
      onRestorePrev: (...a) => live.current.onRestorePrev?.(...a),
      onStart: () => live.current.onStart?.(),
      onClose: () => live.current.onClose?.(),
    })
    if (typeof window !== 'undefined') window.__planner = page
    return () => {
      page.destroy()
      if (typeof window !== 'undefined' && window.__planner === page) delete window.__planner
      release()
    }
  }, [])

  return createPortal(
    <div ref={host} className="pb" role="dialog" aria-modal="true" aria-label="باني الخطط" data-testid="planner" />,
    document.body,
  )
}
