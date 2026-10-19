// «جديد في مران»: the list and who sees what, without a browser.
// (The browser half is tests/whats-new.e2e.mjs.)
//
// It stopped appearing through the redesign because APP_VERSION sat at
// 2.2 from July: nothing was ever newer than what everyone had seen. So:
//
//   · APP_VERSION is the top entry of WHATS_NEW — a release that bumps one
//     without the other fails here;
//   · entries newest first, dated, two to five items, each an icon the
//     modal knows, one short plain line, no emoji, no «تذاكر»;
//   · a user back after several releases is told about all of them; a
//     fresh install is told nothing and only marked seen;
//   · «تمام» writes meran_seen_version, and leaves hf_seen_version at the
//     '2.2' the old design compares against — the two designs never show
//     their notices in turn.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { APP_VERSION, WHATS_NEW } from '../src/constants.js'
import {
  versionCmp, entriesSince, whatsNewAtLaunch, markWhatsNewSeen, WN_ICONS, WN_TONES,
  SEEN_KEY, CLASSIC_SEEN_KEY, CLASSIC_VERSION,
} from '../src/whatsNew.js'

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('APP_VERSION is the newest entry of WHATS_NEW', () => {
  assert.equal(WHATS_NEW[0].version, APP_VERSION)
  assert.ok(versionCmp(APP_VERSION, CLASSIC_VERSION) > 0, 'newer than what the old design knows')
})

test('entries: newest first, dated, a few short plain items each', () => {
  const EMOJI = /\p{Extended_Pictographic}/u
  for (let i = 0; i < WHATS_NEW.length; i++) {
    const e = WHATS_NEW[i]
    assert.match(e.version, /^\d+\.\d+(\.\d+)?$/)
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(!Number.isNaN(Date.parse(e.date)), e.date)
    if (i > 0) {
      assert.ok(versionCmp(WHATS_NEW[i - 1].version, e.version) > 0, `${WHATS_NEW[i - 1].version} before ${e.version}`)
      assert.ok(WHATS_NEW[i - 1].date >= e.date, `dates go back in time: ${e.version}`)
    }
    assert.ok(e.items.length >= 2 && e.items.length <= 5, `${e.version}: ${e.items.length} items`)
    for (const it of e.items) {
      assert.ok(WN_ICONS.includes(it.icon), `${e.version}: icon ${it.icon}`)
      assert.ok(WN_TONES.includes(it.tone || ''), `${e.version}: tone ${it.tone}`)
      assert.ok(it.title && it.title.length <= 40, `title too long: ${it.title}`)
      assert.ok(it.line && it.line.length <= 95, `one short line: ${it.line}`)
      for (const t of [it.title, it.line]) {
        assert.doesNotMatch(t, EMOJI, `no emoji: ${t}`)
        assert.doesNotMatch(t, /تذاكر|تذكرة/, `rest days are «أيام الراحة الاختيارية» now: ${t}`)
      }
    }
  }
})

test('every icon a WHATS_NEW item may name is mapped in the modal and comes from the kit', () => {
  const modal = src('src/components/WhatsNewModal.jsx')
  const kit = src('src/components/kit/icons.js')
  const map = modal.match(/const ICONS = \{([^}]+)\}/)?.[1] || ''
  for (const name of WN_ICONS) {
    assert.match(map, new RegExp(`\\b${name}\\b`), `ICONS misses ${name}`)
    assert.match(kit, new RegExp(`\\b${name}\\b`), `kit/icons.js misses ${name}`)
  }
})

test('versions compare as numbers', () => {
  assert.equal(versionCmp('3.10', '3.9'), 1)
  assert.equal(versionCmp('3.4', '3.4.0'), 0)
  assert.equal(versionCmp('2.2', '3.0'), -1)
  assert.equal(versionCmp(null, '0.1'), -1)
})

test('back after several releases: every entry since, newest first', () => {
  const all = entriesSince('2.2')
  assert.deepEqual(all.map(e => e.version), WHATS_NEW.map(e => e.version))
  assert.deepEqual(entriesSince('3.2').map(e => e.version), ['3.5', '3.4', '3.3'])
  assert.deepEqual(entriesSince(APP_VERSION), [])
  // an entry written ahead of a release is not shown before it
  const ahead = [{ version: '9.0', date: '2030-01-01', items: [] }, ...WHATS_NEW]
  assert.equal(entriesSince('2.2', ahead).some(e => e.version === '9.0'), false)
})

test('at launch: his own key first, the shared one as the start, nothing on a fresh install', () => {
  assert.deepEqual(whatsNewAtLaunch({ firstRun: true, seenShared: null }), { entries: [], markSeen: true })
  assert.equal(whatsNewAtLaunch({ seenShared: '2.2' }).entries.length, WHATS_NEW.length, 'Hamza, at 2.2 since July')
  assert.deepEqual(whatsNewAtLaunch({ seenOwn: '3.3', seenShared: '2.2' }).entries.map(e => e.version), ['3.5', '3.4'])
  assert.deepEqual(whatsNewAtLaunch({ seenOwn: APP_VERSION, seenShared: '2.2' }).entries, [])
})

test('«تمام»: meran_seen_version is the version; hf_seen_version stays what the old design reads', () => {
  const box = new Map()
  const ls = { set: (k, v) => box.set(k, v), get: (k) => box.get(k) }
  markWhatsNewSeen(ls)
  assert.equal(box.get(SEEN_KEY), APP_VERSION)
  assert.equal(box.get(CLASSIC_SEEN_KEY), CLASSIC_VERSION)
  // the old design shows its notice whenever hf_seen_version is not its APP_VERSION
  assert.match(src('classic/src/constants.js'), new RegExp(`APP_VERSION = '${CLASSIC_VERSION.replace('.', '\\.')}'`))
  assert.match(src('classic/src/App.jsx'), /ls\.get\('hf_seen_version'\) !== APP_VERSION/)
})

test('App never writes the new version into the shared key', () => {
  const app = src('src/App.jsx')
  assert.doesNotMatch(app, /ls\.set\('hf_seen_version'/)
  assert.match(app, /markWhatsNewSeen\(ls\)/)
})
