import { Card, SectionTitle } from './ui.jsx'
import { switchDesign } from '../design.js'

// ── The design switch ─────────────────────────────────────────
// On: the new design. Off: the old one. Same data either way — the two
// designs share this phone's storage. This file exists, identical, in
// src/ and classic/src/; `isNew` says which one is rendering it.

export default function DesignSwitch({ isNew }) {
  const flip = () => switchDesign(isNew ? 'classic' : 'new')
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionTitle>التصميم</SectionTitle>
      <Card style={{ padding: 12 }}>
        <button
          type="button"
          role="switch"
          aria-checked={isNew}
          onClick={flip}
          data-testid="design-switch"
          style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '4px', minHeight: 48,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              التصميم الجديد
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.6 }}>
              {isNew
                ? 'شغّال الحين. طفّه وترجع للتصميم القديم اللي متعوّد عليه — بياناتك نفسها.'
                : 'مطفّي الحين. شغّله وتنتقل للتصميم الجديد — بياناتك نفسها.'}
            </div>
          </div>
          {/* The track's end is the "on" side, so in RTL the knob sits on
              the left when on, as iOS draws it. */}
          <span aria-hidden="true" style={{
            flexShrink: 0, width: 51, height: 31, borderRadius: 999, padding: 2,
            boxSizing: 'border-box', display: 'flex',
            justifyContent: isNew ? 'flex-end' : 'flex-start',
            background: isNew ? 'var(--cyan)' : 'var(--bg3)',
            border: `1px solid ${isNew ? 'var(--cyan)' : 'var(--border2)'}`,
            transition: 'background 0.2s',
          }}>
            <span style={{ width: 25, height: 25, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }} />
          </span>
        </button>
      </Card>
    </div>
  )
}
