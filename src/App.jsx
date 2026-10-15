import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { flushSync } from 'react-dom'
import {
  ls, calcStreak, buildExercise, getExerciseStats, resolveExerciseName, suggestedWeightFor, fmtDate, pickGreeting, keepDone, normalizeSession, setCounts,
  levelFromXP, xpProgress, getTodayChallenges,
  scheduleNotificationsForToday, applySubsToDay, getHistoricalMax, sessionVolume, restoreMonthGoals, restorePlan,
} from './utils.js'
import {
  NAV_TABS, ACHIEVEMENTS,
  DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES,
  NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS,
  DEFAULT_EXERCISE_MAPPING, APP_VERSION, EXERCISE_ALTERNATIVES,
} from './constants.js'
import { PersonIcon, TrophyIcon, FlagIcon, DumbbellIcon, HomeIcon, SettingsIcon } from './components/Icons.jsx'
import { computeRecovery, DEFAULT_RECOVERY, DAY_STATUS, changeCooldownLeft, dayDiff } from './recovery.js'
import { streakView, todayStreak, skipCopy, finishToast, spendToast, countAr } from './streak.js'
import { planReminders } from './notify.js'
import { todayKey, dayKey, nextDayTurn } from './day.js'
import { analyzeProgression, DEFAULT_REP_TARGET, planRepTarget, liftRepTarget, ownTarget } from './progression.js'
import { deloadState, sessionDeloadStamp, isDeloadSession, startDeload, endDeload, deloadWeight,
         suggestDeload, dismissSuggestion } from './deload.js'

// ── The four tabs ──
// Home, what you did, how you are progressing, and the library. The
// profile opens from the avatar on Home and settings from the gear;
// achievements live inside التقدم. «تمرين» and «التمارين» used to sit
// side by side and mean different things.
const NAV = [
  { id: 'home',     label: 'الرئيسية', icon: House },
  { id: 'history',  label: 'السجل',    icon: ClockCounterClockwise },
  { id: 'progress', label: 'التقدم',   icon: ChartLineUp },
  { id: 'library',  label: 'المكتبة',  icon: Books },
]

// The page under the bar. How it arrived is fixed when it mounts: inside
// a tab switch's view transition the snapshot moves, so it has no fade of
// its own (adding one later would replay it); otherwise it fades in.
function PageMain({ vt, children, ...rest }) {
  const [enter] = useState(() => !vt)
  return <main className={enter ? 'page-enter f-main' : 'f-main'} {...rest}>{children}</main>
}

// Pages
import HomePage        from './pages/HomePage.jsx'
// The plan builder is a page of its own, loaded only when it opens (it
// brings the body figure's paths with it).
const PlannerPage = lazy(() => import('./pages/planner/PlannerPage.jsx'))
// «خطتي» — his plan as he runs it, as cards (src/pages/planview): its
// own chunk too (the page, its styles, the body figure).
const PlanView = lazy(() => import('./pages/planview/PlanView.jsx'))
import WorkoutPage     from './pages/WorkoutPage.jsx'
import HistoryPage     from './pages/HistoryPage.jsx'
import AchievementsPage from './pages/AchievementsPage.jsx'
import ProfilePage     from './pages/ProfilePage.jsx'
import SettingsPage    from './pages/SettingsPage.jsx'
import PhotosPage      from './pages/PhotosPage.jsx'
import ExercisesPage   from './pages/ExercisesPage.jsx'

// Components
import RestTimer        from './components/RestTimer.jsx'
import RoutinesModal    from './components/RoutinesModal.jsx'
import LevelUpScreen    from './components/LevelUpScreen.jsx'
import { dayWord }       from './components/player/sessionWords.js'
import SystemAlert      from './components/SystemAlert.jsx'
import WhatsNewModal    from './components/WhatsNewModal.jsx'
import DeloadEndScreen  from './components/DeloadEndScreen.jsx'
import AssetPackPrompt  from './components/AssetPackPrompt.jsx'
import StreakChip       from './components/streak/StreakChip.jsx'
import LiveBar          from './components/frame/LiveBar.jsx'
import TabBar           from './components/frame/TabBar.jsx'
import { reducedMotion } from './motion.js'
import SessionSummary   from './components/frame/SessionSummary.jsx'
import { warmMedals, dropWarm } from './components/progress/medalStage.js'
import Onboarding       from './components/frame/Onboarding.jsx'
import ProgressPage     from './pages/ProgressPage.jsx'
import { LargeTitle, NavBar, IconButton } from './components/kit/index.jsx'
import { House, ClockCounterClockwise, ChartLineUp, Books, GearSix, CaretDown } from './components/kit/icons.js'
import SkipSheet        from './components/streak/SkipSheet.jsx'
import StreakSheet      from './components/streak/StreakSheet.jsx'
import RestDayEarned    from './components/streak/RestDayEarned.jsx'
import { restDaysView, toAnnounce, markAnnounced, REST_ANNOUNCED_KEY } from './restDays.js'
import MonthReport      from './components/report/MonthReport.jsx'
import SavePosterSheet  from './components/report/SavePosterSheet.jsx'
import { sharePoster, SHARE_RESULT } from './reportPoster.js'
import {
  buildMonthReport, monthReportWindow, monthsTrail, reportMonths, MONTH_GOAL_KEY,
  monthGoalOf, withMonthGoal, expectedSessions, nextMonth, monthName,
} from './monthReport.js'
import { REPORT_SEEN_KEY, storySeen, withStorySeen, applyNext, appliedLine, REPORT_APPLIED_KEY, appliedOn, withApplied } from './reportStory.js'
import { validatePlan } from './plan/validate.js'
import { planTitle } from './plan/title.js'
import { dropsOf, withDropped, DROPPED_KEY } from './plan/view.js'
import { initPack, wasPrompted, syncPack } from './assets/pack.js'

// One-time weights reset (v2): the old exercise mapping wrongly
// merged machine/cable/dumbbell/barbell variants, polluting saved
// weight suggestions. Clear the snapshot, backups, and the stored
// stale mapping so suggestions rebuild from the precise mapping.
// Runs once per user (flag is per-user namespaced).
if (!ls.get('hf_weights_reset_v2', false)) {
  ls.remove('hf_last_weights')
  ls.remove('hf_weight_backups')
  ls.remove('hf_exercise_mapping')
  // Only users with existing sessions get the history cutoff —
  // fresh users have nothing to reset
  if ((ls.get('hf_sessions', []) || []).length) {
    ls.set('hf_weights_reset_at', Date.now())
  }
  ls.set('hf_weights_reset_v2', true)
}

// History repair. The first cleanup (hf_history_cleaned_v1) dropped
// every session with no ticked set — but a workout could always be
// finished by typing the numbers without ticking, and a month of real
// sessions went with it, breaking a 30-day streak. The untouched
// original was kept in hf_sessions_backup_v1; rebuild from it with the
// corrected rule (normalizeSession: a saved session is never dropped),
// keep any session saved since, and write down which days came back so
// the Settings ledger can show them. Runs once per user.
if (!ls.get('hf_history_restored_v2', false)) {
  const backup  = ls.get('hf_sessions_backup_v1', null)
  const current = ls.get('hf_sessions', []) || []
  const source  = backup || current
  if (source.length || current.length) {
    const rebuilt  = source.map(normalizeSession).filter(Boolean)
    const known    = new Set(rebuilt.map(s => s.id))
    const newer    = current.filter(s => !known.has(s.id)).map(normalizeSession).filter(Boolean)
    const had      = new Set(current.map(s => s.id))
    const returned = rebuilt.filter(s => !had.has(s.id))
    const merged   = [...newer, ...rebuilt].sort((a, b) => (b.id || 0) - (a.id || 0))
    ls.set('hf_sessions', merged)
    if (backup && !ls.get('hf_sessions_backup_v2', null)) ls.set('hf_sessions_backup_v2', current)
    ls.set('hf_history_restore_report', {
      at: Date.now(),
      count: returned.length,
      dates: returned.map(s => dayKey(s.date)).sort(),
    })
  }
  ls.set('hf_history_cleaned_v1', true)
  ls.set('hf_history_restored_v2', true)
}

// The achievements a check would award now: met, and not yet unlocked.
// The award (checkAchievements) and the look-ahead that builds the medal
// stage before the summary opens (medalsIfFinished) both ask this, so
// they can't disagree.
function newlyEarned(sessions, xp, streak, unlocked = []) {
  return ACHIEVEMENTS.filter(a => {
    if (unlocked.includes(a.id)) return false
    try { return !!a.check(sessions, xp, streak) } catch { return false }
  })
}

// Later, when the page has a moment (requestIdleCallback where there is one).
const whenIdle = (fn) => {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 2000 })
    return () => cancelIdleCallback(id)
  }
  const t = setTimeout(fn, 200)
  return () => clearTimeout(t)
}

// A change of weekly frequency, effective from today and never
// backdated — a change must not rescue a day already missed. The past
// keeps being judged by the pattern in force then (patternHistory).
function withFrequency(prev, patch, today) {
  const next = { ...prev, ...patch }
  const segment = { from: today, daysPerWeek: next.daysPerWeek, customPattern: next.customPattern }
  const history = (prev.patternHistory || []).filter(seg => seg.from !== today)
  // Seed the pre-change era so the past keeps being judged as it was.
  if (!history.length && !(prev.patternHistory || []).length) {
    history.push({ from: '1970-01-01', daysPerWeek: prev.daysPerWeek, customPattern: prev.customPattern })
  }
  return { ...next, patternHistory: [...history, segment].slice(-40) }
}

// Default profile
const DEFAULT_PROFILE = {
  name: 'البطل',
  birthday: null,
  height: null,
  weight: null,
  bodyFat: null,
  goal: 'muscle',
  gymType: 'commercial',
  trainingSystem: 'ppl',
  trainingDays: [1, 3, 5], // Mon, Wed, Fri
  workoutTime: 'المساء',
  lastWeightUpdate: null,
}

export default function App() {
  // ── Persistent state ──────────────────────────────────────────
  const [sessions,            setSessions]            = useState(() => ls.get('hf_sessions', []))
  const [xp,                  setXP]                  = useState(() => ls.get('hf_xp', 0))
  const [active,              setActive]              = useState(() => ls.get('hf_active', null))
  const [profile,             setProfile]             = useState(() => ls.get('hf_profile', DEFAULT_PROFILE))
  const [unlockedAchievements,setUnlockedAchievements]= useState(() => ls.get('hf_unlocked', []))
  const [challengeState,      setChallengeState]      = useState(() => ls.get('hf_challenges', null))
  const [plan,                setPlan]                = useState(() => ls.get('hf_plan', null))
  const [planIndex,           setPlanIndex]           = useState(() => ls.get('hf_plan_index', 0))
  const [exerciseMapping,     setExerciseMapping]     = useState(() => ({ ...DEFAULT_EXERCISE_MAPPING, ...ls.get('hf_exercise_mapping', {}) }))
  const [exerciseSubs,        setExerciseSubs]        = useState(() => ls.get('hf_exercise_subs', {}))
  // Recovery config. Migrates existing users off the old weekday
  // picker by reading how many days a week they had selected —
  // workout history and plan order are left completely untouched.
  const [repTarget, setRepTarget] = useState(() => ({ ...DEFAULT_REP_TARGET, ...ls.get('hf_rep_target', {}) }))
  // When each achievement was earned: { id: epochMs }. Stored separately
  // so the existing unlocked-id list needs no migration.
  const [unlockedAt, setUnlockedAt] = useState(() => ls.get('hf_unlocked_at', {}))
  const [recoveryCfg, setRecoveryCfg] = useState(() => {
    const saved = ls.get('hf_recovery', null)
    if (saved) return { ...DEFAULT_RECOVERY, ...saved }
    const legacy = ls.get('hf_profile', null)?.trainingDays
    const perWeek = Array.isArray(legacy) && legacy.length >= 3 && legacy.length <= 6
      ? legacy.length : DEFAULT_RECOVERY.daysPerWeek
    return { ...DEFAULT_RECOVERY, daysPerWeek: perWeek }
  })

  // ── UI state ──────────────────────────────────────────────────
  const [tab,        setTab]        = useState('home')
  // Pages pushed over a tab (profile → settings → …), and whether the
  // running session is open full screen or docked as the live bar.
  const [pages,      setPages]      = useState([])
  const [sessionOpen, setSessionOpen] = useState(() => !!ls.get('hf_active', null))
  const page = pages[pages.length - 1] || null
  const pushPage = useCallback((p) => setPages(prev => [...prev.filter(x => x !== p), p]), [])
  const popPage  = useCallback(() => setPages(prev => prev.slice(0, -1)), [])
  // A tab switch (phase 5): the page under the bar leaves towards the
  // side it came from and the new one comes in from the tapped tab's side,
  // 14px and a fade, while the bar stays put and its capsule slides
  // (TabBar). It runs as a view transition — a snapshot of the old page
  // moves, never <main> itself, so no transform is ever left on it (see
  // index.css: a transform on <main> traps fixed sheets). Without view
  // transitions, or under reduced motion, the new page simply fades in.
  const navNow = useRef({ tab: 'home', page: null })
  const tabNav = useRef({ vt: false, token: 0 })
  const goTab    = useCallback((t) => {
    const apply = () => {
      setPages([])
      setTab(prev => {
        if (prev === t) window.scrollTo({ top: 0, behavior: 'smooth' })
        return t
      })
    }
    const { tab: cur, page: pg } = navNow.current
    const i = NAV.findIndex(n => n.id === t), j = NAV.findIndex(n => n.id === cur)
    const vt = !pg && t !== cur && i >= 0 && j >= 0 && typeof document.startViewTransition === 'function'
      && !reducedMotion() && document.visibilityState === 'visible'
    if (!vt) { apply(); return }
    const root = document.documentElement
    const token = ++tabNav.current.token
    root.dataset.tabnav = i > j ? 'fwd' : 'back'
    const clear = () => { if (tabNav.current.token === token) delete root.dataset.tabnav }
    try {
      const tr = document.startViewTransition(() => {
        tabNav.current.vt = true
        try { flushSync(apply) } finally { tabNav.current.vt = false }
      })
      tr.ready?.catch?.(() => {})   // skipped (a second tap mid-way): fine
      tr.finished.then(clear, clear)
    } catch {
      clear()
      apply()
    }
  }, [])

  // Each view keeps its own scroll position, so a tab switch does not
  // dump you at the top of a long list, or halfway down the next one.
  const viewKey = page || tab
  navNow.current = { tab, page }
  const scrollPos = useRef({})
  const viewRef = useRef(viewKey)
  useEffect(() => {
    const onScroll = () => { scrollPos.current[viewRef.current] = window.scrollY }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Before paint (and inside a tab switch's view transition, before its
  // new snapshot), so the page never shows a frame at the wrong height.
  useLayoutEffect(() => {
    viewRef.current = viewKey
    window.scrollTo(0, scrollPos.current[viewKey] || 0)
  }, [viewKey])
  const [showRest,   setShowRest]   = useState(() => {
    // A rest timer left running when the app was closed keeps counting
    // on wall-clock time — bring it back so it isn't silently lost.
    const t = ls.get('hf_rest_timer', null)
    if (!t) return false
    if (t.pausedLeft != null) return t.pausedLeft > 0
    if (typeof t.endsAt !== 'number') return false
    // Still counting, or only just finished — coming back a few seconds
    // late should still greet you with "انتهت الراحة" rather than silence.
    return Date.now() - t.endsAt < 120_000
  })
  const [showLevelUp,setShowLevelUp]= useState(false)
  const [levelUpNum, setLevelUpNum] = useState(1)
  const [levelUpFrom, setLevelUpFrom] = useState(null)
  const [alertQueue, setAlertQueue] = useState([])
  const [restKey,    setRestKey]    = useState(0)
  const [photos,     setPhotos]     = useState(() => ls.get('hf_photos', []))
  // A fresh install has nothing to be told is new: no changelog on the
  // first run (critique F45). It is marked seen silently instead.
  const firstRun = !ls.get('hf_onboarded', false) && !(ls.get('hf_sessions', []) || []).length && !ls.get('hf_plan', null)
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    if (ls.get('hf_seen_version') === APP_VERSION) return false
    if (firstRun) { ls.set('hf_seen_version', APP_VERSION); return false }
    return true
  })
  const [onboarding, setOnboarding] = useState(firstRun)
  // Set by the boot reconciliation below, never by a stored flag alone.
  const [packOffer,  setPackOffer]  = useState(false)
  const [showReport, setShowReport] = useState(false)
  // Another month opened from inside the report; null is the month the
  // report window is offering.
  const [reportPick, setReportPick] = useState(null)
  const [sharing,    setSharing]    = useState(false)
  // Set only when neither the share sheet nor a download is available.
  const [posterUrl,  setPosterUrl]  = useState(null)

  const prevLevelRef  = useRef(levelFromXP(xp))
  const sessionXPRef  = useRef(0) // XP earned in the current live session (refunded on تراجع)
  // While the end-of-workout summary is being composed, XP, a level-up
  // and achievements are collected into it instead of firing toasts and
  // full-screen interruptions one after another.
  const collectRef      = useRef(false)
  const pendingLevelRef = useRef(null)
  const [summary, setSummary] = useState(null)
  const summaryRef = useRef(null)
  summaryRef.current = summary
  const xpRef = useRef(xp)
  xpRef.current = xp
  const activeRef     = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const unlockedRef = useRef(unlockedAchievements)
  unlockedRef.current = unlockedAchievements
  const recoveryRef = useRef(recoveryCfg)
  recoveryRef.current = recoveryCfg

  // ── Persist to localStorage ───────────────────────────────────
  useEffect(() => { ls.set('hf_sessions', sessions) },             [sessions])
  useEffect(() => { ls.set('hf_xp',       xp)       },             [xp])
  useEffect(() => { ls.set('hf_active',   active)   },             [active])
  useEffect(() => { ls.set('hf_profile',  profile)  },             [profile])
  useEffect(() => { ls.set('hf_unlocked', unlockedAchievements) }, [unlockedAchievements])
  useEffect(() => { ls.set('hf_challenges', challengeState) },     [challengeState])
  useEffect(() => { ls.set('hf_plan',             plan)            }, [plan])
  useEffect(() => { ls.set('hf_plan_index',       planIndex)       }, [planIndex])
  useEffect(() => { ls.set('hf_photos',           photos)          }, [photos])
  useEffect(() => { ls.set('hf_exercise_mapping', exerciseMapping) }, [exerciseMapping])
  useEffect(() => { ls.set('hf_exercise_subs',    exerciseSubs)    }, [exerciseSubs])
  useEffect(() => { ls.set('hf_recovery',         recoveryCfg)     }, [recoveryCfg])
  useEffect(() => { ls.set('hf_rep_target',       repTarget)       }, [repTarget])
  useEffect(() => { ls.set('hf_unlocked_at',      unlockedAt)      }, [unlockedAt])


  // ── Initialize / refresh challenge state ──────────────────────
  useEffect(() => {
    const fresh = getTodayChallenges(challengeState, DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES)
    if (
      !challengeState ||
      challengeState.date !== fresh.date ||
      challengeState.week !== fresh.week
    ) {
      setChallengeState(prev => ({
        ...fresh,
        completed: prev?.date === fresh.date ? (prev?.completed || []) : [],
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Art pack ─────────────────────────────────────────────────
  // Bring whatever art is already on the device onto the screen, then
  // decide whether to offer the download. The answer comes from
  // counting the stored blobs, not from a flag: iOS can evict
  // script-writable storage without notice, and a flag left behind
  // would leave the app convinced it has art it no longer has.
  useEffect(() => {
    let alive = true
    initPack().then(rec => {
      if (!alive) return
      // Not on a fresh install: setup comes first, the art offer waits
      // for the next launch.
      if (!rec.installed && !wasPrompted() && !firstRun) setPackOffer(true)
      // An installed pack is only as new as the day it was downloaded.
      // Check the published version in the background so art added
      // after that day actually arrives; silent by design, and a
      // failure here leaves the app exactly as it already was.
      else if (rec.installed) syncPack().catch(() => {})
    }).catch(e => {
      // Never swallow this: a throw here once left the art un-hydrated
      // with no trace of why.
      console.error('meran/assets: boot failed', e)
    })
    return () => { alive = false }
  }, [])

  // ── WhatsNew dismiss ─────────────────────────────────────────
  const dismissWhatsNew = useCallback(() => {
    ls.set('hf_seen_version', APP_VERSION)
    setShowWhatsNew(false)
  }, [])

  // ── Alert helper ──────────────────────────────────────────────
  const pushAlert = useCallback((icon, msg) => {
    setAlertQueue(prev => {
      const [head, ...rest] = prev
      // Same icon as current → merge in place, bump timer
      if (head && head.icon === icon) {
        return [{ ...head, msg, count: (head.count || 1) + 1, bumpAt: Date.now() }, ...rest]
      }
      // Different icon → queue behind
      return [...prev, { id: Date.now() + Math.random(), icon, msg, count: 1, bumpAt: Date.now() }]
    })
  }, [])

  // Storage full: tell the user what did not save and what to do.
  useEffect(() => {
    let last = 0
    const onFull = (e) => {
      if (Date.now() - last < 15000) return
      last = Date.now()
      const what = e.detail?.key === 'hf_photos' ? 'الصورة' : e.detail?.key === 'hf_sessions' ? 'الجلسة' : 'آخر تعديل'
      pushAlert('⚠️', `التخزين ممتلئ — ${what} ما انحفظت. احذف صور تقدم قديمة أو خذ نسخة احتياطية من الإعدادات.`)
    }
    window.addEventListener('meran:storage-full', onFull)
    return () => window.removeEventListener('meran:storage-full', onFull)
  }, [pushAlert])

  const removeAlert = useCallback(() => {
    setAlertQueue(prev => prev.slice(1))
  }, [])

  // ── XP float animation ────────────────────────────────────────
  const showXPFloat = useCallback((amount) => {
    const el = document.createElement('div')
    el.className = 'xp-float'
    el.dir = 'ltr'   // «+150 XP», the sign before the number, in an RTL page
    el.textContent = `+${amount} XP`
    el.style.left = '50%'
    el.style.top  = '35%'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1600)
  }, [])

  // ── Add XP ───────────────────────────────────────────────────
  // quiet: no float, no toast, and a level-up waits for the summary —
  // used for XP earned set by set, which used to interrupt every set.
  const addXP = useCallback((amount, label = '', { quiet = false } = {}) => {
    const deferred = quiet || collectRef.current
    setXP(prev => {
      const newXP      = prev + amount
      const oldLevel   = levelFromXP(prev)
      const newLevel   = levelFromXP(newXP)
      if (newLevel > oldLevel) {
        prevLevelRef.current = newLevel
        if (deferred) {
          pendingLevelRef.current = newLevel
          setSummary(sm => (sm ? { ...sm, levelUp: newLevel } : sm))
        } else {
          setLevelUpNum(newLevel)
          setShowLevelUp(true)
        }
      }
      return newXP
    })
    if (collectRef.current) { setSummary(sm => (sm ? { ...sm, xp: sm.xp + amount } : sm)); return }
    if (quiet) return
    showXPFloat(amount)
    if (label) pushAlert('⭐', `${label} +${amount} XP`)
  }, [showXPFloat, pushAlert])

  // XP during a live workout — tracked so it can be refunded on تراجع,
  // and silent: the summary at the end says it once.
  const addWorkoutXP = useCallback((amount, label = '') => {
    addXP(amount, label, { quiet: true })
    sessionXPRef.current += amount
  }, [addXP])

  // ── Achievement checker ───────────────────────────────────────
  const checkAchievements = useCallback((newSessions, newXP, newStreak) => {
    setUnlockedAchievements(prev => {
      const newUnlocked = [...prev]
      const stamps = {}
      let gained = 0
      newlyEarned(newSessions, newXP, newStreak, prev).forEach(a => {
        newUnlocked.push(a.id)
        stamps[a.id] = Date.now()
        gained += a.xp
        // (finishSession already put the session's own into the summary)
        if (collectRef.current) setSummary(sm => (sm && !sm.achievements.some(x => x.id === a.id) ? { ...sm, achievements: [...sm.achievements, a] } : sm))
        else pushAlert('🏆', `إنجاز: ${a.title}`)
      })
      if (Object.keys(stamps).length) {
        setUnlockedAt(p2 => ({ ...p2, ...stamps }))
      }
      if (gained > 0) {
        setTimeout(() => addXP(gained, 'إنجازات'), 300)
      }
      return newUnlocked
    })
  }, [addXP, pushAlert])

  // ── Achievements safety net ──────────────────────────────────
  // Re-check whenever sessions change (app load, history edits,
  // imports) — not only at finishSession. Idempotent: already
  // unlocked achievements are skipped, so no duplicate awards.
  useEffect(() => {
    if (!sessions.length) return
    const t = setTimeout(() => {
      checkAchievements(sessions, xp, computeRecovery(sessions, recoveryCfg).consistencyStreak)
    }, 1000)
    return () => clearTimeout(t)
  }, [sessions, recoveryCfg]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-backup every 10 min during active workout ───────────
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const cur = activeRef.current
      if (!cur) return
      const backups = ls.get('hf_weight_backups', [])
      backups.unshift({ savedAt: Date.now(), sessionId: cur.id, exercises: cur.exercises })
      ls.set('hf_weight_backups', backups.slice(0, 5))
      pushAlert('💾', 'حُفظت أوزانك تلقائياً')
    }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [active?.id, pushAlert])

  // ── Session management ────────────────────────────────────────
  const startPlannedWorkout = useCallback((planDay) => {
    sessionXPRef.current = 0
    const deloadStamp = sessionDeloadStamp(recoveryCfg, todayKey())
    const lighten = deloadStamp ? (w => deloadWeight(w, deloadStamp.pct)) : undefined
    const planExercises = applySubsToDay(planDay.exercises, exerciseSubs, EXERCISE_ALTERNATIVES)
    const exercises = planExercises.map(ex => {
      const prevWeight = suggestedWeightFor(ex.name, {
        sessions, mapping: exerciseMapping, transform: lighten,
      })
      // The plan's own reps and rest (حمزة: «الجلسة تاخذ العدّات والراحة
      // من الخطة»): the rest counts its seconds; the reps aim for its
      // range only when he set that range himself in the builder — else
      // his Settings target («خياري ١٢ الى ١٥»). Both ride on the
      // session's exercise as optional fields (target, rest) the old
      // design ignores; a stored target is marked own: true.
      const planT = planRepTarget(ex)
      const prog = analyzeProgression(sessions, ex.name, exerciseMapping, planT || repTarget)
      const built = buildExercise({ muscle: ex.muscle, name: ex.name, numSets: ex.sets || 3, prevWeight, prevReps: prog.suggestedReps })
      const rest = Number(ex.restSeconds)
      return {
        ...built,
        // A remembered swap: the plan's own exercise, as a live swap keeps
        // it (the session's «بدل …», and «دايماً بخطتي» finding its row).
        ...(ex.originalName ? { originalName: ex.originalName } : null),
        ...(planT ? { target: ownTarget(planT) } : null),
        ...(rest > 0 ? { rest: Math.round(rest) } : null),
        ...(ex.unit === 'sec' || ex.unit === 'min' ? { unit: ex.unit } : null),
      }
    })
    const session = {
      id:           Date.now(),
      date:         new Date().toISOString(),
      duration:     null,
      exercises,
      planDayName:  planDay.name,
      planDayIndex: planIndex,
      // The plan it was a day of (an optional field the old design
      // ignores): «خطتي» counts what he adds on a day only in this plan's
      // own sessions (src/plan/view.js ofThisPlan), even after he goes
      // back to an older plan whose days have the same names.
      ...(plan?.planId ? { planId: plan.planId } : null),
      // Decided once, here, and it stays decided. A deload that ends
      // mid-workout does not turn the light weights already on screen
      // into normal training. Null when there is no deload running, so
      // ordinary sessions carry no extra field.
      ...(deloadStamp ? { deload: deloadStamp } : null),
    }
    setActive(session)
    setSessionOpen(true)
  }, [plan, planIndex, sessions, exerciseMapping, exerciseSubs, repTarget, recoveryCfg])

  // Skipping only moves the plan. The streak still wants today's
  // workout, which is why the skip sheet states the cost before this
  // runs, and why the toast says the day is still a workout day.
  const skipPlanDay = useCallback((message) => {
    setPlanIndex(prev => prev + 1)
    pushAlert('⏭️', message || 'انتقلت الخطة لليوم الجاي')
  }, [pushAlert])

  const startWorkout = useCallback((exercises = []) => {
    sessionXPRef.current = 0
    const deloadStamp = sessionDeloadStamp(recoveryCfg, todayKey())
    const session = {
      id:        Date.now(),
      date:      new Date().toISOString(),
      duration:  null,
      exercises,
      ...(deloadStamp ? { deload: deloadStamp } : null),
    }
    setActive(session)
    setSessionOpen(true)
  }, [recoveryCfg])

  // ── The medals a session would earn if it were finished now ──
  // The same check, with the same numbers, finishSession hands the award:
  // the session as it stands, its finish bonus, today's streak with it.
  const medalsIfFinished = useCallback((cur) => {
    if (!cur) return []
    try {
      const duration = Math.round((Date.now() - cur.id) / 60000)
      const finished = normalizeSession({ ...cur, duration })
      if (!finished) return []
      const newSessions = [finished, ...sessionsRef.current]
      const streak = computeRecovery(newSessions, recoveryRef.current).consistencyStreak
      const finishBonus = 50 + Math.floor(duration / 30) * 30
      return newlyEarned(newSessions, xpRef.current + sessionXPRef.current + finishBonus, streak, unlockedRef.current)
    } catch { return [] }
  }, [])

  // While the session runs, at a quiet moment after each change: if
  // finishing now would earn a medal, its module and pictures are made
  // ready (no GPU context yet). Once every set is done — the session is
  // as good as finished — the whole stage is built and parked, so the
  // summary's medal sets off on its beat.
  useEffect(() => {
    if (!active) return
    let cancel = () => {}
    const t = setTimeout(() => {
      cancel = whenIdle(() => {
        const cur = activeRef.current
        const earned = medalsIfFinished(cur)
        if (!earned.length) return
        const sets = (cur.exercises || []).flatMap(e => e.sets || [])
        warmMedals(earned, { gl: sets.length > 0 && sets.every(x => x.done) })
      })
    }, 1500)
    return () => { clearTimeout(t); cancel() }
  }, [active, medalsIfFinished])

  // «إنهاء» asked: the stage for what it would earn, built now, while the
  // finish sheet is up.
  const finishing = useCallback(() => {
    warmMedals(medalsIfFinished(activeRef.current), { gl: true })
  }, [medalsIfFinished])

  const finishSession = useCallback(() => {
    if (!active) return
    const duration = Math.round((Date.now() - active.id) / 60000)
    // Only what was actually done goes into the history. The planner
    // lays out every set of the day with a suggested weight in it; an
    // exercise skipped because the machine was taken, or because there
    // was no time, is not something that happened.
    const finished = normalizeSession({ ...active, duration })
    if (!finished) {
      setActive(null)
      setShowRest(false)
      setSessionOpen(false)
      ls.remove('hf_rest_timer')
      setTab('home')
      pushAlert('ℹ️', 'الجلسة فاضية — ما انكتب فيها ولا وزن، فما انحفظت ولا تنحسب للستريك')
      return
    }

    // Snapshot definitive weights at the exact moment of finishing.
    //
    // Except under a deload. hf_last_weights outranks session history
    // in every weight suggestion, so writing the lighter numbers here
    // would make them the new baseline and the deload would never end —
    // it would just be a permanent drop. Leaving the snapshot alone is
    // the entire restore mechanism: the pre-deload weights were never
    // overwritten, so they are simply there again afterwards.
    if (!isDeloadSession(finished)) {
      const snapshot = {}
      for (const ex of finished.exercises || []) {
        const ws = (ex.sets || []).filter(setCounts).map(s => parseFloat(s.weight)).filter(w => w > 0)
        if (ws.length) {
          const canonical = resolveExerciseName(ex.name, exerciseMapping)
          snapshot[canonical] = ws[ws.length - 1]
        }
      }
      if (Object.keys(snapshot).length) {
        ls.set('hf_last_weights', { ...ls.get('hf_last_weights', {}), ...snapshot })
      }
    }

    // What the save does to the streak, said in place of «عمل رائع»:
    // counted today, already counted, counted for the night before
    // (started before 03:00), or not counting after a plan reset.
    const dayNow = todayKey()
    const streakBefore = todayStreak(computeRecovery(sessions, recoveryCfg), { config: recoveryCfg, today: dayNow })
    const recoveryAfter = computeRecovery([finished, ...sessions], recoveryCfg)
    const streakLine = finishToast({
      before: streakBefore,
      after: recoveryAfter,
      sessionDay: dayKey(finished.date),
      today: dayNow,
    })

    // The medals this session earns, known now — the same check the award
    // below runs (after the bonus XP lands) — so the summary opens with
    // them, and their stage (built ahead while «إنهاء» was asked, or now)
    // is ready for their beat.
    const finishBonus = 50 + Math.floor(duration / 30) * 30
    const earned = newlyEarned([finished, ...sessions], xp + sessionXPRef.current + finishBonus, recoveryAfter.consistencyStreak, unlockedRef.current)
    if (earned.length) warmMedals(earned, { gl: true })
    else dropWarm()   // a stage built for medals the session didn't earn after all

    // The summary: what was done, any best weights, what it did to the
    // streak, the medals; XP and a level-up arrive into it as they are
    // awarded below.
    const doneSets = (finished.exercises || []).flatMap(e => (e.sets || []).filter(setCounts))
    const prs = (finished.exercises || []).map(ex => {
      const top = Math.max(0, ...(ex.sets || []).filter(setCounts).map(x => parseFloat(x.weight) || 0))
      const prev = getHistoricalMax(sessions, ex.name, exerciseMapping)
      return top > 0 && prev > 0 && top > prev ? { name: ex.name, top, prev } : null
    }).filter(Boolean)
    collectRef.current = true
    setSummary({
      title: dayWord(finished),
      duration, sets: doneSets.length, volume: sessionVolume(finished), prs,
      streakLine,
      streakBefore: computeRecovery(sessions, recoveryCfg).consistencyStreak,
      streakAfter: recoveryAfter.consistencyStreak,
      xp: sessionXPRef.current,
      levelUp: pendingLevelRef.current,
      achievements: earned,
    })

    setSessions(prev => {
      const newSessions = [finished, ...prev]
      const streak = computeRecovery(newSessions, recoveryCfg).consistencyStreak

      // Bonus XP at session finish (per-set XP already awarded live)
      setTimeout(() => {
        addXP(finishBonus, '✓ جلسة مكتملة')
        checkAchievements(newSessions, xp + sessionXPRef.current + finishBonus, streak)
        sessionXPRef.current = 0
      }, 200)

      return newSessions
    })

    // Advance plan index when a planned session is completed
    if (active.planDayIndex !== undefined) {
      setPlanIndex(active.planDayIndex + 1)
    }

    setActive(null)
    // The workout is over — a rest timer left running has nothing left
    // to rest for, so close it and clear its saved state.
    setShowRest(false)
    ls.remove('hf_rest_timer')
    setSessionOpen(false)
    setPages([])
    setTab('home')
  }, [active, sessions, exerciseMapping, recoveryCfg, addXP, checkAchievements, pushAlert, xp])

  // «تم». A level reached in the session was only a line in the summary;
  // now that the workout is over it gets its own moment: the level-up
  // screen, counting from the level the session started at.
  const closeSummary = useCallback(() => {
    collectRef.current = false
    pendingLevelRef.current = null
    const sm = summaryRef.current
    // Only a level he is actually at now (whatever was held for it).
    if (sm?.levelUp && levelFromXP(xpRef.current) >= sm.levelUp) {
      setLevelUpNum(sm.levelUp)
      setLevelUpFrom(levelFromXP(Math.max(0, xpRef.current - (sm.xp || 0))))
      setShowLevelUp(true)
    }
    setSummary(null)
  }, [])

  const updateActive = useCallback((updater) => {
    setActive(prev => prev ? updater(prev) : prev)
  }, [])

  const updateSession = useCallback((sessionId, updater) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? updater(s) : s))
  }, [])

  const deleteSession = useCallback((sessionId) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }, [])

  // ── Challenge completion ──────────────────────────────────────
  const handleCompleteChallenge = useCallback((challengeId, xpReward) => {
    setChallengeState(prev => ({
      ...prev,
      completed: [...(prev?.completed || []), challengeId],
    }))
    addXP(xpReward, '🏳️ تحدي مكتمل')
  }, [addXP])

  // ── Profile update ────────────────────────────────────────────
  const handleUpdateProfile = useCallback((newProfile) => {
    setProfile(newProfile)
    pushAlert('✅', 'تم حفظ التغييرات')
  }, [pushAlert])

  // ── Derived values ────────────────────────────────────────────
  // While a session is open, the streak's day is the day it started.
  // A session counts for that day whenever it ends, so a workout begun
  // at 02:30 must not see its own day judged as missed at 03:00 — no
  // false «كسر», no ticket spent and written down for a day it covers.
  // Only for a session started in the last 12 hours: a forgotten one
  // must not freeze the streak indefinitely.
  const activeDay = active && Date.now() - (Number(active.id) || 0) < 12 * 3600e3 ? dayKey(active.date) : null
  const calendarToday = todayKey()
  const streakToday = activeDay && activeDay < calendarToday ? activeDay : calendarToday
  const recovery = computeRecovery(sessions, recoveryCfg, streakToday)

  // ── Record what the engine already decided ───────────────────
  // The engine spends credits itself while it replays the calendar, so
  // the balance and the streak on screen are already true. This effect
  // only writes those days down so the record survives, and tells you
  // once when a day came out of your balance. If it never runs, nothing
  // the user sees changes.
  const autoPaidKey = (recovery.autoPaidDays || []).join(',')
  useEffect(() => {
    const paid = autoPaidKey ? autoPaidKey.split(',') : []
    setRecoveryCfg(prev => {
      const from = prev.autoSpendFrom || todayKey()
      if (!prev.autoSpendFrom) return { ...prev, autoSpendFrom: from }

      const known = new Set(prev.restDays || [])
      const fresh = paid.filter(d => !known.has(d))
      if (!fresh.length) return prev

      // Only announce days from when auto-spending started; older ones
      // are recorded silently.
      const news = fresh.filter(d => d >= from)
      if (news.length) {
        // Dated, Gregorian, with what is left — the engine already
        // spent these, so the numbers in `recovery` are after the spend.
        setTimeout(() => pushAlert('🎟️', spendToast(news, recovery)), 0)
      }
      return {
        ...prev,
        restDays: [...known, ...fresh].sort().slice(-120),
      }
    })
  }, [autoPaidKey, pushAlert])

  // The streak shown everywhere is the CONSISTENCY streak: a recovery
  // day taken as planned keeps it alive. calcStreak() counted raw
  // consecutive calendar days, so any rest day wiped it.
  const streak  = recovery.consistencyStreak

  // The header chip stands in for the scoreboard wherever the
  // scoreboard is not on screen: every other tab, and Home once it has
  // scrolled away.
  const [askSkip, setAskSkip] = useState(false)
  // Which Settings sub-page to open on (e.g. the deload from Home); null = the root list.
  const [settingsSection, setSettingsSection] = useState(null)

  const [showStreak, setShowStreak] = useState(false)
  // «خطتي» open: { from } (see openPlanView below), else null.
  const [planView, setPlanView] = useState(null)

  // The best streak, kept as a high-water mark. The engine can only
  // replay the last 400 days, and a record must outlive that window. A
  // new key, ignored by the old design, so the shared data stays
  // readable on both sides.
  const [storedBest, setStoredBest] = useState(() => ls.get('hf_streak_best', null))
  useEffect(() => {
    const cur = recovery.consistencyStreak
    if (cur > 0 && cur > (storedBest?.value || 0)) {
      const next = { value: cur, start: recovery.streakStart, end: streakToday }
      setStoredBest(next)
      ls.set('hf_streak_best', next)
    }
  }, [recovery.consistencyStreak, recovery.streakStart, streakToday]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Today, as the app currently believes it ──────────────────
  // Left open overnight, nothing would notice the date changing: every
  // dated feature reads todayKey() at render, and React has no reason
  // to render when the day turns. This bumps a counter exactly when the
  // training day turns, so a deload that ended in the night ends on screen too.
  const [dayTick, setDayTick] = useState(0)
  useEffect(() => {
    // The training day turns at 03:00, not midnight (see day.js). A
    // second past, not a minute: the streak card counts down to 03:00
    // and must not spend a minute pairing the new day with old numbers.
    const id = setTimeout(() => setDayTick(n => n + 1), nextDayTurn() - Date.now() + 1_000)
    // A phone asleep at 03:00 never runs that timer on time; catch up
    // the moment the app is back in front.
    const wake = () => { if (document.visibilityState === 'visible') setDayTick(n => n + 1) }
    document.addEventListener('visibilitychange', wake)
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', wake) }
  }, [dayTick])

  const today = useMemo(() => todayKey(), [dayTick])

  // ── Deload ───────────────────────────────────────────────────
  const deload = useMemo(() => deloadState(recoveryCfg, today), [recoveryCfg, today])

  // ── Reminders follow the streak (src/notify.js) ──
  // Re-planned whenever what today means for the streak changes; saving
  // a session cancels them. Nothing random, nothing on a counted day.
  const reminderView = streakView({ recovery, config: recoveryCfg, active, deload, today: streakToday })
  const reminderKey = `${reminderView.kind}|${reminderView.number}|${reminderView.tickets}|${streakToday}|${profile?.workoutTime}`
  useEffect(() => {
    planReminders({
      view: reminderView,
      workoutHour: WORKOUT_TIME_HOURS[profile?.workoutTime || 'المساء'] ?? 17,
      enabled: ls.get('hf_notif_enabled', false),
    })
  }, [reminderKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The greeting knows what day it is. Re-drawn when the day turns or
  // the day's state changes, not on every render — otherwise the line
  // would flicker to a new one each time a set is logged.
  const yesterdayKey = useMemo(() => dayKey(new Date(Date.now() - 86400000)), [today])
  const greeting = useMemo(() => pickGreeting({
    name: profile?.name,
    isRecoveryDay: recovery.status === DAY_STATUS.RECOVERY,
    isRestTaken: recovery.status === DAY_STATUS.REST_TAKEN,
    trainedToday: recovery.status === DAY_STATUS.COMPLETED,
    deload: !!deload?.active,
    streak,
    daysSinceLast: Number.isFinite(recovery.daysSinceLastWorkout) ? recovery.daysSinceLastWorkout : null,
    creditSpentYesterday: (recovery.restTakenHistory || []).includes(yesterdayKey),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [today, profile?.name, recovery.status, deload?.active, streak, recovery.daysSinceLastWorkout])

  // A stretch whose last day passed while the app was shut is still
  // stored. File it once, here, rather than leaving every reader to
  // cope with a deload that is over but not closed.
  useEffect(() => {
    if (deload.lapsed) setRecoveryCfg(prev => endDeload(prev, today))
  }, [deload.lapsed, today])

  const beginDeload = useCallback(({ days, pct } = {}) => {
    setRecoveryCfg(prev => startDeload(prev, todayKey(), { days, pct }))
    setPages([])
    setTab('home')
    pushAlert('💧', `بدأت فترة ديلود — أوزانك أخف بـ${pct}٪`)
  }, [pushAlert])

  // Ending early and ending on time run through the same call. The
  // difference is recorded by endDeload itself, from the date.
  const finishDeload = useCallback(() => {
    setRecoveryCfg(prev => endDeload(prev, todayKey()))
    pushAlert('💪', 'انتهى الديلود — رجعت أوزانك كما كانت')
  }, [pushAlert])

  // Does the app have grounds to raise one?
  //
  // suggestDeload deliberately knows nothing about the progression
  // engine, so the count of stalled lifts is worked out here and passed
  // in. Only exercises actually trained in the last month are asked —
  // a lift dropped six months ago is not stalled, it is gone.
  const deloadSuggestion = useMemo(() => {
    if (recoveryCfg.deload) return null
    const cutoff = Date.now() - 35 * 86400000
    const names = new Set()
    for (const s of sessions) {
      if (new Date(s.date).getTime() < cutoff) continue
      for (const ex of s.exercises || []) names.add(ex.name)
    }
    let stalled = 0
    for (const name of names) {
      // The range the lift's sessions ran on, as the player judged it.
      const t = liftRepTarget(sessions, name, exerciseMapping, { plan, fallback: repTarget })
      const p = analyzeProgression(sessions, name, exerciseMapping, t)
      if (p.hint === 'lower' || p.failedAtWeight >= 2) stalled++
    }
    return suggestDeload({ sessions, config: recoveryCfg, today, stalledCount: stalled })
  }, [sessions, recoveryCfg, today, exerciseMapping, repTarget, plan])

  // The closing screen, offered once. `deloadEndSeenAt` holds the end
  // date rather than a boolean, so the next deload gets its own screen
  // without anything having to reset the flag.
  const lastDeload = recoveryCfg.deloadHistory?.[recoveryCfg.deloadHistory.length - 1] || null
  const showDeloadEnd = !!lastDeload
    && !deload.active
    && recoveryCfg.deloadEndSeenAt !== (lastDeload.until || lastDeload.plannedUntil)
    // Someone opening the app a fortnight later does not need a
    // congratulations screen about a week they have forgotten.
    && dayDiff(lastDeload.until || lastDeload.plannedUntil, today) <= 3

  // ── «كسبت يوم راحة», once per rest day earned ─────────────────
  // Anything that covers Home holds it: the session summary (with its
  // medals) and the level-up screen first, then a short pause so the
  // streak number rolls up on Home before the moment comes. Which days
  // were announced is remembered (meran_rest_announced, a key of the new
  // design's own); the first time there is no list, the rest days he
  // already holds are written down as known, silently — the flame on
  // Home already shows them.
  const homeCovered = !!summary || showLevelUp || (!!active && sessionOpen) || showReport || onboarding
    || showDeloadEnd || showWhatsNew || packOffer || !!planView
  const restHeld = restDaysView(recovery).held
  const restHeldKey = restHeld.map(h => h.earnedOn).join(',')
  const [restEarned, setRestEarned] = useState(null)
  useEffect(() => {
    const held = restHeldKey ? restHeld : []
    const stored = ls.get(REST_ANNOUNCED_KEY, null)
    if (!Array.isArray(stored)) { ls.set(REST_ANNOUNCED_KEY, markAnnounced([], held.map(h => h.earnedOn))); return }
    if (homeCovered || restEarned) return
    const fresh = toAnnounce(held, stored)
    if (!fresh.length) return
    const t = setTimeout(() => {
      ls.set(REST_ANNOUNCED_KEY, markAnnounced(ls.get(REST_ANNOUNCED_KEY, []), fresh.map(f => f.earnedOn)))
      setRestEarned({ days: fresh, count: held.length })
    }, reducedMotion() ? 300 : 1400)
    return () => clearTimeout(t)
  }, [restHeldKey, homeCovered, restEarned]) // eslint-disable-line react-hooks/exhaustive-deps

  // The lift the end screen names: the heaviest weight still on record.
  //
  // Read from the sessions rather than from hf_last_weights, because
  // that snapshot is keyed by the canonical lowercase name — an
  // internal key, not something to show anyone. The history carries the
  // name as it was actually written. Deload sessions are skipped, so
  // the number quoted is the one being returned to, not the light one
  // just finished.
  const heaviestLift = useMemo(() => {
    if (!showDeloadEnd) return null
    let best = null
    for (const session of sessions) {
      if (isDeloadSession(session)) continue
      for (const ex of session.exercises || []) {
        for (const set of ex.sets || []) {
          if (!set?.done) continue
          const w = parseFloat(set.weight)
          if (w > 0 && (!best || w > best.weight)) best = { name: ex.name, weight: w }
        }
      }
    }
    return best
  }, [showDeloadEnd, sessions])

  // The palette, softness and pacing all hang off this one attribute,
  // so nothing downstream has to know the rule.
  useEffect(() => {
    const root = document.documentElement
    if (deload.active) root.setAttribute('data-deload', '1')
    else root.removeAttribute('data-deload')
    return () => root.removeAttribute('data-deload')
  }, [deload.active])

  // ── Monthly report ───────────────────────────────────────────
  // Offered only in its window — the last days of a month and the first
  // week of the next — and only when that month has something in it.
  // Built once per change rather than on every render: it replays the
  // whole history to find record events.
  const reportMonth = monthReportWindow(today)
  // The month's goal lives under its own key, which the old design does
  // not know and ignores. Read when the report opens, so a goal set in
  // another tab is not missed.
  // goalsTick re-reads them after the report itself sets one.
  const [goalsTick, setGoalsTick] = useState(0)
  const monthGoals = useMemo(() => (showReport ? ls.get(MONTH_GOAL_KEY, {}) : {}), [showReport, goalsTick])
  const reportArgs = {
    sessions, config: recoveryCfg, unlockedAt, xp,
    mapping: exerciseMapping, repTarget, plan, goals: monthGoals, today,
  }
  const monthReport = useMemo(
    () => (reportMonth ? buildMonthReport({ ...reportArgs, month: reportMonth }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportMonth, sessions, recoveryCfg, unlockedAt, xp, exerciseMapping, repTarget, plan, monthGoals, today],
  )
  // The month on screen: the offered one, or a past one picked inside it.
  const shownReport = useMemo(
    () => (reportPick && reportPick !== reportMonth
      ? buildMonthReport({ ...reportArgs, month: reportPick })
      : monthReport),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportPick, reportMonth, monthReport, sessions, recoveryCfg, unlockedAt, xp, exerciseMapping, repTarget, plan, monthGoals, today],
  )
  // The past-month picker: six months of bars ending at the offered one,
  // and any older month with training in it.
  const reportHistory = useMemo(() => {
    if (!showReport || !reportMonth) return null
    const trail = monthsTrail(sessions, reportMonth, 6)
    const older = reportMonths(sessions, reportMonth).filter(m => m < trail[0].month)
    return { trail, older }
  }, [showReport, reportMonth, sessions])

  // The share button's whole job: draw the poster, then take whichever
  // route out of the app actually works on this device. The ladder
  // itself lives in reportPoster.js; this only decides what to say.
  // Two posters: the month's (kind 'month') and the new weight's ('pr').
  // `sharing` holds which one is being drawn.
  const handleSharePoster = useCallback(async (kind = 'month') => {
    if (!shownReport?.hasData || sharing) return
    const k = kind === 'pr' && shownReport.jump ? 'pr' : 'month'
    setSharing(k)
    try {
      const how = await sharePoster({
        kind: k,
        report: shownReport,
        profile,
        mapping: exerciseMapping,
        liveStreak: recovery.consistencyStreak,
        today,
        onInline: setPosterUrl,
      })
      if (how === SHARE_RESULT.DOWNLOADED) pushAlert('📥', k === 'pr' ? 'تم حفظ صورة الوزن الجديد' : 'تم حفظ صورة التقرير')
      // SHARED needs no confirmation — the share sheet was the
      // confirmation. CANCELLED was a decision, not a failure. INLINE
      // opens its own sheet.
    } catch (err) {
      pushAlert('⚠️', err?.message === 'poster-encode-failed'
        ? 'تعذّر تجهيز الصورة — الذاكرة لم تكفِ. أغلق تطبيقات أخرى وحاول مجدداً.'
        : 'تعذّرت مشاركة التقرير')
    } finally {
      setSharing(false)
    }
  }, [shownReport, profile, sharing, pushAlert, exerciseMapping, recovery.consistencyStreak, today])

  // ── Changing frequency or plan ───────────────────────────────
  // Both keep the streak, because each past day is judged by the pattern
  // that was in force then. One change is free per cooldown; a further
  // change inside the window is allowed but ends the streak, and the
  // caller has already confirmed that.
  const applyFrequencyChange = useCallback((patch, { breakStreak = false } = {}) => {
    const today = todayKey()
    setRecoveryCfg(prev => ({
      ...withFrequency(prev, patch, today),
      lastSettingsChangeAt: today,
      streakResetAt: breakStreak ? today : prev.streakResetAt,
    }))
    pushAlert(breakStreak ? '⚠️' : '✅',
      breakStreak ? 'تم التغيير — بدأ ستريك جديد' : 'تم التغيير — ستريكك محفوظ')
  }, [pushAlert])

  const applyPlanChange = useCallback((newPlan, { breakStreak = false } = {}) => {
    const today = todayKey()
    // Every plan that is replaced is kept for «رجّع خطتك القديمة» — a
    // ready-made switch and an import as much as the builder's.
    keepPrevPlan({ stamps: !!plan })
    // It starts today, the day it is put in (Settings stamps a ready-made
    // one so; an imported file says whatever it says): an older start would
    // let the sessions of the plan it replaces count as its own («خطتي»,
    // src/plan/view.js ofThisPlan).
    setPlan({ ...newPlan, startDate: today })
    setPlanIndex(0)
    setRecoveryCfg(prev => ({
      ...prev,
      lastSettingsChangeAt: today,
      streakResetAt: breakStreak ? today : prev.streakResetAt,
    }))
    pushAlert(breakStreak ? '⚠️' : '📋',
      breakStreak ? `${planTitle(newPlan.planName)} — بدأ ستريك جديد` : `تم تفعيل: ${planTitle(newPlan.planName)}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushAlert, plan, planIndex])

  // ── The plan builder (src/pages/planner) ────────────────────
  // A page of its own over any screen, with five doors: Settings › الخطة,
  // Home › تقدّم البرنامج, Home › ⋯ › عدّل الخطة, Home with no plan, and
  // the first run's «أبني خطتي بنفسي». `planner` is the door it opened
  // from, or null.
  const [planner, setPlanner] = useState(null)
  // The day «خطتك» opens on, when «خطتي» opened the builder on one.
  const [plannerDay, setPlannerDay] = useState(null)
  const openPlanner = useCallback((door, day = null) => { setPlannerDay(Number.isInteger(day) ? day : null); setPlanner(door) }, [])
  // The plan before the last one the builder put in, for «رجّع خطتك
  // القديمة» (حمزة: «إيه، احفظها»). A key of the new design's own.
  const [planPrev, setPlanPrev] = useState(() => ls.get('hf_plan_prev', null))
  useEffect(() => { ls.set('hf_plan_prev', planPrev) }, [planPrev])

  // When a name left a day of his plan (src/plan/view.js DROPPED_KEY): an
  // edit that takes a row out or swaps one away — from «خطتي», the
  // builder, the session's «دايماً بخطتي», «رجّع خطتك القديمة» the same
  // day — so «تسويها بالجلسة» never offers back what the plan itself had
  // put in his sessions. A key of the new design's own; the old design
  // never reads it. Written with the plan, in the same render.
  const [planDropped, setPlanDropped] = useState(() => ls.get(DROPPED_KEY, {}))
  function notePlanDrops(before, after) {
    const drops = dropsOf(before, after, { subs: exerciseSubs, mapping: exerciseMapping })
    if (!drops.length) return
    const next = withDropped(ls.get(DROPPED_KEY, {}), drops, Date.now())
    ls.set(DROPPED_KEY, next)
    setPlanDropped(next)
  }

  // The plan in force, saved before it is replaced. `stamps` keeps what
  // the replacement is about to stamp on the streak's rule (the free
  // change, a streak reset, the days), so an undo the same day puts the
  // rule back exactly as it was — the switch never happened.
  const STAMP_KEYS = ['lastSettingsChangeAt', 'streakResetAt', 'daysPerWeek', 'customPattern', 'patternHistory']
  const stampOf = (cfg) => Object.fromEntries(STAMP_KEYS.map(k => [k, cfg?.[k] ?? null]))
  function keepPrevPlan({ stamps = false } = {}) {
    if (!plan) return
    const today = todayKey()
    setPlanPrev({ plan, planIndex, savedAt: today, ...(stamps ? { undo: stampOf(recoveryRef.current) } : null) })
  }

  // The day reached, carried into an edited plan whose cycle changed
  // length: the same kind of day if the new cycle has one, else the same
  // place in it.
  const carryIndex = (oldPlan, idx, newPlan) => {
    const n = (newPlan?.weeklySchedule || []).length
    if (!n) return 0
    const oldN = (oldPlan?.weeklySchedule || []).length
    const at = oldN ? ((idx % oldN) + oldN) % oldN : 0
    const type = oldPlan?.split?.cycle?.[at]
    const cyc = newPlan?.split?.cycle
    if (type && Array.isArray(cyc)) {
      const hit = cyc.indexOf(type)
      if (hit >= 0 && hit < n) return hit
    }
    return at % n
  }

  // Put a plan from the builder in. Editing his own plan is free and
  // keeps the day he reached (when the number of days in the cycle is the
  // same); switching to another plan follows the streak rule, like every
  // switch. Days a week chosen in the builder change with the plan, in
  // the same stamp: one change, not two. The plan it replaces is kept.
  // `quiet` skips the alert, for a caller with its own (the report's
  // «طبّقها على خطتي» toast, which has an undo).
  // His first plan (the first run's «أبني خطتي بنفسي», Home with no
  // plan) is a setup, not a switch: like Onboarding it spends no free
  // change and never breaks the streak.
  // `keepPrev: false` leaves the saved old plan as it is («خطتي»'s small
  // edits after the first one of the day: «رجّع خطتك القديمة» still goes
  // back to the plan before today's edits, not the last step of a stepper).
  const commitPlan = useCallback((newPlan, { edit = false, days = null, breakStreak = false, quiet = false, first = false, keepPrev = true } = {}) => {
    const today = todayKey()
    const isFirst = first || !plan
    const daysChange = days != null && days !== recoveryRef.current.daysPerWeek
    const stamps = !isFirst && (!edit || daysChange)
    if (keepPrev) keepPrevPlan({ stamps })
    if (edit && plan) notePlanDrops(plan, newPlan)
    setPlan(newPlan)
    if (!edit || !plan) setPlanIndex(0)
    else if ((plan.weeklySchedule || []).length !== newPlan.weeklySchedule.length) setPlanIndex(carryIndex(plan, planIndex, newPlan))
    if (isFirst) {
      if (daysChange) setRecoveryCfg(prev => withFrequency(prev, { daysPerWeek: days }, today))
    } else if (stamps) {
      setRecoveryCfg(prev => ({
        ...(daysChange ? withFrequency(prev, { daysPerWeek: days }, today) : prev),
        lastSettingsChangeAt: today,
        streakResetAt: breakStreak ? today : prev.streakResetAt,
      }))
    }
    if (quiet) return
    const breaks = breakStreak && stamps
    pushAlert(breaks ? '⚠️' : '📋',
      breaks ? `${planTitle(newPlan.planName)} — بدأ ستريك جديد`
        : edit ? 'انحفظ تعديل خطتك' : `تم تفعيل: ${planTitle(newPlan.planName)}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, planIndex, pushAlert, exerciseSubs, exerciseMapping])

  // «رجّع خطتك القديمة»: the saved plan back, at the day it had reached,
  // and the one it replaces saved in its place (so it can go back again).
  // An undo the same day costs nothing; later it is a switch like any.
  // The same day, it is an undo: the rule goes back to how it was before
  // the switch (the free change, the streak, the days), and the plan it
  // replaces keeps today's state so going forward again is the same undo.
  const restorePrevPlan = useCallback(({ breakStreak = false } = {}) => {
    const prev = planPrev
    if (!prev?.plan) return
    const today = todayKey()
    const sameDay = prev.savedAt === today
    const now = stampOf(recoveryRef.current)
    setPlanPrev(plan ? { plan, planIndex, savedAt: today, ...(sameDay && prev.undo ? { undo: now } : null) } : null)
    // back to the same plan before today's edits: what they put in leaves it
    if (plan) notePlanDrops(plan, prev.plan)
    setPlan(prev.plan)
    setPlanIndex(prev.planIndex || 0)
    if (sameDay) {
      if (prev.undo) setRecoveryCfg(p => ({ ...p, ...prev.undo }))
    } else {
      setRecoveryCfg(p => ({ ...p, lastSettingsChangeAt: today, streakResetAt: breakStreak ? today : p.streakResetAt }))
    }
    pushAlert('↩️', `رجعت خطتك: ${planTitle(prev.plan.planName)}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planPrev, plan, planIndex, pushAlert, exerciseSubs, exerciseMapping])

  // ── «خطتي» (src/pages/planview) ─────────────────────────────
  // Three doors: Home › تقدّم البرنامج, Settings › الخطة › «شوف خطتي», and
  // the session's ⋯ › «شوف خطتي». `planView` (above) is { from } while open.
  const openPlanView = useCallback((from = 'home') => setPlanView({ from }), [])
  // An edit from «خطتي» (or the session's «دايماً بخطتي») goes in the way
  // the builder saves an edit of his own plan: commitPlan as an edit —
  // free for the streak, the day he reached kept — after the check both
  // designs need. The plan before today's edits stays the one «رجّع خطتك
  // القديمة» brings back.
  const editPlan = useCallback((next) => {
    if (!next || validatePlan(next)) return false
    const today = todayKey()
    const keepPrev = !(planPrev && planPrev.savedAt === today && planPrev.plan?.planId === plan?.planId)
    commitPlan(next, { edit: true, quiet: true, keepPrev })
    return true
  }, [commitPlan, planPrev, plan])
  // A remembered swap undone: the plan's own exercise again, on every day.
  const clearSub = useCallback((name) => {
    setExerciseSubs(prev => {
      if (!prev?.[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // «طبّقها على خطتي»: next month's suggestions written into the plan
  // (sets) and the weights the next sessions start at (hf_last_weights),
  // plus next month's goal if none was set — only after the tap, and with
  // an undo that puts back exactly what was there. Editing the plan this
  // way is not a change of plan: the streak's rule is not involved.
  const applyNextMonth = useCallback((report, items) => {
    // Once a month: a second time would add the sets again and save the
    // already-changed plan as «the old plan».
    if (appliedOn(ls.get(REPORT_APPLIED_KEY, {}), report.month)) return null
    const before = {
      plan,
      planPrev,
      weights: ls.get('hf_last_weights', null),
      goals: ls.get(MONTH_GOAL_KEY, null),
    }
    const out = applyNext({ plan, lastWeights: before.weights || {}, items, mapping: exerciseMapping, config: recoveryCfg })
    // The plan goes in the way the builder saves an edit of his own plan:
    // the same check both designs need, the old plan kept for «رجّع خطتك
    // القديمة», the day he reached kept, and no streak rule (an edit).
    const setsChanged = out.changes.some(c => c.kind === 'sets') && !validatePlan(out.plan)
    if (setsChanged) commitPlan(out.plan, { edit: true, quiet: true })
    else out.changes = out.changes.filter(c => c.kind !== 'sets')
    if (out.changes.some(c => c.kind === 'raise' || c.kind === 'lower')) ls.set('hf_last_weights', out.lastWeights)
    const nm = nextMonth(report.month)
    let goalWords = ''
    if (!monthGoalOf(before.goals || {}, nm)) {
      const target = expectedSessions(recoveryCfg, nm)
      ls.set(MONTH_GOAL_KEY, withMonthGoal(before.goals || {}, nm, { kind: 'sessions', target }))
      goalWords = ` وهدف ${monthName(nm)}: ${countAr(target, 'session')}.`
      setGoalsTick(t => t + 1)
    }
    ls.set(REPORT_APPLIED_KEY, withApplied(ls.get(REPORT_APPLIED_KEY, {}), report.month, todayKey()))
    return {
      text: `${appliedLine(out)}${goalWords}`,
      undo: () => {
        ls.set(REPORT_APPLIED_KEY, withApplied(ls.get(REPORT_APPLIED_KEY, {}), report.month, null))
        if (setsChanged) { setPlan(before.plan); setPlanPrev(before.planPrev) }
        if (before.weights == null) ls.remove('hf_last_weights')
        else ls.set('hf_last_weights', before.weights)
        if (before.goals == null) ls.remove(MONTH_GOAL_KEY)
        else ls.set(MONTH_GOAL_KEY, before.goals)
        setGoalsTick(t => t + 1)
      },
    }
  }, [plan, planPrev, commitPlan, exerciseMapping, recoveryCfg])

  const setMonthGoal = useCallback((month, goal) => {
    ls.set(MONTH_GOAL_KEY, withMonthGoal(ls.get(MONTH_GOAL_KEY, {}), month, goal))
    setGoalsTick(t => t + 1)
  }, [])

  const overrideRecoveryDay = useCallback(() => {
    const today = todayKey()
    setRecoveryCfg(prev => ({
      ...prev,
      overrides: [...new Set([...(prev.overrides || []), today])].slice(-60),
    }))
    pushAlert('💪', 'التعافي جزء من الخطة — لكن القرار لك')
  }, [pushAlert])
  const { level } = xpProgress(xp)

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--ground)',
      color: 'var(--text)',
      maxWidth: 560,
      margin: '0 auto',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Page content ──
          No shared header any more: Home has its own top (date, greeting,
          avatar, gear), every other tab a large title with the streak
          chip, pushed pages a back bar. */}
      <PageMain key={viewKey} vt={tabNav.current.vt} data-live={active && !sessionOpen ? '1' : undefined}>
        {!page && tab === 'home' && (
          <HomePage
            sessions={sessions}
            xp={xp}
            streak={streak}
            profile={profile}
            greeting={greeting}
            onOpenProfile={() => pushPage('profile')}
            onOpenStreak={() => setShowStreak(true)}
            onOpenSettings={() => { setSettingsSection(null); pushPage('settings') }}
            hold={!!summary || showLevelUp || (!!active && sessionOpen) || showReport || onboarding
              || showDeloadEnd || showWhatsNew || packOffer || !!planView}
            active={active}
            plan={plan}
            planIndex={planIndex}
            exerciseMapping={exerciseMapping}
            exerciseSubs={exerciseSubs}
            onCycleSub={(name, idx) => setExerciseSubs(prev => ({ ...prev, [name]: idx }))}
            recovery={recovery}
            recoveryConfig={recoveryCfg}
            streakToday={streakToday}
            repTarget={repTarget}
            onOverrideRecovery={overrideRecoveryDay}
            tickets={recovery.usableCredits}
            creditProgress={recovery.creditProgress}
            creditTarget={recovery.creditTarget}
            daysToNextCredit={recovery.daysToNextCredit}
            onStartWorkout={() => startWorkout()}
            onStartPlannedWorkout={startPlannedWorkout}
            onSkipPlanDay={() => setAskSkip(true)}
            onGoToWorkout={() => setSessionOpen(true)}
            monthReport={monthReport}
            onShowMonthReport={() => setShowReport(true)}
            deload={deload}
            deloadSuggestion={deloadSuggestion}
            onStartDeload={beginDeload}
            onDismissDeloadSuggestion={() => setRecoveryCfg(prev => dismissSuggestion(prev, today))}
            onOpenDeload={() => { setSettingsSection('deload'); pushPage('settings') }}
            onOpenPlanner={openPlanner}
            onOpenPlanView={() => openPlanView('home')}
          />
        )}
        {!page && tab === 'history' && (
          <>
            <LargeTitle title="السجل" actions={<StreakChip recovery={recovery} config={recoveryCfg} active={active} deload={deload} today={streakToday} onOpen={() => setShowStreak(true)} />} />
            <HistoryPage
              sessions={sessions}
              plan={plan}
              planIndex={planIndex}
              onStartPlannedWorkout={startPlannedWorkout}
              onStartWorkout={(exercises) => startWorkout(exercises)}
              active={active}
              onResumeWorkout={() => setSessionOpen(true)}
              recovery={recovery}
              repTarget={repTarget}
              recoveryConfig={recoveryCfg}
              exerciseMapping={exerciseMapping}
              onUpdateSession={updateSession}
              onDeleteSession={deleteSession}
            />
          </>
        )}
        {!page && tab === 'progress' && (
          <>
            <LargeTitle title="التقدم" actions={<StreakChip recovery={recovery} config={recoveryCfg} active={active} deload={deload} today={streakToday} onOpen={() => setShowStreak(true)} />} />
            <ProgressPage
              achievements={{ sessions, xp, streak, unlockedAchievements, unlockedAt, level }}
              photos={{ photos, setPhotos, onBack: () => goTab('progress') }}
            />
          </>
        )}
        {!page && tab === 'library' && (
          <>
            <LargeTitle title="المكتبة" actions={<StreakChip recovery={recovery} config={recoveryCfg} active={active} deload={deload} today={streakToday} onOpen={() => setShowStreak(true)} />} />
            <ExercisesPage sessions={sessions} exerciseMapping={exerciseMapping} />
          </>
        )}
        {page === 'profile' && (
          <>
            <NavBar title="الملف" onBack={popPage}
              actions={<IconButton icon={GearSix} label="الإعدادات" onClick={() => { setSettingsSection(null); pushPage('settings') }} />} />
            <ProfilePage
              profile={profile}
              sessions={sessions}
              xp={xp}
              streak={streak}
              level={level}
              recovery={recovery}
              photos={photos}
              storedBest={storedBest}
              onOpenSettings={() => { setSettingsSection(null); pushPage('settings') }}
              onUpdateProfile={handleUpdateProfile}
              onGoToPhotos={() => pushPage('photos')}
            />
          </>
        )}
        {page === 'settings' && (
          <>
            <NavBar title="الإعدادات" onBack={popPage} />
            <SettingsPage
              section={settingsSection}
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              sessions={sessions}
              xp={xp}
              unlockedAchievements={unlockedAchievements}
              challengeState={challengeState}
              photos={photos}
              plan={plan}
              onImportPlan={applyPlanChange}
              onOpenPlanner={openPlanner}
              onOpenPlanView={() => openPlanView('settings')}
              onClearPlan={() => { keepPrevPlan(); setPlan(null); setPlanIndex(0) }}
              exerciseMapping={exerciseMapping}
              recoveryCfg={recoveryCfg}
              onUpdateRecovery={applyFrequencyChange}
              changeCooldownLeft={changeCooldownLeft(recoveryCfg)}
              currentStreak={recovery.consistencyStreak}
              recovery={recovery}
              repTarget={repTarget}
              onUpdateRepTarget={(patch) => setRepTarget(prev => ({ ...prev, ...patch }))}
              today={today}
              onStartDeload={beginDeload}
              onEndDeload={finishDeload}
              onImportMapping={(newMapping) => {
                setExerciseMapping(prev => ({ ...prev, ...newMapping }))
                pushAlert('🗺️', `تم تحديث خريطة التمارين — ${Object.keys(newMapping).length} تمرين`)
              }}
              onImport={(data) => {
                if (data.type === 'exercise_mapping') {
                  setExerciseMapping(prev => ({ ...prev, ...data.mapping }))
                  pushAlert('🗺️', `تم استيراد خريطة التمارين — ${Object.keys(data.mapping).length} تمرين`)
                  return
                }
                if (data.sessions !== undefined)           setSessions((data.sessions || []).map(normalizeSession).filter(Boolean))
                if (data.xp !== undefined)                 setXP(data.xp)
                if (data.profile)                          setProfile(data.profile)
                if (data.unlockedAchievements)             setUnlockedAchievements(data.unlockedAchievements)
                if (data.challengeState)                   setChallengeState(data.challengeState)
                if (data.photos)                           setPhotos(data.photos)
                // Without this the restored history is judged against a
                // default cycle, which rewrites the streak and loses every
                // rest day. Older backups have no `recovery` key; they keep
                // whatever is configured on the device.
                if (data.recovery)                         setRecoveryCfg(prev => ({ ...prev, ...data.recovery }))
                restoreMonthGoals(data)
                const back = restorePlan(data)
                if (back) { setPlan(back.plan); setPlanIndex(back.planIndex); if (back.planPrev) setPlanPrev(back.planPrev) }
                pushAlert('✅', 'تم استيراد البيانات بنجاح!')
              }}
            />
          </>
        )}
        {page === 'photos' && (
          <>
            <NavBar title="صور التقدم" onBack={popPage} />
            <PhotosPage photos={photos} setPhotos={setPhotos} onBack={popPage} embedded />
          </>
        )}
      </PageMain>

      {/* ── The running session ──
          Full screen while you train: no tabs to wander into mid-set. ⌄
          docks it as the live bar above the tabs. */}
      {active && sessionOpen && (
        <div className="f-cover" role="dialog" aria-modal="true" aria-label="الجلسة" data-testid="session-cover">
          <WorkoutPage
            active={active}
            sessions={sessions}
            plan={plan}
            planIndex={planIndex}
            onUpdateActive={updateActive}
            onFinish={finishSession}
            onFinishing={finishing}
            onShowRest={() => { ls.remove('hf_rest_timer'); setShowRest(true); setRestKey(k => k + 1) }}
            onCloseRest={() => { ls.remove('hf_rest_timer'); setShowRest(false) }}
            onStartPlannedWorkout={startPlannedWorkout}
            addXP={addWorkoutXP}
            onGoBack={() => {
              // The session is thrown away: its XP goes back, and so does a
              // level it crossed — held for a summary that will never come,
              // it must not turn up in the next session's.
              const refund = sessionXPRef.current
              sessionXPRef.current = 0
              pendingLevelRef.current = null
              dropWarm()   // no summary is coming for the medal stage built ahead
              if (refund > 0) {
                setXP(prev => {
                  const back = Math.max(0, prev - refund)
                  prevLevelRef.current = levelFromXP(back)
                  return back
                })
              }
              setActive(null); setShowRest(false); setSessionOpen(false); setTab('home')
            }}
            onMinimize={() => setSessionOpen(false)}
            isResting={showRest}
            exerciseMapping={exerciseMapping}
            repTarget={repTarget}
            exerciseSubs={exerciseSubs}
            onCycleSub={(name, idx) => setExerciseSubs(prev => ({ ...prev, [name]: idx }))}
            onEditPlan={editPlan}
            onClearSub={clearSub}
            onOpenPlanView={plan?.weeklySchedule?.length ? () => openPlanView('session') : undefined}
            onUpdateSession={updateSession}
            onDeleteSession={deleteSession}
          />
        </div>
      )}

      {/* ── Live bar + tabs ── */}
      {active && !sessionOpen && (
        <LiveBar active={active} title={dayWord(active)} onOpen={() => setSessionOpen(true)} />
      )}
      <TabBar items={NAV} current={page ? null : tab} onSelect={goTab} />

      {/* ── Overlays ─────────────────────────────────────────────── */}
      {/* The player owns rest inline while the workout tab is open —
          the floating card would be a second clock for the same rest. */}
      {showRest && !(sessionOpen && active) && (
        <RestTimer key={restKey} onClose={() => setShowRest(false)} />
      )}
      {showLevelUp && !summary && <LevelUpScreen level={levelUpNum} from={levelUpFrom} onDismiss={() => { setShowLevelUp(false); setLevelUpFrom(null) }} />}
      {summary && <SessionSummary summary={summary} xp={xp} onDone={closeSummary} />}
      {restEarned && !summary && !showLevelUp && (
        <RestDayEarned days={restEarned.days} count={restEarned.count} onClose={() => setRestEarned(null)} />
      )}
      {onboarding && (
        <Onboarding
          initialName={profile?.name && profile.name !== DEFAULT_PROFILE.name ? profile.name : ''}
          onDone={({ name, daysPerWeek, plan: chosen, build }) => {
            // Set directly, not through the settings-change paths: a first
            // setup must not spend the one free change per 30 days.
            if (name) setProfile(prev => ({ ...prev, name }))
            setRecoveryCfg(prev => ({ ...prev, daysPerWeek }))
            // (its start, as every activation stamps it: «خطتي» counts
            // only this plan's sessions — src/plan/view.js ofThisPlan)
            if (chosen) { setPlan({ ...chosen, startDate: todayKey() }); setPlanIndex(0) }
            ls.set('hf_onboarded', true)
            setOnboarding(false)
            // «أبني خطتي بنفسي»: the builder opens once the setup is done.
            if (build) setPlanner('onb')
          }}
        />
      )}
      {planner && (
        <Suspense fallback={null}>
          <PlannerPage
            door={planner}
            day={plannerDay}
            plan={plan}
            planIndex={planIndex}
            planPrev={planPrev}
            recoveryCfg={recoveryCfg}
            repTarget={repTarget}
            profile={profile}
            changeCooldownLeft={changeCooldownLeft(recoveryCfg)}
            currentStreak={recovery.consistencyStreak}
            onActivate={commitPlan}
            onRestorePrev={restorePrevPlan}
            onStart={() => {
              setPlanner(null)
              setPlanView(null)
              const s = plan?.weeklySchedule
              if (s?.length && !active) startPlannedWorkout(s[planIndex % s.length])
              else { setPages([]); setTab('home') }
            }}
            onClose={() => setPlanner(null)}
          />
        </Suspense>
      )}
      {planView && plan?.weeklySchedule?.length > 0 && (
        <Suspense fallback={null}>
          <PlanView
            from={planView.from}
            plan={plan}
            planIndex={planIndex}
            exerciseSubs={exerciseSubs}
            sessions={sessions}
            exerciseMapping={exerciseMapping}
            repTarget={repTarget}
            dropped={planDropped}
            status={recovery.status === DAY_STATUS.COMPLETED ? 'completed'
              : recovery.status === DAY_STATUS.RECOVERY || recovery.status === DAY_STATUS.REST_TAKEN ? 'recovery' : 'training'}
            active={active}
            onCommit={editPlan}
            onClearSub={clearSub}
            onOpenBuilder={(day) => openPlanner('view', day)}
            onClose={() => setPlanView(null)}
          />
        </Suspense>
      )}
      <SystemAlert alerts={alertQueue} onRemove={removeAlert} />

      <StreakSheet
        open={showStreak}
        onClose={() => setShowStreak(false)}
        recovery={recovery}
        config={recoveryCfg}
        active={active}
        deload={deload}
        today={streakToday}
        storedBest={storedBest}
      />

      {askSkip && (() => {
        const copy = skipCopy(streakView({ recovery, config: recoveryCfg, active, deload, today: streakToday }))
        return (
          <SkipSheet
            copy={copy}
            onConfirm={() => { setAskSkip(false); skipPlanDay(copy.toast) }}
            onClose={() => setAskSkip(false)}
          />
        )
      })()}
      {showDeloadEnd && (
        <DeloadEndScreen
          entry={lastDeload}
          heaviest={heaviestLift}
          onDismiss={() => setRecoveryCfg(prev => ({
            ...prev,
            deloadEndSeenAt: lastDeload.until || lastDeload.plannedUntil,
          }))}
        />
      )}
      {showWhatsNew && !(active && sessionOpen) && <WhatsNewModal version={APP_VERSION} onClose={dismissWhatsNew} />}
      {/* Queued behind the version notice so the two never stack. */}
      {packOffer && !showWhatsNew && !onboarding && !(active && sessionOpen) && <AssetPackPrompt onClose={() => setPackOffer(false)} />}
      {showReport && shownReport && (
        <MonthReport
          report={shownReport}
          mapping={exerciseMapping}
          liveStreak={recovery.consistencyStreak}
          today={today}
          sharing={sharing}
          onShare={handleSharePoster}
          months={reportHistory}
          onPickMonth={(m) => setReportPick(m === reportMonth ? null : m)}
          onClose={() => { setShowReport(false); setReportPick(null) }}
          // The first time a month's report opens it plays as a story.
          storyFirst={!storySeen(ls.get(REPORT_SEEN_KEY, {}), shownReport.month, today)}
          onStorySeen={(m) => ls.set(REPORT_SEEN_KEY, withStorySeen(ls.get(REPORT_SEEN_KEY, {}), m, today))}
          photos={photos}
          profile={profile}
          config={recoveryCfg}
          onApplyNext={applyNextMonth}
          appliedBefore={!!appliedOn(ls.get(REPORT_APPLIED_KEY, {}), shownReport.month)}
          onSetGoal={setMonthGoal}
        />
      )}
      {posterUrl && (
        <SavePosterSheet
          url={posterUrl}
          onClose={() => { URL.revokeObjectURL(posterUrl); setPosterUrl(null) }}
        />
      )}
    </div>
  )
}
