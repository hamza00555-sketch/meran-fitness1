// ── Shared pieces of the report ───────────────────────────────
// The building blocks the cover and the five chapters share, so a
// number, a chapter heading and a line of engine text look the same
// wherever they appear. Styles live in src/styles/screens/report.css.

import { useCountUp, useReveal } from '../../hooks/useMotion.js'
import { EXERCISE_MEDIA } from '../../exerciseMedia.js'
import { todayKey } from '../../day.js'
import { Num } from '../kit/index.jsx'

export const AR = (n) => Number(n || 0).toLocaleString('en-US')

const cx = (...a) => a.filter(Boolean).join(' ')

// ── A number that counts up once and then rests ────────────────
// One beat: it climbs while its section arrives and stops. Under
// reduced motion useCountUp hands back the final value immediately.
export function Counted({ value, run = true, duration = 900 }) {
  const shown = useCountUp(value, { run, duration })
  return <Num>{AR(shown)}</Num>
}

// ── Engine text, made to read in Arabic ────────────────────────
// The tips are written by monthReport.js, which knows exercises by
// their English names and writes «٪12» with the Arabic percent sign.
// Here, and only here, the line is made presentable: an exercise the
// app has an Arabic name for is called by it, the percent goes after
// a Western number, and every Latin or numeric run is isolated LTR so
// «Leg Press, Squat» or «1.52» never reorders inside the Arabic.

const NAMES = Object.keys(EXERCISE_MEDIA).sort((a, b) => b.length - a.length)
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NAME_RE = new RegExp(`\\b(${NAMES.map(escape).join('|')})\\b`, 'g')

export const arabize = (text) =>
  String(text ?? '')
    .replace(NAME_RE, (m) => EXERCISE_MEDIA[m]?.ar || m)
    .replace(/٪\s?(\d+(?:\.\d+)?)/g, '$1%')
    .replace(/\b(\d+) PR\b/g, (_, n) => (Number(n) === 0 ? 'ولا رقم قياسي' : `${n} ${Number(n) === 1 ? 'رقم قياسي' : 'أرقام قياسية'}`))
    .replace(/رقم قياسي جديدة/g, 'رقم قياسي جديد')

const RUN = /[+\-−]?[0-9A-Za-z][0-9A-Za-z.,:%×+\-−/'’ ]*[0-9A-Za-z%]|[+\-−]?[0-9A-Za-z]/g

/** Arabic text with every number or Latin run wrapped in <Num>. */
export function Bidi({ text, arabic = true }) {
  const s = arabic ? arabize(text) : String(text ?? '')
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

// ── A chapter: hairline, number, title ─────────────────────────
// No box. The number is the report's own index (01–05, Archivo) and
// matches the button that jumps to it in the bottom bar.
export function Chapter({ id, n, title, note, children, className }) {
  const [ref, run] = useReveal({ threshold: 0.08 })
  return (
    <section
      ref={ref}
      id={id}
      data-chapter={id}
      className={cx('rp-ch', 'mr-section', run ? 'rp-on' : 'rp-off', className)}
      aria-labelledby={`${id}-t`}
    >
      <header className="rp-ch-h rp-in">
        <span className="rp-ch-n"><Num>{String(n).padStart(2, '0')}</Num></span>
        <h2 className="rp-ch-title" id={`${id}-t`}>{title}</h2>
        {note && <p className="rp-ch-note">{note}</p>}
      </header>
      {children}
    </section>
  )
}

// ── A figure: a broadcast number with its label under it ───────
export function Figure({ value, label, tone, i = 0, suffix }) {
  return (
    <div className={cx('rp-fig', 'rp-in', tone && `is-${tone}`)} style={{ '--i': i }}>
      <b className="rp-fig-v"><Num>{typeof value === 'number' ? AR(value) : value}{suffix}</Num></b>
      <span className="rp-fig-l">{label}</span>
    </div>
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
