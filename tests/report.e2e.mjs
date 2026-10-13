#!/usr/bin/env node
// End-to-end checks for the monthly report on a phone.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/report.e2e.mjs
//   SHOTS=/some/dir node tests/report.e2e.mjs   # also save screenshots
//
// What is worth testing through a browser rather than in Node: the
// date window as the app's own clock actually sees it, whether the
// report renders without throwing, whether what حمزة asked to remove is
// really gone from the screen, whether a gain's sign is drawn on the
// right side of its digits, whether a past month opens in place, whether
// a deload month says so in blue, whether motion is entrances only (and
// none at all under reduced motion), and whether the poster's Arabic
// survives canvas inside the Stories safe area.
//
// The poster is written as a PNG to look at: shaping cannot be asserted.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS } from '../src/constants.js'
import { buildHistory, SESSIONS, RECOVERY, DELOAD_SESSIONS, DELOAD_RECOVERY } from './report-fixtures.mjs'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-report-e2e'
const SHOTS = process.env.SHOTS || null
mkdirSync(OUT, { recursive: true })
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

const browser = await chromium.launch()

/** A page with the clock pinned to `iso` and a seeded history. */
async function open(iso, { sessions = SESSIONS, recovery = RECOVERY, reduced = false, goals = null } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', // the worker has its own suites (offline, pack-install); here it would serve past page.route
    ...devices['iPhone 13'], viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  // The art pack (served by the preview at /pack/) stays out, so every
  // run sees the same fallback art whatever the pack holds.
  await page.route(u => u.pathname.startsWith('/pack/'), r => r.abort())

  await page.addInitScript(([sessions, recovery, iso, version, goals, unlocked]) => {
    localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    // Every achievement already held, so no medal or level-up
    // celebration lands on top of the report mid-test; two of them
    // dated inside March for «كل الأرقام».
    localStorage.setItem('hf_unlocked', JSON.stringify(unlocked))
    localStorage.setItem('hf_unlocked_at', JSON.stringify({
      [unlocked[0]]: new Date(2026, 2, 5, 20).getTime(),
      [unlocked[1]]: new Date(2026, 2, 21, 20).getTime(),
    }))
    localStorage.setItem('hf_recovery', JSON.stringify(recovery))
    localStorage.setItem('hf_xp', '4200')
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
    localStorage.setItem('hf_onboarded', 'true')
    // The app stamps a weights-reset watermark on first run for anyone
    // with history, which would put the whole seeded month behind the
    // cutoff and hide every new weight.
    localStorage.setItem('hf_weights_reset_v2', 'true')
    if (goals) localStorage.setItem('hf_month_goal', JSON.stringify(goals))

    const real = Date
    const fixed = new real(iso).getTime()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = D
  }, [sessions, recovery, iso, APP_VERSION, goals, ACHIEVEMENTS.map(a => a.id)])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  return { ctx, page, errors }
}

// ══ 1. The date window ════════════════════════════════════════
// The button reports on a month that has finished: the last two days
// of it, and the first week of the one after.

const WINDOW = [
  ['2026-03-29T18:00:00+03:00', null,        'two days before the end is too early'],
  ['2026-03-30T18:00:00+03:00', 'مارس 2026', 'the second-to-last day'],
  ['2026-03-31T18:00:00+03:00', 'مارس 2026', 'the last day'],
  ['2026-04-01T18:00:00+03:00', 'مارس 2026', 'the first of the next month'],
  ['2026-04-07T18:00:00+03:00', 'مارس 2026', 'the seventh'],
  ['2026-04-08T18:00:00+03:00', null,        'the eighth is out of window'],
  ['2026-04-20T18:00:00+03:00', null,        'mid-month is out of window'],
]

for (const [iso, expect, label] of WINDOW) {
  const { ctx, page, errors } = await open(iso)
  const text = await page.evaluate(() => document.body.innerText)
  const shown = /تقرير\s+(\S+\s+\d{4})/.exec(text)?.[1] || null
  ok(`window: ${label}`, shown === expect, `expected ${expect ?? 'no button'}, got ${shown ?? 'no button'}`)
  ok(`window: ${label} — no errors`, errors.length === 0, errors.join('; '))
  await ctx.close()
}

// The turn of the year is where month arithmetic usually breaks.
{
  const shift = 90 * 86400000
  const { ctx, page } = await open('2026-01-03T18:00:00+03:00', {
    sessions: SESSIONS.filter(s => s.date >= '2026-03-01').map(s => ({
      ...s, id: s.id - shift, date: new Date(new Date(s.date).getTime() - shift).toISOString(),
    })),
  })
  const text = await page.evaluate(() => document.body.innerText)
  ok('window: 3 January reports December', /تقرير\s+ديسمبر\s+2025/.test(text), text.slice(0, 200))
  await ctx.close()
}

// A month with nothing in it must not offer a report at all.
{
  const { ctx, page } = await open('2026-04-02T18:00:00+03:00', { sessions: [] })
  const text = await page.evaluate(() => document.body.innerText)
  ok('window: an empty month offers nothing', !/تقرير\s+\S+\s+\d{4}/.test(text))
  await ctx.close()
}

// The row on Home says sessions, not kilos.
{
  const { ctx, page } = await open('2026-04-02T18:00:00+03:00')
  const row = await page.evaluate(() =>
    [...document.querySelectorAll('.k-row')].find(e => /تقرير مارس 2026/.test(e.textContent || ''))?.innerText || '')
  ok('home: the report row counts sessions, not kilos', /جلسة حضرتها/.test(row) && !/كجم/.test(row), row)
  await ctx.close()
}

// …in Arabic: «5 جلسات», «8 أوزان جديدة», as the cover it opens says it.
{
  const { ctx, page } = await open('2026-04-02T18:00:00+03:00', { sessions: SESSIONS.filter(s => s.date < '2026-03-10') })
  const row = await page.evaluate(() =>
    [...document.querySelectorAll('.k-row')].find(e => /تقرير مارس 2026/.test(e.textContent || ''))?.innerText.replace(/\s+/g, ' ') || '')
  ok('home: the row counts in Arabic (3–10 take the plural)', /\b([3-9]|10) جلسات حضرتها/.test(row) && /أوزان جديدة|وزن جديد|وزنين جداد/.test(row) && !/\b([3-9]|10) (جلسة|وزن جديد)/.test(row), row)
  await openReport(page)
  const cover = await page.evaluate(() => document.querySelector('.rp-hero-unit')?.textContent.trim())
  ok('home: the row and the cover use the same word', !!cover && row.includes(` ${cover}`), `${row} | ${cover}`)
  const labels = await page.evaluate(() => [...document.querySelectorAll('.rp-sets-row')].map(r => r.getAttribute('aria-label')))
  ok('muscles: the spoken label counts in Arabic too', labels.length > 0 && labels.every(l => !/\b([3-9]|10) مجموعة/.test(l)), labels.join(' | '))
  await ctx.close()
}

// ══ 2. The report ═════════════════════════════════════════════

const QUESTIONS = ['متى تمرّنت؟', 'صرت أقوى؟', 'وين راح شغلك؟', 'خطة أبريل', 'كل الأرقام', 'الشهور اللي فاتت']

async function openReport(page) {
  await page.getByText('تقرير مارس 2026', { exact: false }).first().dispatchEvent('click')
  // No opening sequence to skip: the cover is the first frame.
  await page.waitForTimeout(1200)
}

// Walk the whole report so every section has had its entrance.
async function scrollThrough(page) {
  const scroller = page.locator('.rp-scroll')
  for (let i = 1; i <= 10; i++) {
    await scroller.evaluate((el, i) => { el.scrollTop = el.clientHeight * i * 0.8 }, i)
    await page.waitForTimeout(300)
  }
  await scroller.evaluate(el => { el.scrollTop = 0 })
  await page.waitForTimeout(300)
}

const questions = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.rp .rp-ch')]
    .filter(c => c.getBoundingClientRect().height > 40)
    .map(c => c.querySelector('.rp-ch-q')?.textContent.trim()))

// Animations inside the report layer: [how many, how many loop].
const motion = (page) => page.evaluate(() => {
  const root = document.querySelector('.rp')
  if (!root) return [-1, -1]
  const anims = [...root.querySelectorAll('*')].map(el => getComputedStyle(el))
    .filter(cs => cs.animationName && cs.animationName !== 'none')
  return [anims.length, anims.filter(cs => cs.animationIterationCount === 'infinite').length]
})

/** The whole report as one tall picture, plus its first screen. */
async function shoot(page, name) {
  if (!SHOTS) return
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${SHOTS}/${name}-screen.png` })
  const h = await page.evaluate(() => {
    const rp = document.querySelector('.rp'), sc = document.querySelector('.rp-scroll')
    const full = sc.scrollHeight + document.querySelector('.rp-bar').offsetHeight
    rp.style.position = 'absolute'; rp.style.height = `${full}px`
    sc.style.overflow = 'visible'
    document.documentElement.style.height = `${full}px`
    document.body.style.height = `${full}px`
    document.body.style.overflow = 'visible'
    return full
  })
  await page.setViewportSize({ width: 390, height: Math.min(h, 16000) })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${name}-full.png`, fullPage: true })
  // Put the phone back exactly as it was, or every check after this one
  // would run against the stretched page.
  await page.evaluate(() => {
    for (const el of [document.querySelector('.rp'), document.querySelector('.rp-scroll'), document.documentElement, document.body]) {
      el.style.position = ''; el.style.height = ''; el.style.overflow = ''
    }
    window.scrollTo(0, 0)
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
}

{
  const goals = { '2026-03': { kind: 'sessions', target: 20 } }
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00', { goals })
  await openReport(page)

  // The cover: the sessions he came to, inside one dash per planned one.
  const cover = await page.evaluate(() => {
    const hero = document.querySelector('.rp-hero')
    const arcs = [...document.querySelectorAll('.rp-ring .rp-arc')]
    return {
      text: hero?.textContent.trim(),
      size: hero ? parseFloat(getComputedStyle(hero).fontSize) : 0,
      arcs: arcs.length,
      lit: arcs.filter(a => a.classList.contains('is-done')).length,
      missed: arcs.filter(a => a.classList.contains('is-missed') || a.classList.contains('is-ticket')).length,
      line: document.querySelector('.rp-cover-line')?.textContent.trim(),
      goal: [...document.querySelectorAll('.rp-cover-note')].map(n => n.textContent.trim()).join(' | '),
      label: document.querySelector('.rp-ring')?.getAttribute('aria-label'),
    }
  })
  ok('cover: the headline is the sessions attended', /^\d{1,2}$/.test(cover.text) && cover.size >= 72, JSON.stringify(cover))
  ok('cover: one dash per session, the attended ones lit', cover.arcs >= 18 && cover.lit === Number(cover.text), JSON.stringify(cover))
  ok('cover: the skipped day is a dark dash', cover.missed === 1, JSON.stringify(cover))
  ok('cover: one plain sentence of planned against attended', /من \d+ جلسة في خطتك، فاتتك/.test(cover.line || ''), cover.line)
  ok('cover: the goal from hf_month_goal is answered', /هدفك/.test(cover.goal), cover.goal)

  // The chrome is solid and never sits on the text, and the index bar
  // is gone: bar and scroller stacked, both bar buttons 44pt.
  const chrome = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const bar = r('.rp-bar'), scroll = r('.rp-scroll')
    const btns = [...document.querySelectorAll('.rp-bar button')].map(b => b.getBoundingClientRect())
    return {
      stacked: !!(bar && scroll) && bar.bottom <= scroll.top + 0.5,
      targets: btns.length === 2 && btns.every(b => b.width >= 44 && b.height >= 44),
      index: !!document.querySelector('.rp-index'),
      numbers: [...document.querySelectorAll('.rp-ch-n')].length,
    }
  })
  ok('chrome: the bar never overlaps the report', chrome.stacked, JSON.stringify(chrome))
  ok('chrome: close and share are 44pt buttons', chrome.targets, JSON.stringify(chrome))
  ok('removed: the numbered chapters and their index bar', !chrome.index && chrome.numbers === 0, JSON.stringify(chrome))

  await scrollThrough(page)
  const qs = await questions(page)
  ok('sections: in the order the month is told', JSON.stringify(qs) === JSON.stringify(QUESTIONS), qs.join(' | '))

  // Everything in the removals table is gone from the screen.
  const text = await page.evaluate(() => document.querySelector('.rp').innerText)
  const GONE = [
    ['the tonnage headline', /كجم رفعتها|\bطن\b|\d{1,3},\d{3},?\d* ?كجم/],
    ['«الدليل:» lines', /الدليل:/],
    ['code-ish notes', /المحرك|الوزن × التكرار|من قوالب عامة/],
    ['the daily bars and their extremes', /أعلى يوم|أدنى يوم|حجم كل يوم/],
    ['the average session in kilos', /لكل جلسة/],
    ['the verdict word', /خلال الشهر|صاعد|نازل/],
    ['the push/pull ratio', /الدفع والسحب|نسبة الدفع|: 1/],
    ['«100% of plan days» and its four counts', /من أيام الخطة|راحة مجدولة|يوم غياب/],
    ['the session-run rows', /أطول تتابع/],
    ['the ticket balance', /رصيدك/],
    ['the generic form tip', /نصيحة أداء/],
    ['the three names for one thing', /رقم قياسي|أقوى رقم|أعلى وزن/],
  ]
  for (const [what, re] of GONE) ok(`removed: ${what}`, !re.test(text), (text.match(re) || [])[0])

  // The streak is one number, the same flame and unit as Home.
  const streak = await page.evaluate(() => [...document.querySelectorAll('.rp-streak')].map(s => s.innerText.replace(/\s+/g, ' ').trim()))
  ok('streak: one number, nothing around it', streak.length === 1 && /^\d+ (يوم|أيام)$/.test(streak[0]), streak.join(' | '))

  // Each trained day is lit by its kilos, in more than one step.
  const levels = await page.evaluate(() => [...new Set([...document.querySelectorAll('.rp-cal .rp-lit[data-level]')].map(e => e.dataset.level))].sort())
  ok('calendar: trained days lit in steps', levels.length >= 3 && levels.every(l => /^[1-5]$/.test(l)), levels.join(','))
  const key = await page.evaluate(() => document.querySelector('.rp-key')?.innerText.replace(/\s+/g, ' ').trim())
  ok('calendar: one line of key, no «اضغط على يوم»', !!key && !/اضغط على يوم/.test(text), key)
  // The 18th was skipped and a ticket paid for it: the calendar and the
  // cover tell the same story about it.
  const when = await page.evaluate(() => document.querySelector('#rp-when .rp-ch-lead')?.textContent.trim())
  ok('calendar: its sentence agrees with the cover about the skipped day', when === 'مشيت على خطتك، إلا الأربعاء 18.', when)
  // …and that day can be found on the calendar: the ticket's mark, in
  // the rest blue, explained in the key.
  const paid = await page.evaluate(() => {
    const cell = [...document.querySelectorAll('.rp-cal-cell')].find(c => c.querySelector('.rp-cal-n')?.textContent.trim() === '18')
    const mark = cell?.querySelector('.is-paid svg')
    const keyMark = document.querySelector('.rp-key .is-paid svg')
    return {
      kind: cell?.className, mark: !!mark, color: mark ? getComputedStyle(mark.parentElement).color : '',
      keyMark: !!keyMark, key: document.querySelector('.rp-key')?.innerText.replace(/\s+/g, ' ').trim(),
    }
  })
  ok('calendar: the day a ticket paid for carries the ticket mark', /k-paid/.test(paid.kind || '') && paid.mark && paid.color === 'rgb(59, 157, 232)', JSON.stringify(paid))
  ok('calendar: and the key says what that mark is', paid.keyMark && /تذكرة بدل يوم فاتك/.test(paid.key || ''), JSON.stringify(paid))
  const lit = await page.evaluate(() => [...document.querySelectorAll('.rp-cal-cell.k-trained')].every(c => c.dataset.level))
  ok('calendar: every ordinary trained day is lit', lit)

  // «+12.5», never «12.5+»: the plus is drawn left of its digits.
  const signs = await page.evaluate(() => [...document.querySelectorAll('.rp-gain .k-num')].map(el => {
    const t = el.firstChild
    if (!t || !/^\+\d/.test(t.textContent)) return { text: el.textContent, ok: false }
    const at = (i) => { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); return r.getBoundingClientRect().left }
    return { text: el.textContent, ok: at(0) < at(1) }
  }))
  ok('stronger: gains are shown', signs.length >= 3, JSON.stringify(signs))
  ok('stronger: every «+» sits left of its digits', signs.length > 0 && signs.every(s => s.ok), JSON.stringify(signs))
  const jump = await page.evaluate(() => document.querySelector('.rp-best')?.innerText.replace(/\s+/g, ' '))
  ok('stronger: the biggest jump leads, called «وزن جديد»', /أكبر قفزة · وزن جديد/.test(jump || ''), jump)

  // Muscles: sets a week against the 10–20 band; biceps fall short.
  const sets = await page.evaluate(() => [...document.querySelectorAll('.rp-sets-row')].map(r => ({
    label: r.querySelector('.rp-sets-l')?.textContent, band: !!r.querySelector('.rp-sets-band'),
    low: r.classList.contains('is-low'), note: r.querySelector('.rp-sets-note')?.textContent || '',
  })))
  ok('muscles: every judged row draws the 10–20 band', sets.length >= 5 && sets.every(s => s.band), JSON.stringify(sets))
  ok('muscles: the one under the band says «أقل من اللازم»',
    sets.some(s => s.low && s.label === 'البايسبس' && s.note === 'أقل من اللازم'), JSON.stringify(sets))

  // Next month: at the end, three things at most, each with a reason.
  const next = await page.evaluate(() => [...document.querySelectorAll('.rp-next-item')].map(li => ({
    kind: li.dataset.kind, title: li.querySelector('strong')?.textContent, why: li.querySelector('.rp-next-main > span')?.textContent,
  })))
  ok('next month: three things at most, each with one reason', next.length >= 1 && next.length <= 3 && next.every(n => n.title && n.why), JSON.stringify(next))
  ok('next month: from the progression engine', next.some(n => n.kind === 'raise') && next.some(n => n.kind === 'lower') && next.some(n => n.kind === 'sets'), JSON.stringify(next))

  // Only today's XP is stored: a finished month names the level as today's.
  const allRows = await page.evaluate(() => [...document.querySelectorAll('#rp-all .rp-row-t')].map(e => e.textContent.trim()))
  ok('all numbers: a finished month calls the level today\'s', allRows.includes('مستواك اليوم') && !allRows.includes('المستوى'), allRows.join(' | '))
  // «20:50 ساعة» reads as a clock: time spent is said in words.
  const allText = await page.evaluate(() => document.querySelector('#rp-all')?.innerText.replace(/\s+/g, ' ') || '')
  ok('all numbers: time spent is said in words, not as a clock', !/\d+:\d{2}/.test(allText) && /\d+ ساعة و/.test(allText), allText)

  ok('report: no page errors', errors.length === 0, errors.join('; '))

  const [ran, loops] = await motion(page)
  ok('motion: the entrances run', ran > 10, `${ran} animated elements`)
  ok('motion: nothing loops — one beat, then still', loops === 0, `${loops} infinite animations`)

  await shoot(page, 'march')

  // ══ 3. A past month opens in place ═══════════════════════════
  await page.locator('.rp-scroll').evaluate(el => { el.scrollTop = el.scrollHeight })
  await page.waitForTimeout(500)
  const bars = await page.evaluate(() => [...document.querySelectorAll('.rp-month')].map(b => ({
    label: b.getAttribute('aria-label'), on: b.classList.contains('is-on'), disabled: b.disabled,
  })))
  // He started in January: three bars, not three empty months first.
  ok('months: one bar a month since he started, this one marked',
    bars.length === 3 && bars[2].on && /مارس/.test(bars[2].label) && /يناير/.test(bars[0].label), JSON.stringify(bars))
  await page.locator('.rp-month', { hasText: 'فبراير' }).click()
  await page.waitForTimeout(1400)
  const feb = await page.evaluate(() => ({
    eyebrow: document.querySelector('.rp-cover .rp-eyebrow')?.textContent,
    top: document.querySelector('.rp-scroll').scrollTop,
    hero: document.querySelector('.rp-hero')?.textContent.trim(),
    q: document.querySelector('#rp-next .rp-ch-q')?.textContent,
    goal: !!document.querySelector('.rp-cover-note:not(.is-deload)'),
  }))
  ok('months: a past month opens at its own cover', /فبراير 2026/.test(feb.eyebrow || '') && feb.top === 0, JSON.stringify(feb))
  ok('months: its plan is for the month after it', feb.q === 'خطة مارس', JSON.stringify(feb))
  ok('months: March\'s goal is not February\'s', !feb.goal, JSON.stringify(feb))
  await shoot(page, 'february')

  await page.locator('.rp-scroll').evaluate(el => { el.scrollTop = el.scrollHeight })
  await page.waitForTimeout(400)
  await page.locator('.rp-month', { hasText: 'مارس' }).click()
  await page.waitForTimeout(900)
  const back = await page.evaluate(() => document.querySelector('.rp-cover .rp-eyebrow')?.textContent)
  ok('months: and back again', /مارس 2026/.test(back || ''), back)
  ok('months: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 3b. The same, by keyboard ═════════════════════════════════
// Picking a month replaces the report, button and all: focus must land
// on the new cover, not drop to the page, and the change is said. Escape
// gives focus back to the row on Home that opened the report.
{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00', { reduced: true })
  const row = page.locator('.k-row', { hasText: 'تقرير مارس 2026' }).first()
  await row.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  await page.locator('.rp-scroll').evaluate(el => { el.scrollTop = el.scrollHeight })
  await page.waitForTimeout(300)
  await page.locator('.rp-month', { hasText: 'فبراير' }).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => ({
    active: document.activeElement === document.body ? 'BODY' : `${document.activeElement?.className} ${document.activeElement?.textContent?.trim()}`,
    said: document.querySelector('.rp [aria-live="polite"]')?.textContent.trim() || '',
  }))
  ok('months, keyboard: focus lands on the new month\'s cover', /rp-cover-title/.test(after.active) && /فبراير 2026/.test(after.active), JSON.stringify(after))
  ok('months, keyboard: the new month is announced', after.said === 'تقرير فبراير 2026', JSON.stringify(after))
  await page.keyboard.press('Tab')
  const next = await page.evaluate(() => document.activeElement?.closest('.rp') ? 'inside' : 'outside')
  ok('months, keyboard: Tab goes on from inside the report', next === 'inside', next)
  await page.locator('.rp-bar button[aria-label="إغلاق"]').focus()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const back = await page.evaluate(() => {
    const a = document.activeElement
    return !a || a === document.body ? 'BODY' : `${a.className} ${a.textContent.replace(/\s+/g, ' ').trim()}`
  })
  ok('report, keyboard: Escape gives focus back to the row that opened it', /تقرير مارس 2026/.test(back), back)
  ok('months, keyboard: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4. A month that ends in a deload week ═════════════════════
// Said once, in the deload blue, and never counted against him.
{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00', { sessions: DELOAD_SESSIONS, recovery: DELOAD_RECOVERY })
  await openReport(page)
  await scrollThrough(page)
  const dl = await page.evaluate(() => {
    const note = document.querySelector('.rp-cover-note.is-deload')
    const arcs = [...document.querySelectorAll('.rp-ring .rp-arc.is-deload')]
    return {
      note: note?.textContent.trim(),
      noteColor: note ? getComputedStyle(note).color : '',
      blueArcs: arcs.length,
      arcColor: arcs[0] ? getComputedStyle(arcs[0]).stroke : '',
      rimmed: [...document.querySelectorAll('.rp-cal-cell.is-deload')].length,
      litDeload: [...document.querySelectorAll('.rp-cal-cell.is-deload .rp-lit[data-level]')].length,
      caption: document.querySelector('#rp-stronger .rp-caption')?.textContent || '',
      next: [...document.querySelectorAll('.rp-next-item')].map(li => li.dataset.kind),
      gains: [...document.querySelectorAll('#rp-stronger .rp-row-v')].map(v => v.textContent.trim()),
    }
  })
  ok('deload: one line on the cover, in the deload blue',
    /فيه أسبوع تخفيف من 25 إلى 31\. خفيف عن قصد، وما ينحسب ضدك\./.test(dl.note || '') && dl.noteColor === 'rgb(92, 201, 238)', JSON.stringify(dl))
  ok('deload: its sessions are blue dashes, still attended', dl.blueArcs >= 4 && dl.arcColor === 'rgb(92, 201, 238)', JSON.stringify(dl))
  ok('deload: the calendar rims the whole week', dl.rimmed === 7, String(dl.rimmed))
  ok('deload: its days are not on the light scale', dl.litDeload === 0, String(dl.litDeload))
  ok('deload: «صرت أقوى؟» says the taper is not counted', /جلسات التخفيف ما تنحسب هنا/.test(dl.caption), dl.caption)
  ok('deload: the light week does not read as a step back', !dl.next.includes('lower'), dl.next.join(','))
  ok('deload: no page errors', errors.length === 0, errors.join('; '))
  await shoot(page, 'deload-march')
  await ctx.close()
}

// ══ 5. Reduced motion means none ══════════════════════════════

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00', { reduced: true })
  await openReport(page)
  await scrollThrough(page)
  const [still] = await motion(page)
  ok('reduced motion: nothing animates', still === 0, `${still} still moving`)

  const qs = await questions(page)
  ok('reduced motion: the report still renders in full',
    QUESTIONS.every(s => qs.includes(s)), QUESTIONS.filter(s => !qs.includes(s)).join(', '))
  ok('reduced motion: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 6. The poster ═════════════════════════════════════════════
// Arabic inside a canvas is the one thing here that cannot be
// asserted — the PNG is written out to be looked at. Where the ink
// sits can be: everything between y 250 and y 1600, clear of the
// Stories header above and the reply bar below.

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00')
  // The built bundle does not expose modules, so the poster is exercised
  // through the button the user actually presses.
  await openReport(page)

  const shot = await page.evaluate(async () => {
    // Intercept the share so the test never opens a real sheet.
    let captured = null
    const realShare = navigator.share
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }) => {
        const file = files[0]
        const b = new Uint8Array(await file.arrayBuffer())
        let s = ''
        for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])

        // The rows that carry ink: any channel brighter than the stage light.
        const bmp = await createImageBitmap(file)
        const c = document.createElement('canvas')
        c.width = bmp.width
        c.height = bmp.height
        const x = c.getContext('2d')
        x.drawImage(bmp, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        let first = -1, last = -1
        for (let y = 0; y < c.height; y++) {
          for (let px = 0; px < c.width; px += 2) {
            const i = (y * c.width + px) * 4
            if (Math.max(d[i], d[i + 1], d[i + 2]) > 120) {
              if (first < 0) first = y
              last = y
              break
            }
          }
        }
        captured = { b64: btoa(s), name: file.name, type: file.type, bytes: b.length, first, last }
      },
      configurable: true,
    })

    document.querySelector('.rp-bar button[aria-label="مشاركة التقرير"]')?.click()
    // Give the draw, the encode and the share a moment.
    for (let i = 0; i < 80 && !captured; i++) await new Promise(r => setTimeout(r, 100))
    if (realShare) Object.defineProperty(navigator, 'share', { value: realShare, configurable: true })
    return captured
  })

  ok('poster: the share button produced a file', !!shot)
  if (shot) {
    ok('poster: it is a PNG', shot.type === 'image/png' && /\.png$/.test(shot.name), shot.name)
    ok('poster: it is not an empty image', shot.bytes > 50_000, `${(shot.bytes / 1024).toFixed(0)} KB`)
    const buf = Buffer.from(shot.b64, 'base64')
    // PNG header carries its own dimensions; no decoder needed.
    ok('poster: 1080×1920', buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1920,
      `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`)
    ok('poster: all of it sits between y 250 and y 1600',
      shot.first >= 250 && shot.last <= 1600, `ink from y ${shot.first} to y ${shot.last}`)
    writeFileSync(`${OUT}/poster.png`, buf)
    if (SHOTS) writeFileSync(`${SHOTS}/poster.png`, buf)
    console.log(`\n  poster written to ${OUT}/poster.png — open it and check the Arabic is joined up\n`)
  }
  ok('poster: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()

// ── Report ────────────────────────────────────────────────────
let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(`\n${failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`}`)
process.exit(failed ? 1 : 0)
