import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera, Image as ImageIcon, Trash, CaretLeft, CaretRight, ArrowsLeftRight, Warning, X, Check,
} from '@phosphor-icons/react'
import {
  Button, IconButton, Sheet, ConfirmSheet, EmptyState, Banner, Num, ListRow,
} from '../components/kit/index.jsx'
import Art, { useHasArt } from '../assets/Art.jsx'
import Numify from '../components/progress/Numify.jsx'
import { fmtDay } from '../components/progress/achievementMeta.js'
import '../styles/screens/progress.css'

// ── صور التقدم ────────────────────────────────────────────────
//
// The point of this page is good photos compared across months, so:
//
//   · camera OR library — the old button promised «اختر من المعرض» but
//     its capture attribute opened the rear camera and nothing else, so
//     the mirror shots already on the phone could not be added;
//   · a preview step: see the photo, add the optional note, then save —
//     the note field no longer sits on the page before you have a photo;
//   · a 3:4 grid (portrait — a square crops the head and the feet);
//   · delete asks first;
//   · «قارن» picks any two, not only the first and the last.
//
// Storage is exactly what it was: the same `photos` array (id, date,
// note, src as a JPEG data URL) that App keeps in localStorage — the old
// design reads it too. What changed is that a full store says so, where
// the user is looking: inside the preview sheet when «احفظ» is what
// failed (the page behind is under the scrim), on the page when App's
// own write failed after the sheet closed — instead of the photo
// appearing and then vanishing on the next open.

function compressImage(file, maxPx = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode'))
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/** Will this many more characters fit in localStorage? A best-effort
 *  probe with a throwaway key, removed at once. */
function fits(text) {
  const k = '__meran_photo_probe'
  try {
    localStorage.setItem(k, text)
    localStorage.removeItem(k)
    return true
  } catch (e) {
    try { localStorage.removeItem(k) } catch { /* nothing */ }
    return !(e && (e.name === 'QuotaExceededError' || e.code === 22))
  }
}

const daysBetween = (a, b) => Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000)

export default function PhotosPage({ photos = [], setPhotos, onBack, embedded }) {
  const [picker, setPicker] = useState(false)
  const [draft, setDraft] = useState(null)        // { src, date } waiting for «احفظ»
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)      // 'full' | 'read'
  const [viewing, setViewing] = useState(null)    // photo id
  const [confirmDel, setConfirmDel] = useState(null)
  const [selecting, setSelecting] = useState(false)
  const [picks, setPicks] = useState([])
  const [comparing, setComparing] = useState(null) // [olderId, newerId]
  const camRef = useRef(null)
  const libRef = useRef(null)
  const pending = useRef(null)
  const bannerRef = useRef(null)

  const newestFirst = [...photos].reverse()
  const byId = (id) => photos.find(p => p.id === id)

  // A save App could not write (localStorage full): take the photo back
  // out, so what is on screen is what is stored, and say why.
  useEffect(() => {
    const onFull = (e) => {
      if (e.detail?.key !== 'hf_photos') return
      setFailed('full')
      const id = pending.current
      if (id != null) {
        pending.current = null
        setPhotos(prev => prev.filter(p => p.id !== id))
      }
    }
    window.addEventListener('meran:storage-full', onFull)
    return () => window.removeEventListener('meran:storage-full', onFull)
  }, [setPhotos])

  // The page banner sits at the top of a grid that may be scrolled away.
  const pageBanner = failed && !draft
  useEffect(() => {
    if (pageBanner) bannerRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [pageBanner, failed])

  const choose = (ref) => {
    // Synchronously, inside the tap: iOS only opens a file picker from a
    // live user gesture.
    ref.current?.click()
    setPicker(false)
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setFailed(null)
    try {
      const src = await compressImage(file)
      setNote('')
      setDraft({ src, date: new Date().toISOString() })
    } catch {
      setFailed('read')
    }
    setBusy(false)
  }

  const save = () => {
    if (!draft) return
    if (!fits(draft.src)) { setFailed('full'); return }
    const photo = { id: Date.now(), date: draft.date, note: note.trim(), src: draft.src }
    pending.current = photo.id
    setTimeout(() => { if (pending.current === photo.id) pending.current = null }, 2000)
    setPhotos(prev => [...prev, photo])
    setFailed(null)
    setDraft(null)
  }

  // From the full-store notice: close the preview and open the oldest
  // photo, with its delete button right there.
  const clearOld = () => {
    setDraft(null)
    if (photos.length) setViewing(photos[0].id)
  }

  const remove = (id) => {
    const idx = newestFirst.findIndex(p => p.id === id)
    const rest = newestFirst.filter(p => p.id !== id)
    setPhotos(prev => prev.filter(p => p.id !== id))
    setConfirmDel(null)
    setFailed(null) // space was freed: the old notice no longer holds
    if (viewing === id) setViewing(rest.length ? rest[Math.min(idx, rest.length - 1)].id : null)
    setPicks(prev => prev.filter(x => x !== id))
  }

  const startCompare = () => {
    setPicks([photos[0].id, photos[photos.length - 1].id])
    setSelecting(true)
  }
  const togglePick = (id) => setPicks(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-2)
  ))
  const openCompare = () => {
    if (picks.length !== 2) return
    const [a, b] = picks.map(byId).filter(Boolean).sort((x, y) => new Date(x.date) - new Date(y.date))
    if (!a || !b) return
    setComparing([a.id, b.id])
    setSelecting(false)
  }

  return (
    <div className="ph" data-testid="photos">
      {!embedded && onBack && (
        <div className="ph-back"><Button variant="plain" size="sm" icon={CaretRight} onClick={onBack}>رجوع</Button></div>
      )}

      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
      <input ref={libRef} type="file" accept="image/*" onChange={handleFile} hidden />

      {pageBanner && (
        <div ref={bannerRef} className="ph-alert">
          <FailNotice kind={failed} hasPhotos={photos.length > 0}
            action={<IconButton icon={X} label="إخفاء" onClick={() => setFailed(null)} />} />
        </div>
      )}

      {photos.length === 0 ? (
        <PhotosEmpty busy={busy} onAdd={() => setPicker(true)} />
      ) : (
        <>
          <div className="ph-head">
            {selecting ? (
              <>
                <span className="ph-count">اختر صورتين <span className="ph-count-n">(<Num>{picks.length}</Num>/<Num>2</Num>)</span></span>
                <Button variant="plain" size="sm" onClick={() => { setSelecting(false); setPicks([]) }}>إلغاء</Button>
              </>
            ) : (
              <>
                <span className="ph-count"><Num>{photos.length}</Num> {photos.length === 1 ? 'صورة' : photos.length === 2 ? 'صورتين' : 'صور'}</span>
                {photos.length >= 2 && (
                  <Button variant="secondary" size="sm" icon={ArrowsLeftRight} onClick={startCompare}>قارن</Button>
                )}
              </>
            )}
          </div>

          {selecting
            ? <Button variant="primary" size="lg" full icon={ArrowsLeftRight} disabled={picks.length !== 2} onClick={openCompare}>قارن الصورتين</Button>
            : <Button variant="primary" size="lg" full icon={Camera} disabled={busy} onClick={() => setPicker(true)}>{busy ? 'نجهّز الصورة…' : 'أضف صورة'}</Button>}

          <div className="ph-grid">
            {newestFirst.map(p => {
              const picked = picks.includes(p.id)
              return (
                <button key={p.id} type="button" className={`ph-thumb${picked ? ' picked' : ''}`}
                  onClick={() => (selecting ? togglePick(p.id) : setViewing(p.id))}
                  aria-pressed={selecting ? picked : undefined}
                  aria-label={`صورة ${fmtDay(p.date)}${p.note ? ' — ' + p.note : ''}`}>
                  <img src={p.src} alt="" loading="lazy" />
                  <span className="ph-date"><Numify>{fmtDay(p.date)}</Numify></span>
                  {selecting && <span className="ph-pick" aria-hidden="true">{picked && <Check size={16} weight="bold" />}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Camera or library ── */}
      <Sheet open={picker} onClose={() => setPicker(false)} title="صورة جديدة">
        <div className="ph-pick-rows">
          <ListRow leading={Camera} title="صوّر الحين" subtitle="بنفس الوقفة والإضاءة كل مرة" onClick={() => choose(camRef)} chevron />
          <ListRow leading={ImageIcon} title="اختر من الصور" subtitle="صورة المراية اللي عندك" onClick={() => choose(libRef)} chevron />
        </div>
      </Sheet>

      {/* ── Preview, note, save ── */}
      {/* A save that did not fit is told here, above the buttons — the
          footer never scrolls, and the page behind is under the scrim. */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title="صورة جديدة"
        footer={failed === 'full' ? (
          <div className="ph-preview-actions">
            <FailNotice kind="full" hasPhotos={photos.length > 0} />
            {photos.length > 0 && (
              <Button variant="secondary" size="lg" full icon={Trash} onClick={clearOld}>احذف صور قديمة</Button>
            )}
            <Button variant={photos.length > 0 ? 'plain' : 'secondary'} size="lg" full onClick={() => setDraft(null)}>إلغاء</Button>
          </div>
        ) : (
          <div className="ph-preview-actions">
            <Button variant="primary" size="lg" full onClick={save}>احفظ الصورة</Button>
            <Button variant="secondary" size="lg" full onClick={() => setDraft(null)}>إلغاء</Button>
          </div>
        )}>
        {draft && (
          <div className="ph-preview">
            <div className="ph-preview-frame"><img src={draft.src} alt="معاينة الصورة" /></div>
            <span className="ph-preview-date"><Numify>{fmtDay(draft.date, { weekday: true })}</Numify></span>
            <label className="ph-note">
              <span className="k-eyebrow">ملاحظة (اختياري)</span>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="مثل: الأسبوع 4" maxLength={80} dir="auto" />
            </label>
          </div>
        )}
      </Sheet>

      {viewing && byId(viewing) && (
        <Viewer
          list={newestFirst}
          id={viewing}
          onMove={setViewing}
          onClose={() => setViewing(null)}
          onDelete={(id) => setConfirmDel(id)}
          dimmed={confirmDel != null}
        />
      )}

      {comparing && byId(comparing[0]) && byId(comparing[1]) && (
        <Compare a={byId(comparing[0])} b={byId(comparing[1])} onClose={() => setComparing(null)} />
      )}

      <ConfirmSheet
        open={confirmDel != null}
        onClose={() => setConfirmDel(null)}
        title="تحذف الصورة؟"
        message="تنحذف من جهازك نهائياً، وما فيه تراجع."
        confirmLabel="احذف الصورة"
        destructive
        onConfirm={() => remove(confirmDel)}
      />
    </div>
  )
}

/** Why a photo did not make it, and what to do about it. */
function FailNotice({ kind, hasPhotos, action }) {
  if (kind === 'read') {
    return (
      <Banner tone="danger" icon={Warning} title="ما قدرنا نقرأ الصورة" action={action}>
        جرّب صورة ثانية، أو صوّر من جديد.
      </Banner>
    )
  }
  return (
    <Banner tone="danger" icon={Warning} title="ما انحفظت الصورة — التخزين ممتلئ" action={action}>
      {hasPhotos
        ? 'احذف صور قديمة أو خذ نسخة احتياطية من الإعدادات، وبعدها جرّب مرة ثانية. جلساتك ما تأثرت.'
        : 'ما بقى مكان لصورة جديدة على هذا الجهاز. جلساتك ما تأثرت، وتقدر تاخذ منها نسخة احتياطية من الإعدادات.'}
    </Banner>
  )
}

function PhotosEmpty({ busy, onAdd }) {
  const hasArt = useHasArt('empty_photos')
  return (
    <div className="ph-empty">
      {hasArt && <Art id="empty_photos" size={96} />}
      <EmptyState icon={hasArt ? null : Camera} title="صوّر أول صورة"
        action={<Button variant="primary" size="lg" icon={Camera} disabled={busy} onClick={onAdd}>{busy ? 'نجهّز الصورة…' : 'أضف صورة'}</Button>}>
        صورة كل أسبوعين بنفس الوقفة والإضاءة تكفي عشان تشوف الفرق مع الوقت.
      </EmptyState>
    </div>
  )
}

// ── The viewer ────────────────────────────────────────────────
// Full screen, above everything. Back sits on the right edge (RTL);
// the list runs newest → oldest toward the end of the line, so the
// left arrow and a drag to the right both go to the older photo.
function Viewer({ list, id, onMove, onClose, onDelete, dimmed }) {
  const idx = list.findIndex(p => p.id === id)
  const photo = list[idx]
  const touch = useRef(null)
  const go = useCallback((d) => {
    const n = idx + d
    if (n >= 0 && n < list.length) onMove(list[n].id)
  }, [idx, list, onMove])

  useEffect(() => {
    const onKey = (e) => {
      if (dimmed) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(1)
      else if (e.key === 'ArrowRight') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [go, onClose, dimmed])

  if (!photo) return null
  return createPortal(
    <div className="ph-view" role="dialog" aria-modal="true" aria-label="عارض الصور"
      onTouchStart={e => { touch.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (dx > 50) go(1)
        else if (dx < -50) go(-1)
      }}>
      <div className="ph-view-bar">
        <button type="button" className="ph-view-back" onClick={onClose}>
          <CaretRight size={22} weight="bold" aria-hidden="true" /><span>رجوع</span>
        </button>
        <span className="ph-view-title"><Numify>{fmtDay(photo.date, { weekday: true })}</Numify></span>
        <IconButton icon={Trash} label="حذف الصورة" onClick={() => onDelete(photo.id)} />
      </div>
      <div className="ph-view-stage">
        <img key={photo.id} src={photo.src} alt={photo.note || `صورة ${fmtDay(photo.date)}`} />
      </div>
      <div className="ph-view-foot">
        {photo.note && <p className="ph-view-note">{photo.note}</p>}
        <div className="ph-view-nav">
          <IconButton icon={CaretRight} label="الصورة الأحدث" variant="filled" disabled={idx <= 0} onClick={() => go(-1)} />
          <Num className="ph-view-pos">{idx + 1} / {list.length}</Num>
          <IconButton icon={CaretLeft} label="الصورة الأقدم" variant="filled" disabled={idx >= list.length - 1} onClick={() => go(1)} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Before and after ──────────────────────────────────────────
function Compare({ a, b, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  const days = daysBetween(a.date, b.date)
  return createPortal(
    <div className="ph-view ph-cmp" role="dialog" aria-modal="true" aria-label="قبل وبعد">
      <div className="ph-view-bar">
        <button type="button" className="ph-view-back" onClick={onClose}>
          <CaretRight size={22} weight="bold" aria-hidden="true" /><span>رجوع</span>
        </button>
        <span className="ph-view-title">قبل وبعد</span>
        <span className="ph-view-spacer" />
      </div>
      <div className="ph-cmp-hero">
        <Num className="ph-cmp-n">{days}</Num>
        <span className="ph-cmp-u">{days === 1 ? 'يوم' : days === 2 ? 'يومين' : days <= 10 ? 'أيام' : 'يوم'} بين الصورتين</span>
      </div>
      <div className="ph-cmp-grid">
        {[['قبل', a], ['بعد', b]].map(([lab, p]) => (
          <figure key={lab} className="ph-cmp-fig">
            <div className="ph-cmp-frame"><img src={p.src} alt={`${lab} — ${fmtDay(p.date)}`} /></div>
            <figcaption><b>{lab}</b> · <Numify>{fmtDay(p.date)}</Numify></figcaption>
          </figure>
        ))}
      </div>
    </div>,
    document.body,
  )
}
