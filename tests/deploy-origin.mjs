// A stand-in for Vercel that can deploy a new version under an open page,
// for tests/resilience.e2e.mjs.
//
// It serves a built dist/ the way vercel.json does: a file that exists is
// served (sw.js and workbox-*.js with no-cache), /pack/* that doesn't is a
// 404, and every other path gets index.html with a 200 — so a page still
// running the previous version, asking for a chunk that the new deploy no
// longer has, gets HTML back where it wanted JavaScript, exactly as on
// the phone.
//
//   const origin = await deployOrigin(dirA)
//   …open origin.url…
//   origin.deploy(dirB)            // the next push to main
//
// nextBuild(from, to) makes "the next push" out of a built dist/: a copy
// in which every content-hashed file under assets/ has a new hash (and
// every reference to it, the service worker's precache list included),
// and index.html a new revision — what a deploy that touched the code
// looks like to a browser and to the service worker.

import http from 'node:http'
import { createHash } from 'node:crypto'
import { cpSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const TYPES = {
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
}

export async function deployOrigin(dir) {
  let root = dir
  const hits = []
  const sockets = new Set()
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    let p = decodeURIComponent(url.pathname)
    if (p.endsWith('/')) p += 'index.html'
    let file = path.join(root, p)
    let found = false
    try { found = statSync(file).isFile() } catch { found = false }
    if (!found) {
      if (p.startsWith('/pack/')) { res.writeHead(404); res.end(); return }
      file = path.join(root, 'index.html')   // vercel.json: "/(.*)" → "/"
    }
    hits.push({ path: url.pathname, served: path.relative(root, file) })
    const body = readFileSync(file)
    const noStore = /^\/(sw\.js|workbox-[^/]+\.js)$/.test(url.pathname)
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': noStore ? 'no-cache, no-store, must-revalidate' : 'public, max-age=0, must-revalidate',
    })
    res.end(body)
  })
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    hits,
    deploy(next) { root = next },
    close: () => { for (const s of sockets) s.destroy(); return new Promise((resolve) => server.close(resolve)) },
  }
}

const HASHED = /^(.+)-([A-Za-z0-9_-]{8})\.(js|css)$/
const TEXT = /\.(js|css|html|webmanifest|json)$/

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

/** A copy of the built app `from` at `to`, as the next deploy would build it. */
export function nextBuild(from, to, { salt = 'next' } = {}) {
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, {
    recursive: true,
    filter: (src) => !/[\\/](pack|classic)([\\/]|$)/.test(path.relative(from, src)),
  })
  const renames = []
  for (const name of readdirSync(path.join(to, 'assets'))) {
    const m = name.match(HASHED)
    if (!m) continue
    const hash = createHash('sha256').update(salt + name).digest('base64url').slice(0, 8)
    renames.push([name, `${m[1]}-${hash}.${m[3]}`])
  }
  for (const [a, b] of renames) renameSync(path.join(to, 'assets', a), path.join(to, 'assets', b))
  for (const file of walk(to)) {
    if (!TEXT.test(file) && !file.endsWith('sw.js')) continue
    let s = readFileSync(file, 'utf8')
    let changed = false
    for (const [a, b] of renames) if (s.includes(a)) { s = s.split(a).join(b); changed = true }
    if (changed) writeFileSync(file, s)
  }
  // index.html changed (it names the new entry chunk): a new revision in
  // the precache list, as Workbox would write it.
  const html = readFileSync(path.join(to, 'index.html'))
  const rev = createHash('md5').update(html).digest('hex')
  const swPath = path.join(to, 'sw.js')
  const sw = readFileSync(swPath, 'utf8').replace(/(\{url:"index\.html",revision:")[0-9a-f]+(")/, `$1${rev}$2`)
  writeFileSync(swPath, sw)
  return { renames }
}
