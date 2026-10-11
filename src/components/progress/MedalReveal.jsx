import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Medal from './Medal.jsx'
import { medalFace, achText } from './achievementMeta.js'
import { revealMode } from './medalQueue.js'
import { achSlot } from '../../assets/slots.js'
import { urlFor } from '../../assets/registry.js'
import { RARITY_COLORS } from '../../constants.js'
import { animate, reducedMotion } from '../../motion.js'
import '../../styles/medal-reveal.css'

// ── A medal that spins ────────────────────────────────────────
//
// The medal itself, in its own art, coming out of the depth and turning
// on its metal edge (medal3d.js, hand-written WebGL). The module is a
// separate chunk, fetched the moment this mounts — so a summary with no
// medal never loads it — and nothing waits for it: the stage is there
// and lit from the first frame, the medal arrives when `play` turns true.
//
//   items    achievements, already in the order they should play
//            (medalQueue.js); one or two
//   play     start the reveal (the summary: after its last line; the
//            medal sheet: as it opens — every time it opens)
//   skip     land everything now, facing front (the summary's tap)
//   onLand(items, { skipped })  as medals land: one by one, or all the
//            ones still in the air at once when skipped — the caller
//            plays the sound and the buzz
//   variant  'summary' (titles under the medals) · 'sheet' (the sheet
//            has the title already)
//
// Fallbacks, each a decision in medalQueue.js revealMode():
//   no WebGL, the chunk can't load, or the context is lost and doesn't
//   come back within 3 s (iOS drops them in the background) → the app's
//   own flat medal (Medal.jsx) turning on a CSS rotateY instead;
//   the phone asks for less motion → no spin, a fade (both kinds);
//   no art pack → the module composes the face from Medal.jsx's parts
//   (disc, glyph, engraved number), so nothing is ever a broken image.
//
// The GL context is freed (WEBGL_lose_context) on unmount: iOS allows only
// a handful at once, and every sheet opening makes a new one.

const FONT = "'Meran Latin','Meran Arabic',sans-serif"

let loader = null
const loadStage = () => loader || (loader = import('./medal3d.js')
  .then(m => m.default)
  .catch((e) => { loader = null; throw e }))

/** The SVG path(s) of a rendered Phosphor glyph, as one string for Path2D. */
const pathOf = (root, id) => {
  const el = root?.querySelector(`[data-glyph="${id}"]`)
  return el ? [...el.querySelectorAll('path')].map(p => p.getAttribute('d')).filter(Boolean).join(' ') : ''
}

export default function MedalReveal({ items, date = '', variant = 'summary', play = false, skip = false, onLand, className = '' }) {
  const host = useRef(null)
  const glyphs = useRef(null)
  const stage = useRef(null)
  const flatRefs = useRef([])
  const st = useRef({ played: false, landed: new Set(), skipped: false, anims: [] })
  const land = useRef(onLand)
  land.current = onLand
  const [mode, setMode] = useState('wait')        // wait · gl · flat
  const [state, setState] = useState('ready')      // ready · playing · landed
  const reduced = reducedMotion()
  const motion = revealMode({ webgl: mode !== 'flat', reduced })
  const ids = items.map(a => a.id).join(',')

  const list = () => items.map(a => {
    const mark = medalFace(a).mark
    return {
      id: a.id,
      title: achText(a).title,
      word: RARITY_COLORS[a.rarity]?.label || 'عادي',
      rarity: a.rarity || 'common',
      art: urlFor(achSlot(a.id)) || null,
      glyph: pathOf(glyphs.current, a.id),
      n: mark?.n || '',
    }
  })

  const landed = (idx, skipped) => {
    const s = st.current
    const fresh = idx.filter(i => !s.landed.has(i))
    fresh.forEach(i => s.landed.add(i))
    if (s.landed.size >= items.length) setState('landed')
    if (fresh.length) {
      try { land.current?.(fresh.map(i => items[i]), { skipped }) } catch {}
    }
  }

  // The stage: fetched and built at once, the art prepared ahead of time.
  useEffect(() => {
    let alive = true
    const flat = () => { if (alive) setMode('flat') }
    loadStage().then((MedalStage) => {
      if (!alive || !host.current) return
      let s = null
      try {
        s = MedalStage(host.current, {
          font: FONT, date, reduced: reducedMotion, labels: variant !== 'sheet',
          onLand: (i) => landed([i], false),
          onFallback: () => {
            // lost for good: the flat medal takes over, already landed if it had
            if (stage.current === s) { stage.current = null; s.destroy() }
            flat()
          },
        })
      } catch { s = null }
      if (!s || !s.webgl) { try { s?.destroy() } catch {} flat(); return }
      stage.current = s
      setMode('gl')
      s.prepare(list()).catch(() => {})
    }, flat)
    return () => {
      alive = false
      st.current.anims.forEach(a => { try { a.cancel() } catch {} })
      const s = stage.current
      stage.current = null
      try { s?.destroy() } catch {}
    }
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play (and skip) on the GL stage.
  useEffect(() => {
    const s = stage.current
    const S = st.current
    if (mode !== 'gl' || !s) return
    if ((play || skip) && !S.played) {
      S.played = true
      setState('playing')
      s.play(list()).then(() => {
        if (stage.current !== s) return
        if (S.skipped) { s.skip(); landed(items.map((_, i) => i), true) }
      }, () => {})
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
    setState('playing')
    const fade = revealMode({ webgl: false, reduced: reducedMotion() }) === 'flat-fade'
    // (lost mid-flight on the GL stage: only the ones still in the air turn)
    els.filter((_, i) => !S.landed.has(i)).forEach((el, k) => {
      const i = els.indexOf(el)
      if (!el) return
      const a = fade
        ? animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 500, delay: 150 + k * 120, e: 'linear', fill: 'both' })
        : animate(el, [
          { opacity: 0, transform: 'perspective(600px) translateY(-18px) rotateY(-720deg) scale(.55)' },
          { opacity: 1, offset: 0.18 },
          { opacity: 1, transform: 'perspective(600px) rotateY(0deg) scale(1)' },
        ], { d: 1500, delay: 200 + k * 1700, e: 'cubic-bezier(.16,.84,.3,1)', fill: 'both' })
      if (!a) { el.style.opacity = '1'; landed([i], false); return }
      S.anims.push(a)
      a.finished.then(() => landed([i], false), () => {})
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
      {/* The glyphs the composed face is drawn from (no art pack). */}
      <span ref={glyphs} hidden>
        {items.map(a => {
          const G = medalFace(a).glyph
          return <span key={a.id} data-glyph={a.id}><G weight="fill" size={256} /></span>
        })}
      </span>
    </div>
  )
}
