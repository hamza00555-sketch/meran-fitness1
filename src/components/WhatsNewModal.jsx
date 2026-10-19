// ── «جديد في مران» ────────────────────────────────────────────
//
// حمزة: «نبا نرجع ميزة شرح التحديثات الجديدة لما الواحد يدخل التطبيق».
//
// Once per version, after an update (App decides when: never on a fresh
// install, and only once nothing else is on Home — the session summary,
// the level-up screen, «كسبت يوم راحة», the art offer, «خطتي», the
// builder — see App.jsx). It lists every entry since the version he last
// saw (src/whatsNew.js), newest first, from WHATS_NEW in constants.js.
//
// The kit's sheet (one scrim, the app inert behind it, pull down to close,
// the scroll lock of src/scrollLock.js). On top, the app's own icon on a
// light — the lit moment; then one block per version: «الإصدار 3.4» and
// its date, and its items, each a Phosphor icon in its well, a bold title
// and one plain line. «تمام» marks the version seen. It comes in as the
// rest of the app does (src/motion.js): the icon on the bouncy spring, the
// lines rising one after another; reduced motion: a fade.
//
// Never over a session: a workout restored at launch opens the player as
// a cover, and the sheet waits (useScreenClear) until no full-screen layer
// is up, then opens and stays open.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Sheet, Button, Num } from './kit/index.jsx'
import {
  ShieldCheck, ArrowsClockwise, Sparkle, ListChecks, ClockCounterClockwise, Target, Trophy,
  YoutubeLogo, Flame, ChartBar, Barbell, Lightning, Medal, Image, WifiSlash, Palette, Notepad,
  Moon, Timer, Bell, Users, Repeat,
} from './kit/icons.js'
import { useScreenClear } from './system/layers.js'
import { withNums } from './home/HomeBits.jsx'
import { fmtDayAr } from '../streak.js'
import { animate, reducedMotion, rise } from '../motion.js'
import '../styles/screens/system.css'

// Every name in WN_ICONS (src/whatsNew.js); tests/whats-new.test.mjs checks the two agree.
const ICONS = {
  ShieldCheck, ArrowsClockwise, Sparkle, ListChecks, ClockCounterClockwise, Target, Trophy,
  YoutubeLogo, Flame, ChartBar, Barbell, Lightning, Medal, Image, WifiSlash, Palette, Notepad,
  Moon, Timer, Bell, Users, Repeat,
}

const updatesWord = (n) => (n === 2 ? 'تحديثين' : n <= 10 ? `${n} تحديثات` : `${n} تحديث`)

export default function WhatsNewModal({ entries = [], onClose }) {
  const [started, setStarted] = useState(false)
  const clear = useScreenClear(!started)
  useEffect(() => { if (clear) setStarted(true) }, [clear])

  // Closing plays the sheet's way out before the parent unmounts it.
  const [closing, setClosing] = useState(false)
  const done = useRef(false)
  const close = useCallback(() => {
    if (done.current) return
    done.current = true
    setClosing(true)
    setTimeout(() => onClose?.(), 230)
  }, [onClose])

  // The way in, once, when the sheet's content first lands in the page.
  const played = useRef(false)
  const enter = useCallback((el) => {
    if (!el || played.current) return
    played.current = true
    if (reducedMotion()) { animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 200, e: 'linear' }); return }
    animate(el.querySelector('.sys-wn-mark'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { spring: 'bouncy', delay: 120 })
    animate(el.querySelector('.sys-wn-mark-light'), [{ opacity: 0 }, { opacity: 1 }], { d: 600, delay: 80 })
    const lines = [...el.querySelectorAll('.sys-wn-eyebrow, .sys-wn-title, .sys-wn-meta, .sys-wn-ver-h, .sys-wn-item')].slice(0, 10)
    lines.forEach((n, k) => animate(n, rise(12), { spring: 'smooth', delay: 180 + k * 45 }))
  }, [])

  const titleId = useId()
  const one = entries.length === 1
  const latest = entries[0]
  if (!latest) return null

  return (
    <Sheet
      open={started && !closing}
      onClose={close}
      labelledBy={titleId}
      footer={<Button variant="primary" size="lg" full onClick={close} data-testid="whats-new-ok">تمام</Button>}
    >
      <div className="sys-wn" data-testid="whats-new" ref={enter}>
        <header className="sys-wn-hero">
          <span className="sys-wn-mark-wrap" aria-hidden="true">
            <span className="sys-wn-mark-light" />
            <img className="sys-wn-mark" src="/assets/meran-app-icon-transparent-180.png" alt="" width="76" height="76" decoding="async" />
          </span>
          <p className="sys-wn-eyebrow">جديد في مران</p>
          <h2 id={titleId} className="sys-wn-title">
            {one ? <>الإصدار <Num>{latest.version}</Num></> : 'وش تغيّر من آخر مرة'}
          </h2>
          <p className="sys-wn-meta">
            {one ? withNums(fmtDayAr(latest.date, { weekday: false })) : withNums(updatesWord(entries.length))}
          </p>
        </header>

        {entries.map(entry => (
          <section key={entry.version} className="sys-wn-ver" data-version={entry.version}
            aria-label={one ? undefined : `الإصدار ${entry.version}`}>
            {!one && (
              <h3 className="sys-wn-ver-h">
                <span>الإصدار <Num>{entry.version}</Num></span>
                <span className="sys-wn-date">{withNums(fmtDayAr(entry.date, { weekday: false }))}</span>
              </h3>
            )}
            <ul className="sys-wn-list">
              {entry.items.map(({ icon, tone, title, line }) => {
                const Icon = ICONS[icon] || Sparkle
                return (
                  <li key={title} className="sys-wn-item">
                    <span className={`sys-wn-glyph${tone ? ` is-${tone}` : ''}`} aria-hidden="true">
                      <Icon size={22} weight={tone ? 'fill' : 'bold'} />
                    </span>
                    <div className="sys-wn-item-text">
                      <p className="sys-wn-item-t">{title}</p>
                      <p className="sys-wn-item-l">{withNums(line)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
