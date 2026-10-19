// ── «خطتي» — his plan, the way he actually runs it ───────────
//
// حمزة: «أحتاج إنه لما أبغى في زر حق الخطة أضغط عليه أشوف خطتي كلها بشكل
// كروت واضحة بشكل جميل، وبعدين يكون سهل علي إن أنا في تمرين ما عجبني
// أغيره وأبدله بواحد ثاني».
//
// A page of its own over any screen (Home › تقدّم البرنامج, Settings ›
// الخطة › «شوف خطتي», the session's ⋯ › «شوف خطتي»). Lazy (App.jsx): this
// chunk carries the page, its styles and the body figure's paths.
//
//   the top     «خطتي», the plan's name, ×
//   the days    one pill per day of the cycle — the builder's day pills,
//               the one shown filled white — with the word the Home stage
//               uses («دفع», «سحب A») and, only on today's / the next
//               one, that mark under it; a row that scrolls when the days
//               outgrow it. The days swipe sideways (scroll snap), the
//               tab follows
//   a day       a short header — the muscles (the tab already names the
//               day), how many exercises and sets and the minutes, and
//               the muscles lit on a small grey body — then one card per
//               exercise (PlanCard), then what he does on this day in his
//               sessions that the day doesn't have («تسويها بالجلسة»,
//               ExtraCard: «ثبّته بخطتي» or «مو هنا»; a line on the
//               header counts them), then «عدّل الخطة كاملة» (the
//               builder, on this day)
//
// «بالتناوب» (src/plan/rotate.js): a row that takes turns is one card of
// its names (RotateCard) — the one due marked, read from his sessions (and
// from the session running, on its day). Its sheet edits the turns
// (RotateEditor: add, ↑, ×, «فكّ التناوب»); any card's sheet starts them
// («بالتناوب مع…»); two cards of a natural pair on one day (the hip
// machines) offer «خلّهم بالتناوب», one tap that makes them one row, or
// × that waves it off for good (OFFERS_OFF_KEY, a key of the new design's).
//
// What it shows is the effective plan (src/plan/view.js): his remembered
// swaps applied, his reps rule, the rest the player will count. What he
// changes from a card's sheet goes straight into his plan through
// onCommit (App's commitPlan, as an edit — free, the day he reached kept).
// Taking an exercise out leaves «تراجع» in its place for six seconds.
//
// It opens on his next training day (today's, if today is one), and
// holds the app's scroll lock (the app behind inert) while open.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconButton, Num } from '../../components/kit/index.jsx'
import { X, PencilSimple, ArrowCounterClockwise, Info, PushPin, ClockCounterClockwise } from '../../components/kit/icons.js'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { dayWord, musclesLine, estimateMinutes, setsUnit } from '../../components/home/dayParts.js'
import { planTitle } from '../../plan/title.js'
import { unitAr } from '../../streak.js'
import { getExerciseStats, durationShort, ls } from '../../utils.js'
import { lockScroll } from '../../scrollLock.js'
import { animate, reducedMotion, rise } from '../../motion.js'
import { haptic } from '../../haptics.js'
import { todayKey, dayKey } from '../../day.js'
import { arabicName } from '../../exerciseMedia.js'
import { withNums } from '../../components/home/HomeBits.jsx'
import {
  effectivePlan, effectiveDay, dayMarks, swapRow, setRowSets, setRowReps, clearRowReps, setRowRest,
  removeRow, insertRow, fromSessions, addRow, addRows, withDismissed, DISMISS_KEY, sessionDay,
} from '../../plan/view.js'
import {
  rotationTurns, liveTurn, rotationOffers, offerId, mergeRows, addToRotation, removeFromRotation, moveInRotation,
  splitRotation, OFFERS_OFF_KEY,
} from '../../plan/rotate.js'
import PlanCard from './PlanCard.jsx'
import RotateCard from './RotateCard.jsx'
import ExtraCard from './ExtraCard.jsx'
import ExerciseSheet from './ExerciseSheet.jsx'
import BodyFigure from './BodyFigure.jsx'
import '../../styles/screens/planview.css'

const UNDO_MS = 6000
const MARK = {
  today: 'اليوم',
  live: 'جلستك الحين',
  done: 'خلّصته اليوم',
  next: 'الجاي',
}

export default function PlanView({
  plan, planIndex = 0, exerciseSubs = {}, sessions = [], exerciseMapping = {}, repTarget, dropped = {},
  status = 'training', active = null, from = 'home',
  onCommit, onClearSub, onOpenBuilder, onClose,
}) {
  const subs = exerciseSubs || {}
  const opts = useMemo(() => ({ subs, repTarget }), [subs, repTarget])
  const days = useMemo(() => effectivePlan(plan, opts), [plan, opts])
  const n = days.length

  // Which day it opens on, and what each tab says (src/plan/view.js).
  const today = todayKey()
  const doneToday = useMemo(() => {
    const s = (sessions || []).find(x => x?.planDayIndex != null && dayKey(x.date) === today)
    return s ? s.planDayIndex : null
  }, [sessions, today])
  const { first, marks } = useMemo(() => dayMarks({
    n, planIndex, status, doneToday, liveIndex: active?.planDayIndex ?? null,
  }), [n, planIndex, status, doneToday, active?.planDayIndex])
  const [cur, setCur] = useState(first)
  const curRef = useRef(cur)
  curRef.current = cur
  // The builder (opened from here) can give the cycle fewer days.
  useEffect(() => { if (n && cur > n - 1) setCur(n - 1) }, [n, cur])

  // ── Open, close ──
  const root = useRef(null)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => lockScroll({ inert: true }), [])
  const close = useCallback(() => {
    if (leaving) return
    setLeaving(true)
    const el = root.current
    const a = reducedMotion()
      ? animate(el, [{ opacity: 1 }, { opacity: 0 }], { d: 160, e: 'linear', fill: 'forwards' })
      : animate(el, [{ transform: 'none' }, { transform: 'translateY(100%)' }], { d: 300, e: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
    if (a) a.onfinish = () => onClose?.()
    else onClose?.()
  }, [leaving, onClose])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.k-sheet:not(.k-leaving), .pb')) return   // a sheet or the builder answers first
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // ── The days, side by side ──
  const pager = useRef(null)
  const tabs = useRef(null)
  const rtl = () => (pager.current ? getComputedStyle(pager.current).direction === 'rtl' : true)
  const goTo = useCallback((i, smooth = true) => {
    const el = pager.current
    if (!el) return
    const w = el.clientWidth
    el.scrollTo({ left: (rtl() ? -1 : 1) * i * w, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
  }, [])
  useLayoutEffect(() => { goTo(first, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The tab follows a swipe; and once the day in view has scrolled, the
  // edge under the days draws its hairline (data-scrolled on .pv). The
  // days scroll on their own (a scroll doesn't bubble): caught on the way
  // down, in the capture phase.
  useEffect(() => {
    const el = pager.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1
        const i = Math.max(0, Math.min(n - 1, Math.round(Math.abs(el.scrollLeft) / w)))
        if (i !== curRef.current) setCur(i)
        const top = el.querySelector(`[data-page="${i}"]`)?.scrollTop || 0
        root.current?.toggleAttribute('data-scrolled', top > 1)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => { el.removeEventListener('scroll', onScroll, { capture: true }); cancelAnimationFrame(raf) }
  }, [n])
  // The selected tab stays in view; a day seen the first time deals its cards in.
  const visited = useRef(new Set())
  useLayoutEffect(() => {
    tabs.current?.querySelector(`[data-day="${cur}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    if (visited.current.has(cur)) return
    visited.current.add(cur)
    const page = pager.current?.querySelector(`[data-page="${cur}"]`)
    if (!page) return
    if (reducedMotion()) { animate(page, [{ opacity: 0 }, { opacity: 1 }], { d: 200, e: 'linear' }); return }
    const head = page.querySelector('.pv-day')
    animate(head?.querySelector('.pv-day-text'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { d: 280, delay: 40 })
    animate(head?.querySelector('.pv-body'), [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { spring: 'smooth', delay: 100 })
    ;[...page.querySelectorAll('.pv-list > li')].slice(0, 6).forEach((li, k) => animate(li, rise(16), { spring: 'smooth', delay: 140 + k * 55 }))
  }, [cur])
  const pick = (i) => { haptic('swipe'); setCur(i); goTo(i) }

  // ── Last weights, worked out once per name ──
  const lastFor = useMemo(() => {
    const cache = new Map()
    return (name) => {
      if (!cache.has(name)) cache.set(name, getExerciseStats(sessions, name, exerciseMapping).lastWeight)
      return cache.get(name)
    }
  }, [sessions, exerciseMapping])

  // ── «بالتناوب»: whose turn, and the pairs offered ──
  const liveDay = active ? sessionDay(plan, active) : null
  const turns = useMemo(() => {
    const t = rotationTurns(plan, sessions, { mapping: exerciseMapping })
    if (liveDay == null || !t[liveDay]) return t
    return t.map((day, d) => (d !== liveDay ? day : day.map(x => liveTurn(x, active, { mapping: exerciseMapping }))))
  }, [plan, sessions, exerciseMapping, liveDay, active])
  const [offersOff, setOffersOff] = useState(() => {
    const v = ls.get(OFFERS_OFF_KEY, [])
    return Array.isArray(v) ? v : []
  })
  const offers = useMemo(() => days.map((_, d) => rotationOffers(plan, d, { mapping: exerciseMapping, off: offersOff })),
    [plan, days, exerciseMapping, offersOff])

  // ── A card's sheet, and what it changes ──
  const [sheet, setSheet] = useState(null)          // { d, j, k, mode }
  const sheetN = useRef(0)
  const [flash, setFlash] = useState({})            // 'd:j' → token
  const bump = (d, j) => setFlash(f => ({ ...f, [`${d}:${j}`]: (f[`${d}:${j}`] || 0) + 1 }))
  // «بدّله» on a card opens the sheet straight on the alternatives.
  const openSheet = (d, j, mode = 'main') => { sheetN.current += 1; setSheet({ d, j, k: sheetN.current, open: true, mode }) }
  const closeSheet = () => setSheet(s => (s ? { ...s, open: false } : s))
  const commit = (next, d, j) => {
    if (!next) return false
    const okd = onCommit?.(next)
    if (okd !== false && d != null) bump(d, j)
    return okd !== false
  }
  // The row the sheet is about. On its way out it keeps showing that one,
  // not the exercise that slid into its place (after «شيله»).
  const liveRow = sheet ? days[sheet.d]?.rows?.[sheet.j] : null
  const lastRow = useRef(null)
  if (sheet?.open && liveRow) lastRow.current = liveRow
  const sheetRow = sheet?.open ? liveRow : lastRow.current

  const doSwap = (name) => {
    if (!sheet || !sheetRow) return
    const { d, j } = sheet
    const row = sheetRow
    // Back to what the plan says, under a remembered swap: the swap goes.
    if (row.swap?.how === 'sub' && name === row.planName) {
      onClearSub?.(row.planName)
      bump(d, j)
    } else {
      commit(swapRow(plan, d, j, name), d, j)
      // a remembered swap of the new name would turn it into something else
      if (subs[name]) onClearSub?.(name)
    }
    closeSheet()
  }

  // «بالتناوب»: the turns of the sheet's row. One picked from the day's
  // own exercises joins it and its row goes, so the row may move up: the
  // sheet follows it.
  const rotAdd = (name) => {
    if (!sheet) return
    const { d, j } = sheet
    const out = addToRotation(plan, d, j, name)
    if (!out) return
    // a row that starts taking turns, or takes another row in, comes in as
    // a card of its names (the layout effect below); one more name on a
    // card of names: the card settles (its flash)
    const merged = out.plan.weeklySchedule[d].exercises.length !== plan.weeklySchedule[d].exercises.length
    const fresh = merged || !days[d]?.rows?.[j]?.rotate
    if (fresh) moves.current = { d, merge: true, tops: rowTops(d), at: out.at }
    if (commit(out.plan, fresh ? null : d, out.at) && out.at !== j) setSheet(x => (x ? { ...x, j: out.at } : x))
  }
  const rotRemove = (name) => sheet && commit(removeFromRotation(plan, sheet.d, sheet.j, name), sheet.d, sheet.j)
  const rotMove = (name) => sheet && commit(moveInRotation(plan, sheet.d, sheet.j, name, -1), sheet.d, sheet.j)
  const rotSplit = () => {
    if (!sheet) return
    const { d, j } = sheet
    const out = splitRotation(plan, d, j)
    if (!out) return
    closeSheet()
    moves.current = { d, split: true, tops: rowTops(d), at: j, count: out.count }
    if (!commit(out.plan)) moves.current = null
  }
  // «خلّهم بالتناوب» on a card: the two become one, in the earlier one's place
  const merge = (d, j, k) => {
    const out = mergeRows(plan, d, Math.min(j, k), Math.max(j, k))
    if (!out) return
    haptic('set')
    moves.current = { d, merge: true, tops: rowTops(d), at: out.at }
    if (!commit(out.plan)) moves.current = null
  }
  const offerOff = (d, j, k) => {
    const rows = plan.weeklySchedule[d].exercises
    const id = offerId(plan, d, rows[j].name, rows[k].name)
    haptic('swipe')
    setOffersOff(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      ls.set(OFFERS_OFF_KEY, next)
      return next
    })
  }

  // Out, with «تراجع» in its place for six seconds.
  const [undo, setUndo] = useState(null)            // { d, j, row, name, t }
  const undoTimer = useRef(0)
  useEffect(() => () => clearTimeout(undoTimer.current), [])
  const doRemove = () => {
    if (!sheet) return
    const { d, j } = sheet
    const out = removeRow(plan, d, j)
    if (!out) return
    closeSheet()
    if (!commit(out.plan)) return
    haptic('set')
    clearTimeout(undoTimer.current)
    const names = sheetRow?.rotate || [sheetRow?.name || out.row.name]
    const name = names.map(n => exerciseNames(n, exerciseMapping).ar).join(' و')
    setUndo({ d, j, row: out.row, name, t: Date.now() })
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }
  const doUndo = () => {
    if (!undo) return
    clearTimeout(undoTimer.current)
    const back = insertRow(plan, undo.d, undo.j, undo.row)
    setUndo(null)
    if (commit(back, undo.d, undo.j)) haptic('set')
  }

  // ── «تسويها بالجلسة»: what he does on a day that the day doesn't say ──
  // (src/plan/view.js doneNotInPlan). «مو هنا» is remembered per day under
  // DISMISS_KEY, a key of the new design's own; `dropped` (App, DROPPED_KEY)
  // says when a name left a day, so what he takes out or swaps away here
  // is not offered straight back from the sessions the plan put it in.
  const [dismissed, setDismissed] = useState(() => {
    const v = ls.get(DISMISS_KEY, {})
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  })
  const dismissedOnce = useRef(true)
  useEffect(() => {
    if (dismissedOnce.current) { dismissedOnce.current = false; return }
    ls.set(DISMISS_KEY, dismissed)
  }, [dismissed])
  const extras = useMemo(
    () => fromSessions(plan, sessions, { subs, mapping: exerciseMapping, dismissed, dropped }),
    [plan, sessions, subs, exerciseMapping, dismissed, dropped],
  )

  // What a pin or a «مو هنا» moves, measured before it: the pinned cards'
  // places (they fly from there into the plan's list, filling in as they
  // go) and where everything under them stood (it slides to its new place).
  const moves = useRef(null)
  const pageEl = (d) => pager.current?.querySelector(`[data-page="${d}"]`)
  const byName = (root, sel, name) => [...(root?.querySelectorAll(sel) || [])].find(el => el.dataset.name === name) || null
  const snapshot = (d, names = []) => {
    const page = pageEl(d)
    if (!page) return null
    const from = new Map()
    for (const nm of names) {
      const el = byName(page, '[data-testid="extra-card"]', nm)
      if (el) from.set(nm, el.getBoundingClientRect())
    }
    const tops = new Map([...page.querySelectorAll('.pv-extra-head, [data-testid="extra-card"], .pv-end')]
      .map(el => [el, el.getBoundingClientRect().top]))
    return { d, from, tops }
  }
  // Where every card of the day and everything under the list stood, for
  // a merge or a split: what moves slides to its new place.
  const rowTops = (d) => {
    const page = pageEl(d)
    if (!page) return new Map()
    return new Map([...page.querySelectorAll('.pv-list:not(.pv-xlist) > li, .pv-extra-head, [data-testid="extra-card"], .pv-end')]
      .map(el => [el, el.getBoundingClientRect().top]))
  }
  const pin = (d, items) => {
    if (!items?.length) return
    const next = items.length > 1 ? addRows(plan, d, items, { repTarget }) : addRow(plan, d, items[0], { repTarget })
    if (!next) return
    moves.current = snapshot(d, items.map(x => x.name))
    if (!commit(next)) { moves.current = null; return }
    haptic('set')
  }
  const dismiss = (d, item) => {
    const el = byName(pageEl(d), '[data-testid="extra-card"]', item.name)
    const go = () => {
      moves.current = snapshot(d)
      setDismissed(prev => withDismissed(prev, plan, d, item.key))
    }
    haptic('swipe')
    if (!el || reducedMotion()) { go(); return }
    el.style.pointerEvents = 'none'
    const a = animate(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }], { d: 180, e: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
    if (a) a.onfinish = go
    else go()
  }
  useLayoutEffect(() => {
    const m = moves.current
    if (!m) return
    moves.current = null
    const page = pageEl(m.d)
    if (!page) return
    const quiet = reducedMotion()
    if (m.merge || m.split) {
      // the card that now takes turns (or the rows it split into): its
      // names come in one by one; what stood under it slides to its place
      const li = page.querySelectorAll('.pv-list:not(.pv-xlist) > li')
      const cards = [...li].slice(m.at, m.at + 1 + (m.count || 0)).map(x => x.querySelector('[data-testid="plan-card"]')).filter(Boolean)
      if (quiet) { cards.forEach(c => animate(c, [{ opacity: 0.6 }, { opacity: 1 }], { d: 200, e: 'linear' })); return }
      for (const c of cards) {
        animate(c, [{ transform: 'scale(0.97)' }, { transform: 'none' }], { spring: 'bouncy' })
        animate(c, [{ boxShadow: 'inset 0 0 0 2px var(--ink-2)' }, { boxShadow: 'inset 0 0 0 1px var(--edge)' }], { d: 900, fill: 'none' })
        ;[...c.querySelectorAll('.pv-rm')].forEach((x, i) => animate(x, rise(12), { spring: 'smooth', delay: 80 + i * 90 }))
      }
      for (const [el, top] of m.tops) {
        if (!el.isConnected || cards.some(c => el.contains(c))) continue
        const dy = top - el.getBoundingClientRect().top
        if (Math.abs(dy) > 1) animate(el, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { spring: 'smooth' })
      }
      return
    }
    let k = 0
    for (const [nm, r] of m.from) {
      const el = byName(page, '.pv-list [data-testid="plan-card"]', nm)
      if (!el) continue
      if (quiet) { animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 200, e: 'linear' }); continue }
      const b = el.getBoundingClientRect()
      const fill = getComputedStyle(el).backgroundColor
      // over whatever it passes on its way up (the heading under the list)
      el.style.zIndex = '3'
      const a = animate(el, [
        { transform: `translate(${r.left - b.left}px, ${r.top - b.top}px)`, backgroundColor: 'rgba(20,23,27,0)' },
        { backgroundColor: fill, offset: 0.3 },
        { transform: 'none', backgroundColor: fill },
      ], { spring: 'smooth', delay: k * 70 })
      const settle = () => { el.style.zIndex = '' }
      if (a) { a.onfinish = settle; a.oncancel = settle } else settle()
      animate(el, [{ boxShadow: 'inset 0 0 0 2px var(--ink-2)' }, { boxShadow: 'inset 0 0 0 1px var(--edge)' }], { d: 900, delay: 200 + k * 70, fill: 'none' })
      k += 1
    }
    if (quiet) return
    for (const [el, top] of m.tops) {
      if (!el.isConnected) continue
      const dy = top - el.getBoundingClientRect().top
      if (Math.abs(dy) <= 1) continue
      // the heading the pinned card flew past comes in where it is now
      if (m.from.size && el.matches('.pv-extra-head')) animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 220, delay: 260, e: 'linear' })
      else animate(el, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { spring: 'smooth' })
    }
  }, [days, extras])
  // The note on the day's header takes him to them.
  const toExtras = (d) => {
    const sec = pageEl(d)?.querySelector('.pv-extra')
    sec?.scrollIntoView?.({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  if (!n) return null

  return createPortal(
    <div ref={root} className="pv" role="dialog" aria-modal="true" aria-label="خطتي" data-testid="plan-view" data-from={from}>
      <header className="pv-top">
        <div className="pv-title">
          <h1>خطتي</h1>
          <p dir="auto">{planTitle(plan.planName)}</p>
        </div>
        <IconButton icon={X} label="إغلاق" onClick={close} data-testid="plan-view-close" />
      </header>

      <div className="pv-tabs" role="tablist" aria-label="أيام الخطة" ref={tabs}>
        {days.map((d, i) => {
          const eff = effectiveDay(plan, i, opts)
          const { word, variant } = dayWord(eff)
          const mark = marks[i]
          return (
            <button key={i} type="button" role="tab" className="pv-tab" data-day={i} data-mark={mark || undefined}
              aria-selected={i === cur} onClick={() => pick(i)}>
              <span className="pv-tab-word">{word || `يوم ${i + 1}`}{variant && <Num className="pv-tab-v">{variant}</Num>}</span>
              {mark && <span className="pv-tab-sub">{MARK[mark]}</span>}
            </button>
          )
        })}
      </div>

      {active && (
        <p className="pv-live" role="note">
          <Info size={18} weight="bold" aria-hidden="true" />
          جلستك شغّالة: تعديلك هنا يمشي من الجلسة الجاية.
        </p>
      )}

      <div className="pv-pages" ref={pager}>
        {days.map((d, i) => {
          const eff = effectiveDay(plan, i, opts)
          const { word, variant, latin } = dayWord(eff)
          const name = word ? `${word}${variant ? ` ${variant}` : ''}` : `يوم ${i + 1}`
          const muscles = musclesLine(eff, word)
          const mins = estimateMinutes(eff)
          const sets = d.rows.reduce((s, r) => s + (Number(r.sets) || 0), 0)
          const extra = extras[i] || []
          return (
            <section key={i} className="pv-page" data-page={i} role="tabpanel" aria-label={name}>
              <header className="pv-day">
                <div className="pv-day-text">
                  {/* The tab above names the day; the header says what it works.
                      A day whose only muscle is its own name says the name. */}
                  <h2 className={`pv-day-title${!muscles && latin ? ' is-latin' : ''}`}>{muscles || name}</h2>
                  <p className="pv-meta">
                    <span><Num>{d.rows.length}</Num> {unitAr(d.rows.length, 'workout')}</span>
                    {sets > 0 && <span><Num>{sets}</Num> {setsUnit(sets)}</span>}
                    {/* «≈45 د»: the digits isolated, the unit after them in the Arabic order */}
                    {mins > 0 && <span>≈{withNums(durationShort(mins))}</span>}
                  </p>
                  {extra.length > 0 && (
                    <button type="button" className="pv-xnote" data-testid="plan-extra-note" onClick={() => toExtras(i)}>
                      <ClockCounterClockwise size={16} weight="bold" aria-hidden="true" />
                      <Num>+{extra.length}</Num> {extra.length === 1 ? 'تسويه بالجلسة' : 'تسويها بالجلسة'}
                    </button>
                  )}
                </div>
                <BodyFigure exercises={eff.exercises} />
              </header>

              <ol className="pv-list">
                {d.rows.map((row, j) => {
                  const turn = turns[i]?.[j]
                  const pair = offers[i]?.[j] ?? -1
                  return (
                    <li key={j}>
                      {undo && undo.d === i && undo.j === j && <UndoRow name={undo.name} mapping={exerciseMapping} onUndo={doUndo} />}
                      {turn && row.rotate ? (
                        <RotateCard row={row} turn={turn} mark={marks[i]} mapping={exerciseMapping} sessions={sessions}
                          flash={flash[`${i}:${j}`] || 0} onOpen={() => openSheet(i, j)} onEdit={() => openSheet(i, j, 'rotate')} />
                      ) : (
                        <PlanCard row={row} mapping={exerciseMapping} sessions={sessions}
                          flash={flash[`${i}:${j}`] || 0} onOpen={() => openSheet(i, j)} onSwap={() => openSheet(i, j, 'swap')}
                          offer={pair >= 0 && d.rows[pair] ? {
                            name: d.rows[pair].name,
                            onMerge: () => merge(i, j, pair),
                            onDismiss: () => offerOff(i, j, pair),
                          } : null} />
                      )}
                    </li>
                  )
                })}
                {undo && undo.d === i && undo.j >= d.rows.length && (
                  <li><UndoRow name={undo.name} mapping={exerciseMapping} onUndo={doUndo} /></li>
                )}
              </ol>

              {extra.length > 0 && (
                <section className="pv-extra" data-testid="plan-extra" aria-labelledby={`pv-x-${i}`}>
                  <div className="pv-extra-head">
                    <div className="pv-extra-text">
                      <h3 id={`pv-x-${i}`}>{extra.length === 1 ? 'تسويه بالجلسة' : 'تسويها بالجلسة'}</h3>
                      <p>مو بخطتك. اللي تثبّته ينضاف لهاليوم.</p>
                    </div>
                    {extra.length > 1 && (
                      <button type="button" className="pv-pin pv-pin-all" data-testid="extra-pin-all" onClick={() => pin(i, extra)}>
                        <PushPin size={18} weight="bold" aria-hidden="true" />ثبّت كلهم
                      </button>
                    )}
                  </div>
                  <ol className="pv-list pv-xlist">
                    {extra.map(item => (
                      <li key={item.key}>
                        <ExtraCard item={item} mapping={exerciseMapping} sessions={sessions}
                          onPin={() => pin(i, [item])} onDismiss={() => dismiss(i, item)} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <div className="pv-end">
                <Button variant="secondary" size="lg" full icon={PencilSimple} data-testid="plan-view-builder"
                  onClick={() => onOpenBuilder?.(i)}>عدّل الخطة كاملة</Button>
                <p>ترتيب الأيام، تمارين جديدة، ونظامك — من باني الخطة.</p>
              </div>
            </section>
          )
        })}
      </div>

      {sheet && sheetRow && (
        <ExerciseSheet
          key={sheet.k}
          open={sheet.open}
          startMode={sheet.mode}
          row={sheetRow}
          dayNames={days[sheet.d].rows.flatMap(r => [r.name, ...(r.rotate || [])])}
          mapping={exerciseMapping}
          lastFor={lastFor}
          repTarget={repTarget}
          canRemove={days[sheet.d].rows.length > 1}
          onSwap={doSwap}
          onSets={(v) => commit(setRowSets(plan, sheet.d, sheet.j, v), sheet.d, sheet.j)}
          onReps={(r) => commit(setRowReps(plan, sheet.d, sheet.j, r), sheet.d, sheet.j)}
          onRepsReset={() => commit(clearRowReps(plan, sheet.d, sheet.j), sheet.d, sheet.j)}
          onRest={(s) => commit(setRowRest(plan, sheet.d, sheet.j, s), sheet.d, sheet.j)}
          onRemove={doRemove}
          onClose={closeSheet}
          turn={sheetRow.rotate ? (turns[sheet.d]?.[sheet.j] || null) : null}
          mark={marks[sheet.d]}
          dayRows={days[sheet.d].rows}
          pairName={(() => { const k = offers[sheet.d]?.[sheet.j] ?? -1; return k >= 0 ? days[sheet.d].rows[k]?.planName : null })()}
          onRotateAdd={rotAdd}
          onRotateRemove={rotRemove}
          onRotateMove={rotMove}
          onRotateSplit={rotSplit}
        />
      )}
    </div>,
    document.body,
  )
}

/** In the taken-out card's place: what went, and «تراجع» while the line drains. */
function UndoRow({ name, mapping, onUndo }) {
  const ref = useRef(null)
  useLayoutEffect(() => { animate(ref.current, rise(10), { spring: 'smooth' }) }, [])
  return (
    <div ref={ref} className="pv-undo" role="status" data-testid="plan-undo">
      <span className="pv-undo-text">شلنا {arabicName(name, mapping) || name}</span>
      <Button variant="secondary" size="md" icon={ArrowCounterClockwise} onClick={onUndo}>تراجع</Button>
      <i className="pv-undo-clock" style={{ animationDuration: `${UNDO_MS}ms` }} aria-hidden="true" />
    </div>
  )
}
