import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Medal from './Medal.jsx'
import { achText } from './achievementMeta.js'
import { revealMode } from './medalQueue.js'
import { FONT, loadStage, medalItems, stageKey, takeStage, giveBack } from './medalStage.js'
import { RARITY_COLORS } from '../../constants.js'
import { animate, reducedMotion } from '../../motion.js'
import { mark, resetMarks } from '../../perf.js'
import '../../styles/medal-reveal.css'

// ── A medal that spins ────────────────────────────────────────
//
// The medal itself, in its own art, coming out of the depth and turning
// on its metal edge (medal3d.js, hand-written WebGL). The module is a
// separate chunk (medalStage.js loads it) — a summary with no medal never
// fetches it — and nothing waits for it: the stage is there and lit from
// the first frame, the medal arrives when `play` turns true.
//
//   items    achievements, already in the order they should play
//            (medalQueue.js); one or two
//   play     start the reveal — the caller's beat (the summary: right
//            after its numbers; the medal sheet: as it opens, every time)
//   skip     land everything now, facing front (the summary's tap)
//   onLand(items, { skipped })  as medals land: one by one, or all the
//            ones still in the air at once when skipped — the caller
//            plays the sound and the buzz
//   variant  'summary' (titles under the medals) · 'sheet' (the sheet
//            has the title already)
//
// The beat never waits for the 3D stage. The stage kept ready
// (medalStage.js: built ahead as the session finishes, or the medal
// sheet's, parked between openings) is taken — as it is if it was built
// for these medals, else with these medals prepared on it; with none
// kept, one is built now. If it is not ready when `play` comes —
// pictures baked, GPU pipelines warm — the flat medal plays this showing,
// on time, and the 3D one is let go when it arrives (switching renderers
// mid-flight would show as a jump).
//
// Fallbacks, each a decision in medalQueue.js revealMode():
//   no WebGL, the chunk can't load, the medal's picture can't be built
//   (a 2D canvas refused — iOS caps canvas memory), the stage isn't ready
//   on the beat, or the context is lost and doesn't come back within 3 s
//   (iOS drops them in the background) → the app's own flat medal
//   (Medal.jsx) turning on a CSS rotateY instead (already standing, if a
//   skip was asked for);
//   the phone asks for less motion → no spin, a fade (both kinds);
//   no art pack → the module composes the face from Medal.jsx's parts
//   (disc, glyph, engraved number), so nothing is ever a broken image.
//
// The GL context is freed (WEBGL_lose_context) when the summary closes:
// iOS allows only a handful at once. The sheet's is parked for the next
// medal instead — one context for the whole medal wall, freed with it.

// The flat medal's turn, and how far apart a pair turns: the second sets
// off a second after the first (the 3D pair lands about a second apart too).
const FLAT_TURN = 1500
const FLAT_APART = 1000

export default function MedalReveal({ items, date = '', variant = 'summary', play = false, skip = false, onLand, className = '' }) {
  const host = useRef(null)
  const stage = useRef(null)
  const abandon = useRef(null)
  const flatRefs = useRef([])
  const st = useRef({ played: false, landed: new Set(), skipped: false, anims: [], late: false })
  const land = useRef(onLand)
  land.current = onLand
  const [mode, setMode] = useState('wait')        // wait · gl · flat
  const [state, setState] = useState('ready')      // ready · playing · landed
  const reduced = reducedMotion()
  const motion = revealMode({ webgl: mode !== 'flat', reduced })
  const ids = items.map(a => a.id).join(',')
  const list = useMemo(() => medalItems(items), [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  const landed = (idx, skipped) => {
    const s = st.current
    const fresh = idx.filter(i => !s.landed.has(i))
    fresh.forEach(i => s.landed.add(i))
    if (s.landed.size >= items.length) setState('landed')
    if (fresh.length) {
      try { land.current?.(fresh.map(i => items[i]), { skipped }) } catch {}
    }
  }

  // The GL stage gives up (its picture couldn't be built): the flat medal
  // takes over from here — the flat effect below plays it, or stands it
  // there if a skip was already asked for.
  const giveUp = (s) => {
    if (stage.current !== s) return
    stage.current = null
    try { s.destroy() } catch {}
    setMode('flat')
  }

  // The stage: the one kept ready, or one built now. It is handed the
  // reveal only once it is ready to play.
  useEffect(() => {
    let alive = true
    let building = null
    let owned = false
    const S = st.current
    const labels = variant !== 'sheet'
    if (variant === 'sheet') resetMarks()   // (timing marks: each opening its own timeline)
    // The phone turned, the sheet changed width: the stage re-measures, so
    // the medals and their titles stay centred on it.
    let ro = null
    try {
      ro = new ResizeObserver(() => { try { stage.current?.resize() } catch {} })
      ro.observe(host.current)
    } catch { ro = null }
    const own = (s) => {
      if (!s) { if (alive) setMode('flat'); return }
      owned = true   // from here this reveal frees it, parks it, or plays it
      // too late — the beat came and the flat medal has this showing — or gone
      if (!alive || S.late || !host.current) {
        if (variant === 'sheet') giveBack(s)   // ready for the next medal opened
        else { try { s.destroy() } catch {} }
        taken?.release()
        return
      }
      s.set({
        labels,
        onLand: (i) => landed([i], false),
        onFallback: () => {
          // lost for good: the flat medal takes over, already landed if it had
          if (stage.current === s) { stage.current = null; s.destroy() }
          if (alive) setMode('flat')
        },
      })
      s.mount(host.current)
      taken?.release()
      stage.current = s
      mark('medal:ready')
      setMode('gl')
    }
    // prepared on a stage kept ready, or on one built now
    const prepareOn = (s) => {
      building = s
      s.prepare(list, { warm: true }).then(
        () => { building = null; own(s) },
        () => { building = null; try { s.destroy() } catch {} own(null) },
      )
    }
    const build = () => {
      loadStage().then((m) => {
        if (!alive || !host.current || (S.late && variant !== 'sheet')) return
        let s = null
        try { s = m.default(host.current, { font: FONT, date, reduced: reducedMotion, labels }) } catch { s = null }
        if (!s || !s.webgl) { try { s?.destroy() } catch {} own(null); return }
        mark('medal:stage')
        prepareOn(s)
      }, () => own(null))
    }
    // The summary's medals went flat (the stage missed the beat): stop
    // building it now rather than finish and throw it away — that work
    // would land in the middle of the flat medals' flight. (The sheet's
    // is finished and parked for the next medal.)
    abandon.current = () => {
      if (variant === 'sheet') return
      try { building?.destroy() } catch {}
      building = null
      if (taken && !owned) taken.dispose()
    }
    const taken = takeStage(stageKey(list, date))
    if (taken) {
      mark(taken.fresh ? 'medal:warm-taken' : 'medal:kept-taken')
      taken.ready.then((s) => {
        if (!alive) { taken.dispose(); return }
        if (!s) { taken.dispose(); build(); return }
        if (taken.fresh) own(s)
        else { s.set({ date }); prepareOn(s) }
      })
    } else build()
    return () => {
      alive = false
      try { ro?.disconnect() } catch {}
      S.anims.forEach(a => { try { a.cancel() } catch {} })
      const s = stage.current
      stage.current = null
      // the sheet's stage waits for the next medal; the summary's is freed
      if (s) { if (variant === 'sheet') giveBack(s); else { try { s.destroy() } catch {} } }
      try { building?.destroy() } catch {}
      if (taken && !owned) taken.dispose()
    }
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  // On the beat: the 3D stage plays if it is ready; if it isn't, the flat
  // medal plays now instead of waiting for it.
  useEffect(() => {
    const S = st.current
    if (!play && !skip) return
    if (mode === 'wait') {
      S.late = true
      mark('medal:late')
      abandon.current?.()
      setMode('flat')
      return
    }
    const s = stage.current
    if (mode !== 'gl' || !s) return
    if (!S.played) {
      S.played = true
      mark('medal:play-gl')
      setState('playing')
      s.play(list, { delay: 0 }).then(() => {
        if (stage.current !== s) return
        if (S.skipped) { s.skip(); landed(items.map((_, i) => i), true) }
      }, () => giveUp(s))
    }
    if (skip && !S.skipped) {
      S.skipped = true
      if (s.medals.length) { s.skip(); landed(items.map((_, i) => i), true) }
    }
  }, [mode, play, skip]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play (and skip) the flat fallback: a CSS turn, one after the other —
  // or, asked for less motion, a fade, both together.
  useLayoutEffect(() => {
    const S = st.current
    if (mode !== 'flat') return
    const els = flatRefs.current.slice(0, items.length)
    const finishAll = (skipped) => {
      S.anims.forEach(a => { try { a.cancel() } catch {} })
      S.anims = []
      els.forEach(el => { if (el) el.style.opacity = '1' })
      landed(items.map((_, i) => i), skipped)
    }
    // Skipped, or already landed on the GL stage before its context was
    // lost: the flat medals simply stand there.
    if (skip || S.landed.size >= items.length) {
      if (S.landed.size < items.length || S.anims.length) finishAll(!!skip)
      return
    }
    if (!play || S.flatPlayed) return
    S.flatPlayed = true
    S.played = true
    mark('medal:play-flat')
    setState('playing')
    const fade = revealMode({ webgl: false, reduced: reducedMotion() }) === 'flat-fade'
    // (lost mid-flight on the GL stage: only the ones still in the air turn)
    els.filter((_, i) => !S.landed.has(i)).forEach((el, k) => {
      const i = els.indexOf(el)
      if (!el) return
      const a = fade
        ? animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 500, delay: k * 150, e: 'linear', fill: 'both' })
        : animate(el, [
          { opacity: 0, transform: 'perspective(600px) translateY(-18px) rotateY(-720deg) scale(.55)' },
          { opacity: 1, offset: 0.18 },
          { opacity: 1, transform: 'perspective(600px) rotateY(0deg) scale(1)' },
        ], { d: FLAT_TURN, delay: k * FLAT_APART, e: 'cubic-bezier(.16,.84,.3,1)', fill: 'both' })
      if (!a) { el.style.opacity = '1'; landed([i], false); return }
      S.anims.push(a)
      a.finished.then(() => { mark(`flat:land:${i}`); landed([i], false) }, () => {})
    })
  }, [mode, play, skip, ids]) // eslint-disable-line react-hooks/exhaustive-deps

  // A tap on a landed flat medal turns it once more (the GL one spins on its own).
  const again = (i) => (e) => {
    if (!st.current.landed.has(i)) return
    e.stopPropagation()
    if (reducedMotion()) return
    animate(flatRefs.current[i], [
      { transform: 'perspective(600px) rotateY(-360deg)' },
      { transform: 'perspective(600px) rotateY(0deg)' },
    ], { d: 1100, e: 'cubic-bezier(.16,.84,.3,1)' })
  }

  const two = items.length > 1
  return (
    <div className={`mr mr-${variant}${two ? ' mr-two' : ''} ${className}`}
      data-testid="medal-reveal" data-mode={mode} data-motion={motion} data-state={state} data-order={ids}>
      <div className="mr-stage" ref={host} aria-hidden="true">
        {mode === 'flat' && (
          <div className="mr-flat">
            {items.map((a, i) => (
              <div key={a.id} className="mr-flat-one" ref={el => { flatRefs.current[i] = el }}
                style={{ opacity: st.current.landed.has(i) ? 1 : 0 }} onClick={again(i)}>
                <Medal achievement={a} earned size={variant === 'sheet' ? 132 : two ? 104 : 132} showUnit={!two} />
                {variant !== 'sheet' && (
                  <span className={`mr-flat-lab m3-${a.rarity || 'common'}`}>
                    <b>{achText(a).title}</b>
                    <small>{RARITY_COLORS[a.rarity]?.label || 'عادي'}</small>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* What the stage shows, for a screen reader — whichever way it is drawn. */}
      {variant !== 'sheet' && (
        <ul className="mr-sr">
          {items.map(a => <li key={a.id}>{achText(a).title} · {RARITY_COLORS[a.rarity]?.label || 'عادي'}</li>)}
        </ul>
      )}
    </div>
  )
}
