import { useState } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import { Card, Overlay, CloseBtn } from './ui.jsx'

export default function AddExerciseModal({ onAdd, onClose }) {
  const muscles = Object.keys(MUSCLE_GROUPS)
  const [muscle, setMuscle]       = useState('Chest')
  const [selectedEx, setSelectedEx] = useState(null)
  const [customName, setCustomName] = useState('')
  const [isCustom, setIsCustom]   = useState(false)
  const [numSets, setNumSets]     = useState(3)

  const group     = MUSCLE_GROUPS[muscle]
  const finalName = isCustom ? customName : selectedEx?.name
  const canAdd    = Boolean(finalName?.trim())

  const handleAdd = () => {
    if (!canAdd) return
    onAdd({ muscle, name: finalName.trim(), numSets })
    onClose()
  }

  return (
    <Overlay onClose={onClose} align="bottom">
      <Card style={{ padding: 0, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>➕ إضافة تمرين</div>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Muscle group tabs - horizontal scroll */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              المجموعة العضلية
            </div>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
              {muscles.map(m => {
                const g = MUSCLE_GROUPS[m]
                const isActive = muscle === m
                return (
                  <button
                    key={m}
                    onClick={() => { setMuscle(m); setSelectedEx(null); setIsCustom(false) }}
                    style={{
                      background: isActive ? g.color + '20' : 'var(--bg3)',
                      border: `1px solid ${isActive ? g.color : 'var(--border)'}`,
                      borderRadius: 20, padding: '6px 14px',
                      color: isActive ? g.color : 'var(--text3)',
                      fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-ar)',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                  >{g.emoji} {g.label}</button>
                )
              })}
            </div>
          </div>

          {/* Exercise list */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              اختر تمريناً
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {group.exercises.map(ex => {
                const isActive = !isCustom && selectedEx?.name === ex.name
                return (
                  <button
                    key={ex.name}
                    onClick={() => { setSelectedEx(ex); setIsCustom(false) }}
                    style={{
                      background: isActive ? group.color + '18' : 'var(--bg3)',
                      border: `1px solid ${isActive ? group.color : 'var(--border)'}`,
                      borderRadius: 10, padding: '10px 12px',
                      color: isActive ? group.color : 'var(--text2)',
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      cursor: 'pointer', textAlign: 'right',
                      transition: 'all 0.15s',
                    }}
                  >{ex.name}</button>
                )
              })}

              {/* Custom exercise */}
              <button
                onClick={() => { setIsCustom(true); setSelectedEx(null) }}
                style={{
                  background: isCustom ? 'var(--purple-lo)' : 'var(--bg3)',
                  border: `1px solid ${isCustom ? 'var(--purple)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '10px 12px',
                  color: isCustom ? 'var(--purple)' : 'var(--text3)',
                  fontFamily: 'var(--font-ar)', fontSize: 12,
                  cursor: 'pointer', textAlign: 'right',
                }}
              >✏️ تمرين مخصص</button>
            </div>

            {isCustom && (
              <input
                autoFocus
                placeholder="اسم التمرين..."
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                style={{
                  marginTop: 10, width: '100%',
                  background: 'var(--bg3)', border: '1px solid var(--cyan)',
                  borderRadius: 8, padding: '10px 12px',
                  color: 'var(--text)', fontFamily: 'var(--font-ar)',
                  fontSize: 13, outline: 'none',
                }}
              />
            )}
          </div>

          {/* Number of sets */}
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              عدد السيتات
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNumSets(n)}
                  style={{
                    background: numSets === n ? 'var(--cyan-lo)' : 'var(--bg3)',
                    border: `1px solid ${numSets === n ? 'var(--cyan)' : 'var(--border)'}`,
                    borderRadius: 8, width: 50, height: 42,
                    color: numSets === n ? 'var(--cyan)' : 'var(--text3)',
                    fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="btn-cyan"
            style={{ opacity: canAdd ? 1 : 0.4, fontSize: 15 }}
          >
            {canAdd ? `➕ إضافة: ${finalName}` : 'اختر تمريناً أولاً'}
          </button>
        </div>
      </Card>
    </Overlay>
  )
}
