// ── Rest-ticket audit ─────────────────────────────────────────
// Formats the per-day transcript that computeRecovery already produces.
// This module only presents rows; it never decides anything, so what it
// shows cannot drift from what the ticket balance shows.

import { restRulesOn } from './recovery.js'

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
  // out of the rule on that day: /5 until 20 Oct 2026, /3 from 21 Oct
  r.inRun ? `${r.progress}/${restRulesOn(r.date).every}` : '—',
  r.earned ? `+${r.earned}` : '—',
  // the morning the cap of 5 came in and trimmed a balance above it
  [r.spent ? '−1' : '', r.trimmed ? `−${r.trimmed} (الحد)` : ''].filter(Boolean).join(' ') || '—',
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
  ['usableCredits',     recovery.usableCredits ?? recovery.restCredits,
    recovery.creditCap != null ? `التذاكر المتاحة الحين (الحد ${recovery.creditCap})` : 'التذاكر المتاحة الحين، بلا حد'],
  ...(recovery.creditsTrimmed ? [['creditsTrimmed', recovery.creditsTrimmed, 'انشالت يوم بدأ الحد']] : []),
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
