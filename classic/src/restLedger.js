// ── Rest-reward audit ─────────────────────────────────────────
// Formats the per-day transcript that computeRecovery already produces.
// This module only presents rows; it never decides anything, so what it
// shows cannot drift from what the reward card shows.

import { REST_CREDIT_EVERY } from './recovery.js'

export const LEDGER_COLUMNS = [
  'التاريخ', 'المجدول', 'تمرّن', 'في restDays',
  'التصنيف', 'الـstreak', 'التقدم', 'كسب', 'صرف', 'الرصيد',
]

const KIND_AR = { eligible: 'مؤهل', paid: 'مدفوع', miss: 'فائت' }

/** The last `days` rows, newest last. */
export const recentLedger = (recovery, days = 20) =>
  (recovery?.ledger || []).slice(-days)

/** One row as the plain strings the table and the CLI both print. */
export const ledgerRow = (r) => [
  r.date,
  r.scheduled === 'rest' ? 'راحة' : 'تمرين',
  r.completed ? 'نعم' : 'لا',
  r.inRestDays ? 'نعم' : 'لا',
  r.pending ? 'اليوم — لم ينتهِ' : !r.inRun ? `${KIND_AR[r.kind]} (خارج السلسلة)` : KIND_AR[r.kind],
  r.inRun ? `+${r.streakDelta} → ${r.streak}` : '—',
  r.inRun ? `${r.progress}/${REST_CREDIT_EVERY}` : '—',
  r.earned ? '★ +1' : '—',
  r.spent ? '−1' : '—',
  r.inRun ? String(r.balance) : '—',
]

/** The totals the engine reports, paired with their Arabic labels. */
export const ledgerTotals = (recovery) => [
  ['consistencyStreak', recovery.consistencyStreak, 'أيام مؤهلة في السلسلة الحالية'],
  ['eligibleDays',      recovery.eligibleDays,      'نفس الرقم، بالاسم الصريح'],
  ['creditProgress',    recovery.creditProgress,    'أيام مؤهلة منذ آخر مكافأة'],
  ['daysToNextCredit',  recovery.daysToNextCredit,  'الباقي حتى المكافأة القادمة'],
  ['creditsEarned',     recovery.creditsEarned,     'مكافآت كسبتها هذه السلسلة'],
  ['creditsSpent',      recovery.creditsSpent,      'مكافآت صرفتها هذه السلسلة'],
  ['restCredits',       recovery.restCredits,       'الرصيد المتاح الآن'],
]

/** The whole audit as monospaced text — what the copy button puts on the clipboard. */
export function ledgerText(recovery, days = 20) {
  const rows = recentLedger(recovery, days)
  const table = [LEDGER_COLUMNS, ...rows.map(ledgerRow)]
  const width = LEDGER_COLUMNS.map((_, i) =>
    Math.max(...table.map(r => [...String(r[i])].length)))
  const line = (r) => r.map((c, i) => String(c).padEnd(width[i])).join('  ')

  return [
    `سجل المكافأة — آخر ${rows.length} يوم`,
    `بداية السلسلة: ${recovery.streakStart || '—'}`,
    '',
    line(LEDGER_COLUMNS),
    line(width.map(w => '─'.repeat(w))),
    ...table.slice(1).map(line),
    '',
    ...ledgerTotals(recovery).map(([k, v, d]) => `${k.padEnd(18)} ${String(v).padStart(3)}   ${d}`),
  ].join('\n')
}
