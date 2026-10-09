import { Button, Num } from '../kit/index.jsx'
import { Barbell, Moon, CheckCircle, Play } from '../kit/icons.js'
import { ListPlus } from '@phosphor-icons/react'
import Txt, { Count } from './Txt.jsx'
import { countText, planDayTitleAr, sessionTitle } from './model.js'

// ── تمرين اليوم — pinned above the history ───────────────────
// The tab used to be a dead end: once there was any history, nothing on
// it could start a workout (F12). One card, one question — what now? —
// and the screen's single green fill, only when there is something to
// start. A rest day, a day already trained and a session already
// running each say so instead of pushing a button.


export default function TodayCard({
  planDay, active, resting = false, trainedToday = false,
  onStartPlanned, onStartFree, onPickRoutine, onResume,
}) {
  const start = () => (planDay ? onStartPlanned?.(planDay) : onStartFree?.())
  const dayTitle = planDay ? planDayTitleAr(planDay) : ''
  const exCount = planDay?.exercises?.length || 0
  const setCount = (planDay?.exercises || []).reduce((t, ex) => t + (Number(ex.sets) || 3), 0)

  // ── A session is already open: go back to it, never start another ──
  if (active) {
    const all = (active.exercises || []).flatMap(ex => ex.sets || [])
    const done = all.filter(s => s.done).length
    return (
      <section className="hs-today" aria-label="تمرين اليوم">
        <span className="hs-today-eyebrow hs-live"><i className="hs-live-dot" aria-hidden="true" />جلسة شغّالة</span>
        <h2 className="hs-today-title"><Txt>{sessionTitle(active, { planned: true })}</Txt></h2>
        <p className="hs-today-sub">
          {all.length ? <>خلّصت <Num>{done}</Num> من <Count n={all.length} noun="set" /></> : 'ما فيها تمارين للحين'}
        </p>
        {onResume ? (
          <div className="hs-today-actions">
            <Button variant="primary" size="lg" icon={Play} onClick={onResume} className="hs-grow">كمّل التمرين</Button>
          </div>
        ) : (
          <p className="hs-today-note">ترجع لها من الشريط اللي فوق التبويبات.</p>
        )}
      </section>
    )
  }

  // ── The engine scheduled rest: no green, the day word in blue ──
  if (resting) {
    return (
      <section className="hs-today" aria-label="تمرين اليوم">
        <span className="hs-today-eyebrow hs-rest"><Moon size={16} weight="fill" aria-hidden="true" />يوم راحة</span>
        <h2 className="hs-today-title">اليوم للراحة</h2>
        {dayTitle && <p className="hs-today-sub">الجاي: <Txt>{dayTitle}</Txt></p>}
        <div className="hs-today-actions">
          <Button variant="secondary" size="md" icon={Barbell} onClick={start} className="hs-grow">أبي أتمرّن</Button>
          <Button variant="secondary" size="md" icon={ListPlus} onClick={onPickRoutine} className="hs-grow">اختر روتين</Button>
        </div>
      </section>
    )
  }

  // ── Today already counts: offer an extra session, quietly ──
  if (trainedToday) {
    return (
      <section className="hs-today" aria-label="تمرين اليوم">
        <span className="hs-today-eyebrow hs-done"><CheckCircle size={16} weight="fill" aria-hidden="true" />تمرين اليوم خلص</span>
        <h2 className="hs-today-title">عافية عليك</h2>
        {dayTitle && <p className="hs-today-sub">اللي بعده: <Txt>{dayTitle}</Txt></p>}
        <div className="hs-today-actions">
          <Button variant="secondary" size="md" icon={Barbell} onClick={start} className="hs-grow">جلسة زيادة</Button>
          <Button variant="secondary" size="md" icon={ListPlus} onClick={onPickRoutine} className="hs-grow">اختر روتين</Button>
        </div>
      </section>
    )
  }

  // ── A training day: the one green button on the screen ──
  return (
    <section className="hs-today" aria-label="تمرين اليوم">
      <span className="hs-today-eyebrow">تمرين اليوم</span>
      <h2 className="hs-today-title"><Txt>{dayTitle || 'تمرين حر'}</Txt></h2>
      <p className="hs-today-sub">
        {planDay
          ? <><Count n={exCount} noun="exercise" /> · <Count n={setCount} noun="set" /></>
          : 'ابدأ فاضي وأضف تمارينك وانت تتمرن، أو اختر روتين جاهز.'}
      </p>
      <div className="hs-today-actions">
        <Button variant="primary" size="lg" onClick={start} className="hs-grow hs-start"
          aria-label={planDay ? `ابدأ تمرين اليوم: ${dayTitle} · ${countText(exCount, 'exercise')}` : undefined}>
          ابدأ تمرين اليوم
        </Button>
        <Button variant="secondary" size="lg" icon={ListPlus} onClick={onPickRoutine} className="hs-routine">اختر روتين</Button>
      </div>
    </section>
  )
}
