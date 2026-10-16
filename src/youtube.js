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

/** Opens a video link: the YouTube app directly on iOS, a new tab elsewhere. */
export function openYouTube(url) {
  if (!url) return
  const app = isIOS() ? appLink(url) : null
  if (!app) return openWeb(url)
  let left = false
  const away = () => { if (document.visibilityState === 'hidden') left = true }
  document.addEventListener('visibilitychange', away)
  // a link click rather than location.href: the same hand-off on the
  // phone, and it leaves the page (and its state) exactly as it was
  const a = document.createElement('a')
  a.href = app
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => {
    document.removeEventListener('visibilitychange', away)
    if (!left && document.visibilityState === 'visible') openWeb(url)
  }, 1500)
}

/** For <a href> links: keeps the href (long-press, copy) and opens through openYouTube. */
export const onVideoClick = (url) => (e) => { e.preventDefault(); openYouTube(url) }
