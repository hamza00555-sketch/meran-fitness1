#!/usr/bin/env node
// Print the rest-reward ledger for a real backup file.
//
//   node scripts/rest-ledger.mjs meran-backup-2026-08-12.json [days] [--date YYYY-MM-DD]
//
// The rows come straight out of computeRecovery, so this shows the same
// decision the app made — not a second opinion about it.

import { readFile } from 'node:fs/promises'

// The engine reads a timezone-aware "today" from the browser; on Node it
// falls back to the system clock, which is what --date overrides.
const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a))
const days = Number(args.find(a => /^\d+$/.test(a))) || 20
const onDate = args.includes('--date') ? args[args.indexOf('--date') + 1] : null

if (!file) {
  console.error('usage: rest-ledger.mjs <backup.json> [days] [--date YYYY-MM-DD]')
  process.exit(1)
}

const backup = JSON.parse(await readFile(file, 'utf8'))
const sessions = backup.sessions || []
const cfg = backup.recovery || backup.recoveryCfg || null

if (!cfg) {
  console.error(
    'هذا الملف لا يحتوي على إعدادات الراحة (`recovery`).\n' +
    'صدّر البيانات مرة أخرى بعد تحديث التطبيق — النسخ القديمة (version 2.0)\n' +
    'لم تكن تحفظ restDays ولا نمط الأيام، ولا يمكن بناء السجل بدونها.',
  )
  process.exit(2)
}

const { computeRecovery } = await import('../src/recovery.js')
const { ledgerText } = await import('../src/restLedger.js')

const today = onDate || new Date().toISOString().slice(0, 10)
const recovery = computeRecovery(sessions, cfg, today)

console.log(`الملف: ${file}`)
console.log(`تاريخ التصدير: ${backup.exportDate || '—'}   ·   يُحسب ليوم: ${today}`)
console.log(`عدد الجلسات: ${sessions.length}   ·   restDays المسجلة: ${(cfg.restDays || []).length}`)
console.log(`النمط: ${cfg.daysPerWeek} أيام/أسبوع   ·   streakResetAt: ${cfg.streakResetAt || '—'}`)
console.log()
console.log(ledgerText(recovery, days))
