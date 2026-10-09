// ── Rest-ticket audit panel ───────────────────────────────────
// Shows, day by day, how the ticket balance arrived at the number on the
// home screen. Every row comes from computeRecovery's own transcript, so
// this can disagree with the balance only if the balance is wrong.
// Lives under Settings › متقدم: it is a diagnostic, not a feature.

import { useState } from 'react'
import { Button, Num } from './kit/index.jsx'
import { CaretDown, Check, Copy, Notebook } from './kit/icons.js'
import { ls } from '../utils.js'
import { LEDGER_COLUMNS, recentLedger, ledgerRow, ledgerTotals, ledgerText } from '../restLedger.js'
import '../styles/screens/settings.css'

// Columns that hold numbers or dates read left to right.
const LTR_COLS = new Set([0, 5, 6, 7, 8, 9])

export default function RestLedgerPanel({ recovery = {}, days = 20 }) {
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

  const restore = open ? ls.get('hf_history_restore_report', null) : null

  return (
    <section className="k-group">
      <div className="k-group-body">
        <button type="button" className="k-row k-row-tap rl-toggle" aria-expanded={open} aria-controls="rl-body"
          onClick={() => setOpen(o => !o)}>
          <span className="k-row-icon"><Notebook size={22} aria-hidden="true" /></span>
          <span className="k-row-main">
            <span className="k-row-title">سجل الراحة</span>
            <span className="k-row-sub">كيف وصل رصيد التذاكر لرقمه، يوم بيوم</span>
          </span>
          <CaretDown size={16} weight="bold" className="rl-toggle-caret" aria-hidden="true" />
        </button>

        {open && (
          <div className="rl-body" id="rl-body">
            {!rows.length ? (
              <p className="rl-start">ما فيه أيام كافية للحين.</p>
            ) : (
              <>
                <p className="rl-start">
                  بداية الستريك الحالي: <b><Num>{recovery.streakStart || '—'}</Num></b>
                </p>

                {/* Which sessions the history repair brought back, by date,
                    so the claim can be checked against memory rather than
                    taken on trust. */}
                {restore?.count > 0 && (
                  <p className="rl-restore" data-testid="restore-report">
                    رجّعنا <Num>{restore.count}</Num> جلسة كانت انحذفت بالغلط لأنها انحفظت بدون علامة إنجاز:
                    <Num>{restore.dates.join(' · ')}</Num>
                  </p>
                )}

                <div className="rl-scroll">
                  <table className="rl-table">
                    <thead>
                      <tr>{LEDGER_COLUMNS.map(c => <th key={c} scope="col">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.date} className={[!r.inRun && 'out', r.earned && 'earned'].filter(Boolean).join(' ') || undefined}>
                          {ledgerRow(r).map((c, i) => (
                            <td key={i} className={i === 4 && r.inRun && !r.pending ? `k-${r.kind}` : undefined}>
                              {LTR_COLS.has(i) ? <Num>{c}</Num> : c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <dl className="rl-totals">
                  {ledgerTotals(recovery).map(([key, value, desc]) => (
                    <div key={key} style={{ display: 'contents' }}>
                      <dt>{desc}</dt>
                      <dd><Num>{value ?? '—'}</Num></dd>
                    </div>
                  ))}
                </dl>

                <Button variant="secondary" full icon={copied ? Check : Copy} onClick={copy}>
                  {copied ? 'انتسخ' : 'انسخ السجل كنص'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
