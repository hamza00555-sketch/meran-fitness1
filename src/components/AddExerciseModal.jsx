import { useState } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import { Card, Btn, CloseBtn, Select, Overlay, Badge } from './ui.jsx'

export default function AddExerciseModal({ onAdd, onClose }) {
  const muscles = Object.keys(MUSCLE_GROUPS)
  const [muscle, setMuscle] = useState('Chest')
  const [selectedEx, setSelectedEx] = useState(null)
  const [customName, setCustomName] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [numSets, setNumSets] = useState(3)

  const group = MUSCLE_GROUPS[muscle]
  const finalName = isCustom ? customName : selectedEx?.name
  const finalEmoji = isCustom ? '🏋️' : selectedEx?.emoji

  const handleAdd = () => {
    if (!finalName?.trim()) return
    onAdd({ muscle, name: finalName.trim(), emoji: finalEmoji, numSets })
    onClose()
  }

  return (
    <Overlay onClose={onClose} align="bottom">
      <Card style={{ padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>➕ إضافة تمرين</div>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Muscle group tabs */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              المجموعة العضلية
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {muscles.map(m => {
                const g = MUSCLE_GROUPS[m]
                const active = muscle === m
                return (
                  <button
                    key={m}
                    onClick={() => { setMuscle(m); setSelectedEx(null); setIsCustom(false) }}
                    style={{
                      background: active ? g.color + '20' : 'var(--bg3)',
                      border: `1px solid ${active ? g.color : 'var(--border)'}`,
                      borderRadius: 20, padding: '6px 13px',
                      color: active ? g.color : 'var(--text3)',
                      fontSize: 12, fontFamily: 'var(--font-ar)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >{g.emoji} {m}</button>
                )
              })}
            </div>
          </div>

          {/* Exercises grid */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              اختر تمرين
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {group.exercises.map(ex => {
                const active = !isCustom && selectedEx?.name === ex.name
                return (
                  <button
                    key={ex.name}
                    onClick={() => { setSelectedEx(ex); setIsCustom(false) }}
                    style={{
                      background: active ? group.color + '18' : 'var(--bg)',
                      border: `1px solid ${active ? group.color : 'var(--border)'}`,
                      borderRadius: 10, padding: '10px 12px',
                      color: active ? group.color : 'var(--text2)',
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      cursor: 'pointer', textAlign: 'right',
                      transition: 'all 0.15s',
                    }}
                  >{ex.emoji} {ex.name}</button>
                )
              })}

              {/* Custom */}
              <button
                onClick={() => { setIsCustom(true); setSelectedEx(null) }}
                style={{
                  background: isCustom ? '#A855F720' : 'var(--bg)',
                  border: `1px solid ${isCustom ? '#A855F7' : 'var(--border)'}`,
                  borderRadius: 10, padding: '10px 12px',
                  color: isCustom ? '#A855F7' : 'var(--text3)',
                  fontFamily: 'var(--font-ar)', fontSize: 12,
                  cursor: 'pointer', textAlign: 'right',
                }}
              >✏️ تمرين مخصص</button>
            </div>

            {isCustom && (
              <input
                autoFocus
                placeholder="اسم التمرين (بالإنجليزي)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                style={{
                  marginTop: 10, width: '100%',
                  background: 'var(--bg)', border: '1px solid var(--orange)',
                  borderRadius: 8, padding: '10px 12px',
                  color: 'var(--text)', fontFamily: 'var(--font-mono)',
                  fontSize: 13, outline: 'none',
                }}
              />
            )}
          </div>

          {/* Number of sets */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              عدد السيتات
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNumSets(n)}
                  style={{
                    background: numSets === n ? 'var(--orange-lo)' : 'var(--bg)',
                    border: `1px solid ${numSets === n ? 'var(--orange)' : 'var(--border)'}`,
                    borderRadius: 8, width: 48, height: 40,
                    color: numSets === n ? 'var(--orange)' : 'var(--text3)',
                    fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <Btn
            onClick={handleAdd}
            disabled={!finalName?.trim()}
            full
            style={{ fontSize: 15, padding: 14 }}
          >
            {finalName ? `➕ إضافة: ${finalEmoji} ${finalName}` : 'اختر تمرين أولاً'}
          </Btn>
        </div>
      </Card>
    </Overlay>
  )
}
