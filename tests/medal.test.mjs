// Specs for motion phases 2 and 4: which medals spin and in what order,
// how each one lands, which way a medal is drawn when the phone can't
// (or doesn't want to) spin it, when the streak's flame lights, and the
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
  for (const f of ['src/components/frame/SessionSummary.jsx', 'src/pages/AchievementsPage.jsx', 'src/components/progress/MedalReveal.jsx', 'src/App.jsx']) {
    const s = src(f)
    assert.ok(!/import\s[^;]*from\s+['"][^'"]*medal3d(\.js)?['"]/.test(s), `${f} imports medal3d.js statically`)
  }
  assert.match(src('src/components/progress/MedalReveal.jsx'), /import\(\s*['"]\.\/medal3d\.js['"]\s*\)/)
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
  assert.match(r, /urlFor\(achSlot\(/)
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
