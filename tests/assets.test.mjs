// Node specs for the icon-pack runtime, run against the real ES
// modules — no bundler, no framework beyond node:test.
//
//   node --test tests/assets.test.mjs
//
// fake-indexeddb supplies the database; everything else (Blob,
// crypto.subtle, fetch) is native in Node 22.

import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'

// registry.js mints object URLs, which Node has no notion of.
let urlSeq = 0
const liveUrls = new Set()
globalThis.URL.createObjectURL = () => { const u = `blob:test/${++urlSeq}`; liveUrls.add(u); return u }
globalThis.URL.revokeObjectURL = (u) => { liveUrls.delete(u) }

const { parseManifest, normalizeEmoji, SUPPORTED_SCHEMA } = await import('../src/assets/manifest.js')
const store = await import('../src/assets/store.js')
const registry = await import('../src/assets/registry.js')
const dl = await import('../src/assets/download.js')
const { clearAll, countBlobs } = await import('../src/assets/idb.js')

// ── helpers ───────────────────────────────────────────────────
const enc = new TextEncoder()
const bodyFor = (id) => enc.encode(`icon-bytes-for-${id}`).buffer
const sha = async (buf) => store.sha256Hex(buf)

async function makeManifest(ids, { schemaVersion = 1, packVersion = '1' } = {}) {
  const assets = []
  for (const id of ids) {
    const buf = bodyFor(id)
    assets.push({
      id, file: `i/${id}.webp`, sha256: await sha(buf),
      bytes: buf.byteLength, emoji: [],
    })
  }
  return { schemaVersion, packVersion, baseUrl: 'https://cdn.test/', assets }
}

const reset = async () => {
  await clearAll()
  registry.__resetForTests()
  dl.__resetForTests()
}

// ══ manifest ══════════════════════════════════════════════════

test('parseManifest accepts a well-formed manifest and absolutises URLs', async () => {
  const m = parseManifest(await makeManifest(['flame', 'star']))
  assert.equal(m.assets.length, 2)
  assert.equal(m.assets[0].url, 'https://cdn.test/i/flame.webp')
  assert.equal(m.byId.get('star').id, 'star')
})

test('a baseUrl without a trailing slash still joins correctly', async () => {
  const raw = await makeManifest(['flame'])
  raw.baseUrl = 'https://cdn.test/packs/v3'
  assert.equal(parseManifest(raw).assets[0].url, 'https://cdn.test/packs/v3/i/flame.webp')
})

test('a newer schema is refused outright, not half-read', async () => {
  const raw = await makeManifest(['flame'], { schemaVersion: SUPPORTED_SCHEMA + 1 })
  assert.throws(() => parseManifest(raw), /manifest-too-new/)
})

test('entries without a usable sha256 are dropped', async () => {
  const raw = await makeManifest(['flame', 'star'])
  raw.assets[1].sha256 = 'not-a-hash'
  const m = parseManifest(raw)
  assert.equal(m.assets.length, 1)
  assert.equal(m.assets[0].id, 'flame')
})

test('a manifest left with no valid entries throws rather than installing nothing', async () => {
  const raw = await makeManifest(['flame'])
  raw.assets[0].sha256 = 'x'
  assert.throws(() => parseManifest(raw), /manifest-empty/)
})

test('variation selectors are normalised, so 🗑️ and 🗑 are one icon', async () => {
  assert.equal(normalizeEmoji('\u{1F5D1}️'), normalizeEmoji('\u{1F5D1}'))
  const raw = await makeManifest(['trash'])
  raw.assets[0].emoji = ['\u{1F5D1}️']
  const m = parseManifest(raw)
  assert.equal(m.emojiToId.get('\u{1F5D1}'), 'trash')
})

test('two assets claiming one emoji resolve to the first, deterministically', async () => {
  const raw = await makeManifest(['a', 'b'])
  raw.assets[0].emoji = ['\u{1F525}']
  raw.assets[1].emoji = ['\u{1F525}']
  const warn = console.warn; let warned = 0; console.warn = () => { warned++ }
  try {
    const m = parseManifest(raw)
    assert.equal(m.emojiToId.get('\u{1F525}'), 'a')
    assert.equal(warned, 1, 'a duplicate claim should be reported')
  } finally { console.warn = warn }
})

// ══ store ═════════════════════════════════════════════════════

test('a verified file is stored', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['flame']))
  await store.verifyAndStore(m.assets[0], bodyFor('flame'))
  assert.equal(await countBlobs(), 1)
  assert.ok(await store.hasBlob(m.assets[0].sha256))
})

test('a hash mismatch is rejected BEFORE anything is written', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['flame']))
  await assert.rejects(
    () => store.verifyAndStore(m.assets[0], enc.encode('tampered').buffer),
    (e) => e.name === 'IntegrityError',
  )
  assert.equal(await countBlobs(), 0, 'the corrupt blob must not reach the database')
})

test('garbage collection drops unreferenced blobs and keeps the rest', async () => {
  await reset()
  const v1 = parseManifest(await makeManifest(['a', 'b', 'c']))
  for (const asset of v1.assets) await store.verifyAndStore(asset, bodyFor(asset.id))
  assert.equal(await countBlobs(), 3)

  const v2 = parseManifest(await makeManifest(['a', 'b']))
  const dropped = await store.collectGarbage(v2)
  assert.equal(dropped, 1)
  assert.equal(await countBlobs(), 2)
  assert.ok(await store.hasBlob(v2.assets[0].sha256))
})

test('a pointer claiming "installed" over an empty database reconciles to not-installed', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b']))
  await store.writeManifest({
    schemaVersion: 1, packVersion: '1', baseUrl: m.baseUrl,
    assets: m.assets.map(a => ({ ...a })),
  })
  // Manifest present, blobs evicted — exactly the iOS storage-eviction shape.
  const rec = await store.reconcile()
  assert.equal(rec.installed, false)
  assert.equal(rec.reason, 'empty')
})

test('reconcile reports a partial install and names what is missing', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b']))
  await store.verifyAndStore(m.assets[0], bodyFor('a'))
  await store.writeManifest({
    schemaVersion: 1, packVersion: '1', baseUrl: m.baseUrl,
    assets: m.assets.map(a => ({ id: a.id, file: a.file, sha256: a.sha256, bytes: a.bytes, emoji: [] })),
  })
  const rec = await store.reconcile()
  assert.equal(rec.installed, false)
  assert.equal(rec.reason, 'partial')
  assert.equal(rec.missing.length, 1)
  assert.equal(rec.missing[0].id, 'b')
})

// ══ download ══════════════════════════════════════════════════

/** Installs a fake fetch and reports what it was asked for. */
function stubFetch({ fail = () => null, delay = 0 } = {}) {
  const calls = []
  let live = 0, peak = 0
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    live++; peak = Math.max(peak, live)
    try {
      if (delay) await new Promise(r => setTimeout(r, delay))
      const id = String(url).split('/').pop().replace('.webp', '')
      const verdict = fail(id, calls.length)
      if (verdict === 'network') throw new TypeError('Failed to fetch')
      if (typeof verdict === 'number') {
        return { ok: false, status: verdict, headers: new Map() }
      }
      const buf = verdict === 'corrupt' ? enc.encode('garbage').buffer : bodyFor(id)
      return {
        ok: true, status: 200,
        headers: { get: () => 'image/webp' },
        arrayBuffer: async () => buf,
      }
    } finally { live-- }
  }
  return { calls, peak: () => peak }
}

test('a clean run downloads everything once', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b', 'c']))
  const f = stubFetch()
  const res = await dl.ensureDownload(m)
  assert.equal(res.ok, true)
  assert.equal(f.calls.length, 3)
  assert.equal(await countBlobs(), 3)
  assert.equal(registry.getPackState().phase, 'ready')
})

test('concurrency never exceeds the cap', async () => {
  await reset()
  const ids = Array.from({ length: 20 }, (_, i) => `i${i}`)
  const m = parseManifest(await makeManifest(ids))
  const f = stubFetch({ delay: 5 })
  await dl.ensureDownload(m)
  assert.ok(f.peak() <= dl.CONCURRENCY, `peak ${f.peak()} exceeded ${dl.CONCURRENCY}`)
  assert.equal(await countBlobs(), 20)
})

test('a transient network failure is retried and succeeds', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a']))
  let n = 0
  const f = stubFetch({ fail: () => (++n === 1 ? 'network' : null) })
  const res = await dl.ensureDownload(m)
  assert.equal(res.ok, true)
  assert.equal(f.calls.length, 2, 'one failure, one retry')
})

test('a 404 is not retried — a bad manifest should fail fast', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a']))
  const f = stubFetch({ fail: () => 404 })
  const res = await dl.ensureDownload(m)
  assert.equal(res.ok, false)
  assert.equal(f.calls.length, 1)
  assert.equal(res.failed[0].reason, 'http')
})

test('a 500 IS retried, up to the attempt limit', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a']))
  const f = stubFetch({ fail: () => 500 })
  const res = await dl.ensureDownload(m)
  assert.equal(res.ok, false)
  assert.equal(f.calls.length, dl.MAX_ATTEMPTS)
})

test('a corrupt file is retried, then reported — and never stored', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b']))
  const f = stubFetch({ fail: (id) => (id === 'a' ? 'corrupt' : null) })
  const res = await dl.ensureDownload(m)
  assert.equal(res.ok, false)
  assert.deepEqual(res.failed, [{ id: 'a', reason: 'hash' }])
  assert.equal(f.calls.filter(u => u.includes('/a.webp')).length, dl.MAX_ATTEMPTS)
  assert.equal(await countBlobs(), 1, 'the good file still installs')
  assert.ok(await store.hasBlob(m.assets[1].sha256))
  assert.equal(await store.hasBlob(m.assets[0].sha256), false)
  assert.equal(registry.getPackState().phase, 'error')
})

test('resuming skips what is already verified', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b', 'c', 'd']))
  // First run: two files land, two fail outright.
  let f = stubFetch({ fail: (id) => (id === 'c' || id === 'd' ? 404 : null) })
  await dl.ensureDownload(m)
  assert.equal(await countBlobs(), 2)

  // Second run: only the missing two are requested.
  f = stubFetch()
  const res = await dl.ensureDownload(m)
  assert.equal(res.ok, true)
  assert.equal(f.calls.length, 2, `expected only the 2 missing, got ${f.calls.join(',')}`)
  assert.equal(await countBlobs(), 4)
})

test('an update transfers only the icons that changed', async () => {
  await reset()
  const v1 = parseManifest(await makeManifest(['a', 'b', 'c']))
  stubFetch()
  await dl.ensureDownload(v1)

  // Same ids, new bytes for one of them → a different hash, one fetch.
  const raw2 = await makeManifest(['a', 'b', 'c'], { packVersion: '2' })
  const changed = enc.encode('icon-bytes-for-b-v2').buffer
  raw2.assets[1].sha256 = await sha(changed)
  raw2.assets[1].bytes = changed.byteLength
  const v2 = parseManifest(raw2)

  const f = stubFetch({ fail: (id) => (id === 'b' ? 'v2' : null) })
  globalThis.fetch = (url) => {
    const id = String(url).split('/').pop().replace('.webp', '')
    f.calls.push(String(url))
    return Promise.resolve({
      ok: true, status: 200, headers: { get: () => 'image/webp' },
      arrayBuffer: async () => (id === 'b' ? changed : bodyFor(id)),
    })
  }
  const res = await dl.ensureDownload(v2)
  assert.equal(res.ok, true)
  assert.equal(f.calls.length, 1, `expected 1 changed file, got ${f.calls.join(',')}`)

  const dropped = await store.collectGarbage(v2)
  assert.equal(dropped, 1, 'the superseded blob is collected')
  assert.equal(await countBlobs(), 3)
})

test('progress only ever moves forward', async () => {
  await reset()
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`)
  const m = parseManifest(await makeManifest(ids))
  let last = -1, ok = true
  const unsub = registry.subscribe(() => {
    const { bytesDone, filesDone } = registry.getPackState()
    if (bytesDone < last) ok = false
    last = bytesDone
    if (filesDone > m.assets.length) ok = false
  })
  stubFetch({ fail: (id, n) => (n % 4 === 0 ? 'network' : null) })
  await dl.ensureDownload(m)
  unsub()
  assert.ok(ok, 'bytesDone went backwards')
})

test('two concurrent installs join one run instead of racing', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b']))
  const f = stubFetch({ delay: 5 })
  const [r1, r2] = await Promise.all([dl.ensureDownload(m), dl.ensureDownload(m)])
  assert.equal(r1, r2, 'the second call should return the first promise')
  assert.equal(f.calls.length, 2, 'nothing fetched twice')
})

test('cancelling stops the run and leaves what already verified', async () => {
  await reset()
  const ids = Array.from({ length: 30 }, (_, i) => `c${i}`)
  const m = parseManifest(await makeManifest(ids))
  stubFetch({ delay: 8 })
  const p = dl.ensureDownload(m)
  await new Promise(r => setTimeout(r, 25))
  dl.cancel()
  const res = await p
  assert.equal(res.reason, 'aborted')
  const n = await countBlobs()
  assert.ok(n > 0 && n < 30, `expected a partial install, got ${n}`)
})

// ══ registry ══════════════════════════════════════════════════

test('a manifest survives the round trip through IndexedDB', async () => {
  // The structured clone drops the lookup Maps parseManifest builds.
  // Reading one back and handing it straight to the registry used to
  // throw, leaving every icon un-hydrated after a reload with nothing
  // in the log to say why.
  await reset()
  const raw = await makeManifest(['flame'])
  raw.assets[0].emoji = ['\u{1F525}']
  const m = parseManifest(raw)
  await store.writeManifest({
    schemaVersion: m.schemaVersion, packVersion: m.packVersion, baseUrl: m.baseUrl,
    assets: m.assets.map(a => ({ id: a.id, file: a.file, sha256: a.sha256, bytes: a.bytes, emoji: a.emoji })),
  })

  const back = await store.readManifest()
  assert.ok(back, 'a stored manifest reads back')
  assert.ok(back.emojiToId instanceof Map, 'its lookup maps are rebuilt')
  assert.equal(back.emojiToId.get('\u{1F525}'), 'flame')

  registry.applyManifest(back)
  assert.equal(registry.idForEmoji('\u{1F525}'), 'flame')
  const n = registry.hydrate(back, new Map([[back.assets[0].sha256, new Blob(['x'])]]))
  assert.equal(n, 1)
  assert.ok(registry.urlFor('flame'))
})

test('hydrate publishes a URL per stored asset and notifies once', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a', 'b']))
  let notified = 0
  const unsub = registry.subscribe(() => { notified++ })
  const blobs = new Map(m.assets.map(a => [a.sha256, new Blob(['x'])]))
  const n = registry.hydrate(m, blobs)
  unsub()
  assert.equal(n, 2)
  assert.equal(notified, 1)
  assert.ok(registry.urlFor('a').startsWith('blob:'))
})

test('a broken image stops resolving so it is not retried every render', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a']))
  registry.hydrate(m, new Map([[m.assets[0].sha256, new Blob(['x'])]]))
  assert.ok(registry.urlFor('a'))
  registry.markBroken('a')
  assert.equal(registry.urlFor('a'), undefined)
})

test('replacing an asset revokes the URL it replaced', async () => {
  await reset()
  const m = parseManifest(await makeManifest(['a']))
  registry.hydrate(m, new Map([[m.assets[0].sha256, new Blob(['x'])]]))
  const first = registry.urlFor('a')
  registry.put('a', new Blob(['y']))
  assert.notEqual(registry.urlFor('a'), first)
  assert.equal(liveUrls.has(first), false, 'the old object URL leaked')
})

test('the version counter is stable between notifications', async () => {
  await reset()
  const v = registry.getVersion()
  assert.equal(registry.getVersion(), v, 'getSnapshot must be Object.is-stable')
  registry.bump()
  assert.equal(registry.getVersion(), v + 1)
})
