import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ls, calcStreak, buildExercise,
  levelFromXP, xpProgress, getTodayChallenges,
  scheduleNotificationsForToday,
} from './utils.js'
import {
  GREETINGS, NAV_TABS, ACHIEVEMENTS,
  DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES,
  NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS,
  DEFAULT_EXERCISE_MAPPING,
} from './constants.js'
import { PersonIcon, TrophyIcon, FlagIcon, DumbbellIcon, HomeIcon, SettingsIcon } from './components/Icons.jsx'

const NAV_ICONS = {
  home:         HomeIcon,
  workout:      DumbbellIcon,
  exercises:    null,
  challenges:   FlagIcon,
  achievements: TrophyIcon,
  profile:      PersonIcon,
  settings:     SettingsIcon,
}

// Pages
import HomePage        from './pages/HomePage.jsx'
import WorkoutPage     from './pages/WorkoutPage.jsx'
import ChallengesPage  from './pages/ChallengesPage.jsx'
import AchievementsPage from './pages/AchievementsPage.jsx'
import ProfilePage     from './pages/ProfilePage.jsx'
import SettingsPage    from './pages/SettingsPage.jsx'
import PhotosPage      from './pages/PhotosPage.jsx'
import ExercisesPage   from './pages/ExercisesPage.jsx'

// Components
import RestTimer        from './components/RestTimer.jsx'
import RoutinesModal    from './components/RoutinesModal.jsx'
import LevelUpScreen    from './components/LevelUpScreen.jsx'
import SystemAlert      from './components/SystemAlert.jsx'

// Stable greeting index per session
const GREETING_IDX = Math.floor(Math.random() * GREETINGS.length)

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

  // ── UI state ──────────────────────────────────────────────────
  const [tab,        setTab]        = useState('home')
  const [showRest,   setShowRest]   = useState(false)
  const [showLevelUp,setShowLevelUp]= useState(false)
  const [levelUpNum, setLevelUpNum] = useState(1)
  const [alerts,     setAlerts]     = useState([])
  const [restKey,    setRestKey]    = useState(0)
  const [photos,     setPhotos]     = useState(() => ls.get('hf_photos', []))

  const prevLevelRef = useRef(levelFromXP(xp))

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

  // ── Schedule daily notifications ─────────────────────────────
  useEffect(() => {
    if (ls.get('hf_notif_enabled', false)) {
      scheduleNotificationsForToday(
        profile?.workoutTime || 'المساء',
        NOTIFICATION_MESSAGES,
        WORKOUT_TIME_HOURS,
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Alert helper ──────────────────────────────────────────────
  const pushAlert = useCallback((icon, msg) => {
    const id = Date.now() + Math.random()
    setAlerts(prev => [...prev, { id, icon, msg }])
  }, [])

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  // ── XP float animation ────────────────────────────────────────
  const showXPFloat = useCallback((amount) => {
    const el = document.createElement('div')
    el.className = 'xp-float'
    el.textContent = `+${amount} XP`
    el.style.left = '50%'
    el.style.top  = '40%'
    el.style.transform = 'translateX(-50%)'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1500)
  }, [])

  // ── Add XP ───────────────────────────────────────────────────
  const addXP = useCallback((amount, label = '') => {
    setXP(prev => {
      const newXP      = prev + amount
      const oldLevel   = levelFromXP(prev)
      const newLevel   = levelFromXP(newXP)
      if (newLevel > oldLevel) {
        prevLevelRef.current = newLevel
        setLevelUpNum(newLevel)
        setShowLevelUp(true)
      }
      return newXP
    })
    showXPFloat(amount)
    if (label) pushAlert('⭐', `${label} +${amount} XP`)
  }, [showXPFloat, pushAlert])

  // ── Achievement checker ───────────────────────────────────────
  const checkAchievements = useCallback((newSessions, newXP, newStreak) => {
    setUnlockedAchievements(prev => {
      const newUnlocked = [...prev]
      let gained = 0
      ACHIEVEMENTS.forEach(a => {
        if (newUnlocked.includes(a.id)) return
        try {
          if (a.check(newSessions, newXP, newStreak)) {
            newUnlocked.push(a.id)
            gained += a.xp
            pushAlert('🏆', `إنجاز: ${a.title}`)
          }
        } catch {}
      })
      if (gained > 0) {
        setTimeout(() => addXP(gained, 'إنجازات'), 300)
      }
      return newUnlocked
    })
  }, [addXP, pushAlert])

  // ── Session management ────────────────────────────────────────
  const startPlannedWorkout = useCallback((planDay) => {
    const exercises = (planDay.exercises || []).map(ex =>
      buildExercise({ muscle: ex.muscle, name: ex.name, numSets: ex.sets || 3 })
    )
    const session = {
      id:           Date.now(),
      date:         new Date().toISOString(),
      duration:     null,
      exercises,
      planDayName:  planDay.name,
      planDayIndex: planIndex,
    }
    setActive(session)
    setTab('workout')
  }, [planIndex])

  const skipPlanDay = useCallback(() => {
    setPlanIndex(prev => prev + 1)
    pushAlert('⏭️', 'تم تخطي يوم التمرين')
  }, [pushAlert])

  const startWorkout = useCallback((exercises = []) => {
    const session = {
      id:        Date.now(),
      date:      new Date().toISOString(),
      duration:  null,
      exercises,
    }
    setActive(session)
    setTab('workout')
  }, [])

  const finishSession = useCallback(() => {
    if (!active) return
    const duration = Math.round((Date.now() - active.id) / 60000)
    const finished = { ...active, duration }

    setSessions(prev => {
      const newSessions = [finished, ...prev]
      const streak = calcStreak(newSessions)

      // XP for session
      const setsDone = finished.exercises.flatMap(e => e.sets).filter(s => s.done).length
      const sessionXP = 50 + setsDone * 10 + Math.floor(duration / 30) * 30
      setTimeout(() => {
        addXP(sessionXP, '✓ جلسة مكتملة')
        checkAchievements(newSessions, xp + sessionXP, streak)
      }, 200)

      return newSessions
    })

    // Advance plan index when a planned session is completed
    if (active.planDayIndex !== undefined) {
      setPlanIndex(active.planDayIndex + 1)
    }

    setActive(null)
    setTab('home')
    pushAlert('🎉', 'جلسة مكتملة! عمل رائع!')
  }, [active, addXP, checkAchievements, pushAlert, xp])

  const updateActive = useCallback((updater) => {
    setActive(prev => prev ? updater(prev) : prev)
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
  const streak  = calcStreak(sessions)
  const { level } = xpProgress(xp)

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #0A0E1A 0%, var(--bg) 30%)',
      color: 'var(--text)',
      maxWidth: 560,
      margin: '0 auto',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        background: 'rgba(8,11,20,0.94)',
        borderBottom: '1px solid rgba(94,195,42,0.12)',
        padding: `calc(var(--safe-top) + 14px) 18px 14px`,
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 1px 0 rgba(94,195,42,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              letterSpacing: 4, color: 'var(--cyan)', marginBottom: 2,
              opacity: 0.8,
            }}>MERAN</div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 13,
              fontWeight: 600, color: 'var(--text2)',
              maxWidth: 230, lineHeight: 1.4,
            }}>
              {GREETINGS[GREETING_IDX].replace('{name}', profile?.name || 'البطل')}
            </div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 10,
              color: 'var(--text3)', marginTop: 3,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              اضغط ⚙️ لتغيير اسمك
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{
                background: 'var(--orange-lo)',
                border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: 20, padding: '3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--orange)', fontWeight: 700,
              }}>🔥 {streak}</div>
            )}
            <button
              onClick={() => setShowRest(true)}
              style={{
                background: 'rgba(94,195,42,0.07)', border: '1px solid rgba(94,195,42,0.18)',
                borderRadius: 10, width: 36, height: 36,
                color: 'var(--text2)', cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(94,195,42,0.18)'; e.currentTarget.style.color = 'var(--text2)' }}
            >⏱️</button>
            <button
              onClick={() => setTab(t => t === 'settings' ? 'home' : 'settings')}
              style={{
                background: tab === 'settings' ? 'var(--cyan-lo)' : 'rgba(94,195,42,0.07)',
                border: `1px solid ${tab === 'settings' ? 'var(--cyan)' : 'rgba(94,195,42,0.18)'}`,
                borderRadius: 10, width: 36, height: 36,
                color: tab === 'settings' ? 'var(--cyan)' : 'var(--text2)', cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)' }}
              onMouseOut={e => {
                if (tab !== 'settings') {
                  e.currentTarget.style.borderColor = 'rgba(94,195,42,0.18)'
                  e.currentTarget.style.color = 'var(--text2)'
                }
              }}
            ><SettingsIcon size={18} /></button>
          </div>
        </div>
      </header>

      {/* ── Page Content ────────────────────────────────────────── */}
      <main
        key={tab}
        className="page-enter"
        style={{ padding: '16px 14px 0', flex: 1 }}
      >
        {tab === 'home' && (
          <HomePage
            sessions={sessions}
            xp={xp}
            streak={streak}
            profile={profile}
            active={active}
            plan={plan}
            planIndex={planIndex}
            onStartWorkout={() => startWorkout()}
            onStartPlannedWorkout={startPlannedWorkout}
            onSkipPlanDay={skipPlanDay}
            onGoToWorkout={() => setTab('workout')}
          />
        )}
        {tab === 'workout' && (
          <WorkoutPage
            active={active}
            sessions={sessions}
            plan={plan}
            planIndex={planIndex}
            onUpdateActive={updateActive}
            onFinish={finishSession}
            onShowRest={() => { setShowRest(true); setRestKey(k => k + 1) }}
            onStartPlannedWorkout={startPlannedWorkout}
            addXP={addXP}
            onGoBack={() => { setActive(null); setShowRest(false); setTab('home') }}
            isResting={showRest}
            exerciseMapping={exerciseMapping}
          />
        )}
        {tab === 'exercises' && <ExercisesPage sessions={sessions} exerciseMapping={exerciseMapping} />}
        {tab === 'challenges' && (
          <ChallengesPage
            sessions={sessions}
            challengeState={challengeState}
            onCompleteChallenge={handleCompleteChallenge}
            xp={xp}
          />
        )}
        {tab === 'achievements' && (
          <AchievementsPage
            sessions={sessions}
            xp={xp}
            streak={streak}
            unlockedAchievements={unlockedAchievements}
            level={level}
          />
        )}
        {tab === 'profile' && (
          <ProfilePage
            profile={profile}
            sessions={sessions}
            xp={xp}
            streak={streak}
            level={level}
            onUpdateProfile={handleUpdateProfile}
            onGoToPhotos={() => setTab('photos')}
          />
        )}
        {tab === 'settings' && (
          <SettingsPage
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            sessions={sessions}
            xp={xp}
            unlockedAchievements={unlockedAchievements}
            challengeState={challengeState}
            photos={photos}
            plan={plan}
            onImportPlan={(p) => { setPlan(p); setPlanIndex(0); pushAlert('📋', `تم استيراد خطة: ${p.planName}`) }}
            onClearPlan={() => { setPlan(null); setPlanIndex(0) }}
            exerciseMapping={exerciseMapping}
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
              if (data.sessions !== undefined)           setSessions(data.sessions)
              if (data.xp !== undefined)                 setXP(data.xp)
              if (data.profile)                          setProfile(data.profile)
              if (data.unlockedAchievements)             setUnlockedAchievements(data.unlockedAchievements)
              if (data.challengeState)                   setChallengeState(data.challengeState)
              if (data.photos)                           setPhotos(data.photos)
              pushAlert('✅', 'تم استيراد البيانات بنجاح!')
            }}
          />
        )}
        {tab === 'photos' && (
          <PhotosPage
            photos={photos}
            setPhotos={setPhotos}
            onBack={() => setTab('profile')}
          />
        )}
      </main>

      {/* ── Bottom Navigation ────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        background: 'rgba(8,11,20,0.96)',
        borderTop: '1px solid rgba(94,195,42,0.10)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 -1px 0 rgba(94,195,42,0.06)',
        display: 'flex',
        padding: `10px 6px calc(env(safe-area-inset-bottom, 0px) + 10px)`,
        zIndex: 200,
        margin: '0 auto',
      }}>
        {NAV_TABS.map(t => {
          const isActive = tab === t.id
          const hasActiveSession = t.id === 'workout' && !!active
          const IconComp = NAV_ICONS[t.id]
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, background: 'none', border: 'none',
                cursor: 'pointer', position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4, padding: '4px 2px',
                transition: 'opacity 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {hasActiveSession && (
                <div className="pulse-dot" style={{
                  position: 'absolute', top: 2, right: '50%',
                  transform: 'translateX(12px)',
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--cyan)',
                }} />
              )}

              <div style={{
                width: 38, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                background: isActive ? 'var(--cyan-lo)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                {IconComp
                  ? <IconComp size={19} color={isActive ? 'var(--cyan)' : '#4B5563'} filled={isActive} />
                  : <span style={{ fontSize: 17, opacity: isActive ? 1 : 0.45 }}>{t.icon}</span>
                }
              </div>

              <span style={{
                fontFamily: 'var(--font-ar)', fontSize: 11,
                color: isActive ? 'var(--cyan)' : '#4B5563',
                fontWeight: isActive ? 700 : 500,
                transition: 'color 0.15s',
              }}>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Overlays ─────────────────────────────────────────────── */}
      {showRest    && <RestTimer key={restKey} onClose={() => setShowRest(false)} />}
      {showLevelUp && <LevelUpScreen level={levelUpNum} onDismiss={() => setShowLevelUp(false)} />}
      <SystemAlert alerts={alerts} onRemove={removeAlert} />
    </div>
  )
}
