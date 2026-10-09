// ── Honest reminders ──────────────────────────────────────────
//
// The old scheduler fired five random messages at fixed hours — morning,
// a tip, water, the workout hour, 21:00 — whatever the day was: on rest
// days, after a workout, never mentioning the one thing worth an
// interruption (critique F63). Now there are two, and both depend on
// the streak's real state (src/streak.js):
//
//   · at the chosen workout hour, only on a workout day still owed;
//   · one late warning, only when the day is owed and the streak can be
//     lost: at 23:00 when no ticket would cover it («ستريكك 10 بخطر»),
//     at 01:00 when a ticket would («لو ما تمرّنت الليلة تنصرف تذكرة»).
//
// Saving a session (or the day becoming counted any other way) cancels
// both and closes any shown. Timers live in the page, so they fire only
// while the app is alive; no copy anywhere promises more than that.

import { countAr } from './streak.js'

let timers = []
const clear = () => { timers.forEach(clearTimeout); timers = [] }

async function registration() {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return null
  return navigator.serviceWorker?.ready.catch(() => null) ?? null
}

async function closeShown(tag) {
  const reg = await registration()
  if (!reg?.getNotifications) return
  try { (await reg.getNotifications({ tag })).forEach(n => n.close()) } catch { /* ignore */ }
}

function at(day, hour, min = 0) {
  // `day` is a training-day key; 00:00–02:59 belong to the next calendar date.
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, hour < 3 ? d + 1 : d, hour, min, 0, 0)
}

/**
 * Re-plan from the current streak view. Call whenever it changes.
 * view: streakView(); workoutHour: the chosen hour (e.g. 17); enabled:
 * the user's notification setting.
 */
export function planReminders({ view, workoutHour = 17, enabled = false, now = new Date() }) {
  clear()
  const owed = view && (view.kind === 'owed')
  if (!enabled || !owed) {
    closeShown('streak'); closeShown('workout')
    return []
  }
  const plans = []
  const workoutAt = at(view.today, workoutHour)
  if (workoutAt > now) {
    plans.push({ when: workoutAt, tag: 'workout', title: 'وقت التمرين', body: 'يوم تمرين اليوم — يلا قبل لا يزحمك اليوم.' })
  }
  if (view.number >= 1) {
    const ticket = view.tickets >= 1
    const lateAt = at(view.today, ticket ? 1 : 23)
    if (lateAt > now) {
      plans.push(ticket
        ? { when: lateAt, tag: 'streak', title: 'لو ما تمرّنت الليلة تنصرف تذكرة', body: `الستريك يوقف على ${view.number}${view.tickets - 1 > 0 ? ` ويبقى لك ${countAr(view.tickets - 1, 'ticket')}` : ' وتخلص تذاكرك'}.` }
        : { when: lateAt, tag: 'streak', title: `ستريكك ${view.number} بخطر`, body: 'باقي لك لين 3 الفجر وما عندك تذاكر. ابدأ جلسة قبل 3 وتنحسب.' })
    }
  }
  for (const p of plans) {
    timers.push(setTimeout(async () => {
      const reg = await registration()
      if (!reg) return
      try {
        await reg.showNotification(p.title, {
          body: p.body, icon: '/icon-192.png', badge: '/icon-192.png',
          dir: 'rtl', lang: 'ar', tag: p.tag, renotify: false,
        })
      } catch { /* ignore */ }
    }, p.when - now))
  }
  return plans
}
