// ── Rest-ticket audit ─────────────────────────────────────────
// Formats the per-day transcript that computeRecovery already produces.
// This module only presents rows; it never decides anything, so what it
// shows cannot drift from what the ticket balance shows.

import { REST_CREDIT_EVERY } from './recovery.js'

export const LEDGER_COLUMNS = [
  'التاريخ', 'المجدول', 'تمرّن', 'يوم راحة',
  'التصنيف', 'الستريك', 'التقدم', 'كسب', 'صرف', 'الرصيد',
]

const KIND_AR = { eligible: 'محسوب', paid: 'بتذكرة', miss: 'فايت' }

/** The last `days` rows, newest last. */
export const recentLedger = (recovery, days = 20) =>
  (recovery?.ledger || []).slice(-days)

/** One row as the plain strings the table and the CLI both print. */
export const ledgerRow = (r) => [
  r.date,
  r.scheduled === 'rest' ? 'راحة' : 'تمرين',
  r.completed ? 'نعم' : 'لا',
  r.inRestDays ? 'نعم' : 'لا',
  r.pending ? 'اليوم — ما خلص' : !r.inRun ? `${KIND_AR[r.kind]} (خارج الستريك)` : KIND_AR[r.kind],
  r.inRun ? `+${r.streakDelta} → ${r.streak}` : '—',
  r.inRun ? `${r.progress}/${REST_CREDIT_EVERY}` : '—',
  r.earned ? '+1' : '—',
  r.spent ? '−1' : '—',
  r.inRun ? String(r.balance) : '—',
]

/** The totals the engine reports, paired with their Arabic labels. */
export const ledgerTotals = (recovery) => [
  ['consistencyStreak', recovery.consistencyStreak, 'أيام محسوبة في الستريك الحالي'],
  ['eligibleDays',      recovery.eligibleDays,      'نفس الرقم، باسمه الصريح'],
  ['creditProgress',    recovery.creditProgress,    'أيام محسوبة من آخر تذكرة'],
  ['daysToNextCredit',  recovery.daysToNextCredit,  'الباقي على التذكرة الجاية'],
  ['creditsEarned',     recovery.creditsEarned,     'تذاكر كسبتها بهذا الستريك'],
  ['creditsSpent',      recovery.creditsSpent,      'تذاكر انصرفت بهذا الستريك'],
  ['usableCredits',     recovery.usableCredits ?? recovery.restCredits, 'التذاكر المتاحة الحين، بلا حد'],
]

/** The whole audit as monospaced text — what the copy button puts on the clipboard. */
export function ledgerText(recovery, days = 20) {
  const rows = recentLedger(recovery, days)
  const table = [LEDGER_COLUMNS, ...rows.map(ledgerRow)]
  const width = LEDGER_COLUMNS.map((_, i) =>
    Math.max(...table.map(r => [...String(r[i])].length)))
  const line = (r) => r.map((c, i) => String(c).padEnd(width[i])).join('  ')

  return [
    `سجل الراحة — آخر ${rows.length} يوم`,
    `بداية الستريك: ${recovery.streakStart || '—'}`,
    '',
    line(LEDGER_COLUMNS),
    line(width.map(w => '─'.repeat(w))),
    ...table.slice(1).map(line),
    '',
    ...ledgerTotals(recovery).map(([k, v, d]) => `${k.padEnd(18)} ${String(v).padStart(3)}   ${d}`),
  ].join('\n')
}
