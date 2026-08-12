// ── Rest-reward audit panel ───────────────────────────────────
// Shows, day by day, how the reward bar arrived at the number on the
// home screen. Every row comes from computeRecovery's own transcript, so
// this can disagree with the bar only if the bar is wrong.

import { Fragment, useState } from 'react'
import { Card } from './ui.jsx'
import { LEDGER_COLUMNS, recentLedger, ledgerRow, ledgerTotals, ledgerText } from '../restLedger.js'

const KIND_COLOR = {
  eligible: 'var(--green)',
  paid:     'var(--amber, #F59E0B)',
  miss:     'var(--red, #EF4444)',
}

const cell = {
  padding: '7px 8px',
  borderBottom: '1px solid var(--border2)',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}

export default function RestLedgerPanel({ recovery, days = 20 }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const rows = recentLedger(recovery, days)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ledgerText(recovery, days))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            background: 'transparent', border: 'none', padding: '14px 16px',
            color: 'var(--text)', cursor: 'pointer',
            fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600,
            textAlign: 'right',
          }}
        >
          <span style={{ fontSize: 20 }}>🧾</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>سجل المكافأة (تشخيص)</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              كيف وصل شريط الراحة الاختيارية إلى رقمه الحالي، يوماً بيوم
            </div>
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div style={{ padding: '0 16px 16px' }}>
            {!rows.length ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>
                لا يوجد تاريخ كافٍ بعد.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px' }}>
                  بداية السلسلة الحالية: <strong style={{ color: 'var(--text)' }}>
                    {recovery.streakStart || '—'}
                  </strong>
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{
                    borderCollapse: 'collapse', fontSize: 12,
                    fontFamily: 'var(--font-ar)', minWidth: '100%',
                  }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)', textAlign: 'right' }}>
                        {LEDGER_COLUMNS.map(c => (
                          <th key={c} style={{ ...cell, fontWeight: 600 }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const cols = ledgerRow(r)
                        return (
                          <tr
                            key={r.date}
                            style={{
                              opacity: r.inRun ? 1 : 0.45,
                              background: r.earned ? 'color-mix(in srgb, var(--green) 12%, transparent)' : 'transparent',
                            }}
                          >
                            {cols.map((c, i) => (
                              <td
                                key={i}
                                style={{
                                  ...cell,
                                  color: i === 4 ? (r.inRun ? KIND_COLOR[r.kind] : 'var(--text3)') : 'var(--text2)',
                                  fontWeight: i === 0 || i === 4 ? 600 : 400,
                                }}
                              >
                                {c}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  marginTop: 14, display: 'grid',
                  gridTemplateColumns: 'auto 1fr', gap: '6px 12px',
                  fontSize: 12, fontFamily: 'var(--font-ar)',
                }}>
                  {ledgerTotals(recovery).map(([key, value, desc]) => (
                    <Fragment key={key}>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {key} = {value}
                      </div>
                      <div style={{ color: 'var(--text3)' }}>{desc}</div>
                    </Fragment>
                  ))}
                </div>

                <button
                  onClick={copy}
                  style={{
                    marginTop: 14, width: '100%',
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    borderRadius: 10, padding: '10px 12px',
                    color: copied ? 'var(--green)' : 'var(--text)', cursor: 'pointer',
                    fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {copied ? '✓ تم النسخ' : 'نسخ السجل كنص'}
                </button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
