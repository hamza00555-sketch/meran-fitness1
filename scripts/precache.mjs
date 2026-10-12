// The precache list a built service worker carries, read back out of
// its sw.js, and what must hold for it. Used by scripts/build.mjs (the
// deploy fails on a problem) and tests/pack-build.test.mjs.

// Every {url, revision} entry, in order. `count` is every `{url:"` in the
// text, so a format this does not understand shows up as a mismatch
// instead of an empty, "clean" list.
export function readPrecache(swText) {
  const entries = [...swText.matchAll(/\{url:"([^"]+)",revision:(null|"[^"]*")\}/g)]
    .map(m => ({ url: m[1], revision: m[2] === 'null' ? null : m[2].slice(1, -1) }))
  const count = (swText.match(/\{url:"/g) || []).length
  return { entries, count }
}

// name: how to call this worker in a message (dist/sw.js).
// isPublic(url): whether the URL is a file copied from public/.
export function precacheProblems({ entries, count }, { name, isPublic = () => false }) {
  const problems = []
  if (count !== entries.length) problems.push(`precache: read ${entries.length} of ${count} entries in ${name}`)

  // Every URL once. Workbox refuses one URL under two revisions: the
  // worker throws at startup and caches nothing, so the app never works
  // offline and every launch fetches the JS, the fonts and the art
  // again — what includeAssets beside globPatterns did to the root
  // worker from its first commit to October 2026. The same URL twice
  // under one revision does not throw, but it means two settings feed
  // the precache one file.
  const revs = new Map()
  for (const e of entries) revs.set(e.url, [...(revs.get(e.url) || []), e.revision])
  for (const [url, rs] of revs) {
    if (rs.length < 2) continue
    problems.push(new Set(rs).size > 1
      ? `precache: ${name} lists ${url} under ${rs.length} revisions (${rs.map(r => r ?? 'none').join(', ')}) — the worker throws at install and caches nothing`
      : `precache: ${name} lists ${url} ${rs.length} times`)
  }

  // Only a file Vite names by its content may go without a revision. One
  // from public/ keeps its own, or a redrawn picture under the same name
  // would never reach a phone that already has the old one.
  for (const e of entries) {
    if (e.revision === null && isPublic(e.url)) {
      problems.push(`precache: ${name} lists ${e.url}, a public/ file, with no revision (see dontCacheBustURLsMatching)`)
    }
  }

  // The pack is downloaded on request into IndexedDB, never precached.
  for (const e of entries) {
    if (/(^|\/)pack\//.test(e.url)) problems.push(`precache: ${name} lists ${e.url}, a pack file`)
  }
  return problems
}
