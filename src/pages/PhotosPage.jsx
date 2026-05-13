import { useState, useRef, useEffect } from 'react'
import { ls } from '../utils.js'
import { Btn, PillTabs } from '../components/ui.jsx'
import { fmtDate } from '../utils.js'
import TimeLapseModal from '../components/TimeLapseModal.jsx'

const ANGLES = ['Front', 'Side', 'Back']

export default function PhotosPage() {
  const [photos, setPhotos] = useState(() => ls.get('hf_photos', []))
  const [angle, setAngle] = useState('Front')
  const [lightbox, setLightbox] = useState(null)
  const [showTimeLapse, setShowTimeLapse] = useState(false)
  const fileRef = useRef()

  useEffect(() => { ls.set('hf_photos', photos) }, [photos])

  const addPhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPhotos(prev => [{
        id: Date.now(),
        date: new Date().toISOString(),
        angle,
        src: ev.target.result,
      }, ...prev])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const filtered = photos.filter(p => p.angle === angle)

  // Lightbox navigation
  const lightboxIdx = lightbox ? filtered.findIndex(p => p.id === lightbox.id) : -1
  const goNext = () => lightboxIdx < filtered.length - 1 && setLightbox(filtered[lightboxIdx + 1])
  const goPrev = () => lightboxIdx > 0 && setLightbox(filtered[lightboxIdx - 1])

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <PillTabs tabs={ANGLES} active={angle} onChange={setAngle} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={addPhoto}
            capture="environment"
          />
          {filtered.length >= 2 && (
            <Btn
              onClick={() => setShowTimeLapse(true)}
              variant="secondary"
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              🎬 Time-lapse
            </Btn>
          )}
          <Btn onClick={() => fileRef.current?.click()} style={{ fontSize: 13, padding: '8px 16px' }}>
            📸 إضافة
          </Btn>
        </div>
      </div>

      {/* Stats */}
      {photos.length > 0 && (
        <div style={{
          display: 'flex', gap: 16,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text4)',
          marginBottom: 16,
        }}>
          {ANGLES.map(a => (
            <span key={a} style={{ color: a === angle ? 'var(--orange)' : 'var(--text4)' }}>
              {a}: {photos.filter(p => p.angle === a).length}
            </span>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '70px 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>📸</div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, color: 'var(--text3)', marginBottom: 8 }}>
            لا يوجد صور {angle} بعد
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text4)', marginBottom: 20 }}>
            ابدأ تتبع تقدمك الجسدي 💪
          </div>
          <Btn onClick={() => fileRef.current?.click()}>📸 إضافة صورة</Btn>
        </div>
      )}

      {/* Photo grid (masonry-style 2 columns) */}
      {filtered.length > 0 && (
        <div style={{ columns: 2, gap: 10 }}>
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => setLightbox(p)}
              style={{
                breakInside: 'avoid', marginBottom: 10,
                borderRadius: 12, overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                position: 'relative',
                transition: 'transform 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img
                src={p.src} alt={p.angle}
                style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                loading="lazy"
              />
              {/* Date overlay */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, #000000cc)',
                padding: '20px 10px 8px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#999' }}>
                  {fmtDate(p.date)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Time-lapse */}
      {showTimeLapse && (
        <TimeLapseModal
          photos={filtered}
          angle={angle}
          onClose={() => setShowTimeLapse(false)}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0,
            background: '#000000f0',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480 }}>
            {/* Nav arrows */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Btn onClick={goPrev} variant="ghost" disabled={lightboxIdx === 0} style={{ fontSize: 20, padding: '8px 16px' }}>←</Btn>
              <div style={{ fontFamily: 'var(--font-ar)', color: 'var(--text2)', fontSize: 13, alignSelf: 'center' }}>
                {lightbox.angle} · {fmtDate(lightbox.date)}
              </div>
              <Btn onClick={goNext} variant="ghost" disabled={lightboxIdx === filtered.length - 1} style={{ fontSize: 20, padding: '8px 16px' }}>→</Btn>
            </div>

            {/* Image */}
            <img
              src={lightbox.src} alt={lightbox.angle}
              style={{
                width: '100%', borderRadius: 14,
                maxHeight: '65vh', objectFit: 'contain',
                display: 'block',
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => setLightbox(null)} variant="ghost">إغلاق</Btn>
              <Btn
                onClick={() => {
                  setPhotos(prev => prev.filter(p => p.id !== lightbox.id))
                  setLightbox(null)
                }}
                variant="danger"
              >🗑️ حذف</Btn>
            </div>

            {/* Counter */}
            <div style={{
              textAlign: 'center', marginTop: 12,
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)',
            }}>
              {lightboxIdx + 1} / {filtered.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
