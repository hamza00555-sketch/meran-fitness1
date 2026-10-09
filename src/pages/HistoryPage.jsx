import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, Sheet, ListGroup, ListRow } from '../components/kit/index.jsx'
import { ClockCounterClockwise, PencilSimple, Trash } from '../components/kit/icons.js'
import TodayCard from '../components/history/TodayCard.jsx'
import SessionRow, { UndoRow } from '../components/history/SessionRow.jsx'
import EditSessionSheet from '../components/history/EditSessionSheet.jsx'
import RoutinePickerSheet from '../components/history/RoutinePickerSheet.jsx'
import Txt from '../components/history/Txt.jsx'
import {
  groupByWeek, weekTotalsText, sessionTitle, sessionDateText, sessionDay, firstBestSessions,
} from '../components/history/model.js'
import { buildExercise, suggestedWeightFor, resolveExerciseName, getWeightsResetAt, ls } from '../utils.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from '../progression.js'
import { sessionDeloadStamp, deloadWeight } from '../deload.js'
import { DAY_STATUS } from '../recovery.js'
import { todayKey } from '../day.js'
import '../styles/screens/history.css'

// ── السجل — what you did ──────────────────────────────────────
//
// App draws the large title «السجل» above this page. Under it:
//   1. «تمرين اليوم», pinned, so the tab is never a dead end (F12);
//      «اختر روتين» opens RoutinePickerSheet (the ROUTINES on the kit,
//      in Arabic) and starts the picked routine through onStartWorkout;
//   2. the sessions, grouped by training week under sticky headers
//      «هذا الأسبوع · 3 جلسات · 5.7 طن» (F67, F36);
//   3. each session an open row — day, date, the first two lifts with
//      their best set, time and sets — with one ⋯ for edit and delete.
// Delete is immediate with six seconds to take it back: the row turns
// into an undo bar, and onDeleteSession only runs when the time is up
// (or when the page goes away), so the stored data is never touched by
// a delete that was undone.
//
// Optional props, all safe when absent:
//   active / onResumeWorkout  — a session already running (falls back to
//                               the saved hf_active, read only)
//   recovery                  — today's status, for the rest-day and
//                               trained-today states of the card
//   repTarget, recoveryConfig — for building a routine's sets (fall back
//                               to their saved values, read only)

const UNDO_MS = 6000

export default function HistoryPage({
  sessions = [], onUpdateSession, onDeleteSession, exerciseMapping = {},
  onStartPlannedWorkout, onStartWorkout, plan, planIndex = 0,
  active, onResumeWorkout, recovery, repTarget, recoveryConfig,
}) {
  const today = todayKey()
  const [expanded, setExpanded] = useState(null)
  const [menu, setMenu] = useState(null)           // { session, open, n }
  const [edit, setEdit] = useState(null)           // { session, data, open, n }
  const [pending, setPending] = useState(null)     // { id, label }
  const [picker, setPicker] = useState(null)       // { open, n }
  const sheetN = useRef(0)

  // ── Deferred delete, so «تراجع» never has to un-delete anything ──
  const pendingRef = useRef(null)
  const timerRef = useRef(null)
  const deleteRef = useRef(onDeleteSession)
  deleteRef.current = onDeleteSession

  const commitDelete = useCallback(() => {
    clearTimeout(timerRef.current)
    const p = pendingRef.current
    pendingRef.current = null
    if (p) deleteRef.current?.(p.id)
  }, [])

  // Leaving the tab mid-countdown completes the delete.
  useEffect(() => () => commitDelete(), [commitDelete])

  const removeSession = (s) => {
    commitDelete()                        // an earlier delete goes through now
    const p = { id: s.id, label: sessionDateText(s, today) }
    pendingRef.current = p
    setPending(p)
    if (expanded === s.id) setExpanded(null)
    timerRef.current = setTimeout(() => { commitDelete(); setPending(null) }, UNDO_MS)
  }
  const undoDelete = () => {
    clearTimeout(timerRef.current)
    pendingRef.current = null
    setPending(null)
  }

  // ── Today ──
  const schedule = plan?.weeklySchedule
  const planDay = schedule?.length ? schedule[(planIndex || 0) % schedule.length] : null
  const running = active !== undefined ? active : ls.get('hf_active', null)
  const visible = useMemo(() => sessions.filter(s => s.id !== pending?.id), [sessions, pending])
  const trainedToday = recovery?.status === DAY_STATUS.COMPLETED || visible.some(s => sessionDay(s) === today)
  const resting = recovery?.status === DAY_STATUS.RECOVERY && !trainedToday

  const startRoutine = (routine) => {
    // Built the way the player builds a loaded routine: last weight
    // (lightened under a deload), the reps the progression suggests.
    const cfg = recoveryConfig ?? ls.get('hf_recovery', null) ?? {}
    const stamp = sessionDeloadStamp(cfg, today)
    const lighten = stamp ? (w => deloadWeight(w, stamp.pct)) : undefined
    const target = repTarget ?? { ...DEFAULT_REP_TARGET, ...ls.get('hf_rep_target', {}) }
    const exercises = (routine?.exercises || []).map(ex => buildExercise({
      muscle: ex.muscle, name: ex.name, numSets: ex.defaultSets || ex.sets || 3,
      prevWeight: suggestedWeightFor(ex.name, { sessions, mapping: exerciseMapping, transform: lighten }),
      prevReps: analyzeProgression(sessions, ex.name, exerciseMapping, target).suggestedReps,
    }))
    onStartWorkout?.(exercises)
  }
  const openPicker = () => setPicker({ open: true, n: ++sheetN.current })
  const closePicker = () => setPicker(p => (p ? { ...p, open: false } : p))
  const pickRoutine = (routine) => { closePicker(); startRoutine(routine) }

  // ── The feed ──
  const weeks = useMemo(() => groupByWeek(sessions, today), [sessions, today])
  const firsts = useMemo(
    () => firstBestSessions(visible, exerciseMapping, getWeightsResetAt()),
    [visible, exerciseMapping],
  )

  // ── ⋯ menu and the editor ──
  // A fresh key per opening, so each sheet remembers its own opener and
  // hands focus back to the right ⋯.
  const openMenu = (s) => setMenu({ session: s, open: true, n: ++sheetN.current })
  const closeMenu = () => setMenu(m => (m ? { ...m, open: false } : m))
  const SHEET_EXIT = 240   // the kit's sheet leaves in 220ms; open the next one after it

  const startEdit = (s) => {
    closeMenu()
    setTimeout(() => setEdit({
      session: s, open: true, n: ++sheetN.current,
      data: (s.exercises || []).map(ex => ({ ...ex, sets: (ex.sets || []).map(x => ({ ...x })) })),
    }), SHEET_EXIT)
  }
  const closeEdit = () => setEdit(e => (e ? { ...e, open: false } : e))

  const saveEdit = () => {
    if (!edit) return
    const sessionId = edit.session.id
    const cleaned = edit.data.filter(ex => ex.sets.some(s => s.done))
    if (!cleaned.length) return
    onUpdateSession?.(sessionId, s => ({ ...s, exercises: cleaned }))

    // The most recent session feeds the weight snapshot, as before.
    const mostRecentId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) : null
    if (sessionId === mostRecentId) {
      const snapshot = {}
      for (const ex of cleaned) {
        const ws = (ex.sets || []).map(s => parseFloat(s.weight)).filter(w => w > 0)
        if (ws.length) snapshot[resolveExerciseName(ex.name, exerciseMapping)] = ws[ws.length - 1]
      }
      if (Object.keys(snapshot).length) {
        ls.set('hf_last_weights', { ...ls.get('hf_last_weights', {}), ...snapshot })
      }
    }
    closeEdit()
  }

  const menuSession = menu?.session
  const menuTitle = menuSession ? sessionTitle(menuSession) : ''
  const menuDate = menuSession ? sessionDateText(menuSession, today) : ''

  return (
    <div className="hs-page">
      <TodayCard
        planDay={planDay}
        active={running}
        resting={resting}
        trainedToday={trainedToday}
        onStartPlanned={onStartPlannedWorkout}
        onStartFree={() => onStartWorkout?.()}
        onPickRoutine={openPicker}
        onResume={onResumeWorkout}
      />

      {sessions.length === 0 ? (
        <EmptyState icon={ClockCounterClockwise} title="ما فيه جلسات للحين">
          أول ما تخلّص تمرين ينحفظ هنا: التمارين، والأوزان، وكل مجموعة لعبتها.
        </EmptyState>
      ) : (
        weeks.map(week => {
          const shown = week.sessions.filter(s => s.id !== pending?.id)
          const totals = weekTotalsText(shown)
          return (
            <section key={week.key} className="hs-week">
              <h2 className="hs-week-h">
                <span className="hs-week-name"><Txt>{week.label}</Txt></span>
                {totals && <span className="hs-week-sum"><Txt>{totals}</Txt></span>}
              </h2>
              <div className="hs-rows">
                {week.sessions.map(s => (
                  s.id === pending?.id
                    ? <UndoRow key={s.id} label={pending.label} onUndo={undoDelete} ms={UNDO_MS} />
                    : (
                      <SessionRow
                        key={s.id}
                        session={s}
                        title={sessionTitle(s)}
                        dateText={sessionDateText(s, today)}
                        firsts={firsts}
                        mapping={exerciseMapping}
                        expanded={expanded === s.id}
                        onToggle={() => setExpanded(x => (x === s.id ? null : s.id))}
                        onMore={() => openMenu(s)}
                      />
                    )
                ))}
              </div>
            </section>
          )
        })
      )}

      {menu && (
        <Sheet key={menu.n} open={menu.open} onClose={closeMenu} title={<Txt>{menuTitle}</Txt>}>
          <p className="hs-menu-date"><Txt>{menuDate}</Txt></p>
          <ListGroup className="hs-menu">
            <ListRow leading={PencilSimple} title="تعديل الجلسة" onClick={() => startEdit(menuSession)} />
            <ListRow leading={Trash} title="حذف الجلسة" tone="danger"
              onClick={() => { closeMenu(); removeSession(menuSession) }} />
          </ListGroup>
        </Sheet>
      )}

      {edit && (
        <EditSessionSheet
          key={edit.n}
          open={edit.open}
          onClose={closeEdit}
          title={sessionTitle(edit.session)}
          dateText={sessionDateText(edit.session, today)}
          data={edit.data}
          mapping={exerciseMapping}
          onChange={data => setEdit(e => (e ? { ...e, data } : e))}
          onSave={saveEdit}
        />
      )}

      {picker && (
        <RoutinePickerSheet key={picker.n} open={picker.open} onClose={closePicker} onSelect={pickRoutine} />
      )}
    </div>
  )
}
