import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Num, Gauge } from '../kit/index.jsx'
import { Trophy, Medal as MedalIcon, ArrowUp } from '../kit/icons.js'
import LiveFlame from '../streak/LiveFlame.jsx'
import RollNumber from '../RollNumber.jsx'
import MedalReveal from '../progress/MedalReveal.jsx'
import MedalBadge from '../progress/Medal.jsx'
import { medalQueue, heaviestFeel } from '../progress/medalQueue.js'
import { achText } from '../progress/achievementMeta.js'
import { arabicName } from '../../exerciseMedia.js'
import { xpProgress, durationParts } from '../../utils.js'
import { animate, reducedMotion, EASE } from '../../motion.js'
import { play as playSound, load as loadSound } from '../../sound.js'
import { haptic } from '../../haptics.js'
import '../../styles/summary.css'
import { lockScroll } from '../../scrollLock.js'

// ── The end of a workout ──────────────────────────────────────
// Finishing used to fire up to five effects in different places and
// queue toasts over the header for 13 seconds or more. Now: one screen,
// beats about a third of a second apart, then still until you tap
// «تم». A tap anywhere jumps to the final frame. The level-up and any
// achievements earned land here instead of on top of you mid-set.
//
// The moments (motion phases 2 and 4):
//   • the numbers count up from zero as their line arrives — minutes,
//     sets, tons, 120ms apart (durations keep durationParts' form);
//   • «أعلى وزن»: the trophy hops and the weight rolls from the old best;
//   • the streak: the flame lights and the number rolls up;
//   • the level bar fills from where the session started, the XP counts;
//   • «إنجازات جديدة» sits right under the numbers, and after the last
//     line the medals arrive and spin on their metal edge (MedalReveal):
//     the rarer first, the second when the first has landed; three or
//     more (rare) — the two rarest spin, the rest sit in a row under
//     them. Each landing has its sound and buzz, the bell from rare up.
// «تم» works from the first frame, the medal module loads beside the
// summary and never holds it up, and a tap anywhere lands everything —
// a tap on a landed medal spins it again instead.
// Reduced motion: the numbers are there from the start, the medals fade.

const BEAT = 320
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

const LOCALE = 'ar-u-ca-gregory-nu-latn'
const today = () => {
  try { return new Date().toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' }
}

/** True once `at` ms have passed since the summary opened (re-armed if `at` moves first). */
function useAt(t0, at, skip) {
  const [on, setOn] = useState(() => skip || performance.now() - t0 >= at)
  useEffect(() => {
    if (on) return
    if (skip) { setOn(true); return }
    const t = setTimeout(() => setOn(true), Math.max(0, t0 + at - performance.now()))
    return () => clearTimeout(t)
  }, [at, skip, on, t0])
  return on
}

/** A number counting up from zero once its line is in — or the final number, skipped or reduced. */
function Tally({ to, t0, at, dur = 900, skip, fmt = (v) => Math.round(v) }) {
  const still = skip || reducedMotion()
  const [v, setV] = useState(still ? to : 0)
  const cur = useRef(still ? to : 0)
  useEffect(() => {
    if (skip || reducedMotion()) { cur.current = to; setV(to); return }
    let raf = 0
    const from = cur.current
    // Timed from when it was due, not from the first frame that came: a
    // busy moment (the medal stage building) skips the count ahead
    // instead of starting it late.
    const start = Math.max(performance.now(), t0 + at)
    const step = (now) => {
      const k = Math.max(0, Math.min(1, (now - start) / dur))
      cur.current = from + (to - from) * easeOut(k)
      setV(cur.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    const t = setTimeout(() => { raf = requestAnimationFrame(step) }, Math.max(0, t0 + at - performance.now()))
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [to, skip]) // eslint-disable-line react-hooks/exhaustive-deps
  return <Num>{fmt(v)}</Num>
}

export default function SessionSummary({ summary, xp, onDone }) {
  const [skipped, setSkipped] = useState(false)
  const t0 = useRef(performance.now()).current
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onDone() }
    window.addEventListener('keydown', onKey)
    const release = lockScroll()
    return () => { window.removeEventListener('keydown', onKey); release() }
  }, [onDone])

  const s = summary
  const queue = useMemo(() => medalQueue(s?.achievements || []), [s?.achievements])
  const hasMedals = queue.stage.length > 0

  // The beats, in order: what is on screen decides the numbering.
  let beat = 0
  const B = {}
  B.eyebrow = beat++; B.title = beat++; B.stats = beat++
  if (hasMedals) B.medals = beat++
  if (s?.prs?.length) B.prs = beat++
  B.streak = beat++; B.xp = beat++; B.foot = beat++
  const at = (k) => B[k] * BEAT
  const b = (k) => ({ '--b': B[k] })

  const prGo = useAt(t0, (B.prs ?? 0) * BEAT + 120, skipped)
  const streakGo = useAt(t0, at('streak') + 120, skipped)
  // the medals arrive after the summary's last line has landed
  const medalGo = useAt(t0, at('xp') + 240, skipped)

  // The medal sounds, decoded ahead of the landing.
  useEffect(() => { if (hasMedals) { loadSound('medal'); loadSound('medal-heavy') } }, [hasMedals])
  // the row of the rest (a third medal and on) comes once the two are down
  const [allDown, setAllDown] = useState(false)
  const down = useRef(0)
  const onLand = useCallback((items) => {
    const f = heaviestFeel(items.map(a => a.rarity))
    playSound(f.sound)
    haptic(f.haptic)
    down.current += items.length
    if (down.current >= queue.stage.length) setAllDown(true)
  }, [queue.stage.length])

  // The trophy of «أعلى وزن» hops as its line arrives.
  const trophy = useRef(null)
  useLayoutEffect(() => {
    if (!prGo || skipped || reducedMotion() || !trophy.current) return
    const a = animate(trophy.current, [{ transform: 'scale(.4) rotate(-12deg)' }, { transform: 'none' }], { spring: 'bouncy' })
    return () => { try { a?.finish() } catch {} }
  }, [prGo, skipped])

  // The level bar fills from where it stood before the session.
  const gauge = useRef(null)
  const xpNow = useRef(xp)
  xpNow.current = xp
  const summaryRef = useRef(s)
  summaryRef.current = s
  const gaugeAnim = useRef(null)
  useEffect(() => {
    if (reducedMotion() || !s) return
    // Set up as the line starts to come in (still transparent), holding
    // the old fill through the 120ms delay: the bar never shows its final
    // length first and then jumps back. The XP of the finish and of the
    // medals has all arrived by then.
    const t = setTimeout(() => {
      const fillEl = gauge.current?.querySelector('.k-gauge-fill')
      if (!fillEl) return
      const now = xpProgress(xpNow.current)
      const before = xpProgress(Math.max(0, xpNow.current - (summaryRef.current?.xp || 0)))
      const r0 = before.level < now.level ? 0 : before.currentXP / Math.max(1, before.neededXP)
      const r1 = now.currentXP / Math.max(1, now.neededXP)
      gaugeAnim.current = animate(fillEl, [{ transform: `scaleX(${r0})` }, { transform: `scaleX(${r1})` }],
        { d: 800, delay: Math.max(0, t0 + at('xp') + 120 - performance.now()), e: EASE.out })
    }, Math.max(0, t0 + at('xp') - performance.now()))
    return () => { clearTimeout(t); try { gaugeAnim.current?.cancel() } catch {} }
  }, [B.xp]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (skipped) { try { gaugeAnim.current?.finish() } catch {} } }, [skipped])

  if (!s) return null
  const { level, currentXP, neededXP } = xpProgress(xp)
  const dur = durationParts(s.duration)
  const hours = dur.unit === 'ساعة'
  const fmtDur = (v) => {
    const m = Math.round(v)
    return hours ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m)
  }
  const tons = s.volume / 1000
  const streakUp = s.streakBefore !== s.streakAfter
  const date = today()

  return createPortal(
    <div className={`sum${skipped ? ' sum-skip' : ''}`} role="dialog" aria-modal="true" aria-label="ملخص الجلسة"
      onClick={() => setSkipped(true)} data-testid="session-summary">
      <div className="sum-body">
        <span className="k-eyebrow sum-beat" style={b('eyebrow')}>انحفظت الجلسة</span>
        <h1 className="sum-title sum-beat" style={b('title')}>{s.title}</h1>
        <div className="sum-stats sum-beat" style={b('stats')}>
          <span><b><Tally to={s.duration} t0={t0} at={at('stats') + 80} skip={skipped} fmt={fmtDur} /></b><small>{dur.unit}</small></span>
          <span><b><Tally to={s.sets} t0={t0} at={at('stats') + 200} skip={skipped} /></b><small>مجموعة</small></span>
          <span><b><Tally to={tons} t0={t0} at={at('stats') + 320} skip={skipped} fmt={(v) => v.toFixed(1)} /></b><small>طن</small></span>
        </div>

        {hasMedals && (
          <section className="sum-sec sum-ach-sec sum-beat" style={b('medals')}>
            <h2><MedalIcon size={16} weight="fill" aria-hidden="true" /> إنجازات جديدة</h2>
            <MedalReveal key={queue.stage.map(a => a.id).join(',')} items={queue.stage} date={date}
              play={medalGo} skip={skipped} onLand={onLand} />
            {queue.rest.length > 0 && (
              <ul className={`sum-ach-rest${allDown || skipped ? ' on' : ''}`}>
                {queue.rest.map(a => (
                  <li key={a.id}>
                    <MedalBadge achievement={a} earned size={40} compact />
                    <span>{achText(a).title}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {s.prs.length > 0 && (
          <section className="sum-sec sum-beat" style={b('prs')}>
            <h2><span className="sum-trophy" ref={trophy}><Trophy size={16} weight="fill" aria-hidden="true" /></span> أعلى وزن</h2>
            {s.prs.map(p => (
              <div key={p.name} className="sum-pr">
                <span>{arabicName(p.name) || p.name}</span>
                <span className="sum-pr-v"><ArrowUp size={14} weight="bold" aria-hidden="true" />
                  {prGo && !skipped
                    ? <RollNumber className="sum-roll" from={p.prev} to={p.top} delay={160} stagger={50} />
                    : <Num>{prGo || skipped ? p.top : p.prev}</Num>}
                  {' '}كجم <small>(كان <Num>{p.prev}</Num>)</small></span>
              </div>
            ))}
          </section>
        )}

        <section className="sum-sec sum-beat" style={b('streak')}>
          <div className="sum-streak">
            <span className="sum-flame"><LiveFlame size={26} filled={!streakUp || streakGo} ignite={streakUp && streakGo} skip={skipped} /></span>
            <span className="sum-streak-n">
              {streakUp && <><Num>{s.streakBefore}</Num> ← </>}
              <b>{streakUp && streakGo && !skipped
                ? <RollNumber className="sum-roll" from={s.streakBefore} to={s.streakAfter} delay={260} />
                : <Num>{streakUp && !streakGo ? s.streakBefore : s.streakAfter}</Num>}</b>
            </span>
          </div>
          <p className="sum-line">{s.streakLine}</p>
        </section>

        <section className="sum-sec sum-beat" style={b('xp')}>
          <div className="sum-xp">
            <span>المستوى <Num>{level}</Num></span>
            <span className="sum-xp-gain"><Tally to={s.xp} t0={t0} at={at('xp') + 120} dur={800} skip={skipped} fmt={(v) => `+${Math.round(v)} XP`} /></span>
          </div>
          <div ref={gauge}><Gauge value={currentXP} max={neededXP} tone="accent" label="التقدم للمستوى الجاي" /></div>
          {s.levelUp && level >= s.levelUp && <p className="sum-levelup">مستوى جديد · <Num>{s.levelUp}</Num></p>}
        </section>
      </div>
      <div className="sum-foot sum-beat" style={b('foot')} onClick={e => e.stopPropagation()}>
        <Button variant="primary" size="lg" full onClick={onDone}>تم</Button>
      </div>
    </div>,
    document.body,
  )
}
