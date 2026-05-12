// ── localStorage helpers ──────────────────────────────────────
export const ls = {
  get: (key, def) => {
    try {
      const v = localStorage.getItem(key)
      return v !== null ? JSON.parse(v) : def
    } catch {
      return def
    }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  },
}

// ── Date helpers ──────────────────────────────────────────────
export const todayISO = () => new Date().toISOString().split('T')[0]

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('ar-SA', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('ar-SA', {
    hour: '2-digit', minute: '2-digit',
  })

export const fmtDuration = (ms) => {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} دقيقة`
  return `${Math.floor(m / 60)}س ${m % 60}د`
}

// ── Streak calculator ─────────────────────────────────────────
export const calcStreak = (sessions) => {
  if (!sessions.length) return 0
  const days = [...new Set(sessions.map(s => s.date.split('T')[0]))]
    .sort()
    .reverse()
  let streak = 0
  let cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (const d of days) {
    const dd = new Date(d)
    const diff = Math.round((cursor - dd) / 86400000)
    if (diff <= 1) { streak++; cursor = dd } else break
  }
  return streak
}

// ── 1RM estimate (Epley formula) ─────────────────────────────
export const calc1RM = (weight, reps) => {
  if (!weight || !reps) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

// ── Session volume ────────────────────────────────────────────
export const sessionVolume = (session) =>
  session.exercises.flatMap(ex => ex.sets).reduce((total, s) => {
    if (!s.done) return total
    const w = parseFloat(s.weight) || 0
    const r = (parseInt(s.r1) || 0) + (parseInt(s.r2) || 0) + (parseInt(s.r3) || 0)
    return total + w * r
  }, 0)

// ── ID generator ─────────────────────────────────────────────
export const uid = () => Date.now() + Math.random().toString(36).slice(2)

// ── Build blank set ───────────────────────────────────────────
export const blankSet = (prevWeight = '') => ({
  weight: prevWeight,
  r1: '', r2: '', r3: '',
  done: false,
})

// ── Build exercise object ─────────────────────────────────────
export const buildExercise = ({ muscle, name, emoji, numSets = 3, prevWeight = '' }) => ({
  id: uid(),
  muscle,
  name,
  emoji,
  sets: Array.from({ length: numSets }, () => blankSet(prevWeight)),
})

// ── Audio beep ───────────────────────────────────────────────
export const playBeep = (count = 3) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    Array.from({ length: count }).forEach((_, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = i < count - 1 ? 660 : 880
      const t = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      o.start(t); o.stop(t + 0.15)
    })
  } catch {}
}

// ── Build calendar data (past N weeks) ──────────────────────
export const buildCalendarData = (sessions, weeks = 14) => {
  const counts = {}
  sessions.forEach(s => {
    const d = s.date.split('T')[0]
    counts[d] = (counts[d] || 0) + 1
  })
  const end = new Date(); end.setHours(0, 0, 0, 0)
  const start = new Date(end); start.setDate(start.getDate() - weeks * 7 + 1)
  const days = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split('T')[0]
    days.push({ iso, count: counts[iso] || 0 })
  }
  return days
}

// ── Arabic numeral helper ─────────────────────────────────────
export const toAr = (n) =>
  String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d])
