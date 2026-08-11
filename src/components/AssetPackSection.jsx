// ── Settings › حزمة الأيقونات ─────────────────────────────────
// Download, update, retry and remove the external icon pack.
// Follows the page's existing section rhythm and reuses ProgressBar
// and the red error-box convention rather than inventing new ones.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, SectionTitle, ProgressBar } from './ui.jsx'
import { usePackState, installPack, deletePack, cancelInstall } from '../assets/pack.js'
import { ALL_IDS } from '../assets/ids.js'
import { getUsers } from '../utils.js'

const mb = (bytes) => (bytes / 1048576).toFixed(1)

const LABELS = {
  unknown:     { text: 'جارٍ الفحص…',            color: 'var(--text3)' },
  checking:    { text: 'جارٍ فحص التحديثات…',    color: 'var(--text3)' },
  idle:        { text: 'غير مثبّتة',              color: 'var(--text3)' },
  downloading: { text: 'جارٍ التنزيل…',           color: 'var(--cyan)'  },
  verifying:   { text: 'جارٍ التحقق…',            color: 'var(--cyan)'  },
  ready:       { text: 'مثبّتة',                  color: 'var(--cyan)'  },
  error:       { text: 'فشل التنزيل',             color: 'var(--red)'   },
  offline:     { text: 'لا يوجد اتصال',           color: 'var(--gold)'  },
  nospace:     { text: 'المساحة غير كافية',       color: 'var(--red)'   },
  unsupported: { text: 'غير مدعومة على هذا المتصفح', color: 'var(--text3)' },
}

const FAIL_REASON = {
  hash:    'ملف تالف',
  http:    'الملف غير موجود على الخادم',
  network: 'انقطاع في الشبكة',
  decode:  'تعذّر فتح الصورة',
}

const actionBtn = (accent) => ({
  flex: 1, padding: '12px 14px', borderRadius: 12,
  background: accent ? 'var(--cyan)' : 'var(--bg3)',
  border: accent ? 'none' : '1px solid var(--border2)',
  color: accent ? '#07130A' : 'var(--text)',
  fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700,
  cursor: 'pointer',
})

export default function AssetPackSection() {
  const state = usePackState()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const busy = state.phase === 'downloading' || state.phase === 'checking' || state.phase === 'verifying'
  const label = LABELS[state.phase] || LABELS.unknown
  const total = state.filesTotal || ALL_IDS.length
  const pct = total ? Math.round((state.filesDone / total) * 100) : 0
  const multiUser = getUsers().length > 1

  return (
    <div style={{ marginBottom: 10 }}>
      <SectionTitle>حزمة الأيقونات</SectionTitle>
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700 }}>
              أيقونات مران المخصّصة
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.7 }}>
              تُحمَّل مرة واحدة على الجهاز وتعمل بعدها بدون إنترنت
            </div>
          </div>
          <span data-pack-phase={state.phase} style={{
            fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700,
            color: label.color, flexShrink: 0,
          }}>{label.text}</span>
        </div>

        {/* Progress — files, because a byte total is only as honest as
            the manifest's declared sizes. */}
        {busy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ProgressBar value={state.filesDone} max={total} gradient />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
            }}>
              <span>{state.filesDone} / {total}</span>
              <span>{pct}%{state.bytesDone > 0 ? ` · ${mb(state.bytesDone)} MB` : ''}</span>
            </div>
          </div>
        )}

        {state.phase === 'ready' && (
          <div style={{
            background: 'var(--bg3)', borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
            display: 'flex', justifyContent: 'space-between', gap: 8,
          }}>
            <span>{state.filesDone} أيقونة</span>
            {state.packVersion && <span dir="ltr">v{state.packVersion}</span>}
          </div>
        )}

        {/* crypto.subtle is missing outside a secure context — LAN
            testing over plain HTTP. Say so rather than implying the
            files were hash-checked when they weren't. */}
        {state.verified === false && state.phase === 'ready' && (
          <div style={{
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--gold)', lineHeight: 1.6,
          }}>
            تم التحقق من الحجم فقط — التحقق الكامل يحتاج اتصالاً آمناً (HTTPS)
          </div>
        )}

        {(state.phase === 'error' || state.phase === 'nospace' || state.phase === 'offline') && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--red)', lineHeight: 1.7,
          }}>
            {state.phase === 'offline' && (
              <>
                لا يوجد اتصال بالإنترنت.
                <div style={{ marginTop: 4, opacity: 0.85 }}>
                  ما نجح تنزيله محفوظ — إعادة المحاولة تُكمل الناقص فقط.
                </div>
              </>
            )}
            {state.phase === 'nospace' && 'المساحة على الجهاز غير كافية لتنزيل الحزمة.'}
            {state.phase === 'error' && (
              state.failed.length === 0
                // Nothing individually failed, so the manifest itself
                // never arrived — a different problem, and a different fix.
                ? 'تعذّر الوصول إلى خادم الأيقونات. حاول مرة أخرى بعد قليل.'
                : (
                  <>
                    تعذّر تنزيل {state.failed.length} من {total} أيقونة.
                    <div style={{ marginTop: 4, opacity: 0.85 }}>
                      السبب: {FAIL_REASON[state.failed[0].reason] || 'خطأ غير معروف'}
                    </div>
                    <div style={{ marginTop: 4, opacity: 0.85 }}>
                      ما نجح تنزيله محفوظ — إعادة المحاولة تُكمل الناقص فقط.
                    </div>
                  </>
                )
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {busy ? (
            <button data-pack="cancel" onClick={cancelInstall} style={actionBtn(false)}>إيقاف</button>
          ) : (
            <button
              data-pack="install"
              onClick={installPack}
              disabled={state.phase === 'unsupported'}
              style={{
                ...actionBtn(state.phase !== 'ready'),
                opacity: state.phase === 'unsupported' ? 0.5 : 1,
                cursor: state.phase === 'unsupported' ? 'not-allowed' : 'pointer',
              }}
            >
              {state.phase === 'ready' ? 'التحقق من التحديثات'
                : (state.phase === 'error' || state.phase === 'offline') ? 'إعادة المحاولة'
                : 'تنزيل الحزمة'}
            </button>
          )}
          {(state.phase === 'ready' || state.phase === 'error' || state.phase === 'offline') && !busy && state.filesDone > 0 && (
            <button data-pack="delete" onClick={() => setConfirmDelete(true)} style={{ ...actionBtn(false), flex: 0, padding: '12px 18px', color: 'var(--red)' }}>
              حذف
            </button>
          )}
        </div>
      </Card>

      {confirmDelete && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setConfirmDelete(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, background: 'var(--bg2)',
              borderRadius: '18px 18px 0 0', border: '1px solid var(--border2)',
              padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>
              حذف حزمة الأيقونات؟
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
              سترجع الأيقونات الافتراضية، وتحتاج إنترنت لتنزيلها مرة أخرى.
              {multiUser && (
                <div style={{ color: 'var(--gold)', marginTop: 6 }}>
                  الحزمة مشتركة بين كل المستخدمين على هذا الجهاز — الحذف يشملهم جميعاً.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button data-pack="delete-cancel" onClick={() => setConfirmDelete(false)} style={actionBtn(false)}>إلغاء</button>
              <button
                data-pack="delete-confirm"
                onClick={() => { deletePack(); setConfirmDelete(false) }}
                style={{ ...actionBtn(false), background: 'var(--red)', border: 'none', color: '#fff' }}
              >حذف</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
