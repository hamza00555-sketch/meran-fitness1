// A pass-through origin in front of the preview that a test can take
// down, for the e2e suites that check what works offline.
//
// Playwright's context.setOffline() (and context.route) do not reach the
// requests a service worker makes itself, in this Chromium: a worker
// whose cache is gone quietly falls back to the network and the page
// loads anyway — the very failure an offline test is there to catch.
// Pages are opened on this origin instead, and setDown(true) drops every
// connection, the page's and the workers' alike, like a phone with no
// signal. Use it with ctx.setOffline() so the page side matches too.

import http from 'node:http'
import https from 'node:https'

export async function offlineOrigin(app) {
  const up = new URL(app)
  const client = up.protocol === 'https:' ? https : http
  let down = false
  const sockets = new Set()
  const server = http.createServer((req, res) => {
    if (down) return req.socket.destroy()
    const out = client.request({
      protocol: up.protocol, hostname: up.hostname, port: up.port, method: req.method,
      path: up.pathname.replace(/\/$/, '') + req.url, headers: { ...req.headers, host: up.host },
    }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
    out.on('error', () => res.destroy())
    req.pipe(out)
  })
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    setDown(v) {
      down = !!v
      if (down) for (const s of sockets) s.destroy()
    },
    close: () => { for (const s of sockets) s.destroy(); return new Promise((resolve) => server.close(resolve)) },
  }
}
