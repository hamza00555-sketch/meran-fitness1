// ── The monthly report ────────────────────────────────────────
// A full-screen layer over the whole app (it covers the tab bar), in
// three fixed parts so nothing ever floats over the text:
//
//   1. a solid 56pt bar — close at the start, share at the end, both
//      neutral 44pt buttons; the month's name appears in it once the
//      cover has scrolled away;
//   2. the scroller — the cover (the month's one lit moment: the total
//      as a 96px broadcast number, what it is made of, and the one green
//      action, «شارك شهرك»), then five numbered chapters with no boxes;
//   3. a solid bottom index — real buttons that jump to each chapter,
//      the current one followed by an IntersectionObserver.
//
// Motion is entrances only: each piece arrives once, the number counts
// up once, and then the page is still. Under reduced motion nothing
// moves at all.

import { useCallback, useEffect, useRef, useState } from 'react'
import Art, { useHasArt } from '../../assets/Art.jsx'
import { useReducedMotion } from '../../hooks/useMotion.js'
import { Button, Num } from '../kit/index.jsx'
import { X, ShareFat } from '../kit/icons.js'
import { Counted, Bidi, Wordmark, AR } from './parts.jsx'
import Tips from './sections/Tips.jsx'
import Volume from './sections/Volume.jsx'
import Consistency from './sections/Consistency.jsx'
import Muscles from './sections/Muscles.jsx'
import Progress from './sections/Progress.jsx'
import '../../styles/screens/report.css'

// ShareFat is a forward arrow: under RTL forward points left.
const ShareRtl = (props) => <ShareFat {...props} mirrored />

// Without the month's cover from the art pack, the stage still gets a
// figure: the bundled «mountain of iron» — the month's tonnage, drawn.
const STAGE_FIGURE = '/assets/ach_volume.webp'

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
}) {
  const reduced = useReducedMotion()
  const scroller = useRef(null)
  const cover = useRef(null)
  const closeBtn = useRef(null)
  const lockUntil = useRef(0)
  const hasArt = useHasArt(report?.cover)
  const [scrolled, setScrolled] = useState(false)
  const [pastCover, setPastCover] = useState(false)
  const [active, setActive] = useState(null)

  // Escape closes, the page behind must not scroll while this is up,
  // and keyboard focus starts inside the layer. Once, on open: the
  // caller hands a fresh onClose every render, and re-running this on
  // each one would keep pulling focus back to the close button.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus?.({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  const has = !!report?.hasData
  const chapters = has ? [
    report.tips?.length ? { id: 'rp-tips', label: 'نصائح' } : null,
    { id: 'rp-volume', label: 'الحجم' },
    { id: 'rp-consistency', label: 'الالتزام' },
    report.muscles?.length ? { id: 'rp-muscles', label: 'العضلات' } : null,
    { id: 'rp-progress', label: 'التقدم' },
  ].filter(Boolean) : []
  const ids = chapters.map(c => c.id).join(',')
  const nOf = (id) => chapters.findIndex(c => c.id === id) + 1

  // The bar's hairline and title, and the last chapter at the very
  // bottom (a short last chapter never reaches the observer's band).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      setScrolled(el.scrollTop > 4)
      setPastCover(el.scrollTop > (cover.current?.offsetHeight || 300) - 72)
      if (performance.now() < lockUntil.current) return
      const last = ids.split(',').pop()
      if (el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setActive(last)
      else if (el.scrollTop < (cover.current?.offsetHeight || 300) * 0.5) setActive(null)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    el.addEventListener('scroll', onScroll, { passive: true })
    measure()
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [ids])

  // Which chapter is on screen: the one crossing a band 40–45% down.
  useEffect(() => {
    const root = scroller.current
    if (!root || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver((entries) => {
      if (performance.now() < lockUntil.current) return
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
    }, { root, rootMargin: '-40% 0px -55% 0px', threshold: 0 })
    for (const id of ids.split(',')) {
      const el = id && document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [ids])

  const go = useCallback((id) => {
    const el = document.getElementById(id)
    if (!el) return
    lockUntil.current = performance.now() + (reduced ? 50 : 900)
    setActive(id)
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [reduced])

  const total = report?.volume?.total || 0
  const long = AR(total).replace(/\D/g, '').length >= 7

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

      <div ref={scroller} className="rp-scroll">
        {has ? (
          <>
            <section ref={cover} className={`rp-cover${hasArt ? ' has-art' : ''}`} aria-label="غلاف الشهر">
              {hasArt ? (
                <Art id={report.cover} alt="" className="rp-cover-art"
                     style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img className="rp-cover-fig" src={STAGE_FIGURE} alt="" aria-hidden="true" draggable="false"
                     onError={(e) => { e.currentTarget.style.display = 'none' }} />
              )}
              <div className="rp-cover-body">
                <p className="rp-eyebrow rp-in" style={{ '--i': 0 }}>
                  تقرير الشهر · <Bidi text={report.monthLabel} />
                </p>
                <p className={`rp-hero rp-in${long ? ' is-long' : ''}`} style={{ '--i': 1 }}
                   aria-label={`${AR(total)} كجم`}>
                  <Counted value={total} duration={900} />
                </p>
                <p className="rp-hero-unit rp-in" style={{ '--i': 1 }}>كجم رفعتها</p>
                <p className="rp-cover-stats rp-in" style={{ '--i': 2 }}>
                  <span><b><Num>{AR(report.sessionCount)}</Num></b> جلسة</span>
                  <span><b><Num>{AR(report.sets.completed)}</Num></b> مجموعة</span>
                  {report.prs.length > 0 && (
                    <span className="is-raise"><b><Num>{report.prs.length}</Num></b> أعلى وزن</span>
                  )}
                </p>
                <Button
                  variant="primary" size="lg" full icon={ShareRtl}
                  className="rp-cover-cta rp-in" style={{ '--i': 3 }}
                  onClick={onShare} disabled={sharing}
                >
                  {sharing ? 'نجهّز الصورة…' : 'شارك شهرك'}
                </Button>
              </div>
            </section>

            <div className="rp-body">
              <Tips tips={report.tips} n={nOf('rp-tips')} />
              <Volume report={report} n={nOf('rp-volume')} mapping={mapping} />
              <Consistency report={report} n={nOf('rp-consistency')} liveStreak={liveStreak} today={today} />
              <Muscles report={report} n={nOf('rp-muscles')} />
              <Progress report={report} n={nOf('rp-progress')} />

              <footer className="rp-foot">
                <Wordmark height={22} />
                <span><Bidi text={report.monthLabel} /></span>
              </footer>
            </div>
          </>
        ) : (
          <div className="rp-empty">
            <strong>ما فيه شي نعرضه لهالشهر</strong>
            <p>سجّل جلساتك، وآخر الشهر يطلع لك تقريرك هنا.</p>
          </div>
        )}
      </div>

      {chapters.length > 0 && (
        <nav className="rp-index" aria-label="أقسام التقرير">
          {chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rp-index-btn"
              aria-current={active === c.id ? 'true' : undefined}
              onClick={() => go(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
