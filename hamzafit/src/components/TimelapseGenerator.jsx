import { useState } from 'react'
import { Card, Btn, CloseBtn, Overlay } from './ui.jsx'
import { generateTimelapse, generateTimelapseVideo } from '../utils/timelapse.js'

export default function TimelapseGenerator({ photos, onClose }) {
  const [frameDuration, setFrameDuration] = useState(1000)
  const [generating, setGenerating] = useState(false)
  const [selectedAngle, setSelectedAngle] = useState('All')

  const filtered = selectedAngle === 'All'
    ? photos
    : photos.filter(p => p.angle === selectedAngle)

  const angles = ['All', ...new Set(photos.map(p => p.angle))]

  const handleGenerate = async () => {
    if (filtered.length < 2) {
      alert('تحتاج على الأقل صورتين')
      return
    }

    setGenerating(true)
    try {
      await generateTimelapse(filtered, frameDuration)
      setTimeout(() => {
        onClose()
        setGenerating(false)
      }, 500)
    } catch (err) {
      console.error('Error:', err)
      alert('خطأ في إنشاء الـ timelapse')
      setGenerating(false)
    }
  }

  const handleVideo = async () => {
    if (filtered.length < 2) {
      alert('تحتاج على الأقل صورتين')
      return
    }

    setGenerating(true)
    try {
      await generateTimelapseVideo(filtered, frameDuration)
      setTimeout(() => {
        onClose()
        setGenerating(false)
      }, 500)
    } catch (err) {
      console.error('Error:', err)
      alert('خطأ في إنشاء الفيديو')
      setGenerating(false)
    }
  }

  return (
    <Overlay onClose={onClose} align="bottom">
      <Card style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>
                🎬 Time-lapse Generator
              </div>
              <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {filtered.length} صورة محددة
              </div>
            </div>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Angle Filter */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              الزاوية
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {angles.map(a => (
                <button
                  key={a}
                  onClick={() => setSelectedAngle(a)}
                  style={{
                    background: selectedAngle === a ? 'var(--orange-lo)' : 'var(--bg)',
                    border: `1px solid ${selectedAngle === a ? 'var(--orange)' : 'var(--border)'}`,
                    borderRadius: 20,
                    padding: '6px 14px',
                    color: selectedAngle === a ? 'var(--orange)' : 'var(--text3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Frame Duration Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
                سرعة الـ Frame
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)' }}>
                {1000 / frameDuration} fps
              </span>
            </div>
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={frameDuration}
              onChange={e => setFrameDuration(parseInt(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', marginTop: 6 }}>
              {frameDuration}ms per frame
            </div>
          </div>

          {/* Preview info */}
          <Card style={{ background: 'var(--bg3)', border: 'none' }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
              📋 معلومات الـ Timelapse
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text4)', lineHeight: 1.8 }}>
              <div>• الصور: {filtered.length}</div>
              <div>• المدة الكلية: {Math.round((filtered.length * frameDuration) / 1000)}s</div>
              <div>• الحجم: ~{Math.round((filtered.length * 50) / 1024)}MB (تقريبي)</div>
            </div>
          </Card>

          {/* Warning */}
          {filtered.length < 2 && (
            <div style={{
              background: '#EF444418',
              border: '1px solid #EF444430',
              borderRadius: 10,
              padding: 12,
              fontFamily: 'var(--font-ar)',
              fontSize: 12,
              color: '#EF4444',
            }}>
              ⚠️ تحتاج على الأقل صورتين لإنشاء timelapse
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <Btn
            onClick={handleGenerate}
            disabled={generating || filtered.length < 2}
            full
            style={{ fontSize: 14, padding: 12 }}
          >
            {generating ? '⏳ جاري الإنشاء...' : '📸 إنشاء Frames'}
          </Btn>
          <Btn
            onClick={handleVideo}
            variant="ghost"
            disabled={generating || filtered.length < 2}
            full
            style={{ fontSize: 14, padding: 12 }}
          >
            🎥 فيديو
          </Btn>
        </div>
      </Card>
    </Overlay>
  )
}
