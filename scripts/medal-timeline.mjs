#!/usr/bin/env node
// The summary's medals, timed: from «احفظ وأنهِ» to each landing, read
// from the app's own performance marks (src/perf.js — on with
// localStorage.meran_perf = '1', which this sets). A lifter whose best
// was 95 kg puts up 140 kg and earns two medals; the phone is 390×844.
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/medal-timeline.mjs [default|throttle|warm] [runs]
//
//   default   a first visit, no service worker
//   throttle  the same with the CPU 4× slower (a stand-in for an older phone)
//   warm      the service worker installed and the page reopened, as from
//             the home-screen icon
//
// Prints every mark (ms from the summary opening; the stage built ahead
// shows before 0) and the long tasks, then one row per run. In headless
// Chromium WebGL is SwiftShader, on the CPU: the GPU work is far slower
// than on a phone, so read it for where things happen, not how long.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { ACHIEVEMENTS, APP_VERSION } from '../src/constants.js'

const APP = process.env.APP || 'http://localhost:4173/'
const MODE = process.argv[2] || 'default'
const RUNS = Number(process.argv[3] || 3)

const DAY = (n, w) => ({
  id: 500 + n, date: new Date(2026, 8, n, 18).toISOString(), duration: 45,
  exercises: [{ id: 'm', muscle: 'Chest', name: 'Bench Press',
    sets: [{ weight: String(w), reps: '10', done: true }, { weight: String(w), reps: '10', done: true }] }],
})
const HISTORY = [DAY(2, 90), DAY(4, 95)]
const ACTIVE = {
  id: Date.now() - 5 * 60000, date: new Date().toISOString(), name: 'Push',
  exercises: [
    { id: 'a', muscle: 'Chest', name: 'Bench Press',
      sets: [{ weight: '140', reps: '5', done: true }, { weight: '140', reps: '5', done: true }] },
    { id: 'b', muscle: 'Shoulders', name: 'Machine Shoulder Press', sets: [{ weight: '40', reps: '12', done: true }] },
  ],
}
// «أول 100 كجم» and «140 كجم» still to earn
const UNLOCKED = ACHIEVEMENTS.map(a => a.id).filter(id => id !== 'b1' && id !== 'b2')

function seed([active, sessions, version, unlocked]) {
  if (sessionStorage.getItem('__seeded')) return
  sessionStorage.setItem('__seeded', '1')
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v))
  localStorage.setItem('meran_perf', '1')
  set('hf_unlocked', unlocked); set('hf_profile', { name: 'حمزة' }); set('hf_pack_prompted', true)
  set('hf_seen_version', version); set('hf_onboarded', true); set('hf_weights_reset_v2', true)
  set('hf_active', active); set('hf_sessions', sessions)
}
function longTasks() {
  window.__lt = []
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true }) } catch {}
}

const browser = await chromium.launch()
const rows = []
for (let run = 0; run < RUNS; run++) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Riyadh', locale: 'ar',
    serviceWorkers: MODE === 'warm' ? 'allow' : 'block',
  })
  await ctx.route('**/*.r2.dev/**', r => r.abort())
  await ctx.addInitScript(seed, [ACTIVE, HISTORY, APP_VERSION, UNLOCKED])
  await ctx.addInitScript(longTasks)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(APP, { waitUntil: 'load' })
  if (MODE === 'warm') {
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await page.reload({ waitUntil: 'load' })
  }
  await page.locator('[data-testid="session"]').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const cdp = MODE === 'throttle' ? await ctx.newCDPSession(page) : null
  if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: 'احفظ وأنهِ' }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid="medal-reveal"]')?.dataset.state === 'landed', null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(400)
  rows.push({ run, errors, ...await page.evaluate(() => {
    const all = performance.getEntriesByType('mark').filter(m => m.name.startsWith('meran:'))
    const t0 = all.filter(m => m.name === 'meran:sum:open').pop()?.startTime ?? 0
    const r = document.querySelector('[data-testid="medal-reveal"]')
    return {
      marks: all.filter(m => m.startTime >= t0 - 15000).map(m => [m.name.slice(6), Math.round(m.startTime - t0)]),
      lt: (window.__lt || []).filter(([s, d]) => s + d >= t0 - 3000).map(([s, d]) => [Math.round(s - t0), Math.round(d)]),
      mode: r?.dataset.mode, state: r?.dataset.state,
    }
  }) })
  await ctx.close()
}
await browser.close()

for (const r of rows) {
  console.log(`\n── ${MODE} run ${r.run}: ${r.mode} · ${r.state}${r.errors.length ? ` · errors: ${r.errors.join(' | ')}` : ''}`)
  for (const [n, t] of r.marks) console.log(`  ${String(t).padStart(6)} ms  ${n}`)
  if (r.lt.length) console.log('  long tasks (start+ms):', r.lt.map(([s, d]) => `${s}+${d}`).join('  '))
}
const at = (r, ...names) => { for (const n of names) { const m = r.marks.find(x => x[0] === n); if (m) return m[1] } return '-' }
console.log(`\n${MODE}: run · beat · first drawn · first lands · second lands · drawn as`)
for (const r of rows) {
  console.log(`  ${r.run} · ${at(r, 'sum:medal-go')} · ${at(r, 'm3:frame:0', 'medal:play-flat')} · ${at(r, 'm3:land:0', 'flat:land:0')} · ${at(r, 'm3:land:1', 'flat:land:1')} · ${r.mode}`)
}
