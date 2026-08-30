import { useEffect, useRef, useState } from 'react'
import { ls, playBeep } from '../../utils.js'

const STORE = 'hf_rest_timer'

// ── Rest, inside the player ───────────────────────────────────
//
// Reads the exact state the floating RestTimer writes — selected,
// endsAt, pausedLeft — so a rest started anywhere continues here and
// vice versa. Wall-clock driven for the same reason the original is:
// a phone locked mid-rest must come back with the truth, not with a
// frozen tick count.
//
// The floating overlay is suppressed while the player is on screen
// (App skips it for the workout tab), which makes this the mounted
// owner of the finish beep. ±15s just moves endsAt; the original
// component reads the same key and needs no teaching.

function read() {
  return ls.get(STORE, null)
}

export default function InlineRest({ onDone, onSkip }) {
  const [, force] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 300)
    return () => clearInterval(id)
  }, [])

  const st = read()
  const left = st?.pausedLeft != null
    ? st.pausedLeft
    : st?.endsAt ? Math.max(0, Math.ceil((st.endsAt - Date.now()) / 1000)) : 0

  // The beep belongs to whoever is on screen when zero arrives.
  useEffect(() => {
    if (left === 0 && st?.endsAt && !firedRef.current) {
      firedRef.current = true
      playBeep(4)
      if (navigator.vibrate) navigator.vibrate([180, 80, 180])
      const t = setTimeout(() => onDone?.(), 1200)
      return () => clearTimeout(t)
    }
    if (left > 0) firedRef.current = false
  }, [left === 0, st?.endsAt])

  if (!st) return null

  const nudge = (delta) => {
    const cur = read()
    if (!cur) return
    if (cur.pausedLeft != null) {
      ls.set(STORE, { ...cur, pausedLeft: Math.max(0, cur.pausedLeft + delta) })
    } else {
      ls.set(STORE, { ...cur, endsAt: Math.max(Date.now(), (cur.endsAt || Date.now()) + delta * 1000) })
    }
    force(n => n + 1)
  }

  const skip = () => {
    ls.remove(STORE)
    onSkip?.()
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const finished = left === 0

  const nudgeBtn = {
    flex: 1, padding: '9px 6px', borderRadius: 10,
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    color: 'var(--text2)', fontFamily: 'var(--font-ar)', fontSize: 12,
    fontWeight: 700, cursor: 'pointer',
  }

  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${finished ? '#22C55E50' : 'var(--border2)'}`,
      borderRadius: 'var(--radius-sm)', padding: 12, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: finished ? '#22C55E' : 'var(--cyan)', display: 'inline-block' }} />
        {finished ? 'جاهز' : 'الراحة'}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 800,
        color: finished ? '#22C55E' : 'var(--text)', lineHeight: 1.3,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {mm}:{ss}
      </div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
        {finished ? 'المجموعة التالية' : 'راحة بين المجموعات'}
      </div>
      {!finished && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button style={nudgeBtn} onClick={() => nudge(-15)}>−15 ثانية</button>
          <button style={nudgeBtn} onClick={() => nudge(15)}>+15 ثانية</button>
        </div>
      )}
      <button
        onClick={skip}
        style={{
          width: '100%', padding: '9px 6px', borderRadius: 10,
          background: 'transparent', border: '1px solid transparent',
          color: finished ? '#22C55E' : 'var(--red)', fontFamily: 'var(--font-ar)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >{finished ? '✓ تمام' : 'تخطي الراحة'}</button>
    </div>
  )
}
