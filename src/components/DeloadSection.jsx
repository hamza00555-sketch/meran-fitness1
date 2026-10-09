import { useState } from 'react'
import { ListGroup, ListRow, Button, Gauge, ConfirmSheet, Num } from './kit/index.jsx'
import { Drop } from './kit/icons.js'
import { toWesternDigits } from '../day.js'
import { countAr, fmtDayAr } from '../streak.js'
import {
  deloadState, daysSinceLastDeload, deloadWeight,
  MIN_PCT, MAX_PCT, MIN_DAYS, MAX_DAYS, DELOAD_DAYS, DELOAD_PCT,
} from '../deload.js'
import { CheckList, CheckRow, TextField, Ar } from '../pages/settings/parts.jsx'

// Three shapes people actually reach for, and a fourth for everyone
// else. The middle one is the default because it is the one the
// evidence is about — a week at roughly 60% of working weight.
const PRESETS = [
  { id: 'light', days: 5,           pct: 25,         label: 'خفيف' },
  { id: 'usual', days: DELOAD_DAYS, pct: DELOAD_PCT, label: 'المعتاد' },
  { id: 'deep',  days: 10,          pct: 55,         label: 'عميق' },
]

const dayWord = (n) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : (n >= 3 && n <= 10) ? 'أيام' : 'يوم')
const presetLine = (p) => `${p.days} ${dayWord(p.days)} · أخف ${p.pct}%`
const range = (from, until) => {
  const a = fmtDayAr(from, { weekday: false })
  const b = fmtDayAr(until, { weekday: false })
  return a && b ? `${a} — ${b}` : a || b
}

/**
 * The deload, as a Settings sub-page.
 *
 * Everything the period needs is here in one place: starting one,
 * watching it run, ending it early, and what came before. The engine
 * itself is in deload.js — this only decides what to show and hands
 * back the two verbs.
 */
export default function DeloadSection({ recoveryCfg = {}, today, onStart, onEnd }) {
  const state = deloadState(recoveryCfg, today)
  const history = [...(recoveryCfg.deloadHistory || [])].reverse()
  const since = daysSinceLastDeload(recoveryCfg, today)

  const [preset, setPreset] = useState('usual')
  const [days, setDays] = useState(DELOAD_DAYS)
  const [pct, setPct]   = useState(DELOAD_PCT)
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState(false)

  const chosen = preset === 'custom'
    ? { days, pct }
    : PRESETS.find(p => p.id === preset) || PRESETS[1]

  // The inputs are free text while being typed, so the guard rails live
  // here rather than in the field — clamping mid-keystroke fights the
  // person typing.
  const validDays = chosen.days >= MIN_DAYS && chosen.days <= MAX_DAYS
  const validPct  = chosen.pct  >= MIN_PCT  && chosen.pct  <= MAX_PCT
  const valid = validDays && validPct

  return (
    <>
      {state.active ? (
        /* ── Running ─────────────────────────────────────────── */
        <section className="dl-run" aria-label="الديلود شغّال">
          <span className="k-eyebrow">الديلود شغّال</span>
          <p className="dl-day">
            <span>اليوم</span> <b><Num>{state.day}</Num></b> <span>من <Num>{state.totalDays}</Num></span>
          </p>
          <Gauge value={state.day} max={state.totalDays} tone="accent" label="أيام الديلود" />
          <p className="dl-line">
            <Ar>{`أوزانك أخف ${state.pct}%. `}</Ar>
            {state.daysLeft > 0
              ? <Ar>{`باقي ${countAr(state.daysLeft, 'day')}، وينتهي ${fmtDayAr(state.until, { weekday: false })} وترجع أوزانك لحالها.`}</Ar>
              : 'اليوم آخر يوم، وبكرة ترجع أوزانك زي ما كانت.'}
          </p>
          <p className="dl-line" style={{ color: 'var(--ink-3)', fontSize: 'var(--t-label)' }}>
            التمارين والمجموعات والعدات ما تتغير، الوزن بس.
          </p>
          <Button variant="secondary" size="lg" full onClick={() => setEnding(true)}>أنهِ الديلود الآن</Button>
        </section>
      ) : (
        /* ── Idle ────────────────────────────────────────────── */
        <>
          <p className="st-lede">أسبوع أخف، وبعده ترجع أوزانك زي ما كانت. التقدّم يوقف طول الفترة عشان ما ينحسب عليك تراجع.</p>

          <CheckList header="المدة والتخفيف"
            footer={valid
              ? <p><Ar>{`يبدأ اليوم ولمدة ${chosen.days} ${dayWord(chosen.days)}. وزن 100 كجم يصير ${toWesternDigits(deloadWeight(100, chosen.pct))} كجم.`}</Ar></p>
              : <p style={{ color: 'var(--danger)' }}><Ar>{`راجع الأرقام: المدة من ${MIN_DAYS} إلى ${MAX_DAYS} أيام، والتخفيف من ${MIN_PCT}% إلى ${MAX_PCT}%.`}</Ar></p>}>
            {PRESETS.map(p => (
              <CheckRow key={p.id} title={p.label} subtitle={<Ar>{presetLine(p)}</Ar>}
                checked={preset === p.id} onClick={() => setPreset(p.id)} />
            ))}
            <CheckRow title="مخصص" subtitle="أنت تحدد المدة والنسبة"
              checked={preset === 'custom'} onClick={() => setPreset('custom')} />
          </CheckList>

          {preset === 'custom' && (
            <div className="st-fields">
              <TextField label="كم يوم؟" numeric="int" unit={dayWord(days)} value={days} invalid={!validDays}
                onChange={e => setDays(parseInt(toWesternDigits(e.target.value)) || 0)} />
              <TextField label="كم ينزل الوزن؟" numeric="int" unit="%" value={pct} invalid={!validPct}
                onChange={e => setPct(parseInt(toWesternDigits(e.target.value)) || 0)} />
            </div>
          )}

          <div className="st-actions">
            <Button variant="primary" size="lg" full disabled={!valid} onClick={() => setConfirming(true)}>
              ابدأ فترة ديلود
            </Button>
          </div>

          {since !== null && (
            <p className="st-note"><Ar>{`آخر ديلود خلص قبل ${countAr(since, 'day')}.`}</Ar></p>
          )}
        </>
      )}

      {/* ── What came before ──────────────────────────────────── */}
      {history.length > 0 && (
        <ListGroup header={<>الديلودات السابقة · <Num>{history.length}</Num></>}>
          {history.map((h, i) => (
            <ListRow key={i} leading={Drop}
              title={<Ar>{range(h.from, h.until || h.plannedUntil)}</Ar>}
              subtitle={h.endedEarly ? <Ar>{`انتهى بدري — كان لين ${fmtDayAr(h.plannedUntil, { weekday: false })}`}</Ar> : null}
              trailing={<Ar>{`أخف ${h.pct}%`}</Ar>} />
          ))}
        </ListGroup>
      )}

      {/* Starting one is a week-long commitment, so it asks once. */}
      <ConfirmSheet open={confirming} onClose={() => setConfirming(false)}
        title="تبدأ الديلود اليوم؟"
        message={<Ar>{`${chosen.days} ${dayWord(chosen.days)} وأوزانك أخف ${chosen.pct}%. تقدر تنهيه بدري متى ما بغيت.`}</Ar>}
        confirmLabel="أكيد، ابدأ الحين"
        onConfirm={() => { onStart?.({ days: chosen.days, pct: chosen.pct }); setConfirming(false) }} />

      <ConfirmSheet open={ending} onClose={() => setEnding(false)}
        title="تنهي الديلود الحين؟"
        message="ترجع أوزانك زي ما كانت من الجلسة الجاية، وينحفظ إنك أنهيته بدري."
        confirmLabel="أنهِ الديلود"
        onConfirm={() => { onEnd?.(); setEnding(false) }} />
    </>
  )
}
