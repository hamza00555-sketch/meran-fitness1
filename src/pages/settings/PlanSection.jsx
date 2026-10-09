// ── Settings › الخطة وعدد الأيام ──────────────────────────────
// How often you train (the recovery cycle), the plan you follow, the
// ready-made programmes, and a plan written by an AI. Every switch of
// frequency or plan goes through one confirmation that states the cost
// to the streak before it is paid.

import { useRef, useState } from 'react'
import {
  ListGroup, ListRow, Segmented, Sheet, Button, Chip, Banner, ConfirmSheet, Num,
} from '../../components/kit/index.jsx'
import { Copy, Flame, Trash, Check } from '../../components/kit/icons.js'
import { ClipboardText, FileArrowUp, TextAlignRight } from '@phosphor-icons/react'
import { CheckList, CheckRow, TextField, Notice, Ar, freqTitle, freqDesc, cycleAr } from './parts.jsx'
import { TRAINING_FREQUENCIES, patternFor } from '../../recovery.js'
import { PLAN_TEMPLATE, AI_PLAN_PROMPT, BUILT_IN_PLANS } from '../../constants.js'
import { todayKey } from '../../day.js'
import { countAr, fmtDayAr } from '../../streak.js'
import { arabicName } from '../../exerciseMedia.js'

const weeksAr = (n) => {
  const k = Number(n) || 0
  if (k === 1) return 'أسبوع'
  if (k === 2) return 'أسبوعين'
  return (k >= 3 && k <= 10) ? `${k} أسابيع` : `${k} أسبوع`
}

// «Push A — صدر، أكتاف» → «دفع A» over «صدر، أكتاف». The day's own
// muscles are already Arabic; only the type word is English.
const TYPE_AR = { push: 'دفع', pull: 'سحب', legs: 'أرجل', leg: 'أرجل', upper: 'علوي', lower: 'سفلي', 'full body': 'الجسم كامل', full: 'الجسم كامل', arms: 'ذراعين', core: 'بطن', cardio: 'كارديو' }
export function dayNameAr(name = '') {
  const [left, ...rest] = String(name).split('—')
  const muscles = rest.join('—').trim()
  const l = left.trim()
  const m = l.match(/^(full body|push|pull|legs?|upper|lower|full|arms|core|cardio)\b\s*(.*)$/i)
  return { head: m ? `${TYPE_AR[m[1].toLowerCase()]}${m[2] ? ` ${m[2]}` : ''}` : l, muscles }
}

const planMeta = (p) => [
  p.daysPerWeek && `${p.daysPerWeek} أيام في الأسبوع`,
  p.durationWeeks && weeksAr(p.durationWeeks),
  p.difficulty,
].filter(Boolean)

// AI replies arrive wrapped in prose, code fences, smart quotes and
// invisible marks; this digs the JSON out.
function extractJson(raw) {
  let text = String(raw || '').trim()
  text = text.replace(/[﻿​‌‍‎‏­⁠]/g, '')
  text = text.replace(/[‘’‚‛]/g, "'")
  text = text.replace(/[“”„‟]/g, '"')
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  return text.slice(start, end + 1)
}

const ERR = {
  empty:     'الخانة فاضية — الصق رد الذكاء الاصطناعي أول.',
  clipEmpty: 'الحافظة فاضية — انسخ رد الذكاء الاصطناعي أول.',
  noJson:    'ما لقينا خطة في النص — تأكد إنك نسخت الرد كامل.',
  bad:       'النص ناقص أو فيه خطأ — انسخ الرد كامل من جديد.',
  notPlan:   'هذا النص مو خطة لمران، ناقصه أيام التمرين. انسخ الطلب من جديد وأرسله.',
  file:      'ما قدرنا نقرأ الملف.',
}

export default function PlanSection({
  recoveryCfg = {}, onUpdateRecovery, changeCooldownLeft = 0, currentStreak = 0,
  plan, onImportPlan, onClearPlan, onImportMapping, onImport,
}) {
  const [pending, setPending] = useState(null)     // { kind, label, apply }
  const [detail, setDetail] = useState(null)       // a built-in plan being previewed
  const [confirmClear, setConfirmClear] = useState(false)
  const [notice, setNotice] = useState(null)
  const [copied, setCopied] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importingPlan, setImportingPlan] = useState(false)
  const planImportRef = useRef(null)

  const fail = (key) => setNotice({ tone: 'danger', text: ERR[key] || key })
  const requestChange = (kind, label, apply) => setPending({ kind, label, apply })
  const confirmPending = () => {
    if (!pending) return
    pending.apply({ breakStreak: changeCooldownLeft > 0 })
    setPending(null)
  }

  // One router for a pasted reply, a clipboard read and a picked file.
  const route = (raw, { fromPaste } = {}) => {
    if (!String(raw || '').trim()) return fail(fromPaste === 'clipboard' ? 'clipEmpty' : 'empty'), false
    const json = extractJson(raw)
    if (!json) return fail('noJson'), false
    let data
    try { data = JSON.parse(json) } catch { return fail('bad'), false }
    if (data.type === 'exercise_mapping' && data.mapping) { onImportMapping?.(data.mapping); return true }
    if (data.sessions !== undefined || data.xp !== undefined) { onImport?.(data); return true }
    if (!Array.isArray(data.weeklySchedule)) return fail('notPlan'), false
    setNotice(null)
    requestChange('plan', data.planName || 'خطة مستوردة', opts => onImportPlan?.(data, opts))
    return true
  }

  const handlePastePlan = () => {
    if (route(pasteText)) { setPasteMode(false); setPasteText('') }
  }

  const handleClipboardPaste = async () => {
    setNotice(null)
    try {
      const raw = await navigator.clipboard.readText()
      if (!raw || !raw.trim()) { fail('clipEmpty'); setPasteMode(true); return }
      setPasteText(raw)
      if (!route(raw, { fromPaste: 'clipboard' })) setPasteMode(true)
    } catch {
      // Permission refused or no clipboard API: paste by hand instead.
      setPasteMode(true)
    }
  }

  const handleImportPlan = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingPlan(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      route(ev.target.result)
      setImportingPlan(false)
      e.target.value = ''
    }
    reader.onerror = () => { fail('file'); setImportingPlan(false); e.target.value = '' }
    reader.readAsText(file, 'UTF-8')
  }

  const handleCopyPrompt = () => {
    const template = JSON.stringify({ ...PLAN_TEMPLATE, startDate: todayKey() }, null, 2)
    const prompt = AI_PLAN_PROMPT.replace('TEMPLATE_PLACEHOLDER', template)
    navigator.clipboard?.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => setNotice({ tone: 'danger', text: 'ما قدرنا ننسخ الطلب على هذا الجهاز.' }))
  }

  // The preview sheet closes before the confirmation opens, so two
  // sheets never hold the page at once.
  const activate = (p) => {
    setDetail(null)
    setTimeout(() => requestChange('plan', p.planName, opts => onImportPlan?.({ ...p, startDate: todayKey() }, opts)), 260)
  }

  const days = recoveryCfg.daysPerWeek
  const customN = (recoveryCfg.customPattern || [2])[0]
  const breaks = changeCooldownLeft > 0

  return (
    <>
      {/* ── How often ── */}
      <CheckList header="كم يوم تبي تتمرن؟"
        footer={<p><Ar>{`الدورة الحين: ${cycleAr(patternFor(recoveryCfg))}`}</Ar></p>}>
        {TRAINING_FREQUENCIES.map(f => (
          <CheckRow key={f.id} title={<Ar>{freqTitle(f.id)}</Ar>} subtitle={<Ar>{freqDesc(f)}</Ar>}
            checked={days === f.id}
            onClick={() => days === f.id || requestChange('frequency', freqTitle(f.id),
              opts => onUpdateRecovery?.({ daysPerWeek: f.id }, opts))} />
        ))}
        <CheckRow title="مخصص" subtitle="أنت تحدد كم تمرين قبل يوم التعافي"
          checked={days === 'custom'}
          onClick={() => days === 'custom' || requestChange('frequency', 'إعداد مخصص',
            opts => onUpdateRecovery?.({
              daysPerWeek: 'custom',
              customPattern: recoveryCfg.customPattern?.length ? recoveryCfg.customPattern : [2],
            }, opts))} />
      </CheckList>

      {days === 'custom' && (
        <div className="st-fields one">
          <span className="st-field-label">تمارين قبل يوم التعافي</span>
          <Segmented label="تمارين قبل يوم التعافي" value={customN}
            options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: <Num>{n}</Num> }))}
            onChange={n => n === customN || requestChange('frequency', cycleAr([n]),
              opts => onUpdateRecovery?.({ customPattern: [n] }, opts))} />
        </div>
      )}

      {breaks ? (
        <Banner tone="streak" icon={Flame} title="التغيير الحين يكسر الستريك" className="st-notice">
          <Ar>{`التغيير المجاني بعد ${countAr(changeCooldownLeft, 'day')}.`}</Ar>
        </Banner>
      ) : (
        <p className="st-note" style={{ marginTop: 'calc(-1 * var(--space-4))' }}>عندك تغيير مجاني — الستريك ما يتأثر.</p>
      )}

      {/* ── The plan in force ── */}
      {plan && (
        <ListGroup header="خطتك الحين">
          <ListRow title={<span dir="auto">{plan.planName}</span>}
            subtitle={<Ar>{[
              plan.durationWeeks && weeksAr(plan.durationWeeks),
              plan.weeklySchedule?.length && `${plan.weeklySchedule.length} أيام في الأسبوع`,
              plan.startDate && `بدأت ${fmtDayAr(plan.startDate, { weekday: false })}`,
            ].filter(Boolean).join(' · ')}</Ar>} />
          <ListRow leading={Trash} title="حذف الخطة" tone="danger" className="st-danger" onClick={() => setConfirmClear(true)} />
        </ListGroup>
      )}

      {/* ── Ready-made programmes ── */}
      <ListGroup header="البرامج الجاهزة" footer="اضغط على البرنامج وتشوف أيامه وتمارينه قبل لا تفعّله.">
        {BUILT_IN_PLANS.map(p => {
          const isActive = plan?.planId === p.planId
          return (
            <ListRow key={p.planId} chevron onClick={() => setDetail(p)}
              title={<span dir="auto">{p.planName}</span>}
              subtitle={<Ar>{planMeta(p).join(' · ')}</Ar>}
              trailing={isActive ? <span className="st-active"><Check size={16} weight="bold" aria-hidden="true" /> مفعّل</span> : null} />
          )
        })}
      </ListGroup>

      {/* ── A plan from an AI ── (its notices sit where the action is) */}
      {!pasteMode && <Notice notice={notice} onClose={() => setNotice(null)} />}
      <ListGroup header="خطة من الذكاء الاصطناعي"
        footer={<Ar>{'انسخ الطلب، أرسله لـ ChatGPT أو Claude مع برنامجك، وبعدين الصق الرد هنا.'}</Ar>}>
        <ListRow leading={copied ? Check : Copy} title={copied ? 'انتسخ الطلب' : 'انسخ الطلب'}
          className={copied ? 'st-accent' : undefined} onClick={handleCopyPrompt} />
        <ListRow leading={ClipboardText} title="الصق الخطة من الحافظة" onClick={handleClipboardPaste} />
        <ListRow leading={FileArrowUp} title={importingPlan ? 'نقرأ الملف…' : 'اختر ملف خطة'}
          subtitle={<Ar>{'ملف JSON حفظته من الرد'}</Ar>}
          onClick={() => planImportRef.current?.click()} />
        <ListRow leading={TextAlignRight} title="الصق النص بنفسك" onClick={() => setPasteMode(m => !m)} />
      </ListGroup>
      <input ref={planImportRef} type="file" accept=".json,application/json" hidden onChange={handleImportPlan} />

      {pasteMode && (
        <div className="st-actions">
          <Notice notice={notice} onClose={() => setNotice(null)} />
          <TextField multiline rows={7} value={pasteText} placeholder="الصق هنا رد الذكاء الاصطناعي…"
            aria-label="نص الخطة" onChange={e => { setPasteText(e.target.value); if (notice) setNotice(null) }} />
          <Button variant="primary" size="lg" full onClick={handlePastePlan}>استورد الخطة</Button>
          <Button variant="plain" full onClick={() => { setPasteMode(false); setPasteText(''); setNotice(null) }}>إلغاء</Button>
        </div>
      )}

      {/* ── Preview of a ready-made programme ── */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} tall
        title={detail ? <span dir="auto">{detail.planName}</span> : ''}
        footer={detail && (plan?.planId === detail.planId
          ? <Button variant="secondary" size="lg" full disabled>مفعّل حالياً</Button>
          : <Button variant="primary" size="lg" full onClick={() => activate(detail)}>فعّل البرنامج</Button>)}>
        {detail && (
          <>
            <div className="st-plan-meta">
              {planMeta(detail).map(m => <Chip key={m}><Ar>{m}</Ar></Chip>)}
            </div>
            <p className="st-plan-desc"><Ar>{detail.description}</Ar></p>
            {detail.weeklySchedule.map((day, di) => {
              const { head, muscles } = dayNameAr(day.name)
              return (
                <section key={di} className="k-group st-plan-day">
                  <h3 className="k-group-h"><b><Ar>{head}</Ar></b>{muscles && <span>· {muscles}</span>}</h3>
                  <div className="k-group-body">
                    {day.exercises.map((ex, ei) => {
                      const ar = arabicName(ex.name)
                      return (
                        <div key={ei} className="k-row">
                          <span className="k-row-main st-ex-name">
                            <span className="k-row-title">{ar || <span dir="ltr">{ex.name}</span>}</span>
                            {ar && <span className="st-ex-en" dir="ltr">{ex.name}</span>}
                          </span>
                          <span className="st-ex-sets">
                            <Num>{`${ex.sets} × ${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`}`}</Num>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </Sheet>

      {/* ── The one confirmation for a frequency or plan change ── */}
      <Sheet open={!!pending} onClose={() => setPending(null)}
        title={pending?.kind === 'plan' ? 'تغيير الخطة' : 'تغيير أيام التمرين'}
        footer={(
          <div className="k-confirm-actions">
            <Button variant={breaks ? 'destructive-fill' : 'primary'} size="lg" full onClick={confirmPending}>
              {breaks ? 'غيّر واكسر الستريك' : 'أكّد التغيير'}
            </Button>
            <Button variant="secondary" size="lg" full onClick={() => setPending(null)}>رجوع</Button>
          </div>
        )}>
        {pending && (
          <div className="st-confirm">
            <p className="st-confirm-what" dir="auto"><Ar>{pending.label}</Ar></p>
            <p className="k-confirm-msg">
              {breaks
                ? <Ar>{`هذا التغيير يكسر الستريك (${countAr(currentStreak, 'day')}) ويبدأ من الصفر. التغيير المجاني الجاي بعد ${countAr(changeCooldownLeft, 'day')}.`}</Ar>
                : <Ar>{`الستريك (${countAr(currentStreak, 'day')}) محفوظ، وأيامك اللي فاتت تنحسب بإعدادك القديم. التغيير المجاني الجاي بعد ${countAr(30, 'day')}.`}</Ar>}
            </p>
          </div>
        )}
      </Sheet>

      <ConfirmSheet open={confirmClear} onClose={() => setConfirmClear(false)} destructive
        title="تحذف الخطة؟"
        message="سجل جلساتك يبقى زي ما هو، بس الرئيسية ما عاد تقترح عليك تمرين اليوم."
        confirmLabel="احذف الخطة"
        onConfirm={() => { onClearPlan?.(); setConfirmClear(false) }} />
    </>
  )
}
