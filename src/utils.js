import { RANKS, COMMITMENT_LEVELS } from './constants.js'

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

// ── ID generator ──────────────────────────────────────────────
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

// ── Date helpers ──────────────────────────────────────────────
export const todayISO = () => new Date().toISOString().split('T')[0]

export const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

export const fmtDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '—'
  const m = Math.round(minutes)
  if (m < 60) return `${m} دقيقة`
  return `${Math.floor(m / 60)}س ${m % 60}د`
}

// ── Streak calculator ─────────────────────────────────────────
export const calcStreak = (sessions) => {
  if (!sessions || !sessions.length) return 0
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

// ── Exercise history stats ────────────────────────────────────
export const getExerciseStats = (sessions, exerciseName) => {
  let lastWeight = null
  let maxWeight  = null
  let lastId     = 0
  for (const session of sessions || []) {
    for (const ex of session.exercises || []) {
      if (ex.name !== exerciseName) continue
      const ws = (ex.sets || [])
        .filter(s => s.done && parseFloat(s.weight) > 0)
        .map(s => parseFloat(s.weight))
      if (!ws.length) continue
      const sMax = Math.max(...ws)
      if (maxWeight === null || sMax > maxWeight) maxWeight = sMax
      if ((session.id || 0) > lastId) { lastId = session.id || 0; lastWeight = ws[ws.length - 1] }
    }
  }
  return { lastWeight, maxWeight }
}

// ── Session volume ────────────────────────────────────────────
export const sessionVolume = (session) => {
  if (!session || !session.exercises) return 0
  return session.exercises.flatMap(ex => ex.sets).reduce((total, s) => {
    if (!s.done) return total
    const w = parseFloat(s.weight) || 0
    const r = parseInt(s.reps) || 0
    return total + w * r
  }, 0)
}

// ── Blank set ─────────────────────────────────────────────────
export const blankSet = (prevWeight = '') => ({
  weight: prevWeight,
  reps: '',
  done: false,
})

// ── Build exercise ────────────────────────────────────────────
export const buildExercise = ({ muscle, name, numSets = 3, prevWeight = '' }) => ({
  id: uid(),
  muscle,
  name,
  sets: Array.from({ length: numSets }, () => blankSet(prevWeight)),
})

// ── XP / Level formulas ───────────────────────────────────────
export const xpForNextLevel = (level) => 300 * level * level

export const totalXPForLevel = (level) => {
  if (level <= 1) return 0
  return 50 * (level - 1) * level * (2 * level - 1)
}

export const levelFromXP = (xp) => {
  let level = 1
  while (totalXPForLevel(level + 1) <= xp) level++
  return level
}

export const xpProgress = (xp) => {
  const level = levelFromXP(xp)
  const currentLevelXP = totalXPForLevel(level)
  const nextLevelXP = totalXPForLevel(level + 1)
  const currentXP = xp - currentLevelXP
  const neededXP = nextLevelXP - currentLevelXP
  const pct = neededXP > 0 ? Math.min(100, Math.round((currentXP / neededXP) * 100)) : 100
  return { level, currentXP, neededXP, pct }
}

// ── Rank lookup ───────────────────────────────────────────────
export const getRank = (level) => {
  let rank = RANKS[0]
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r
  }
  return rank
}

// ── Commitment level ──────────────────────────────────────────
export const getCommitmentLevel = (streak) => {
  let cl = COMMITMENT_LEVELS[0]
  for (const c of COMMITMENT_LEVELS) {
    if (streak >= c.min) cl = c
  }
  return cl
}

// ── BMI ───────────────────────────────────────────────────────
export const calcBMI = (weight, height) => {
  if (!weight || !height) return 0
  const h = height / 100
  return Math.round((weight / (h * h)) * 10) / 10
}

export const bmiCategory = (bmi) => {
  if (bmi < 18.5) return 'نقص وزن'
  if (bmi < 25)   return 'وزن طبيعي'
  if (bmi < 30)   return 'زيادة وزن'
  return 'سمنة'
}

// ── Age calculator ────────────────────────────────────────────
export const calcAge = (birthday) => {
  if (!birthday) return null
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ── Challenge state manager ───────────────────────────────────
export const getTodayChallenges = (challengeState, dailyPool, weeklyPool, bossPool) => {
  const today = todayISO()
  const weekNum = Math.floor(Date.now() / (7 * 86400000))

  // Pick stable daily IDs (deterministic by date seed)
  let dailyIds = challengeState?.dailyIds
  let weeklyIds = challengeState?.weeklyIds
  let bossId = challengeState?.bossId

  if (!dailyIds || challengeState?.date !== today) {
    // Seeded random based on date
    const seed = parseInt(today.replace(/-/g, ''))
    const pick3 = (arr) => {
      const shuffled = [...arr].map((x, i) => ({ x, r: Math.sin(seed + i) }))
        .sort((a, b) => a.r - b.r).map(o => o.x)
      return shuffled.slice(0, 3).map(c => c.id)
    }
    dailyIds = pick3(dailyPool)
  }

  if (!weeklyIds || challengeState?.week !== weekNum) {
    const seed = weekNum
    const pick2 = (arr) => {
      const shuffled = [...arr].map((x, i) => ({ x, r: Math.sin(seed + i * 7) }))
        .sort((a, b) => a.r - b.r).map(o => o.x)
      return shuffled.slice(0, 2).map(c => c.id)
    }
    weeklyIds = pick2(weeklyPool)
  }

  if (!bossId) {
    bossId = bossPool[weekNum % bossPool.length]?.id || bossPool[0]?.id
  }

  return { date: today, week: weekNum, dailyIds, weeklyIds, bossId }
}

// ── Notifications ─────────────────────────────────────────────
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export const scheduleNotificationsForToday = async (workoutTime, messages, workoutTimeHours) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker?.ready.catch(() => null)
  if (!reg) return

  const todayKey = new Date().toISOString().split('T')[0]
  if (localStorage.getItem('hf_notif_scheduled') === todayKey) return
  localStorage.setItem('hf_notif_scheduled', todayKey)

  const workoutHour = workoutTimeHours[workoutTime] ?? 17
  const schedule = [
    { hour: 8,           min: 0,  type: 'morning'   },
    { hour: 12,          min: 30, type: 'tip'        },
    { hour: 15,          min: 30, type: 'hydration'  },
    { hour: workoutHour, min: 0,  type: 'workout'    },
    { hour: 21,          min: 0,  type: 'evening'    },
  ]

  const now = new Date()
  schedule.forEach(({ hour, min, type }) => {
    const target = new Date(); target.setHours(hour, min, 0, 0)
    const delay = target - now
    if (delay > 0 && delay < 86400000) {
      setTimeout(async () => {
        try {
          const msg = pickRandom(messages[type])
          await reg.showNotification(msg.title, {
            body: msg.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            dir: 'rtl', lang: 'ar',
            tag: type,
            vibrate: [100, 50, 100],
          })
        } catch {}
      }, delay)
    }
  })
}

// ── Export / Import ───────────────────────────────────────────
export const exportAllData = (sessions, xp, profile, unlockedAchievements, challengeState, photos) => {
  const data = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    sessions, xp, profile, unlockedAchievements, challengeState, photos,
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hamzafit-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const importAllData = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try { resolve(JSON.parse(e.target.result)) }
    catch { reject(new Error('ملف غير صالح')) }
  }
  reader.onerror = () => reject(new Error('خطأ في قراءة الملف'))
  reader.readAsText(file)
})

// ── Audio beep ────────────────────────────────────────────────
export const playBeep = (count = 3) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    Array.from({ length: count }).forEach((_, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = i < count - 1 ? 660 : 880
      const t = ctx.currentTime + i * 0.2
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      o.start(t); o.stop(t + 0.15)
    })
  } catch {}
}

// ── Calendar data builder ─────────────────────────────────────
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
