import { ROUTINES, MUSCLE_GROUPS } from '../constants.js'
import { Card, Btn, CloseBtn, Badge, Overlay } from './ui.jsx'

export default function RoutinesModal({ onSelect, onClose }) {
  return (
    <Overlay onClose={onClose} align="bottom">
      <Card style={{ padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>📋 روتينات جاهزة</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                اختر وابدأ مباشرة
              </div>
            </div>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        {/* Routines list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROUTINES.map(r => (
            <button
              key={r.name}
              onClick={() => { onSelect(r); onClose() }}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 16px',
                cursor: 'pointer', textAlign: 'right',
                transition: 'border-color 0.2s, background 0.2s',
                width: '100%',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = 'var(--orange)'
                e.currentTarget.style.background = 'var(--orange-lo)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg)'
              }}
            >
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {r.name}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {r.muscles.map(m => (
                  <Badge key={m} color={MUSCLE_GROUPS[m]?.color || '#555'}>
                    {MUSCLE_GROUPS[m]?.emoji} {m}
                  </Badge>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)' }}>
                {r.exercises.length} تمارين · {r.exercises.reduce((a, e) => a + (e.defaultSets || 3), 0)} sets
              </div>
            </button>
          ))}
        </div>
      </Card>
    </Overlay>
  )
}
