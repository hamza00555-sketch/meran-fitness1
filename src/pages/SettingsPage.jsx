import { useState, useRef } from 'react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { TrashIcon, ExportIcon, BellIcon } from '../components/Icons.jsx'
import { WEEK_DAYS_SHORT, GYM_TYPES, WORKOUT_TIME_HOURS, PLAN_TEMPLATE, AI_PLAN_PROMPT, BUILT_IN_PLANS } from '../constants.js'
import { requestNotifPermission, scheduleNotificationsForToday, exportAllData, importAllData, ls, uid, getUsers, saveUsers, switchUser, getCurrentUserId, deleteUserData, PER_USER_KEYS } from '../utils.js'
import { NOTIFICATION_MESSAGES } from '../constants.js'

const WORKOUT_TIMES = ['الصباح', 'الظهيرة', 'المساء', 'الليل']

export default function SettingsPage({ profile, onUpdateProfile, sessions, xp, unlockedAchievements, challengeState, photos, onImport, plan, onImportPlan, onClearPlan, exerciseMapping = {}, onImportMapping }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmWeights, setConfirmWeights] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name || '')
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return localStorage.getItem('hf_notif_enabled') === 'true' } catch { return false }
  })
  const [notifStatus, setNotifStatus] = useState(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const [users, setUsers]               = useState(getUsers)
  const [addingUser, setAddingUser]     = useState(false)
  const [newUserName, setNewUserName]   = useState('')
  const [confirmDelUser, setConfirmDelUser] = useState(null)
  const currentUserId = getCurrentUserId()
  const [importing, setImporting] = useState(false)
  const [importingPlan, setImportingPlan] = useState(false)
  const [importingMapping, setImportingMapping] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteError, setPasteError] = useState('')
  const importRef = useRef(null)
  const planImportRef = useRef(null)
  const mappingImportRef = useRef(null)
  const pasteRef = useRef(null)

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

  const handleImportMapping = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingMapping(true)
    try {
      const data = await importAllData(file)
      if (data.type === 'exercise_mapping' && data.mapping) {
        onImportMapping?.(data.mapping)
      } else {
        alert('الملف ليس خريطة تمارين — تأكد أنه ملف exercise_mapping من مران')
      }
    } catch {
      alert('فشل استيراد الملف')
    } finally {
      setImportingMapping(false)
      e.target.value = ''
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const data = await importAllData(file)
      onImport(data)
    } catch {
      alert('فشل استيراد الملف — تأكد أنه ملف MERAN صالح')
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
      let text = (pasteRef.current?.value || '').trim()
      if (!text) { setPasteError('الخانة فارغة — الصق الـ JSON أولاً'); return }

      // Strip invisible Unicode characters that break JSON.parse
      text = text.replace(/[\uFEFF\u200B\u200C\u200D\u200E\u200F\u00AD\u2060]/g, '')
      // Normalize curly/smart quotes to straight quotes (iOS/AI apps often substitute these)
      text = text.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      text = text.replace(/[\u201C\u201D\u201E\u201F]/g, '"')

      // Extract from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) text = jsonMatch[1].trim()

      // Find first { and last }
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) { setPasteError('لم يتم العثور على JSON — تأكد من النص'); return }
      text = text.slice(start, end + 1)

      const data = JSON.parse(text)
      if (data.type === 'exercise_mapping' && data.mapping) {
        onImportMapping?.(data.mapping); setPasteMode(false); if (pasteRef.current) pasteRef.current.value = ''; return
      }
      if (data.sessions !== undefined || data.xp !== undefined) {
        onImport?.(data); setPasteMode(false); if (pasteRef.current) pasteRef.current.value = ''; return
      }
      if (!data.weeklySchedule || !Array.isArray(data.weeklySchedule)) {
        setPasteError('الـ JSON لا يحتوي على weeklySchedule — تأكد من البرومت')
        return
      }
      onImportPlan(data)
      setPasteMode(false)
      if (pasteRef.current) pasteRef.current.value = ''
    } catch (err) {
      setPasteError(`خطأ في قراءة الـ JSON: ${err.message || 'تأكد من النص'}`)
    }
  }

  const handleImportPlan = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingPlan(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        let text = (ev.target.result || '').trim()
        text = text.replace(/[﻿​‌‍‎‏­⁠]/g, '')
        text = text.replace(/[‘’‚‛]/g, "'")
        text = text.replace(/[“”„‟]/g, '"')
        const data = JSON.parse(text)
        if (data.type === 'exercise_mapping' && data.mapping) {
          onImportMapping?.(data.mapping)
          return
        }
        if (data.sessions !== undefined || data.xp !== undefined) {
          onImport?.(data)
          return
        }
        if (!data.weeklySchedule || !Array.isArray(data.weeklySchedule)) {
          alert('الملف لا يحتوي على خطة صالحة — تأكد من وجود weeklySchedule')
          return
        }
        onImportPlan(data)
      } catch (err) {
        alert(`خطأ في قراءة الملف: ${err.message || 'تأكد من الملف'}`)
      } finally {
        setImportingPlan(false)
        e.target.value = ''
      }
    }
    reader.onerror = () => {
      alert('فشل قراءة الملف')
      setImportingPlan(false)
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleClipboardPaste = async () => {
    setPasteError('')
    try {
      const raw = await navigator.clipboard.readText()
      if (!raw || !raw.trim()) { setPasteError('الحافظة فارغة — انسخ الـ JSON أولاً'); setPasteMode(true); return }
      if (pasteRef.current) pasteRef.current.value = raw
      // Reuse same parsing logic
      let text = raw.trim()
      text = text.replace(/[﻿​‌‍‎‏­⁠]/g, '')
      text = text.replace(/[''‚‛]/g, "'")
      text = text.replace(/[""„‟]/g, '"')
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) text = jsonMatch[1].trim()
      const start = text.indexOf('{'); const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) { setPasteError('لم يتم العثور على JSON — تأكد من النص'); setPasteMode(true); return }
      text = text.slice(start, end + 1)
      const data = JSON.parse(text)
      if (data.type === 'exercise_mapping' && data.mapping) {
        onImportMapping?.(data.mapping); return
      }
      if (data.sessions !== undefined || data.xp !== undefined) {
        onImport?.(data); return
      }
      if (!data.weeklySchedule || !Array.isArray(data.weeklySchedule)) {
        setPasteError('الـ JSON لا يحتوي على weeklySchedule'); setPasteMode(true); return
      }
      onImportPlan(data)
    } catch (err) {
      // If clipboard permission denied or API unsupported, fall back to manual paste
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setPasteMode(true)
      } else {
        setPasteError(`خطأ: ${err.message || 'تأكد من النص'}`)
        setPasteMode(true)
      }
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

  const handleResetWeights = () => {
    ls.remove('hf_last_weights')
    ls.remove('hf_weight_backups')
    ls.set('hf_weights_reset_at', Date.now())
    window.location.reload()
  }

  const handleReset = () => {
    // ls.remove is user-namespaced — clears only the active user's data
    PER_USER_KEYS.forEach(k => ls.remove(k))
    window.location.reload()
  }

  const handleSwitchUser = (id) => {
    if (id === currentUserId) return
    switchUser(id)
    window.location.reload()
  }

  const handleAddUser = () => {
    const name = newUserName.trim()
    if (!name) return
    const u = { id: uid(), name }
    saveUsers([...users, u])
    switchUser(u.id)
    window.location.reload()
  }

  const handleDeleteUser = (id) => {
    if (id === currentUserId) return
    deleteUserData(id)
    const next = users.filter(u => u.id !== id)
    saveUsers(next)
    setUsers(next)
    setConfirmDelUser(null)
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

        {/* ── Users ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>المستخدمون</SectionTitle>
          <Card style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, padding: '0 4px' }}>
              كل مستخدم له بياناته الخاصة المعزولة تماماً — جلسات، أوزان، XP، وخطط. بدّل بالضغط على الاسم.
            </div>
            {users.map(u => {
              const isActive = u.id === currentUserId
              const isConfirming = confirmDelUser === u.id
              return (
                <div key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <button
                    onClick={() => handleSwitchUser(u.id)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 10, textAlign: 'right',
                      background: isActive ? 'var(--cyan-lo)' : 'var(--bg3)',
                      border: `2px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                      color: isActive ? 'var(--cyan)' : 'var(--text2)',
                      fontFamily: 'var(--font-ar)', fontSize: 15,
                      fontWeight: isActive ? 800 : 500, cursor: isActive ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{isActive ? '👤' : '👥'}</span>
                    <span style={{ flex: 1 }}>{u.name}</span>
                    {isActive && <span style={{ fontSize: 11, fontWeight: 700 }}>نشط ✓</span>}
                  </button>
                  {!isActive && (
                    <button
                      onClick={() => isConfirming ? handleDeleteUser(u.id) : setConfirmDelUser(u.id)}
                      onBlur={() => setConfirmDelUser(null)}
                      style={{
                        flexShrink: 0, padding: '0 12px', borderRadius: 10,
                        background: isConfirming ? 'var(--red)' : 'var(--red-lo)',
                        border: `1px solid ${isConfirming ? 'var(--red)' : 'var(--red-md)'}`,
                        color: isConfirming ? 'white' : 'var(--red)',
                        fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >{isConfirming ? 'تأكيد؟' : '🗑'}</button>
                  )}
                </div>
              )
            })}

            {addingUser ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddUser() }}
                  placeholder="اسم المستخدم الجديد..."
                  style={{
                    flex: 1, background: 'var(--bg3)',
                    border: '1px solid var(--border2)', borderRadius: 10,
                    padding: '12px 14px', color: 'var(--text)',
                    fontFamily: 'var(--font-ar)', fontSize: 15, outline: 'none',
                    direction: 'rtl', textAlign: 'right',
                  }}
                />
                <button
                  onClick={handleAddUser}
                  style={{
                    flexShrink: 0, padding: '0 16px', borderRadius: 10,
                    background: 'var(--grad-primary)', border: 'none', color: 'white',
                    fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >إضافة</button>
                <button
                  onClick={() => { setAddingUser(false); setNewUserName('') }}
                  style={{
                    flexShrink: 0, padding: '0 12px', borderRadius: 10,
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    color: 'var(--text3)', fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
                  }}
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingUser(true)}
                style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'var(--bg3)', border: '1px dashed var(--border2)',
                  color: 'var(--cyan)', fontFamily: 'var(--font-ar)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                }}
              >+ إضافة مستخدم جديد</button>
            )}
          </Card>
        </div>

        {/* ── Player Name ─────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>الاسم</SectionTitle>
          <Card style={{ padding: 5 }}>
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
          <Card style={{ padding: 5 }}>
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
          <Card style={{ padding: 5 }}>
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
          <Card style={{ padding: 5 }}>
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

        {/* ── Built-in Program Library ───────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>مكتبة البرامج الجاهزة</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BUILT_IN_PLANS.map(p => {
              const isActive = plan?.planId === p.planId
              const isExpanded = expandedPlan === p.planId
              return (
                <Card key={p.planId} style={{ padding: 0, overflow: 'hidden', border: isActive ? '1px solid var(--cyan)' : undefined }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800 }}>{p.planName}</span>
                          {isActive && (
                            <span style={{
                              background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
                              borderRadius: 20, padding: '1px 8px',
                              fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--cyan)', fontWeight: 700,
                            }}>مفعّل ✓</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 8 }}>
                          {p.description}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          <span style={{
                            background: 'var(--bg3)', border: '1px solid var(--border)',
                            borderRadius: 20, padding: '2px 9px',
                            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)',
                          }}>⏱ {p.daysPerWeek} أيام/أسبوع</span>
                          <span style={{
                            background: 'var(--bg3)', border: '1px solid var(--border)',
                            borderRadius: 20, padding: '2px 9px',
                            fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text2)',
                          }}>{p.difficulty}</span>
                          {p.tags.map(t => (
                            <span key={t} style={{
                              background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
                              borderRadius: 20, padding: '2px 9px',
                              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)',
                            }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setExpandedPlan(isExpanded ? null : p.planId)}
                        style={{
                          flex: 1, padding: '9px',
                          background: 'var(--bg3)', border: '1px solid var(--border2)',
                          borderRadius: 10, color: 'var(--text2)',
                          fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer',
                        }}
                      >{isExpanded ? '▲ إخفاء' : '▼ عرض التمارين'}</button>
                      <button
                        onClick={() => {
                          onImportPlan({ ...p, startDate: new Date().toISOString().split('T')[0] })
                        }}
                        style={{
                          flex: 2, padding: '9px',
                          background: isActive ? 'var(--cyan-lo)' : 'var(--grad-primary)',
                          border: isActive ? '1px solid var(--cyan)' : 'none',
                          borderRadius: 10,
                          color: isActive ? 'var(--cyan)' : 'white',
                          fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          boxShadow: isActive ? 'none' : '0 2px 10px rgba(94,195,42,0.3)',
                        }}
                      >{isActive ? '✓ مفعّل حالياً' : '⚡ تفعيل البرنامج'}</button>
                    </div>
                  </div>

                  {/* Expanded exercise list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                      {p.weeklySchedule.map((day, di) => (
                        <div key={di} style={{ borderBottom: di < p.weeklySchedule.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{
                            padding: '8px 16px',
                            background: 'var(--bg2)',
                            fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700, color: 'var(--cyan)',
                          }}>{day.name}</div>
                          {day.exercises.map((ex, ei) => (
                            <div key={ei} style={{
                              padding: '7px 16px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              borderTop: ei > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                            }}>
                              <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text2)' }}>{ex.name}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', flexShrink: 0, marginRight: 8 }}>
                                {ex.sets} × {ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}-${ex.repsMax}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        {/* ── AI Workout Plan ────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SectionTitle>خطة التمرين الذكية</SectionTitle>
          <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {plan ? (
              <div style={{
                background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
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

            {/* Clipboard API paste — works reliably in installed PWA */}
            <button
              onClick={handleClipboardPaste}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
                borderRadius: 12, padding: '14px 16px',
                color: 'var(--cyan)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                textAlign: 'right', width: '100%',
              }}
            >
              <span style={{ fontSize: 20 }}>📋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>لصق الخطة من الحافظة</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  انسخ الـ JSON من الـ AI ثم اضغط هنا
                </div>
              </div>
            </button>

            {/* Import plan from file — most reliable on PWA/iOS */}
            <div>
              <input
                ref={planImportRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportPlan}
              />
              <button
                onClick={() => planImportRef.current?.click()}
                disabled={importingPlan}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(0,212,198,0.08)', border: '1px solid rgba(0,212,198,0.3)',
                  borderRadius: 12, padding: '14px 16px',
                  color: importingPlan ? 'var(--text3)' : 'var(--cyan)',
                  cursor: importingPlan ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                  textAlign: 'right', width: '100%',
                }}
              >
                <span style={{ fontSize: 20 }}>📂</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{importingPlan ? 'جار الاستيراد...' : 'استيراد خطة من ملف'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    احفظ JSON من الـ AI كملف ثم اختره هنا
                  </div>
                </div>
              </button>
            </div>

            {/* Paste JSON directly */}
            {pasteMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  ref={pasteRef}
                  placeholder='الصق هنا الـ JSON الذي أعطاك إياه الـ AI...'
                  rows={7}
                  onInput={() => { if (pasteError) setPasteError('') }}
                  style={{
                    width: '100%', background: 'var(--bg3)',
                    border: `1px solid ${pasteError ? 'var(--red)' : 'var(--border2)'}`,
                    borderRadius: 10, padding: '10px 12px',
                    color: 'var(--text)', fontFamily: 'monospace', fontSize: 12,
                    outline: 'none', resize: 'none', direction: 'ltr', textAlign: 'left',
                    boxSizing: 'border-box', WebkitUserSelect: 'text', userSelect: 'text',
                  }}
                />
                {pasteError && (
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
                    ⚠️ {pasteError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handlePastePlan}
                    style={{
                      flex: 1, padding: '12px',
                      background: 'var(--purple)', border: 'none',
                      borderRadius: 10, color: 'white',
                      fontFamily: 'var(--font-ar)', fontWeight: 700, fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >استيراد الخطة</button>
                  <button
                    onClick={() => { setPasteMode(false); setPasteError(''); if (pasteRef.current) pasteRef.current.value = '' }}
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
                  background: 'var(--cyan-lo)', border: '1px solid rgba(94,195,42,0.25)',
                  borderRadius: 12, padding: '14px 16px',
                  color: 'var(--cyan)', cursor: 'pointer',
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
              ref={mappingImportRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportMapping}
            />
            <button
              onClick={() => mappingImportRef.current?.click()}
              disabled={importingMapping}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 12, padding: '14px 16px',
                color: 'var(--text)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                textAlign: 'right', opacity: importingMapping ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 20 }}>🗺️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{importingMapping ? 'جاري التحديث...' : 'استيراد خريطة التمارين'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {Object.keys(exerciseMapping).length} تمرين موحد حالياً · استورد ملف exercise_mapping.json من /gym-mapping
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
              onClick={() => confirmWeights ? handleResetWeights() : setConfirmWeights(true)}
              onBlur={() => setConfirmWeights(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: confirmWeights ? 'var(--orange-lo)' : 'var(--bg3)',
                border: `1px solid ${confirmWeights ? 'var(--orange)' : 'var(--border2)'}`,
                borderRadius: 12, padding: '14px 16px',
                color: confirmWeights ? 'var(--orange)' : 'var(--text)', cursor: 'pointer',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
                textAlign: 'right',
              }}
            >
              <span style={{ fontSize: 20 }}>🔄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{confirmWeights ? 'اضغط مرة أخرى للتأكيد' : 'تصفير الأوزان المحفوظة'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  مسح الأوزان المقترحة — سجل الجلسات والإنجازات لا يتأثر
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
          MERAN v1.0 · تطبيق تتبع التمارين
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
