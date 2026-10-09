import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Num } from '../kit/index.jsx'
import { Check } from '../kit/icons.js'
import { BUILT_IN_PLANS } from '../../constants.js'
import '../../styles/onboarding.css'

// ── First run: three questions, then the app ──────────────────
// A new install used to open on a changelog and a download prompt, with
// a placeholder name and a hint that never went away (critique F45).
// Now: your name, how many days a week, and whether you want a ready
// plan. Each can be changed later in Settings. Existing users never see
// this — it shows only on a fresh install with no sessions and no plan.

const DAYS = [
  { id: 3, title: '3 أيام', sub: 'تمرين واحد ثم راحة' },
  { id: 4, title: '4 أيام', sub: 'تمرينين ثم راحة' },
  { id: 5, title: '5 أيام', sub: '3 تمارين · راحة · تمرينين · راحة' },
  { id: 6, title: '6 أيام', sub: '3 تمارين · راحة · 3 تمارين · راحة' },
]

export default function Onboarding({ initialName = '', onDone }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initialName)
  const [days, setDays] = useState(5)
  const [planId, setPlanId] = useState(null)

  const finish = () => onDone({
    name: name.trim(),
    daysPerWeek: days,
    plan: BUILT_IN_PLANS.find(p => p.planId === planId) || null,
  })

  return createPortal(
    <div className="ob" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="ob-steps" aria-hidden="true">
        {[0, 1, 2].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      {step === 0 && (
        <section className="ob-body">
          <img className="ob-mark" src="/assets/app_logo_full_light.png" alt="مران" />
          <h1 id="ob-title" className="ob-title">هلا! وش نسمّيك؟</h1>
          <p className="ob-sub">بنناديك فيه بالرئيسية. تقدر تغيّره بعدين.</p>
          <input className="ob-input" value={name} onChange={e => setName(e.target.value)}
            placeholder="اسمك" maxLength={24} autoFocus aria-label="اسمك" />
        </section>
      )}

      {step === 1 && (
        <section className="ob-body">
          <h1 id="ob-title" className="ob-title">كم يوم بالأسبوع تتمرّن؟</h1>
          <p className="ob-sub">أيام الراحة تجي من هالدورة، وتنحسب لك بالستريك.</p>
          <div className="ob-list" role="radiogroup" aria-label="أيام التمرين">
            {DAYS.map(d => (
              <button key={d.id} type="button" role="radio" aria-checked={days === d.id}
                className={`ob-opt${days === d.id ? ' on' : ''}`} onClick={() => setDays(d.id)}>
                <span className="ob-opt-text"><b>{d.title}</b><small>{d.sub}</small></span>
                {days === d.id && <Check size={20} weight="bold" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ob-body">
          <h1 id="ob-title" className="ob-title">تبي خطة جاهزة؟</h1>
          <p className="ob-sub">الخطة ترتّب لك تمارين كل يوم. تقدر تبدأ بدونها وتختار بعدين.</p>
          <div className="ob-list" role="radiogroup" aria-label="الخطة">
            {BUILT_IN_PLANS.map(p => (
              <button key={p.planId} type="button" role="radio" aria-checked={planId === p.planId}
                className={`ob-opt${planId === p.planId ? ' on' : ''}`} onClick={() => setPlanId(p.planId)}>
                <span className="ob-opt-text">
                  <b>{p.planName}</b>
                  <small><Num>{p.weeklySchedule.length}</Num> أيام بالدورة · <Num>{p.durationWeeks || 6}</Num> أسابيع</small>
                </span>
                {planId === p.planId && <Check size={20} weight="bold" aria-hidden="true" />}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={planId === null}
              className={`ob-opt${planId === null ? ' on' : ''}`} onClick={() => setPlanId(null)}>
              <span className="ob-opt-text"><b>بدون خطة الحين</b><small>جلسات حرة، وتختار خطة متى ما بغيت</small></span>
              {planId === null && <Check size={20} weight="bold" aria-hidden="true" />}
            </button>
          </div>
        </section>
      )}

      <div className="ob-foot">
        {step < 2
          ? <Button variant="primary" size="lg" full onClick={() => setStep(s => s + 1)}>التالي</Button>
          : <Button variant="primary" size="lg" full onClick={finish}>يلا نبدأ</Button>}
        {step > 0 && <Button variant="plain" size="md" full onClick={() => setStep(s => s - 1)}>رجوع</Button>}
      </div>
    </div>,
    document.body,
  )
}
