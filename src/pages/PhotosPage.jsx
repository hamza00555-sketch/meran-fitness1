import { useState, useRef } from 'react'
import { Card } from '../components/ui.jsx'
import { fmtDate } from '../utils.js'

function compressImage(file, maxPx = 800, quality = 0.72) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
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

export default function PhotosPage({ photos, setPhotos, onBack }) {
  const [lightbox,   setLightbox]   = useState(null)
  const [compareMode,setCompareMode]= useState(false)
  const [note,       setNote]       = useState('')
  const [adding,     setAdding]     = useState(false)
  const fileRef = useRef()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAdding(true)
    try {
      const dataUrl = await compressImage(file)
      setPhotos(prev => [...prev, {
        id: Date.now(),
        date: new Date().toISOString(),
        note: note.trim(),
        src: dataUrl,
      }])
      setNote('')
    } catch {}
    setAdding(false)
    e.target.value = ''
  }

  const deletePhoto = (id) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
    setLightbox(null)
  }

  const reversed  = [...photos].reverse()
  const first     = photos[0]
  const latest    = photos[photos.length - 1]
  const canCompare = photos.length >= 2

  // ── Before / After ───────────────────────────────────────────
  if (compareMode && canCompare) {
    const daysDiff = Math.round((new Date(latest.date) - new Date(first.date)) / 86400000)
    return (
      <div style={{ paddingBottom: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 20, fontWeight: 800 }}>مقارنة قبل/بعد</div>
          <button onClick={() => setCompareMode(false)} style={backBtnStyle}>رجوع</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <PhotoCard label="قبل" date={first.date} src={first.src} accent="var(--text3)" />
          <PhotoCard label="بعد" date={latest.date} src={latest.src} accent="var(--cyan)" />
        </div>

        <div style={{
          marginTop: 14, background: 'var(--bg1)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '14px 18px', textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800, color: 'var(--cyan)', marginBottom: 4 }}>
            {daysDiff} يوم من الرحلة 🔥
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
            {photos.length} صورة مسجلة
          </div>
        </div>
      </div>
    )
  }

  // ── Lightbox ─────────────────────────────────────────────────
  if (lightbox) {
    const idx = reversed.findIndex(p => p.id === lightbox.id)
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(0,0,0,0.7)' }}>
          <button onClick={() => setLightbox(null)} style={backBtnStyle}>رجوع</button>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(lightbox.date)}</div>
          <button
            onClick={() => deletePhoto(lightbox.id)}
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '8px 14px', color: 'var(--red)', fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer' }}
          >حذف</button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
          <button onClick={() => idx < reversed.length - 1 && setLightbox(reversed[idx + 1])} style={arrowBtnStyle}>‹</button>
          <img src={lightbox.src} alt="" style={{ flex: 1, maxHeight: '75vh', objectFit: 'contain', borderRadius: 8, margin: '0 4px' }} />
          <button onClick={() => idx > 0 && setLightbox(reversed[idx - 1])} style={arrowBtnStyle}>›</button>
        </div>

        <div style={{ padding: '10px 18px 24px', background: 'rgba(0,0,0,0.7)', textAlign: 'center' }}>
          {lightbox.note && <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>{lightbox.note}</div>}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>{idx + 1} / {reversed.length}</div>
        </div>
      </div>
    )
  }

  // ── Main View ─────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 800 }}>صور التقدم 📸</div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>{photos.length} صورة</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCompare && (
            <button onClick={() => setCompareMode(true)} style={{
              background: 'var(--cyan-lo)', border: '1px solid var(--cyan)',
              borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
              fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--cyan)', fontWeight: 700,
            }}>قبل/بعد</button>
          )}
          <button onClick={onBack} style={backBtnStyle}>رجوع</button>
        </div>
      </div>

      {/* Add photo */}
      <Card style={{ padding: 16, marginBottom: 14 }}>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="ملاحظة اختيارية (مثل: الأسبوع 4)"
          style={{
            width: '100%', background: 'var(--bg3)',
            border: '1px solid var(--border2)', borderRadius: 10,
            padding: '10px 14px', color: 'var(--text)',
            fontFamily: 'var(--font-ar)', fontSize: 14, outline: 'none',
            marginBottom: 10, direction: 'rtl', boxSizing: 'border-box',
          }}
        />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={adding}
          className="btn-cyan"
          style={{ width: '100%', fontSize: 15 }}
        >
          {adding ? '⏳ جاري الحفظ...' : '📷 التقط صورة أو اختر من المعرض'}
        </button>
      </Card>

      {/* Empty state */}
      {photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            لا توجد صور بعد
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
            التقط أول صورة لبدء متابعة تقدمك
          </div>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ columns: 2, gap: 8 }}>
          {reversed.map((photo, i) => (
            <div
              key={photo.id}
              onClick={() => setLightbox(photo)}
              style={{
                breakInside: 'avoid', marginBottom: 8,
                borderRadius: 12, overflow: 'hidden',
                cursor: 'pointer', position: 'relative',
                border: `1px solid ${i === 0 ? 'var(--cyan)' : 'var(--border)'}`,
                transition: 'transform 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <img src={photo.src} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} loading="lazy" />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                padding: '18px 8px 7px',
              }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 9, color: '#ccc', textAlign: 'center' }}>
                  {fmtDate(photo.date)}
                </div>
                {photo.note && (
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 1 }}>
                    {photo.note}
                  </div>
                )}
              </div>
              {i === 0 && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'var(--cyan)', borderRadius: 6, padding: '2px 7px',
                  fontFamily: 'var(--font-mono)', fontSize: 8, color: '#000', fontWeight: 800,
                }}>NEW</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoCard({ label, date, src, accent }) {
  return (
    <div style={{ background: 'var(--bg1)', border: `1px solid ${accent}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{
        padding: '8px 12px', background: accent === 'var(--cyan)' ? 'var(--cyan-lo)' : 'var(--bg2)',
        borderBottom: `1px solid ${accent}`,
        fontFamily: 'var(--font-ar)', fontSize: 12, color: accent, textAlign: 'center',
      }}>
        {label} — {fmtDate(date)}
      </div>
      <img src={src} alt={label} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover' }} />
    </div>
  )
}

const backBtnStyle = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
  fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text2)',
}

const arrowBtnStyle = {
  background: 'rgba(255,255,255,0.1)', border: 'none',
  borderRadius: 8, padding: '12px 10px', color: '#fff',
  fontSize: 24, cursor: 'pointer', flexShrink: 0,
}
