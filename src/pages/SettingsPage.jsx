import { useState } from 'react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { TrashIcon, ExportIcon } from '../components/Icons.jsx'
import { WEEK_DAYS_SHORT, GYM_TYPES } from '../constants.js'

const WORKOUT_TIMES = ['الصباح', 'الظهيرة', 'المساء', 'الليل']

export default function SettingsPage({ profile, onUpdateProfile, onClose, sessions, xp, unlockedAchievements }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name || 'حمزة')

  const update = (key, val) => {
    onUpdateProfile({ ...profile, [key]: val })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const toggleTrainingDay = (day) => {
    const days = [...(profile?.trainingDays || [])]
    const idx = days.indexOf(day)
    if (idx > -1) days.splice(idx, 1)
    else days.push(day)
    update('trainingDays', days.sort((a, b) => a - b))
  }

  const handleExport = () => {
    const data = {
      profile,
      sessions,
      xp,
      unlockedAchievements,
      exportDate: new Date().toISOString(),
      version: '1.0',
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hamzafit-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    ['hf_sessions','hf_xp','hf_active','hf_profile','hf_unlocked','hf_challenges'].forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)',
      overflowY: 'auto',
      paddingBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg1)',
        borderBottom: '1px solid var(--border)',
        padding: 'calc(var(--safe-top) + 14px) 18px 14px',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button onClick={onClose} style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 8, width: 36, height: 36,
          color: 'var(--text2)', cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 20, fontWeight: 800 }}>الإعدادات</div>
        {saved && (
          <div style={{
            marginRight: 'auto',
            fontFamily: 'var(--font-ar)', fontSize: 13,
            color: 'var(--green)', fontWeight: 700,
            animation: 'fadeIn 0.2s ease',
          }}>✓ محفوظ</div>
        )}
      </div>

      <div style={{ padding: '16px 14px', maxWidth: 560, margin: '0 auto' }}>

        {/* ── Player Name ─────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>الاسم</SectionTitle>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => { if (nameInput.trim()) update('name', nameInput.trim()) }}
                style={{
                  flex: 1, background: 'var(--bg3)',
                  border: '1px solid var(--border2)', borderRadius: 10,
                  padding: '12px 14px', color: 'var(--text)',
                  fontFamily: 'var(--font-ar)', fontSize: 16, outline: 'none',
                }}
              />
            </div>
          </Card>
        </div>

        {/* ── Training Days ──────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>أيام التمرين الأسبوعية</SectionTitle>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {WEEK_DAYS_SHORT.map((day, idx) => {
                const isActive = (profile?.trainingDays || []).includes(idx)
                return (
                  <button
                    key={idx}
                    onClick={() => toggleTrainingDay(idx)}
                    style={{
                      flex: 1, height: 48,
                      borderRadius: 10,
                      background: isActive ? 'var(--cyan-lo)' : 'var(--bg3)',
                      border: `2px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                      color: isActive ? 'var(--cyan)' : 'var(--text3)',
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      fontWeight: isActive ? 800 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: isActive ? '0 0 10px var(--cyan-glow)' : 'none',
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── Workout Time ───────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>وقت التمرين المفضل</SectionTitle>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WORKOUT_TIMES.map(t => {
                const isActive = profile?.workoutTime === t
                return (
                  <button
                    key={t}
                    onClick={() => update('workoutTime', t)}
                    style={{
                      flex: '1 1 calc(50% - 4px)',
                      padding: '12px 8px',
                      borderRadius: 10,
                      background: isActive ? 'var(--cyan-lo)' : 'var(--bg3)',
                      border: `2px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                      color: isActive ? 'var(--cyan)' : 'var(--text2)',
                      fontFamily: 'var(--font-ar)', fontSize: 15,
                      fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >{t}</button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── Gym Type ───────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>نوع الجيم</SectionTitle>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GYM_TYPES.map(g => {
                const isActive = profile?.gymType === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => update('gymType', g.id)}
                    style={{
                      flex: '1 1 calc(50% - 4px)',
                      padding: '12px 8px',
                      borderRadius: 10,
                      background: isActive ? 'var(--cyan-lo)' : 'var(--bg3)',
                      border: `2px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                      color: isActive ? 'var(--cyan)' : 'var(--text2)',
                      fontFamily: 'var(--font-ar)', fontSize: 15,
                      fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >{g.icon} {g.label}</button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── Data Management ─────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>إدارة البيانات</SectionTitle>
          <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 12, padding: '14px 16px',
                color: 'var(--text)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                textAlign: 'right',
              }}
            >
              <ExportIcon size={20} color="var(--green)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>تصدير البيانات</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  حفظ كل بياناتك كملف JSON
                </div>
              </div>
            </button>

            <button
              onClick={() => setConfirmReset(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--red-lo)', border: '1px solid var(--red-md)',
                borderRadius: 12, padding: '14px 16px',
                color: 'var(--red)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                textAlign: 'right',
              }}
            >
              <TrashIcon size={20} color="var(--red)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>مسح كل البيانات</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  حذف كل الجلسات والإنجازات والـ XP
                </div>
              </div>
            </button>
          </Card>
        </div>

        {/* ── App Info ───────────────────────────────────────── */}
        <div style={{
          textAlign: 'center', padding: '20px 0',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text3)',
        }}>
          HamzaFit v1.0 · Solo Leveling × Gym
        </div>
      </div>

      {/* Confirm Reset Dialog */}
      {confirmReset && (
        <div
          onClick={() => setConfirmReset(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="scale-enter"
            style={{
              background: 'var(--bg1)', border: '1px solid var(--red)',
              borderRadius: 16, padding: 24, width: '100%', maxWidth: 360,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              مسح كل البيانات؟
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text3)', marginBottom: 24 }}>
              سيتم حذف كل الجلسات والإنجازات والـ XP. هذا الإجراء لا يمكن التراجع عنه.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleReset}
                style={{
                  flex: 1, padding: '14px',
                  background: 'var(--red)', border: 'none',
                  borderRadius: 10, color: 'white',
                  fontFamily: 'var(--font-ar)', fontWeight: 800,
                  fontSize: 15, cursor: 'pointer',
                }}
              >مسح الكل</button>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  flex: 1, padding: '14px',
                  background: 'var(--bg2)', border: '1px solid var(--border2)',
                  borderRadius: 10, color: 'var(--text2)',
                  fontFamily: 'var(--font-ar)', fontWeight: 700,
                  fontSize: 15, cursor: 'pointer',
                }}
              >إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
