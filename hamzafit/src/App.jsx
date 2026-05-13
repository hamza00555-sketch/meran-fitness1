import { useState, useCallback, useEffect } from 'react'
import { ls, calcStreak, buildExercise } from './utils.js'
import { GREETINGS, NAV_TABS, MUSCLE_GROUPS } from './constants.js'

// Pages
import HomePage    from './pages/HomePage.jsx'
import TodayPage   from './pages/TodayPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import PhotosPage  from './pages/PhotosPage.jsx'
import StatsPage   from './pages/StatsPage.jsx'

// Components / Modals
import RestTimer      from './components/RestTimer.jsx'
import AIPanel        from './components/AIPanel.jsx'
import RoutinesModal  from './components/RoutinesModal.jsx'
import ExportModal    from './components/ExportModal.jsx'
import TimelapseGenerator from './components/TimelapseGenerator.jsx'

// ── Greeting (stable per session) ────────────────────────────
const GREETING = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]

export default function App() {
  // ── Persistent state ─────────────────────────────────────────
  const [sessions, setSessions]   = useState(() => ls.get('hf_sessions', []))
  const [active,   setActive]     = useState(() => ls.get('hf_active',   null))

  // ── UI state ─────────────────────────────────────────────────
  const [tab,            setTab]            = useState('home')
  const [showRest,       setShowRest]       = useState(false)
  const [showAI,         setShowAI]         = useState(false)
  const [showRoutines,   setShowRoutines]   = useState(false)
  const [showExport,     setShowExport]     = useState(false)
  const [showTimelapse,  setShowTimelapse]  = useState(false)

  // ── Persist to localStorage ───────────────────────────────────
  useEffect(() => { ls.set('hf_sessions', sessions) }, [sessions])
  useEffect(() => { ls.set('hf_active',   active)   }, [active])

  // ── Session actions ───────────────────────────────────────────
  const startSession = useCallback((preloadedExercises = []) => {
    setActive({
      id:        Date.now(),
      date:      new Date().toISOString(),
      exercises: preloadedExercises,
      duration:  null,
    })
    setTab('today')
  }, [])

  const finishSession = useCallback(() => {
    if (!active) return
    const finished = {
      ...active,
      duration: Math.round((Date.now() - active.id) / 60000),
    }
    setSessions(prev => [finished, ...prev])
    setActive(null)
    setTab('history')
  }, [active])

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  // ── Active session updater ────────────────────────────────────
  const updateActive = useCallback((updater) => {
    setActive(prev => prev ? updater(prev) : prev)
  }, [])

  // ── Load routine ──────────────────────────────────────────────
  const loadRoutine = useCallback((routine) => {
    const exercises = routine.exercises.map((ex, i) =>
      buildExercise({
        muscle: ex.muscle,
        name:   ex.name,
        emoji:  ex.emoji || MUSCLE_GROUPS[ex.muscle]?.exercises.find(e => e.name === ex.name)?.emoji || '🏋️',
        numSets: ex.defaultSets || 3,
      })
    )
    startSession(exercises)
    setShowRoutines(false)
  }, [startSession])

  // ── AI import ────────────────────────────────────────────────
  const importAIRoutine = useCallback((data) => {
    const exercises = (data.exercises || []).map(ex =>
      buildExercise({
        muscle:  ex.muscle,
        name:    ex.name,
        emoji:   ex.emoji || '🏋️',
        numSets: ex.sets || 3,
      })
    )
    if (!active) {
      startSession(exercises)
    } else {
      updateActive(prev => ({ ...prev, exercises: [...prev.exercises, ...exercises] }))
      setTab('today')
    }
    setShowAI(false)
  }, [active, startSession, updateActive])

  // ── Derived ──────────────────────────────────────────────────
  const streak = calcStreak(sessions)
  const activeSetsCount = active?.exercises?.length ?? 0

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', minHeight: '100dvh',
      background: 'var(--bg)',
      color: 'var(--text)',
      maxWidth: 560,
      margin: '0 auto',
      position: 'relative',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--bg1)',
        borderBottom: '1px solid var(--bg3)',
        padding: `calc(var(--safe-top) + 14px) 18px 14px`,
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Brand + current tab */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: 3, color: 'var(--text4)', marginBottom: 2,
            }}>HAMZAFIT</div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 19,
              fontWeight: 900, letterSpacing: -0.3,
            }}>
              {NAV_TABS.find(t => t.id === tab)?.icon}{' '}
              {NAV_TABS.find(t => t.id === tab)?.label}
            </div>
          </div>

          {/* Action icons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{
                background: 'var(--orange-lo)',
                border: '1px solid var(--orange-md)',
                borderRadius: 20, padding: '3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--orange)', fontWeight: 700,
              }}>🔥 {streak}</div>
            )}
            <button
              onClick={() => setShowRest(true)}
              title="Rest Timer"
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, width: 36, height: 36,
                color: 'var(--text2)', cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--orange)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >⏱️</button>
            <button
              onClick={() => setShowAI(true)}
              title="AI Assistant"
              style={{
                background: 'linear-gradient(135deg,#EAB30818,#F59E0B18)',
                border: '1px solid #EAB30830',
                borderRadius: 8, width: 36, height: 36,
                color: 'var(--gold)', cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#EAB30830'}
            >🤖</button>
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────── */}
      <main
        key={tab}
        className="page-enter"
        style={{ padding: '16px 14px 0' }}
      >
        {tab === 'home' && (
          <HomePage
            sessions={sessions}
            active={active}
            greeting={GREETING}
            onNewSession={() => startSession()}
            onShowRoutines={() => setShowRoutines(true)}
            onShowAI={() => setShowAI(true)}
            onGoToToday={() => setTab('today')}
          />
        )}
        {tab === 'today' && (
          <TodayPage
            active={active}
            sessions={sessions}
            onUpdateActive={updateActive}
            onFinish={finishSession}
            onShowRest={() => setShowRest(true)}
            onShowRoutines={() => setShowRoutines(true)}
          />
        )}
        {tab === 'history' && (
          <HistoryPage
            sessions={sessions}
            onDelete={deleteSession}
            onShowExport={() => setShowExport(true)}
          />
        )}
        {tab === 'photos' && <PhotosPage onShowTimelapse={() => setShowTimelapse(true)} />}
        {tab === 'stats' && <StatsPage sessions={sessions} />}
      </main>

      {/* ── Bottom Navigation ────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        background: 'var(--bg1)',
        borderTop: '1px solid var(--bg3)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        padding: `8px 4px calc(var(--safe-bottom) + 8px)`,
        zIndex: 100,
      }}>
        {NAV_TABS.map(t => {
          const isActive = tab === t.id
          const badge = t.id === 'today' && activeSetsCount > 0 ? activeSetsCount : null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, background: 'none', border: 'none',
                cursor: 'pointer', position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: '5px 2px',
                transition: 'opacity 0.15s',
              }}
            >
              {/* Badge */}
              {badge && (
                <div style={{
                  position: 'absolute', top: 1, right: '50%',
                  transform: 'translateX(8px)',
                  background: 'var(--orange)',
                  borderRadius: '50%', width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: '#fff', fontWeight: 700,
                }}>{badge}</div>
              )}

              {/* Icon */}
              <span style={{ fontSize: 21, opacity: isActive ? 1 : 0.35, transition: 'opacity 0.15s' }}>
                {t.icon}
              </span>

              {/* Label */}
              <span style={{
                fontFamily: 'var(--font-ar)', fontSize: 10,
                color: isActive ? 'var(--orange)' : 'var(--text4)',
                fontWeight: isActive ? 700 : 400,
                transition: 'color 0.15s',
              }}>{t.label}</span>

              {/* Active indicator */}
              {isActive && (
                <div style={{
                  position: 'absolute', bottom: -1,
                  width: 20, height: 2,
                  background: 'var(--orange)', borderRadius: 2,
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Modals ─────────────────────────────────────────────── */}
      {showRest       && <RestTimer           onClose={() => setShowRest(false)} />}
      {showAI         && <AIPanel             onImport={importAIRoutine} onClose={() => setShowAI(false)} />}
      {showRoutines   && <RoutinesModal       onSelect={loadRoutine} onClose={() => setShowRoutines(false)} />}
      {showExport     && <ExportModal         sessions={sessions} onClose={() => setShowExport(false)} />}
      {showTimelapse  && <TimelapseGenerator  photos={ls.get('hf_photos', [])} onClose={() => setShowTimelapse(false)} />}
    </div>
  )
}
