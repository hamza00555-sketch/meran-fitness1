// ── The monthly report ────────────────────────────────────────
// A full-screen layer over the whole app, following LevelUpScreen's
// pattern so it covers the bottom nav rather than sitting inside the
// page. Two acts:
//
//   1. An opening the month gets to make an entrance on — the cover
//      full-bleed and drifting, the month's name, then the headline
//      number counting up out of nothing.
//   2. The body, scrolled, where each section animates as it arrives
//      and keeps breathing while it is on screen.
//
// Everything continuous is switched off the moment its section leaves
// the viewport, and everything at all is switched off under reduced
// motion. Both live in useMotion.js and index.css rather than here.

import { useEffect, useRef, useState } from 'react'
import Art from '../../assets/Art.jsx'
import { useReducedMotion, useScrollProgress, useSequence } from '../../hooks/useMotion.js'
import Ambient from './Ambient.jsx'
import { Counted, AR } from './parts.jsx'
import Tips from './sections/Tips.jsx'
import Volume from './sections/Volume.jsx'
import Consistency from './sections/Consistency.jsx'
import Muscles from './sections/Muscles.jsx'
import Progress from './sections/Progress.jsx'

const SECTIONS = ['نصائح', 'الحجم', 'الالتزام', 'العضلات', 'التقدم']

// A gradient stands in for the cover until the art pack is installed —
// the palette the app already uses, not a drawing.
const COVER_FALLBACK = 'linear-gradient(150deg, #0C1220 0%, #16301C 45%, #2A1F08 100%)'

export default function MonthReport({ report, onClose, onShare, sharing = false }) {
  const reduced = useReducedMotion()
  const scroller = useRef(null)
  const [progress, setProgress] = useState(0)
  const [introDone, setIntroDone] = useState(reduced)

  // The cover and the month's name are on screen from the first frame —
  // an opening that starts on a blank rectangle reads as a page that
  // failed to load. The beats stage what comes after: the number, then
  // the prompt to move on.
  const beat = useSequence(3, { run: !introDone, interval: 900 })

  useScrollProgress(scroller, { onProgress: setProgress })

  useEffect(() => {
    if (beat >= 3) setIntroDone(true)
  }, [beat])

  // Escape closes, and the page behind must not scroll while this is up.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const cover = (
    <Art
      id={report.cover}
      alt=""
      className="mr-cover-img"
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      fallback={<div style={{ width: '100%', height: '100%', background: COVER_FALLBACK }} />}
    />
  )

  // ── Act one ──
  if (!introDone) {
    return (
      <div
        onClick={() => setIntroDone(true)}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'var(--bg)', overflow: 'hidden', cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>{cover}</div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(8,11,20,0.5) 0%, rgba(8,11,20,0.88) 70%, var(--bg) 100%)',
        }} />
        <Ambient />

        <div style={{ position: 'relative', textAlign: 'center', padding: 24 }}>
          <div className="mr-rise" style={{
            fontFamily: 'var(--font-ar)', fontSize: 13,
            color: 'var(--text3)', letterSpacing: 2, marginBottom: 8,
          }}>
            تقرير الشهر
          </div>
          <h1 className="mr-rise shimmer-text" style={{
            '--i': 1,
            fontFamily: 'var(--font-ar)', fontSize: 'clamp(30px, 9vw, 46px)',
            fontWeight: 900, marginBottom: 26,
          }}>
            {report.monthLabel}
          </h1>
          {beat >= 1 && (
            <div className="mr-rise" style={{ '--i': 0, position: 'relative' }}>
              <div aria-hidden="true" className="mr-aura" style={{
                position: 'absolute', top: '46%', left: '50%',
                width: 240, height: 240, borderRadius: '50%',
                background: 'radial-gradient(circle, var(--cyan) 0%, transparent 66%)',
                filter: 'blur(30px)',
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{
                  fontSize: 'clamp(52px, 17vw, 92px)', fontWeight: 900,
                  color: 'var(--text)', lineHeight: 1,
                }}>
                  <Counted value={report.volume.total} run duration={1500} />
                </div>
                <div style={{
                  fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700,
                  color: 'var(--cyan)', marginTop: 10,
                }}>
                  كيلوغراماً رفعتها
                </div>
              </div>
            </div>
          )}
          {beat >= 2 && (
            <div className="mr-rise" style={{
              '--i': 0, marginTop: 34, fontFamily: 'var(--font-ar)',
              fontSize: 12, color: 'var(--text3)',
            }}>
              المس للمتابعة
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Act two ──
  const activeSection = Math.min(SECTIONS.length - 1, Math.floor(progress * SECTIONS.length))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar sits above the scroller so it never scrolls away.
          padding-top clears the status bar / notch — without
          --safe-top the buttons render under it and cannot be
          tapped there, which is exactly what every other overlay in
          the app (header, RestTimer, SystemAlert) already accounts
          for and this one had missed. */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 'calc(var(--safe-top) + 12px) 14px 12px',
        background: 'linear-gradient(180deg, rgba(8,11,20,0.92), transparent)',
        pointerEvents: 'none',
      }}>
        <button
          onClick={onClose}
          aria-label="إغلاق"
          style={{
            pointerEvents: 'auto',
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(8,11,20,0.7)', border: '1px solid var(--border2)',
            color: 'var(--text)', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >✕</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onShare}
          disabled={sharing}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 7,
            height: 36, padding: '0 14px', borderRadius: 12,
            background: 'var(--cyan)', border: 'none',
            color: '#06210A', fontFamily: 'var(--font-ar)',
            fontSize: 13, fontWeight: 800, cursor: sharing ? 'wait' : 'pointer',
            opacity: sharing ? 0.7 : 1,
            boxShadow: '0 0 16px var(--cyan-glow)',
          }}
        >
          {sharing ? 'جارٍ التجهيز…' : '↗ مشاركة'}
        </button>
      </div>

      {/* The rail: one element reading --scroll, so following the
          scroll costs a style write rather than a React render. */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 'calc(var(--safe-top) + 64px)',
        bottom: 'calc(var(--safe-bottom) + 20px)', right: 6, width: 3,
        zIndex: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 99,
          background: 'linear-gradient(180deg, var(--cyan), var(--gold))',
          transformOrigin: 'top',
          transform: `scaleY(${progress})`,
          boxShadow: '0 0 8px var(--cyan)',
        }} />
      </div>

      <div style={{
        position: 'absolute', bottom: 'calc(var(--safe-bottom) + 14px)', left: 0, right: 0, zIndex: 3,
        display: 'flex', justifyContent: 'center', gap: 6, pointerEvents: 'none',
      }}>
        {SECTIONS.map((s, i) => (
          <span key={s} style={{
            fontFamily: 'var(--font-ar)', fontSize: 10,
            padding: '3px 9px', borderRadius: 99,
            background: i === activeSection ? 'var(--cyan-lo)' : 'rgba(8,11,20,0.6)',
            border: `1px solid ${i === activeSection ? 'var(--cyan)' : 'var(--border)'}`,
            color: i === activeSection ? 'var(--cyan)' : 'var(--text3)',
            backdropFilter: 'blur(6px)',
            transition: 'color .2s, border-color .2s, background .2s',
          }}>{s}</span>
        ))}
      </div>

      <div
        ref={scroller}
        style={{
          position: 'absolute', inset: 0, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch', zIndex: 1,
        }}
      >
        <Ambient />

        {/* The cover, parallaxing: it drifts up more slowly than the
            content above it. */}
        <div style={{
          position: 'relative', height: 'clamp(180px, 34vw, 260px)',
          overflow: 'hidden',
        }}>
          {cover}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(8,11,20,0.35) 0%, rgba(8,11,20,0.75) 60%, var(--bg) 100%)',
          }} />
          <div style={{
            position: 'absolute', bottom: 12, right: 16, left: 16,
            fontFamily: 'var(--font-ar)', textAlign: 'right',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5 }}>تقرير الشهر</div>
            <div style={{ fontSize: 'clamp(22px, 6.5vw, 30px)', fontWeight: 900, color: 'var(--text)' }}>
              {report.monthLabel}
            </div>
            <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 2 }}>
              {AR(report.sessionCount)} جلسة · {AR(report.volume.total)} كجم
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, padding: '20px 16px 90px' }}>
          <Tips tips={report.tips} />
          <Volume report={report} />
          <Consistency report={report} />
          <Muscles report={report} />
          <Progress report={report} />

          <div style={{
            textAlign: 'center', fontFamily: 'var(--font-ar)',
            fontSize: 11, color: 'var(--text3)', paddingTop: 6,
          }}>
            مران · {report.monthLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
