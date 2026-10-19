// Specs for motion phases 2 and 4: which medals spin and in what order,
// how each one lands, which way a medal is drawn when the phone can't
// (or doesn't want to) spin it, when the summary's medals come in (on
// their own beat, never after the lines under them), how the stage built
// ahead describes a medal, when the streak's flame lights, and the
// ladder the level-up screen climbs.
//
//   node --test tests/medal.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { medalQueue, landingFeel, heaviestFeel, revealMode, rarityRank } from '../src/components/progress/medalQueue.js'
import { flameIgnition, FLAME_LIT_KEY } from '../src/components/streak/flameLit.js'
import { haptic } from '../src/haptics.js'
import { SOUNDS } from '../src/sound.js'
import { BEAT, MEDAL_BEAT, summaryBeats } from '../src/components/frame/summaryBeats.js'

const ROOT = new URL('..', import.meta.url).pathname
const src = (p) => readFileSync(path.join(ROOT, p), 'utf8')
const a = (id, rarity) => ({ id, rarity, title: id })

test('one medal spins on its own', () => {
  assert.deepEqual(medalQueue([a('a1', 'common')]), { stage: [a('a1', 'common')], rest: [] })
  assert.deepEqual(medalQueue([]), { stage: [], rest: [] })
})

test('two medals: the rarer plays first, whatever order they were earned in', () => {
  const q = medalQueue([a('b1', 'common'), a('b2', 'rare')])
  assert.deepEqual(q.stage.map(x => x.id), ['b2', 'b1'])
  assert.deepEqual(q.rest, [])
  // equal rarity keeps the order they were earned in
  assert.deepEqual(medalQueue([a('a1', 'common'), a('c7', 'common')]).stage.map(x => x.id), ['a1', 'c7'])
})

test('three or more: the two rarest spin, the rest sit in a row under them', () => {
  const q = medalQueue([a('d6', 'common'), a('b1', 'common'), a('b3', 'epic'), a('b2', 'rare'), a('c5', 'legendary')])
  assert.deepEqual(q.stage.map(x => x.id), ['c5', 'b3'])
  assert.deepEqual(q.rest.map(x => x.id), ['b2', 'd6', 'b1'])
})

test('a medal counted twice (an award delivered twice) shows once', () => {
  const q = medalQueue([a('b1', 'common'), a('b2', 'rare'), a('b1', 'common')])
  assert.deepEqual(q.stage.map(x => x.id), ['b2', 'b1'])
  assert.equal(q.rest.length, 0)
})

test('unknown or missing rarity counts as common', () => {
  assert.equal(rarityRank(undefined), 0)
  assert.equal(rarityRank('mythic'), 0)
  assert.deepEqual(medalQueue([a('x', undefined), a('y', 'rare')]).stage.map(x => x.id), ['y', 'x'])
})

test('landing: the clink for common, the bell from rare up, the heavy buzz for epic and legendary', () => {
  assert.deepEqual(landingFeel('common'), { sound: 'medal', haptic: 'medal' })
  assert.deepEqual(landingFeel('rare'), { sound: 'medal-heavy', haptic: 'medal' })
  assert.deepEqual(landingFeel('epic'), { sound: 'medal-heavy', haptic: 'medal-heavy' })
  assert.deepEqual(landingFeel('legendary'), { sound: 'medal-heavy', haptic: 'medal-heavy' })
  // a skip lands them together: one sound, the heaviest
  assert.deepEqual(heaviestFeel(['common', 'epic']), landingFeel('epic'))
  assert.deepEqual(heaviestFeel([]), landingFeel('common'))
})

test('every landing sound and buzz exists, and the buzz never throws without a phone', () => {
  for (const r of ['common', 'rare', 'epic', 'legendary']) {
    const f = landingFeel(r)
    assert.ok(SOUNDS[f.sound], `${f.sound} is not a library sound`)
    assert.doesNotThrow(() => haptic(f.haptic))
  }
  assert.match(src('src/haptics.js'), /'medal-heavy':\s*\{/)
  assert.match(src('src/haptics.js'), /\bmedal:\s*\{/)
})

test('how a medal is drawn: spin, fade, or the flat medal turning', () => {
  assert.equal(revealMode({ webgl: true, reduced: false }), 'spin')
  assert.equal(revealMode({ webgl: true, reduced: true }), 'fade')
  assert.equal(revealMode({ webgl: false, reduced: false }), 'flat')
  assert.equal(revealMode({ webgl: false, reduced: true }), 'flat-fade')
  assert.equal(revealMode(), 'spin')
})

test('the medal module is its own chunk: nothing imports it except on demand', () => {
  for (const f of ['src/components/frame/SessionSummary.jsx', 'src/pages/AchievementsPage.jsx', 'src/components/progress/MedalReveal.jsx',
    'src/components/progress/medalStage.js', 'src/pages/WorkoutPage.jsx', 'src/App.jsx']) {
    const s = src(f)
    assert.ok(!/import\s[^;]*from\s+['"][^'"]*medal3d(\.js)?['"]/.test(s), `${f} imports medal3d.js statically`)
  }
  assert.match(src('src/components/progress/medalStage.js'), /import\(\s*['"]\.\/medal3d\.js['"]\s*\)/)
})

test('the summary\'s medals come right behind the numbers — never after the lines under them', () => {
  const plain = summaryBeats({ prs: true })
  const B = summaryBeats({ medals: true, prs: true })
  // on their own beat, within ~0.7 s of the summary opening, after the numbers
  assert.ok(B.medals * BEAT <= 700, `${B.medals * BEAT} ms`)
  assert.ok(B.medals > B.stats && B.medals < B.stats + 1)
  // before every line under them, the level's above all
  for (const k of ['prs', 'streak', 'xp', 'foot']) assert.ok(B.medals < B[k], k)
  // the lines keep their beats with medals or without: nothing waits on the stage
  for (const k of ['eyebrow', 'title', 'stats', 'prs', 'streak', 'xp', 'foot']) assert.equal(B[k], plain[k], k)
  assert.equal(summaryBeats({ medals: true }).xp, summaryBeats().xp)
  assert.equal(MEDAL_BEAT, B.medals)
  // and the summary starts them on that beat alone — no line is its cue
  const s = src('src/components/frame/SessionSummary.jsx')
  assert.match(s, /const medalGo = useAt\(t0, hasMedals \? at\('medals'\)/)
  assert.ok(!/\bcue\b/.test(s), 'the medals must not wait for a line')
})

test('the stage built ahead describes a medal exactly as the reveal does', async () => {
  const { glyphPath, medalItems, stageKey } = await import('../src/components/progress/medalStage.js')
  const { medalFace } = await import('../src/components/progress/achievementMeta.js')
  const { ACHIEVEMENTS } = await import('../src/constants.js')
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  // the glyph's outline, read from the icon's definition, is what rendering it draws
  for (const a of ACHIEVEMENTS) {
    const G = medalFace(a).glyph
    const drawn = [...renderToStaticMarkup(React.createElement(G, { weight: 'fill', size: 256 })).matchAll(/ d="([^"]+)"/g)].map(m => m[1]).join(' ')
    assert.ok(drawn, `${a.id}: no path`)
    assert.equal(glyphPath(G), drawn, `${a.id}: the composed face would draw another glyph`)
  }
  const [it] = medalItems([ACHIEVEMENTS.find(a => a.id === 'b2')])
  assert.equal(it.id, 'b2')
  assert.equal(it.rarity, 'rare')
  assert.equal(it.art, null)   // no pack in node: the composed face
  assert.ok(it.glyph.length > 20)
  // the same medals and date are the same stage; another medal or date is not
  const k = stageKey(medalItems(ACHIEVEMENTS.slice(0, 2)), '12 أكتوبر 2026')
  assert.equal(k, stageKey(medalItems(ACHIEVEMENTS.slice(0, 2)), '12 أكتوبر 2026'))
  assert.notEqual(k, stageKey(medalItems(ACHIEVEMENTS.slice(1, 3)), '12 أكتوبر 2026'))
  assert.notEqual(k, stageKey(medalItems(ACHIEVEMENTS.slice(0, 2)), '13 أكتوبر 2026'))
})

test('the medal is built ahead: as the session would earn it, as «إنهاء» is asked, as it is saved', () => {
  const app = src('src/App.jsx')
  // one check decides both the award and the look-ahead
  assert.match(app, /function newlyEarned\(/)
  assert.match(app, /newlyEarned\(newSessions, newXP, newStreak, prev\)/)
  assert.match(app, /const earned = newlyEarned\(\[finished, \.\.\.sessions\]/)
  assert.match(app, /achievements: earned,/)
  assert.match(app, /warmMedals\(earned, \{ gl: true \}\)/)
  assert.match(app, /onFinishing=\{finishing\}/)
  assert.match(src('src/pages/WorkoutPage.jsx'), /if \(askFinish\) onFinishing\?\.\(\)/)
  // the award that follows doesn't add the summary's medals a second time
  assert.match(app, /!sm\.achievements\.some\(x => x\.id === a\.id\)/)
})

test('the stage: warmed and shown once while built, the back plate sharpened only once landed', () => {
  const m = src('src/components/progress/medal3d.js')
  assert.match(m, /function warmUp\(/)
  assert.match(m, /await frames\(2\)/)
  assert.match(m, /engrave\(it, 512, font, date\)/)
  assert.match(m, /function sharpen\(\)/)
  assert.match(m, /if \(idling\(\)\) sharpen\(\)/)
  // the second of a pair: about a second behind the first
  assert.match(m, /this\.second \? \(this\.R\.heavy \? 1\.2 : 1\)/)
  assert.match(m, /a\.onLand = \(\) => at\(\.06,/)
  const r = src('src/components/progress/MedalReveal.jsx')
  assert.match(r, /const FLAT_APART = 1000/)
  // not ready on the beat: the flat medal, on time
  assert.match(r, /if \(mode === 'wait'\) \{\s*S\.late = true/)
})

test('the medal module frees its GL context and hands a lost one back to the host', () => {
  const m = src('src/components/progress/medal3d.js')
  assert.match(m, /WEBGL_lose_context/, 'destroy() must release the context (iOS keeps only a few)')
  assert.match(m, /webglcontextlost/)
  assert.match(m, /webglcontextrestored/)
  assert.match(m, /onFallback/)
  assert.match(m, /export default function MedalStage/)
  // no art pack: the face is composed, never a broken <img>
  assert.match(m, /function face\(/)
  const r = src('src/components/progress/MedalReveal.jsx')
  assert.match(r, /destroy\(\)/)
  assert.match(src('src/components/progress/medalStage.js'), /urlFor\(achSlot\(/)
  // the stage kept ready is freed: hidden, unused, replaced, and with the medal wall
  const w = src('src/components/progress/medalStage.js')
  assert.match(w, /visibilitychange/)
  assert.match(w, /KEEP_MS/)
  assert.match(src('src/pages/AchievementsPage.jsx'), /useEffect\(\(\) => \(\) => dropWarm\(\), \[\]\)/)
})

test('the flame lights once a day, when today counts and Home can be seen', () => {
  const today = '2026-10-11'
  assert.equal(flameIgnition({ counted: false, kind: 'owed', number: 6, today }), null)
  assert.deepEqual(flameIgnition({ counted: true, kind: 'counted-trained', number: 7, today }), { from: 6 })
  // already lit today
  assert.equal(flameIgnition({ counted: true, kind: 'counted-trained', number: 7, today, lit: today }), null)
  // lit yesterday: lights again today
  assert.deepEqual(flameIgnition({ counted: true, kind: 'counted-trained', number: 8, today, lit: '2026-10-10' }), { from: 7 })
  // something still covers Home: wait
  assert.equal(flameIgnition({ counted: true, kind: 'counted-trained', number: 7, today, hold: true }), null)
  // a rest day counted at 03:00: the flame lights, the number doesn't roll
  assert.deepEqual(flameIgnition({ counted: true, kind: 'counted-rest', number: 7, today }), { from: null })
  assert.deepEqual(flameIgnition({ counted: true, kind: 'held', number: 7, today }), { from: null })
  // the first session ever: 0 → 1 has nothing below it to roll from
  assert.deepEqual(flameIgnition({ counted: true, kind: 'counted-trained', number: 1, today }), { from: 0 })
  assert.deepEqual(flameIgnition({ counted: true, kind: 'counted-trained', number: 0, today }), { from: null })
  assert.equal(flameIgnition({ counted: true, kind: 'counted-trained', number: 3, today: null }), null)
})

test('the flame\'s memory is a new key of its own — nothing the old design stores', () => {
  assert.equal(FLAME_LIT_KEY, 'meran_flame_lit')
  const classic = ['classic/src/App.jsx', 'classic/src/utils.js'].map(f => { try { return src(f) } catch { return '' } }).join('\n')
  assert.ok(!classic.includes(FLAME_LIT_KEY))
})

test('Home keeps the streak to the flame, the number and the unit', () => {
  const s = src('src/components/streak/StreakNumber.jsx')
  const jsx = s.slice(s.indexOf('return (', s.indexOf('export default function StreakNumber')))
  const classes = [...jsx.matchAll(/className="([^"]+)"|className=\{`([^`]+)`\}/g)].map(m => m[1] || m[2])
  assert.deepEqual(classes.filter(c => !/^h-streak|^\$\{/.test(c)), [], 'nothing but the streak parts on Home')
  assert.ok(!/ticket|تذكرة|countdown|cost/i.test(jsx))
})

test('the level-up ladder climbs from the old level to the new', async () => {
  const { ladderFill } = await import('../src/components/progress/ladder.js')
  assert.equal(ladderFill(1), 0)
  assert.equal(ladderFill(75), 1)
  assert.equal(ladderFill(99), 1)
  // a new rank lands exactly on its node; inside a rank it moves part way
  assert.equal(ladderFill(5), 1 / 6)
  assert.ok(ladderFill(4) < ladderFill(5) && ladderFill(5) < ladderFill(6))
  for (let l = 1; l < 80; l++) assert.ok(ladderFill(l + 1) >= ladderFill(l), `level ${l + 1} is not past ${l}`)
  assert.match(src('src/components/progress/RankLadder.jsx'), /fillFrom/)
  assert.match(src('src/components/LevelUpScreen.jsx'), /fillFrom=\{before\}/)
})

test('a new rank is a new rank however many levels the session jumped', async () => {
  const { reachedNewRank } = await import('../src/components/progress/ladder.js')
  assert.equal(reachedNewRank(4, 5), true)      // lands on D's first level
  assert.equal(reachedNewRank(4, 6), true)      // jumps past it: still D's moment
  assert.equal(reachedNewRank(3, 4), false)
  assert.equal(reachedNewRank(5, 6), false)     // already D
  assert.equal(reachedNewRank(9, 12), true)     // C at 10
  assert.equal(reachedNewRank(0, 1), false)     // the first level is no promotion
  assert.equal(reachedNewRank(6, 6), false)
  assert.match(src('src/components/LevelUpScreen.jsx'), /reachedNewRank\(before, level\)/)
})

test('Home\'s flame waits while anything covers Home', () => {
  const app = src('src/App.jsx')
  const hold = app.match(/hold=\{([^}]+)\}/)?.[1] || ''
  // (whatsNewOpen: «جديد في مران» actually up — while it only waits, Home is Home)
  for (const k of ['summary', 'showLevelUp', 'sessionOpen', 'showReport', 'onboarding', 'showDeloadEnd', 'whatsNewOpen', 'packOffer']) {
    assert.ok(hold.includes(k), `hold misses ${k}`)
  }
})
