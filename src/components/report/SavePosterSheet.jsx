// ── The last rung of the share ladder ─────────────────────────
// When the share sheet is unavailable and a download attribute does
// nothing — which is the ordinary case for an installed PWA on iOS —
// the only route left is to put the image on screen and let the user
// press and hold it. That always works, so it is worth doing properly
// rather than leaving them with a button that silently did nothing.

import { useEffect } from 'react'

export default function SavePosterSheet({ url, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!url) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(4,6,12,0.92)', backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 20, gap: 14,
      }}
    >
      <div style={{
        fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700,
        color: 'var(--text)', textAlign: 'center',
      }}>
        اضغط مطوّلاً على الصورة ثم «حفظ الصورة»
      </div>

      <img
        src={url}
        alt="تقرير الشهر"
        // The tap-to-close is on the backdrop; the image itself must
        // keep its own long-press menu.
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '72vh',
          borderRadius: 16, border: '1px solid var(--border2)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
        }}
      />

      <button
        onClick={onClose}
        style={{
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          borderRadius: 12, padding: '11px 22px', color: 'var(--text)',
          fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        تم
      </button>
    </div>
  )
}
