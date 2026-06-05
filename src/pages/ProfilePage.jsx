import { useState } from 'react'
import { Card, SectionTitle, ProgressBar, RankBadge } from '../components/ui.jsx'
import { AgeIcon, WeightIcon, HeightIcon, BodyFatIcon, TargetIcon, SystemIcon } from '../components/Icons.jsx'
import {
  xpProgress, getRank, getCommitmentLevel,
  calcBMI, bmiCategory, calcAge, fmtDuration,
  sessionVolume, calcStreak,
} from '../utils.js'
import { GOALS, WEEK_DAYS_SHORT } from '../constants.js'

const ACTIVITY_LEVELS = [
  { id: 'sedentary',   label: 'قليل الحركة',   mult: 1.2,   desc: 'مكتب / لا رياضة' },
  { id: 'light',       label: 'خفيف',           mult: 1.375, desc: '1-3 أيام/أسبوع' },
  { id: 'moderate',    label: 'متوسط',          mult: 1.55,  desc: '3-5 أيام/أسبوع' },
  { id: 'active',      label: 'نشيط',           mult: 1.725, desc: '6-7 أيام/أسبوع' },
]

const PROTEIN_FACTORS = {
  muscle: 2.0, fat_loss: 2.2, strength: 1.8,
  endurance: 1.6, recomp: 2.2, maintain: 1.6,
}

const CALORIE_ADJUST = {
  muscle: 350, fat_loss: -400, strength: 200,
  endurance: 150, recomp: 0, maintain: 0,
}

const TRAINING_SYSTEMS = [
  { id: 'ppl',        label: 'PPL',               desc: 'Push / Pull / Legs' },
  { id: 'upper-lower',label: 'Upper-Lower',        desc: 'أعلى / أسفل الجسم' },
  { id: 'full-body',  label: 'Full Body',          desc: 'الجسم كامل' },
  { id: 'bro-split',  label: 'Bro Split',          desc: 'تقسيم كلاسيكي' },
  { id: 'custom',     label: 'مخصص',               desc: 'حسب الجدول الشخصي' },
]

export default function ProfilePage({ profile, sessions, xp, streak, level, onUpdateProfile, onGoToPhotos }) {
  const [editField,  setEditField]  = useState(null)
  const [editValue,  setEditValue]  = useState('')
  const [activity,   setActivity]   = useState('moderate')

  const { currentXP, neededXP, pct } = xpProgress(xp)
  const rank       = getRank(level)
  const commitment = getCommitmentLevel(streak)
  const age        = calcAge(profile?.birthday)
  const bmi        = calcBMI(profile?.weight, profile?.height)
  const bmiCat     = bmiCategory(bmi)
  const goal       = GOALS.find(g => g.id === profile?.goal) || GOALS[0]
  const trainingSystem = TRAINING_SYSTEMS.find(s => s.id === profile?.trainingSystem) || null

  // Weight update reminder
  const lastUpdate  = profile?.lastWeightUpdate
  const daysSince   = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate)) / 86400000) : null
  const needsUpdate = daysSince === null || daysSince > 30

  // Lifetime stats
  const totalSessions = sessions.length
  const totalVolume   = sessions.reduce((t, s) => t + sessionVolume(s), 0)
  const bestStreak    = streak

  const startEdit = (field, current) => {
    setEditField(field)
    setEditValue(current !== null && current !== undefined ? String(current) : '')
  }

  const saveEdit = () => {
    if (!editField) return
    const update = { ...profile, [editField]: editValue }
    if (editField === 'weight') update.lastWeightUpdate = new Date().toISOString()
    onUpdateProfile(update)
    setEditField(null)
  }

  const cancelEdit = () => setEditField(null)

  // BMI color
  const bmiColor = !bmi ? 'var(--text2)'
    : bmi < 18.5 ? 'var(--blue)'
    : bmi < 25   ? 'var(--green)'
    : bmi < 30   ? 'var(--orange)'
    : 'var(--red)'

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* ── Weight Update Banner ──────────────────────────────── */}
      {needsUpdate && (
        <div style={{
          background: 'var(--orange-lo)', border: '1px solid var(--orange)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, color: 'var(--orange)' }}>
              ⚠️ تذكير تحديث الوزن
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              {daysSince ? `آخر تحديث منذ ${daysSince} يوم` : 'لم تسجل وزنك بعد'}
            </div>
          </div>
          <button
            onClick={() => startEdit('weight', profile?.weight)}
            style={{
              background: 'var(--orange)', border: 'none',
              borderRadius: 8, padding: '8px 14px',
              color: '#0A0A0A', fontFamily: 'var(--font-ar)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >تحديث</button>
        </div>
      )}

      {/* ── Player Card ───────────────────────────────────────── */}
      <Card style={{ padding: 22, marginBottom: 14 }} topColor="var(--cyan)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          {/* Avatar with pulsing ring */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {/* Pulse ring */}
            <div style={{
              position: 'absolute', inset: -4,
              borderRadius: '50%',
              border: `2px solid ${rank.color}`,
              animation: 'ringExpand 2.5s ease-out infinite',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: `linear-gradient(135deg, ${rank.color}, ${rank.color}80)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 900, color: '#F0F4FF',
              boxShadow: `0 0 20px ${rank.color}40`,
            }}>
              {(profile?.name || 'H')[0]}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 900 }}>
              {profile?.name || 'حمزة'}
            </div>
            <div style={{ marginTop: 5 }}>
              <RankBadge rank={rank} />
            </div>
          </div>
        </div>

        {/* XP + Level badges */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{
            background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
            borderRadius: 20, padding: '5px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)', fontWeight: 700,
          }}>
            ⭐ {xp.toLocaleString()} XP
          </div>
          <div style={{
            background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 20, padding: '5px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: '#F59E0B', fontWeight: 700,
          }}>
            LVL {level}
          </div>
        </div>

        <ProgressBar value={currentXP} max={neededXP} color="var(--gold)" height={8} />
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
          marginTop: 6,
        }}>
          {currentXP} / {neededXP} XP للمستوى التالي
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ══ VITALS SECTION — THE MAIN FEATURE ══════════════════ */}
      {/* ════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', marginBottom: 14,
        overflow: 'hidden',
      }}>
        {/* Section header with rank color left bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: 4, height: 24, background: rank.color,
            borderRadius: 3, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-ar)', fontSize: 20, fontWeight: 800,
            color: 'var(--text)',
          }}>العلامات الحيوية</span>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          {/* 2×2 Vital Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <VitalCard
              label="العمر"
              value={age || null}
              unit="سنة"
              color="var(--cyan)"
              Icon={AgeIcon}
              onEdit={() => startEdit('birthday', profile?.birthday)}
            />
            <VitalCard
              label="الوزن"
              value={profile?.weight || null}
              unit="كغ"
              color="var(--gold)"
              Icon={WeightIcon}
              onEdit={() => startEdit('weight', profile?.weight)}
            />
            <VitalCard
              label="الطول"
              value={profile?.height || null}
              unit="سم"
              color="var(--green)"
              Icon={HeightIcon}
              onEdit={() => startEdit('height', profile?.height)}
            />
            <VitalCard
              label="دهون الجسم"
              value={profile?.bodyFat || null}
              unit="%"
              color="var(--orange)"
              Icon={BodyFatIcon}
              onEdit={() => startEdit('bodyFat', profile?.bodyFat)}
            />
          </div>

          {/* BMI — full-width prominent card */}
          <div style={{
            background: 'var(--bg2)',
            border: `2px solid ${bmiColor}40`,
            borderRadius: 14,
            padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>
                مؤشر كتلة الجسم (BMI)
              </div>
              <div style={{
                fontFamily: 'var(--font-ar)', fontSize: 18, fontWeight: 800,
                color: bmiColor,
              }}>
                {bmi > 0 ? bmiCat : 'أدخل الوزن والطول'}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 900,
              color: bmiColor, lineHeight: 1,
            }}>
              {bmi > 0 ? bmi : '—'}
            </div>
          </div>

          {/* Goal row */}
          <div
            onClick={() => startEdit('goal', profile?.goal)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 14, padding: '16px',
              cursor: 'pointer', marginBottom: 10,
              transition: 'border-color 0.15s', textAlign: 'center',
            }}
          >
            {goal.img
              ? <img src={goal.img} alt={goal.label} style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }} />
              : <TargetIcon size={66} color="var(--purple)" />
            }
            <div style={{ width: '100%' }}>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>الهدف</div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700 }}>
                {goal.label}
              </div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--cyan)', marginTop: 4 }}>اضغط للتغيير</div>
            </div>
          </div>

          {/* Training System row */}
          <div
            onClick={() => startEdit('trainingSystem', profile?.trainingSystem)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 14, padding: '14px 16px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <SystemIcon size={22} color="var(--blue)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>نظام التمرين</div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700 }}>
                {trainingSystem ? trainingSystem.label : (
                  <span style={{ color: 'var(--text3)', fontWeight: 400 }}>اضغط للاختيار</span>
                )}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--cyan)' }}>تغيير</div>
          </div>
        </div>
      </div>
      {/* ════════════════════════════════════════════════════════ */}

      {/* ── Training Schedule ─────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <SectionTitle>جدول التدريب</SectionTitle>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', marginBottom: 12 }}>
          {WEEK_DAYS_SHORT.map((day, idx) => {
            const isTraining = (profile?.trainingDays || []).includes(idx)
            return (
              <div key={idx} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: isTraining ? 'var(--cyan-lo)' : 'var(--bg3)',
                  border: `2px solid ${isTraining ? 'var(--cyan)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                  color: isTraining ? 'var(--cyan)' : 'var(--text3)',
                  boxShadow: isTraining ? '0 0 8px var(--cyan-glow)' : 'none',
                }}>
                  {isTraining ? '⚔️' : day}
                </div>
              </div>
            )
          })}
        </div>
        {profile?.workoutTime && (
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
            وقت التدريب المفضل: {profile.workoutTime}
          </div>
        )}
      </Card>

      {/* ── Lifetime Stats ────────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <SectionTitle>إحصائيات كاملة</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatBox label="إجمالي الجلسات" value={totalSessions} color="var(--cyan)" />
          <StatBox label="الحجم (طن)" value={`${(totalVolume / 1000).toFixed(1)}`} color="var(--gold)" />
          <StatBox label="أفضل streak" value={`${bestStreak} 🔥`} color="var(--orange)" />
          <StatBox label="إجمالي XP" value={xp.toLocaleString()} color="var(--purple)" />
        </div>
      </Card>

      {/* ── Photo Progress ────────────────────────────────────── */}
      {onGoToPhotos && (
        <button
          onClick={onGoToPhotos}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            background: 'var(--bg1)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px 20px',
            cursor: 'pointer', marginBottom: 14, transition: 'border-color 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <div style={{ fontSize: 28 }}>📸</div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700 }}>صور التقدم</div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              صوّر يومياً وقارن قبل وبعد
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--cyan)' }}>←</div>
        </button>
      )}

      {/* ── Protein Calculator ───────────────────────────────── */}
      <ProteinCalc profile={profile} activity={activity} setActivity={setActivity} />

      {/* ── Edit Modal ────────────────────────────────────────── */}
      {editField && (
        <EditModal
          field={editField}
          value={editValue}
          onChange={setEditValue}
          onSave={saveEdit}
          onCancel={cancelEdit}
          profile={profile}
        />
      )}
    </div>
  )
}

// ── Protein Calculator ────────────────────────────────────────
function ProteinCalc({ profile, activity, setActivity }) {
  const weight = parseFloat(profile?.weight) || null
  const height = parseFloat(profile?.height) || null
  const age    = calcAge(profile?.birthday)  || null
  const goal   = profile?.goal || 'muscle'

  const protein = weight ? Math.round(weight * (PROTEIN_FACTORS[goal] || 2.0)) : null

  let calories = null, fatG = null, carbG = null
  if (weight && height && age) {
    const bmr   = 88.36 + 13.4 * weight + 4.8 * height - 5.7 * age
    const mult  = ACTIVITY_LEVELS.find(a => a.id === activity)?.mult || 1.55
    const tdee  = bmr * mult
    calories    = Math.round(tdee + (CALORIE_ADJUST[goal] || 0))
    const protCals = (protein || 0) * 4
    const fatCals  = Math.round(calories * 0.27)
    fatG           = Math.round(fatCals / 9)
    carbG          = Math.round((calories - protCals - fatCals) / 4)
  }

  const missing = !weight || !height || !age

  return (
    <Card style={{ padding: 20, marginBottom: 14 }} topColor="var(--cyan)">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 24 }}>🥩</div>
        <div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, fontWeight: 800 }}>
            حاسبة البروتين
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
            احتياجاتك اليومية حسب هدفك
          </div>
        </div>
      </div>

      {missing ? (
        <div style={{
          background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px',
          fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)',
          textAlign: 'center',
        }}>
          أدخل وزنك وطولك وتاريخ ميلادك من العلامات الحيوية لحساب احتياجاتك
        </div>
      ) : (
        <>
          {/* Activity selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
              مستوى النشاط
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ACTIVITY_LEVELS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setActivity(a.id)}
                  style={{
                    background: activity === a.id ? 'var(--cyan-lo)' : 'var(--bg2)',
                    border: `1px solid ${activity === a.id ? 'var(--cyan)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700,
                    color: activity === a.id ? 'var(--cyan)' : 'var(--text2)' }}>
                    {a.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)' }}>
                    {a.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main protein stat */}
          <div style={{
            background: 'linear-gradient(135deg, var(--cyan-lo), var(--bg2))',
            border: '1px solid var(--cyan-md)',
            borderRadius: 14, padding: '18px 20px', marginBottom: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>
                البروتين اليومي
              </div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
                {(PROTEIN_FACTORS[goal] || 2.0)}g × {weight}كغ
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 900, color: 'var(--cyan)', lineHeight: 1 }}>
                {protein}
              </div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
                جرام / يوم
              </div>
            </div>
          </div>

          {/* Calories + macros */}
          {calories && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <MacroBox label="سعرات" value={calories} unit="kcal" color="var(--gold)" />
              <MacroBox label="دهون" value={fatG} unit="g" color="var(--orange)" />
              <MacroBox label="كارب" value={carbG} unit="g" color="var(--green)" />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function MacroBox({ label, value, unit, color }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${color}30`,
      borderTop: `3px solid ${color}`,
      borderRadius: 12, padding: '12px 10px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
        {unit}
      </div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
        {label}
      </div>
    </div>
  )
}

// ── Vital Card ────────────────────────────────────────────────
function VitalCard({ label, value, unit, color, Icon, onEdit }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid var(--border)`,
      borderTop: `3px solid ${color}`,
      borderRadius: 14,
      padding: '16px 14px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'transform 0.15s',
    }}
    onClick={onEdit}
    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {/* Icon + edit pencil row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <Icon size={22} color={color} />
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          borderRadius: 7, padding: '3px 6px',
          color: 'var(--text3)', fontSize: 13, lineHeight: 1,
        }}>✏️</div>
      </div>

      {/* Value */}
      {hasValue ? (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 900,
          color, lineHeight: 1, marginBottom: 4,
        }}>
          {value}
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text3)', marginRight: 4 }}>
            {unit}
          </span>
        </div>
      ) : (
        <div style={{
          fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text3)',
          lineHeight: 1, marginBottom: 4, marginTop: 4,
        }}>
          اضغط للإضافة
        </div>
      )}

      {/* Label */}
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>
        {label}
      </div>
    </div>
  )
}

// ── Stat Box ──────────────────────────────────────────────────
function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 14px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 24,
        fontWeight: 800, color, marginBottom: 6,
      }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)' }}>{label}</div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ field, value, onChange, onSave, onCancel, profile }) {
  const FIELD_LABELS = {
    name:           'الاسم',
    birthday:       'تاريخ الميلاد',
    height:         'الطول (سم)',
    weight:         'الوزن (كجم)',
    bodyFat:        'نسبة الدهون (%)',
    goal:           'الهدف',
    trainingSystem: 'نظام التمرين',
  }

  const FIELD_TYPES = {
    name:           'text',
    birthday:       'date',
    height:         'number',
    weight:         'number',
    bodyFat:        'number',
    goal:           'select',
    trainingSystem: 'select-system',
  }

  const label    = FIELD_LABELS[field] || field
  const type     = FIELD_TYPES[field]  || 'text'

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="scale-enter"
        style={{
          background: 'var(--bg1)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
        }}
      >
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, fontWeight: 800, marginBottom: 18 }}>
          تعديل {label}
        </div>

        {type === 'select' ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg3)',
              border: '1px solid var(--border2)', borderRadius: 10,
              padding: '12px 14px', color: 'var(--text)',
              fontFamily: 'var(--font-ar)', fontSize: 15, outline: 'none',
              marginBottom: 18, cursor: 'pointer',
            }}
          >
            {GOALS.map(g => (
              <option key={g.id} value={g.id}>{g.icon} {g.label}</option>
            ))}
          </select>
        ) : type === 'select-system' ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg3)',
              border: '1px solid var(--border2)', borderRadius: 10,
              padding: '12px 14px', color: 'var(--text)',
              fontFamily: 'var(--font-ar)', fontSize: 15, outline: 'none',
              marginBottom: 18, cursor: 'pointer',
            }}
          >
            {TRAINING_SYSTEMS.map(s => (
              <option key={s.id} value={s.id}>{s.label} — {s.desc}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            inputMode={type === 'number' ? 'decimal' : undefined}
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg3)',
              border: '1px solid var(--cyan)', borderRadius: 10,
              padding: '14px', color: 'var(--text)',
              fontFamily: type === 'text' ? 'var(--font-ar)' : 'var(--font-mono)',
              fontSize: 16, outline: 'none', marginBottom: 18,
              direction: type === 'number' || type === 'date' ? 'ltr' : 'rtl',
              textAlign: type === 'number' || type === 'date' ? 'left' : 'right',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onSave}
            className="btn-cyan"
            style={{ flex: 1, fontSize: 15 }}
          >
            حفظ
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1, background: 'var(--bg2)',
              border: '1px solid var(--border2)', borderRadius: 10,
              padding: '14px', color: 'var(--text2)',
              fontFamily: 'var(--font-ar)', fontWeight: 700,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
