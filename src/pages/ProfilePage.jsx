import { useState } from 'react'
import { Chip, Gauge, Chapter, ListGroup, ListRow, Num } from '../components/kit/index.jsx'
import { Target, Barbell, Ruler, GearSix, Camera, CaretLeft, Flame, Scales, Person, CalendarBlank } from '../components/kit/icons.js'
import { ForkKnife, Percent } from '@phosphor-icons/react'
import { xpProgress, getRank, calcBMI, bmiCategory, calcAge, sessionVolume, ls } from '../utils.js'
import { GOALS } from '../constants.js'
import { countAr } from '../streak.js'
import { Ar } from './settings/parts.jsx'
import {
  EditSheet, GoalSheet, SystemSheet, MeasurementsSheet, ProteinSheet,
  BODY_MEASUREMENTS, TRAINING_SYSTEMS, proteinPlan,
} from './profile/ProfileSheets.jsx'
import '../styles/screens/profile.css'

// ── الملف ─────────────────────────────────────────────────────
//
// A pushed page (App draws the «الملف» bar and the gear). In order:
// who you are, your level, your body, your photos, your totals, and the
// rows that open the rest (critique F55). The stale-weight reminder is a
// dot in the weight cell, not a banner over the page; gold is gone — it
// belongs to «ارفع الوزن».

const hasValue = (v) => v !== null && v !== undefined && v !== ''
const STALE_DAYS = 30

export default function ProfilePage({
  profile, sessions = [], xp = 0, streak = 0, level, onUpdateProfile, onGoToPhotos, recovery,
  photos: photosProp, storedBest: storedBestProp, onOpenSettings,
}) {
  const [editField, setEditField] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [sheet, setSheet] = useState(null)   // 'goal' | 'system' | 'measure' | 'protein'
  const [activity, setActivity] = useState('moderate')

  const { currentXP, neededXP, level: lvl } = xpProgress(xp)
  const lv = level || lvl
  const rank = getRank(lv)
  const age = calcAge(profile?.birthday)
  const bmi = calcBMI(profile?.weight, profile?.height)
  const goal = GOALS.find(g => g.id === profile?.goal) || GOALS[0]
  const system = TRAINING_SYSTEMS.find(s => s.id === profile?.trainingSystem) || null
  const name = profile?.name || 'البطل'

  // Weight update reminder: missing, or older than a month.
  const lastUpdate = profile?.lastWeightUpdate
  const daysSince = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate)) / 86400000) : null
  const needsUpdate = daysSince === null || daysSince > STALE_DAYS

  // Lifetime totals.
  const totalSessions = sessions.length
  const tons = sessions.reduce((t, s) => t + sessionVolume(s), 0) / 1000
  // Read once, not on every render: the photos are data URLs and can run
  // to megabytes. App passes both when wired; storage is the fallback.
  const [stored] = useState(() => ({
    best: storedBestProp === undefined ? ls.get('hf_streak_best', null) : null,
    photos: photosProp ? null : (ls.get('hf_photos', []) || []),
  }))
  const storedBest = storedBestProp !== undefined ? storedBestProp : stored.best
  const bestStreak = Math.max(recovery?.bestRun?.length || 0, storedBest?.value || 0, streak || 0)

  const photos = photosProp || stored.photos || []
  const shelf = [...photos].reverse().slice(0, 4)

  const measured = BODY_MEASUREMENTS.filter(m => hasValue(profile?.measurements?.[m.id])).length
  const protein = proteinPlan(profile, activity).protein

  const startEdit = (field) => { setEditField(field); setEditOpen(true) }
  const saveField = (field, value) => {
    const update = { ...profile, [field]: value }
    if (field === 'weight') update.lastWeightUpdate = new Date().toISOString()
    onUpdateProfile(update)
  }
  // From the protein sheet to a field: one sheet at a time.
  const editFromProtein = (field) => { setSheet(null); setTimeout(() => startEdit(field), 260) }

  const cell = ({ field, label, icon: Icon, value, unit, sub, dot }) => (
    <button type="button" className="pf-cell" onClick={() => startEdit(field)}
      aria-label={`${label}: ${hasValue(value) ? `${value} ${unit}` : 'أضف'}`}>
      <span className="pf-cell-label">
        <Icon size={16} weight="regular" aria-hidden="true" />{label}
        {dot && <i className="pf-dot" aria-hidden="true" />}
      </span>
      {hasValue(value) ? (
        <span className="pf-cell-value"><Num>{value}</Num><span className="pf-unit">{unit}</span></span>
      ) : (
        <span className="pf-cell-empty">—<span className="pf-add">أضف</span></span>
      )}
      {sub && <span className="pf-cell-sub">{sub}</span>}
    </button>
  )

  return (
    <div className="pf">
      {/* ── Who ── */}
      <section className="pf-id">
        <div className="pf-avatar" aria-hidden="true">{name[0]}</div>
        <div className="pf-id-text">
          <h1 className="pf-name">{name}</h1>
          <Chip><Num>{rank.tier}</Num> · {rank.label}</Chip>
        </div>
      </section>

      {/* ── Level ── */}
      <section className="pf-level" aria-label="المستوى">
        <p className="pf-level-line">
          <span>المستوى <Num>{lv}</Num></span>
          <span aria-hidden="true">·</span>
          <Num>{`${xp.toLocaleString('en-US')} XP`}</Num>
        </p>
        <Gauge value={currentXP} max={neededXP} tone="accent" label="التقدم للمستوى الجاي" />
        <p className="pf-level-left">
          باقي <Num>{`${Math.max(0, neededXP - currentXP).toLocaleString('en-US')} XP`}</Num> للمستوى <Num>{lv + 1}</Num>
        </p>
      </section>

      {/* ── Body ── */}
      <Chapter title="الجسم">
        <div className="pf-grid">
          {cell({
            field: 'weight', label: 'الوزن', icon: Scales, value: profile?.weight, unit: 'كجم',
            dot: needsUpdate,
            sub: hasValue(profile?.weight) && needsUpdate
              ? (daysSince !== null ? <Ar>{`آخر تحديث قبل ${countAr(daysSince, 'day')}`}</Ar> : 'حدّث وزنك')
              : null,
          })}
          {cell({ field: 'height', label: 'الطول', icon: Ruler, value: profile?.height, unit: 'سم' })}
          {cell({ field: 'birthday', label: 'العمر', icon: CalendarBlank, value: age || null, unit: 'سنة' })}
          {cell({ field: 'bodyFat', label: 'الدهون', icon: Percent, value: profile?.bodyFat, unit: '%' })}
        </div>
        {bmi > 0 && (
          <p className="pf-bmi">
            مؤشر كتلة الجسم <Num>{bmi}</Num> · {bmiCategory(bmi)}
          </p>
        )}
      </Chapter>

      {/* ── Photos ── */}
      {onGoToPhotos && (
        <Chapter title="صور التقدم"
          action={photos.length > 0 && (
            <button type="button" className="pf-more" onClick={onGoToPhotos}>
              الكل <Num>{photos.length}</Num>
              <CaretLeft size={16} weight="bold" aria-hidden="true" />
            </button>
          )}>
          {photos.length > 0 ? (
            <button type="button" className="pf-shelf" onClick={onGoToPhotos} aria-label="افتح صور التقدم">
              {shelf.map((p, i) => (
                <span key={p.id || i} className="pf-shot">
                  <img src={p.src} alt="" loading="lazy" />
                  {i === 3 && photos.length > 4 && <span className="pf-shot-more"><Num>{`+${photos.length - 4}`}</Num></span>}
                </span>
              ))}
            </button>
          ) : (
            <button type="button" className="pf-shelf-empty" onClick={onGoToPhotos}>
              <span className="pf-shelf-icon"><Camera size={22} aria-hidden="true" /></span>
              <span className="pf-shelf-text">
                <b>أضف أول صورة</b>
                <span>صوّر كل كم أسبوع وقارن قبل وبعد</span>
              </span>
              <CaretLeft size={16} weight="bold" className="k-row-chev" aria-hidden="true" />
            </button>
          )}
        </Chapter>
      )}

      {/* ── Totals ── */}
      <section className="pf-stats" aria-label="مجموعك">
        <div className="pf-stat"><b><Num>{totalSessions.toLocaleString('en-US')}</Num></b><span>جلسة</span></div>
        <div className="pf-stat"><b><Num>{tons > 0 ? tons.toFixed(1) : '0'}</Num></b><span>طن رفعتها</span></div>
        <div className="pf-stat">
          <b><Num>{bestStreak}</Num>{bestStreak > 0 && <Flame size={18} weight="fill" className="pf-flame" aria-hidden="true" />}</b>
          <span>أطول ستريك</span>
        </div>
      </section>

      {/* ── The rest ── */}
      <ListGroup>
        <ListRow leading={Target} title="الهدف" chevron onClick={() => setSheet('goal')}
          trailing={<span className="st-row-value">{goal.label}</span>} />
        <ListRow leading={Barbell} title="نظام التدريب" chevron onClick={() => setSheet('system')}
          trailing={<span className="st-row-value">{system ? system.label : 'اختر'}</span>} />
        <ListRow leading={Person} title="القياسات" chevron onClick={() => setSheet('measure')}
          trailing={measured ? <Ar>{`${measured} من ${BODY_MEASUREMENTS.length}`}</Ar> : 'أضف'} />
        <ListRow leading={ForkKnife} title="حاسبة البروتين" chevron onClick={() => setSheet('protein')}
          trailing={protein ? <Ar>{`${protein} جرام`}</Ar> : null} />
        {onOpenSettings && <ListRow leading={GearSix} title="الإعدادات" chevron onClick={onOpenSettings} />}
      </ListGroup>

      <EditSheet open={editOpen} field={editField} profile={profile}
        onClose={() => setEditOpen(false)} onSave={saveField} />
      <GoalSheet open={sheet === 'goal'} value={goal.id} onClose={() => setSheet(null)}
        onPick={id => onUpdateProfile({ ...profile, goal: id })} />
      <SystemSheet open={sheet === 'system'} value={profile?.trainingSystem} onClose={() => setSheet(null)}
        onPick={id => onUpdateProfile({ ...profile, trainingSystem: id })} />
      <MeasurementsSheet open={sheet === 'measure'} profile={profile} onClose={() => setSheet(null)}
        onUpdateProfile={onUpdateProfile} />
      <ProteinSheet open={sheet === 'protein'} profile={profile} activity={activity} setActivity={setActivity}
        onClose={() => setSheet(null)} onEdit={editFromProtein} />
    </div>
  )
}
