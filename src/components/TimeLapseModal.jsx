import { useState, useEffect, useRef } from 'react'
import { Btn } from './ui.jsx'
import { fmtDate } from '../utils.js'

const SPEEDS = [
  { label: 'بطيء', ms: 1500 },
  { label: 'عادي', ms: 800 },
  { label: 'سريع', ms: 400 },
]

export default function TimeLapseModal({ photos, angle, onClose }) {
  const sorted   = [...photos].sort((a, b) => new Date(a.date) - new Date(b.date))
  const [idx, setIdx]       = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
  const [recording, setRecording] = useState(false)
  const [videoUrl, setVideoUrl]   = useState(null)
  const intervalRef = useRef(null)
  const canvasRef   = useRef(null)
  const recRef      = useRef(null)

  const current = sorted[idx]
  const speed   = SPEEDS[speedIdx].ms

  // Auto-play
  useEffect(() => {
    if (!playing) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => {
      setIdx(prev => {
        if (prev >= sorted.length - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(intervalRef.current)
  }, [playing, speed, sorted.length])

  // Draw current frame to canvas (for recording)
  useEffect(() => {
    if (!recording || !canvasRef.current || !current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const img    = new Image()
    img.onload = () => {
      canvas.width  = img.naturalWidth  || 480
      canvas.height = img.naturalHeight || 640
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = current.src
  }, [idx, recording, current])

  const startRecord = () => {
    if (!canvasRef.current) return
    setVideoUrl(null)
    const stream = canvasRef.current.captureStream(5)
    const rec    = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    rec.ondataavailable = e => chunks.push(e.data)
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      setVideoUrl(URL.createObjectURL(blob))
      setRecording(false)
    }
    recRef.current = rec
    rec.start()
    setRecording(true)
    setIdx(0)
    setPlaying(true)
  }

  const stopRecord = () => {
    recRef.current?.stop()
    setPlaying(false)
  }

  if (sorted.length < 2) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: '#000000f2',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 400, padding: '16px 12px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800 }}>🎬 Time-lapse</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>
              {angle} · {sorted.length} صورة
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Photo viewer */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#111', marginBottom: 12 }}>
          <img
            src={current?.src}
            alt=""
            style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block' }}
          />
          {/* Date & counter overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, #000000cc)',
            padding: '20px 12px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ccc' }}>
              {current && fmtDate(current.date)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888' }}>
              {idx + 1} / {sorted.length}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#222', borderRadius: 4, height: 3, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${((idx + 1) / sorted.length) * 100}%`,
            background: 'linear-gradient(90deg, var(--orange), var(--gold))',
            borderRadius: 4,
            transition: `width ${speed * 0.8}ms linear`,
          }} />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          {/* Prev */}
          <Btn
            variant="ghost"
            onClick={() => { setPlaying(false); setIdx(i => Math.max(0, i - 1)) }}
            style={{ padding: '8px 12px', fontSize: 16 }}
          >‹</Btn>

          {/* Play / Pause */}
          <Btn
            onClick={() => {
              if (idx >= sorted.length - 1) setIdx(0)
              setPlaying(p => !p)
            }}
            style={{ flex: 1, fontSize: 13 }}
          >
            {playing ? '⏸ إيقاف' : '▶ تشغيل'}
          </Btn>

          {/* Next */}
          <Btn
            variant="ghost"
            onClick={() => { setPlaying(false); setIdx(i => Math.min(sorted.length - 1, i + 1)) }}
            style={{ padding: '8px 12px', fontSize: 16 }}
          >›</Btn>
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              style={{
                flex: 1, background: i === speedIdx ? 'var(--orange-lo)' : 'var(--bg3)',
                border: `1px solid ${i === speedIdx ? 'var(--orange)' : 'var(--border)'}`,
                borderRadius: 8, padding: '7px 4px',
                color: i === speedIdx ? 'var(--orange)' : 'var(--text4)',
                fontFamily: 'var(--font-ar)', fontSize: 12, cursor: 'pointer',
              }}
            >{s.label}</button>
          ))}
        </div>

        {/* Record / Download */}
        {typeof MediaRecorder !== 'undefined' && (
          <div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {!videoUrl && !recording && (
              <Btn onClick={startRecord} variant="secondary" full style={{ fontSize: 12 }}>
                🎥 تسجيل كـ Video
              </Btn>
            )}
            {recording && (
              <Btn onClick={stopRecord} variant="danger" full style={{ fontSize: 12 }}>
                ⏹ إيقاف التسجيل
              </Btn>
            )}
            {videoUrl && (
              <a
                href={videoUrl}
                download={`timelapse-${angle}.webm`}
                style={{ display: 'block', textDecoration: 'none' }}
              >
                <Btn variant="gold" full style={{ fontSize: 12 }}>
                  ⬇️ تحميل الفيديو
                </Btn>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
