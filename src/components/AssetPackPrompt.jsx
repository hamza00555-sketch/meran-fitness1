// ── First-run offer to install the icon pack ──────────────────
// Shown once per device, after the version notice is dismissed —
// which is the one guaranteed first interaction, and a user gesture
// is the right thing to hang a multi-megabyte download off.
//
// Its condition is the reconciliation against IndexedDB, never a
// per-user flag: the pack belongs to the device, so a second profile
// must not be asked to install something that is already there.

import { createPortal } from 'react-dom'
import { installPack, markPrompted } from '../assets/pack.js'

export default function AssetPackPrompt({ onClose }) {
  const dismiss = () => { markPrompted(); onClose?.() }
  const accept  = () => { markPrompted(); installPack(); onClose?.() }

  return createPortal(
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 850,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        data-pack-prompt=""
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: '20px 20px 0 0', padding: '24px 20px 28px',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'fadeUp 0.3s ease',
        }}
      >
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
          أيقونات مران المخصّصة
        </div>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text2)', lineHeight: 2 }}>
          حزمة أيقونات مرسومة بأسلوب التطبيق بدل الرموز الافتراضية.
          تُحمَّل مرة واحدة وتعمل بعدها بدون إنترنت — ويمكنك تنزيلها لاحقاً من
          الإعدادات.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              color: 'var(--text2)', fontFamily: 'var(--font-ar)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
            data-pack="offer-later"
          >لاحقاً</button>
          <button
            onClick={accept}
            style={{
              flex: 2, padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg, #5EC32A, #3B9D2A)',
              border: 'none', color: '#fff', fontFamily: 'var(--font-ar)',
              fontSize: 15, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(94,195,42,0.35)',
            }}
            data-pack="offer-accept"
          >تنزيل الآن</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
