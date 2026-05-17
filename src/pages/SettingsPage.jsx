import { useState, useRef } from 'react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { TrashIcon, ExportIcon, BellIcon } from '../components/Icons.jsx'
import { WEEK_DAYS_SHORT, GYM_TYPES, WORKOUT_TIME_HOURS, PLAN_TEMPLATE, AI_PLAN_PROMPT } from '../constants.js'
import { requestNotifPermission, scheduleNotificationsForToday, exportAllData, importAllData } from '../utils.js'
import { NOTIFICATION_MESSAGES } from '../constants.js'

const WORKOUT_TIMES = ['الصباح', 'الظهيرة', 'المساء', 'الليل']

export default function SettingsPage({ profile, onUpdateProfile, sessions, xp, unlockedAchievements, challengeState, photos, onImport, plan, onImportPlan, onClearPlan }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name || 'حمزة')
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return localStorage.getItem('hf_notif_enabled') === 'true' } catch { return false }
  })
  const [notifStatus, setNotifStatus] = useState(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const [importing, setImporting] = useState(false)
  const [importingPlan, setImportingPlan] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const importRef = useRef(null)
  const planImportRef = useRef(null)

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
    exportAllData(sessions, xp, profile, unlockedAchievements, challengeState, photos)
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const data = await importAllData(file)
      onImport(data)
    } catch {
      alert('فشل استيراد الملف — تأكد أنه ملف HamzaFit صالح')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleToggleNotifications = async () => {
    if (notifEnabled) {
      localStorage.setItem('hf_notif_enabled', 'false')
      localStorage.removeItem('hf_notif_scheduled')
      setNotifEnabled(false)
      return
    }
    const status = await requestNotifPermission()
    setNotifStatus(status)
    if (status === 'granted') {
      localStorage.setItem('hf_notif_enabled', 'true')
      localStorage.removeItem('hf_notif_scheduled')
      setNotifEnabled(true)
      scheduleNotificationsForToday(profile?.workoutTime || 'المساء', NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS)
    }
  }

  const handlePastePlan = () => {
    setPasteError('')
    try {
      // Try to extract JSON from text (AI sometimes wraps it in markdown code blocks)
      let text = pasteText.trim()
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) text = jsonMatch[1].trim()
      // Find first { and last }
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start !== -1 && end !== -1) text = text.slice(start, end + 1)

      const data = JSON.parse(text)
      if (!data.weeklySchedule || !Array.isArray(data.weeklySchedule)) {
        setPasteError('الـ JSON لا يحتوي على weeklySchedule — تأكد من الـ prompt')
        return
      }
      onImportPlan(data)
      setPasteMode(false)
      setPasteText('')
    } catch {
      setPasteError('تعذّر قراءة الـ JSON — الصق النص كما أعطاك إياه الـ AI')
    }
  }

  const handleImportPlan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingPlan(true)
    try {
      const data = await importAllData(file)
      if (!data.weeklySchedule || !Array.isArray(data.weeklySchedule)) throw new Error()
      onImportPlan(data)
    } catch {
      alert('ملف خطة غير صالح — تأكد أنه يحتوي على weeklySchedule')
    } finally {
      setImportingPlan(false)
      e.target.value = ''
    }
  }

  const handleCopyPrompt = () => {
    const template = JSON.stringify({ ...PLAN_TEMPLATE, startDate: new Date().toISOString().split('T')[0] }, null, 2)
    const prompt = AI_PLAN_PROMPT.replace('TEMPLATE_PLACEHOLDER', template)
    navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    })
  }

  const handleReset = () => {
    ['hf_sessions','hf_xp','hf_active','hf_profile','hf_unlocked','hf_challenges','hf_photos'].forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const workoutHourDisplay = (() => {
    const h = WORKOUT_TIME_HOURS[profile?.workoutTime] ?? 17
    return `${h}:00`
  })()

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 800 }}>الإعدادات</div>
        {saved && (
          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 13,
            color: 'var(--green)', fontWeight: 700,
            animation: 'fadeIn 0.2s ease',
          }}>✓ محفوظ</div>
        )}
      </div>

      <div>

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
                  direction: 'rtl', textAlign: 'right',
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

        {/* ── AI Workout Plan ────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>خطة التمرين الذكية</SectionTitle>
          <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {plan ? (
              <div style={{
                background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.3)',
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  📋 {plan.planName}
                </div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
                  {plan.durationWeeks} أسبوع · {plan.weeklySchedule?.length} أيام/أسبوع<br/>
                  يبدأ: {plan.startDate}
                </div>
                <button
                  onClick={onClearPlan}
                  style={{
                    marginTop: 10, background: 'var(--red-lo)', border: '1px solid var(--red-md)',
                    borderRadius: 8, padding: '6px 14px', color: 'var(--red)',
                    fontFamily: 'var(--font-ar)', fontSize: 12, cursor: 'pointer',
                  }}
                >حذف الخطة</button>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
                أرسل الخطة لأي AI (ChatGPT، Claude، Gemini) واطلب منه ملء الهيكل، ثم استورده هنا.
              </div>
            )}

            <button
              onClick={handleCopyPrompt}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: promptCopied ? 'rgba(34,197,94,0.1)' : 'var(--bg3)',
                border: `1px solid ${promptCopied ? 'var(--green)' : 'var(--border2)'}`,
                borderRadius: 12, padding: '14px 16px',
                color: promptCopied ? 'var(--green)' : 'var(--text)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600, textAlign: 'right',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 20 }}>{promptCopied ? '✅' : '🤖'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{promptCopied ? 'تم النسخ!' : 'نسخ البرومت للـ AI'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  الصق في ChatGPT أو Claude مع PDF/فيديو التمرين
                </div>
              </div>
            </button>

            {/* Paste JSON directly */}
            {pasteMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setPasteError('') }}
                  placeholder='الصق هنا الـ JSON الذي أعطاك إياه الـ AI...'
                  rows={7}
                  style={{
                    width: '100%', background: 'var(--bg3)',
                    border: `1px solid ${pasteError ? 'var(--red)' : 'var(--border2)'}`,
                    borderRadius: 10, padding: '10px 12px',
                    color: 'var(--text)', fontFamily: 'monospace', fontSize: 12,
                    outline: 'none', resize: 'none', direction: 'ltr', textAlign: 'left',
                    boxSizing: 'border-box',
                  }}
                />
                {pasteError && (
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--red)' }}>
                    ⚠️ {pasteError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handlePastePlan}
                    disabled={!pasteText.trim()}
                    style={{
                      flex: 1, padding: '12px',
                      background: 'var(--purple)', border: 'none',
                      borderRadius: 10, color: 'white',
                      fontFamily: 'var(--font-ar)', fontWeight: 700, fontSize: 14,
                      cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
                      opacity: pasteText.trim() ? 1 : 0.5,
                    }}
                  >استيراد الخطة</button>
                  <button
                    onClick={() => { setPasteMode(false); setPasteText(''); setPasteError('') }}
                    style={{
                      padding: '12px 16px', background: 'var(--bg3)',
                      border: '1px solid var(--border2)', borderRadius: 10,
                      color: 'var(--text2)', fontFamily: 'var(--font-ar)', fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >إلغاء</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPasteMode(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(155,89,182,0.08)', border: '1px solid rgba(155,89,182,0.3)',
                  borderRadius: 12, padding: '14px 16px',
                  color: 'var(--purple)', cursor: 'pointer',
                  fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600, textAlign: 'right',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 20 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>لصق JSON من الـ AI</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    الصق النص الذي أعطاك إياه ChatGPT أو Claude
                  </div>
                </div>
              </button>
            )}
          </Card>
        </div>

        {/* ── Notifications ──────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>الإشعارات</SectionTitle>
          <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BellIcon size={20} color="var(--cyan)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700 }}>
                  تفعيل الإشعارات
                </div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  ٥ إشعارات يومية: تحفيز + نصائح + تذكير تمرين
                </div>
              </div>
              <button
                onClick={handleToggleNotifications}
                disabled={notifStatus === 'unsupported'}
                style={{
                  width: 52, height: 30, borderRadius: 15, border: 'none',
                  background: notifEnabled ? 'var(--cyan)' : 'var(--bg3)',
                  cursor: notifStatus === 'unsupported' ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s', position: 'relative', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: notifEnabled ? 25 : 3,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {notifEnabled && (
              <div style={{
                background: 'var(--bg3)', borderRadius: 10, padding: '10px 14px',
                fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', lineHeight: 2,
              }}>
                🌅 8:00 — رسالة صباحية<br/>
                💡 12:30 — نصيحة تمرين<br/>
                💧 15:30 — تذكير الماء<br/>
                ⚔️ {workoutHourDisplay} — وقت التمرين<br/>
                🌙 21:00 — مراجعة اليوم
              </div>
            )}

            {notifStatus === 'denied' && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 14px',
                fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--red)', lineHeight: 1.6,
              }}>
                ⚠️ الإشعارات محظورة — افتح إعدادات الجهاز وأعطِ التطبيق إذن الإشعارات.
              </div>
            )}

            {notifStatus === 'unsupported' && (
              <div style={{
                fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)',
              }}>
                متصفحك لا يدعم الإشعارات — ثبّت التطبيق على الشاشة الرئيسية أولاً.
              </div>
            )}
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
                  حفظ الجلسات والصور والإنجازات كملف JSON
                </div>
              </div>
            </button>

            <input
              ref={importRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 12, padding: '14px 16px',
                color: 'var(--text)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                textAlign: 'right', opacity: importing ? 0.6 : 1,
              }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{importing ? 'جاري الاستيراد...' : 'استيراد البيانات'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  استعادة بياناتك من ملف نسخة احتياطية
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
