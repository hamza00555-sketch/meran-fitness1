// ── «شوف الطريقة»: straight into the YouTube app ─────────────────
//
// On the iPhone a home-screen app opens an https link in an in-app
// browser sheet first (a blank page with an address bar), and only then
// hands it to YouTube. Hamza: «انا مابا الصفحة هذه تطلع». So on iOS the
// link goes out as YouTube's own app link (youtube://…), which opens the
// app directly with no sheet. If the app isn't there, the page is still
// in front a moment later, and the https link opens as before.
// Everywhere else nothing changes.

const isIOS = () => typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** The YouTube app's link for a youtube.com / youtu.be link; null for anything else. */
export function appLink(url) {
  let u
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^(www\.|m\.)/, '')
  if (host === 'youtu.be') return `youtube://www.youtube.com/watch?v=${u.pathname.slice(1)}${u.search ? '&' + u.search.slice(1) : ''}`
  if (host !== 'youtube.com') return null
  return `youtube://www.youtube.com${u.pathname}${u.search}`
}

const openWeb = (url) => { window.open(url, '_blank', 'noopener,noreferrer') }

/** Whether the web page may still open: only if nothing says the app took over. */
export const shouldFallback = ({ left, elapsed, visible }) => !left && visible && elapsed <= 2500

/** Opens a video link: the YouTube app directly on iOS, a new tab elsewhere. */
export function openYouTube(url) {
  if (!url) return
  const app = isIOS() ? appLink(url) : null
  if (!app) return openWeb(url)
  // The web page is only a fallback for a phone without the YouTube app,
  // and it must never open after the app did: that was the white browser
  // sheet Hamza found waiting when he came back («ما أبغاها أبداً»). iOS
  // freezes a home-screen app's timers while YouTube is in front, so the
  // fallback timer then fires late, on his return, with the page visible
  // again. Any sign that the app took over — the page hidden, blurred or
  // put away, or the timer running late — cancels it for good.
  const t0 = Date.now()
  let left = false
  const away = () => { left = true }
  const onVis = () => { if (document.visibilityState === 'hidden') left = true }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pagehide', away)
  window.addEventListener('blur', away)
  // a link click: the same hand-off as location.href on the phone, and it
  // leaves the page (and its state) exactly as it was
  const a = document.createElement('a')
  a.href = app
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pagehide', away)
    window.removeEventListener('blur', away)
    if (shouldFallback({ left, elapsed: Date.now() - t0, visible: document.visibilityState === 'visible' })) openWeb(url)
  }, 1500)
}

/** For <a href> links: keeps the href (long-press, copy) and opens through openYouTube. */
export const onVideoClick = (url) => (e) => { e.preventDefault(); openYouTube(url) }
