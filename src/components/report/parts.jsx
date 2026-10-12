// ── Shared pieces of the report ───────────────────────────────
// The building blocks every section shares, so a number, a section and
// a line of text look the same wherever they appear. Styles live in
// src/styles/screens/report.css.

import { useCountUp, useReveal } from '../../hooks/useMotion.js'
import { todayKey } from '../../day.js'
import { Num } from '../kit/index.jsx'

export const AR = (n) => Number(n || 0).toLocaleString('en-US')

const cx = (...a) => a.filter(Boolean).join(' ')

// The deload blue (tokens.css --deload): the report is usually read
// after the stretch ended, when the app's palette is back to normal, and
// this colour has to mean «تخفيف» wherever it is seen. One token, not a
// hex repeated in three files; the ticket stays the rest blue.
export const DELOAD_INK = 'var(--deload)'

// ── A number that counts up once and then rests ────────────────
// Under reduced motion useCountUp hands back the final value at once.
export function Counted({ value, run = true, duration = 900 }) {
  const shown = useCountUp(value, { run, duration })
  return <Num>{AR(shown)}</Num>
}

// ── Arabic text with its numbers kept the right way round ──────
// Every number or Latin run — «+12.5», «Bench Press», «10 إلى 20» — is
// isolated LTR inside <bdi dir="ltr">, so a sign never ends up on the
// wrong side of its digits and a Latin name never reorders the words
// around it.
const RUN = /[+\-−]?[0-9A-Za-z][0-9A-Za-z.,:%×+\-−/'’ ]*[0-9A-Za-z%]|[+\-−]?[0-9A-Za-z]/g

export function Bidi({ text }) {
  const s = String(text ?? '')
  const out = []
  let last = 0
  for (const m of s.matchAll(RUN)) {
    if (m.index > last) out.push(s.slice(last, m.index))
    out.push(<Num key={m.index}>{m[0]}</Num>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return <>{out}</>
}

/** «+12.5» — a gain, its sign on the left of its digits in any context. */
export function Gain({ kg, unit = 'كجم' }) {
  const v = Math.round(Number(kg) * 10) / 10
  return (
    <span className="rp-gain">
      <bdi dir="ltr" className="k-num">{`+${AR(v)}`}</bdi>
      {unit && <span className="rp-gain-u"> {unit}</span>}
    </span>
  )
}

// ── A section: the small question, the one sentence that answers it ──
// No numbers, no boxes, no notes explaining the code. Whatever needs
// reading instructions gets one grey line under its picture instead.
export function Section({ id, q, lead, children, className }) {
  const [ref, run] = useReveal({ threshold: 0.08 })
  return (
    <section
      ref={ref}
      id={id}
      className={cx('rp-ch', 'mr-section', run ? 'rp-on' : 'rp-off', className)}
      aria-labelledby={`${id}-q`}
    >
      <header className="rp-ch-h rp-in">
        <h2 className="rp-ch-q" id={`${id}-q`}>{q}</h2>
        {lead && <p className="rp-ch-lead"><Bidi text={lead} /></p>}
      </header>
      {children}
    </section>
  )
}

// ── The wordmark ───────────────────────────────────────────────
// The bundled light mark, cropped to its ink (172×67 of a 192×192
// canvas) so it is drawn at the size asked for rather than as a speck
// in a field of transparent margin. The same crop is used on the
// poster (reportPoster.js).
export const WORDMARK = { src: '/assets/app_logo_full_light.png', w: 192, h: 192, ink: { x: 10, y: 62, w: 172, h: 67 } }

export function Wordmark({ height = 24, className }) {
  const k = height / WORDMARK.ink.h
  return (
    <span
      className={cx('rp-mark', className)}
      role="img"
      aria-label="مران"
      style={{ width: Math.round(WORDMARK.ink.w * k), height }}
    >
      <img
        src={WORDMARK.src}
        alt=""
        draggable="false"
        style={{
          width: WORDMARK.w * k, height: WORDMARK.h * k,
          transform: `translate(${-WORDMARK.ink.x * k}px, ${-WORDMARK.ink.y * k}px)`,
        }}
      />
    </span>
  )
}

// ── Has this month finished? ───────────────────────────────────
// The report is offered on the last two days of a month as well as the
// first week after it. While the month is still running an «end of
// month» figure would be a forecast, so whatever shows one asks this
// first. Day keys turn at 03:00, like every other day in the app.
export const monthOver = (month, today = todayKey()) => String(today).slice(0, 7) > month
