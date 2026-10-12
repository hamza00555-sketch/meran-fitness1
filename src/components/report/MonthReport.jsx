// ── The monthly report ────────────────────────────────────────
// A full-screen layer over the whole app (it covers the tab bar), in
// two fixed parts so nothing ever floats over the text:
//
//   1. a solid 56pt bar — close at the start, share at the end, both
//      neutral 44pt buttons; the month's name appears in it once the
//      cover has scrolled away;
//   2. the scroller — the cover (how many sessions he came to, around
//      the ring of the ones the plan asked for, and the one green
//      action, «شارك شهرك»), then the sections in the order the month
//      is told: when he trained, whether he got stronger, where the
//      work went, next month's plan, every other number, and the months
//      before.
//
// Each section is a small question and one sentence that answers it,
// with at most one picture and one grey line on how to read it. The
// numbered chapters and the index bar under them are gone: a report
// this short does not need a table of contents.
//
// Motion is entrances only: each piece arrives once, the number counts
// up once, and then the page is still. Under reduced motion nothing
// moves at all.

import { useEffect, useRef, useState } from 'react'
import { X, ShareFat } from '../kit/icons.js'
import { Bidi, Wordmark } from './parts.jsx'
import Cover from './Cover.jsx'
import Consistency from './sections/Consistency.jsx'
import Stronger from './sections/Stronger.jsx'
import Muscles from './sections/Muscles.jsx'
import NextMonth from './sections/NextMonth.jsx'
import AllNumbers from './sections/AllNumbers.jsx'
import Months from './sections/Months.jsx'
import '../../styles/screens/report.css'
import { lockScroll } from '../../scrollLock.js'

// ShareFat is a forward arrow: under RTL forward points left.
const ShareRtl = (props) => <ShareFat {...props} mirrored />

/** The share button in the bar: a neutral 44pt icon, a spinner while
 *  the poster is being drawn. */
function ShareIcon({ onShare, sharing }) {
  return (
    <button
      type="button"
      className="k-iconbtn k-iconbtn-ghost rp-bar-btn"
      style={{ width: 44, height: 44 }}
      onClick={onShare}
      disabled={sharing}
      aria-busy={sharing || undefined}
      aria-label={sharing ? 'جارٍ تجهيز صورة التقرير' : 'مشاركة التقرير'}
      title={sharing ? 'جارٍ تجهيز الصورة…' : 'مشاركة التقرير'}
    >
      {sharing
        ? <span className="rp-spin" aria-hidden="true" />
        : <ShareRtl size={22} weight="regular" aria-hidden="true" />}
    </button>
  )
}

export default function MonthReport({
  report, onClose, onShare, sharing = false,
  // Optional — the report works without them:
  mapping = {},          // the user's exercise aliases, for Arabic names
  liveStreak = null,     // the streak right now, for a month still running
  today,                 // the app's day key; defaults to todayKey()
  months = null,         // { trail, older } for the past-month picker
  onPickMonth,           // open another month's report in place
}) {
  const scroller = useRef(null)
  const closeBtn = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  const [pastCover, setPastCover] = useState(false)
  // Said once, politely, when another month opens in place.
  const [announce, setAnnounce] = useState('')
  const shownMonth = useRef(report?.month)

  // Escape closes, the page behind must not scroll while this is up,
  // and keyboard focus starts inside the layer — and goes back to what
  // opened it (Home's row) when it closes, never to the page itself.
  // Once, on open: the caller hands a fresh onClose every render, and
  // re-running this on each one would keep pulling focus back to the
  // close button.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.() }
    window.addEventListener('keydown', onKey)
    const release = lockScroll()
    closeBtn.current?.focus?.({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      release()
      if (opener && opener !== document.body && opener.isConnected) opener.focus?.({ preventScroll: true })
    }
  }, [])

  // Another month opens at its own cover. The button that opened it went
  // with the old month's report, so focus moves to the new cover's title
  // rather than dropping to the page, and the change is said out loud.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
    if (!report?.month || report.month === shownMonth.current) return
    shownMonth.current = report.month
    setAnnounce(`تقرير ${report.monthLabel}`)
    scroller.current?.querySelector('.rp-cover-title')?.focus?.({ preventScroll: true })
  }, [report?.month])

  // The bar's hairline, and its title once the cover is gone.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      setScrolled(el.scrollTop > 4)
      setPastCover(el.scrollTop > (el.querySelector('.rp-cover')?.offsetHeight || 300) - 72)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    el.addEventListener('scroll', onScroll, { passive: true })
    measure()
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [])

  const has = !!report?.hasData

  return (
    <div className="rp" role="dialog" aria-modal="true" aria-label={`تقرير ${report?.monthLabel || 'الشهر'}`}>
      <header className="rp-bar" data-scrolled={scrolled ? '1' : undefined}>
        <button
          ref={closeBtn}
          type="button"
          className="k-iconbtn k-iconbtn-ghost rp-bar-btn"
          style={{ width: 44, height: 44 }}
          onClick={onClose}
          aria-label="إغلاق"
          title="إغلاق"
        >
          <X size={22} weight="regular" aria-hidden="true" />
        </button>
        <span className={`rp-bar-title${pastCover ? ' is-on' : ''}`} aria-hidden={!pastCover}>
          تقرير <Bidi text={report?.monthLabel || ''} />
        </span>
        {has ? <ShareIcon onShare={onShare} sharing={sharing} /> : <span style={{ width: 44 }} />}
      </header>

      <p className="rp-sr" role="status" aria-live="polite">{announce}</p>

      <div ref={scroller} className="rp-scroll">
        {has ? (
          // Keyed by month: opening another month replays the entrances.
          <div key={report.month}>
            <Cover report={report} onShare={onShare} sharing={sharing} today={today} />

            <div className="rp-body">
              <Consistency report={report} liveStreak={liveStreak} today={today} />
              <Stronger report={report} mapping={mapping} />
              <Muscles report={report} />
              <NextMonth report={report} mapping={mapping} />
              <AllNumbers report={report} />
              <Months report={report} trail={months?.trail} older={months?.older} onPick={onPickMonth} />

              <footer className="rp-foot">
                <Wordmark height={22} />
                <span><Bidi text={report.monthLabel} /></span>
              </footer>
            </div>
          </div>
        ) : (
          <div className="rp-empty">
            <strong>ما فيه شي نعرضه لهالشهر</strong>
            <p>سجّل جلساتك، وآخر الشهر يطلع لك تقريرك هنا.</p>
          </div>
        )}
      </div>
    </div>
  )
}
