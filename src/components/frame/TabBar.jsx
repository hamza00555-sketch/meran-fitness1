import { useLayoutEffect, useRef } from 'react'
import { animate, reducedMotion } from '../../motion.js'

// ── The tab bar, with one capsule that slides ─────────────────
//
// Phase 5 (the plan's «اقتراح 4»): the active tab's soft green capsule is
// one element under all four icons, not a background on each. A tap moves
// it to the new tab on the snappy spring (a transform, measured from the
// icon it lands on, so it follows any width and the RTL order), and the
// new icon swells once (1 → 1.14 → 1, 240ms) as it fills. With a pushed
// page on top (no tab is current) the capsule fades away, and comes back
// where it belongs. Reduced motion: it is simply there — a short fade, no
// slide, no swell.
//
// The bar itself never moves when the page under it changes: during a
// tab switch's view transition it is its own layer (view-transition-name
// f-tabs, see kit.css), shown live, so the capsule is seen sliding.

export default function TabBar({ items, current, onSelect }) {
  const navRef = useRef(null)
  const pillRef = useRef(null)
  const last = useRef({ id: undefined, x: null, y: null })

  const place = (animated) => {
    const nav = navRef.current, pill = pillRef.current
    if (!nav || !pill) return
    const i = items.findIndex(t => t.id === current)
    const icon = i >= 0 ? nav.querySelectorAll('.f-tab-icon')[i] : null
    const prev = last.current
    if (!icon) {
      // A pushed page: no tab is current.
      if (prev.id != null && animated) animate(pill, [{ opacity: 1 }, { opacity: 0 }], { d: 160, fill: 'none' })
      pill.style.opacity = '0'
      last.current = { ...prev, id: null }
      return
    }
    const x = icon.offsetLeft, y = icon.offsetTop
    pill.style.width = `${icon.offsetWidth}px`
    pill.style.height = `${icon.offsetHeight}px`
    pill.style.transform = `translate(${x}px, ${y}px)`
    pill.style.opacity = '1'
    last.current = { id: current, x, y }
    if (!animated) return
    const reduce = reducedMotion()
    if (prev.id == null || prev.x == null || reduce) {
      // Arriving (from a pushed page, or under reduced motion): a fade in place.
      if (prev.id !== current) animate(pill, [{ opacity: 0 }, { opacity: 1 }], { d: 160 })
      return
    }
    if (prev.id === current) return
    animate(pill, [{ transform: `translate(${prev.x}px, ${prev.y}px)` }, { transform: `translate(${x}px, ${y}px)` }], { spring: 'snappy', fill: 'none' })
    animate(icon.querySelector('svg'), [
      { transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.45 }, { transform: 'scale(1)' },
    ], { d: 240, fill: 'none' })
  }

  // Before paint: the capsule is where the tab is in the very frame the tab
  // changes (and the view transition's new snapshot carries its slide).
  useLayoutEffect(() => { place(last.current.id !== undefined) }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  // A width change (rotation, a wider window) puts it back without motion
  // — under the tab current now, not the one of the first render.
  const placeNow = useRef(place)
  placeNow.current = place
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => placeNow.current(false))
    ro.observe(nav)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav className="f-tabs" aria-label="التنقل" ref={navRef}>
      <span className="f-tab-pill" ref={pillRef} aria-hidden="true" />
      {items.map(t => {
        const on = t.id === current
        const Icon = t.icon
        return (
          <button key={t.id} type="button" className={`f-tab${on ? ' on' : ''}`}
            aria-current={on ? 'page' : undefined} onClick={() => onSelect(t.id)}>
            <span className="f-tab-icon"><Icon size={24} weight={on ? 'fill' : 'regular'} aria-hidden="true" /></span>
            <span className="f-tab-label">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
