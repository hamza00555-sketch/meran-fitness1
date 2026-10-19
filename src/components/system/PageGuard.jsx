// ── A page or an overlay that fails never takes the app with it ──
//
// حمزة: «احيانا لما ادخل خطتي البرنامج يعلق على شاشة سودا وماعاد يفتح».
// An error React has nothing to catch unmounts the whole app: the screen
// goes to the ground colour — black — and stays there. Every page App
// opens over the app («خطتي», the builder, the month report and its story,
// the session, the summary, the sheets of record) sits inside a Guard:
//
//   · while a lazy page's code is on its way, nothing for 300 ms (a blink
//     needs no spinner), then «نفتح خطتي…» on the scrim with a ×, so it
//     never looks frozen (PageLoading);
//   · if it fails — its code did not arrive (src/lazyPage.js already tried
//     one reload), or something inside it threw — the page goes and a
//     card says so in plain words: «ما قدرنا نفتح خطتي», «جرّب مرة ثانية»
//     and «رجوع». What the page held (its scroll lock, the app made
//     inert behind it) went with it: React runs its cleanups as it
//     unmounts. Behind the card is the app, usable again.
//
// «جرّب مرة ثانية» renders it afresh; for code that did not arrive it
// reloads into the newest version and opens the same page again (the
// tap is his, so it is not limited to one like the automatic reload).
// One quiet console line, no stack, nothing technical on screen.
//
// AppGuard (main.jsx) is the last resort around everything else: a
// full-screen card and «افتح من جديد», never a black screen.

import { Component, Fragment, Suspense, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sheet, Button, IconButton } from '../kit/index.jsx'
import { ArrowsClockwise, X } from '../kit/icons.js'
import { isChunkError, reloadInto, claimReload } from '../../lazyPage.js'
import { reloadIntoUpdate, reloadPossible } from '../../appUpdate.js'
import { lockScroll } from '../../scrollLock.js'
import '../../styles/screens/system.css'

function quietLog(label, error) {
  try {
    const what = isChunkError(error) ? 'did not load' : 'stopped'
    console.warn(`meran: «${label}» ${what} (${String(error?.message ?? error).slice(0, 140)})`)
  } catch { /* no console */ }
}

/**
 * label    the page in Arabic, as it follows «نفتح» / «ما قدرنا نفتح» (خطتي)
 * onClose  takes the page away (App's state)
 * reopen   what to open again after a reload ({ page, … }), for lazy pages
 * lazy     a lazyPage component inside: Suspense with the loading state, and reset on retry
 */
export class Guard extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, round: 0 }
    this.retry = this.retry.bind(this)
    this.close = this.close.bind(this)
  }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error) { quietLog(this.props.label, error) }

  retry() {
    const { error } = this.state
    if (isChunkError(error) && this.props.reopen && reloadInto(this.props.reopen)) return
    this.props.lazy?.reset?.()
    this.setState(s => ({ error: null, round: s.round + 1 }))
  }

  close() {
    this.props.lazy?.reset?.()
    this.setState(s => ({ error: null, round: s.round + 1 }))
    this.props.onClose?.()
  }

  render() {
    const { error, round } = this.state
    const { children, label, lazy, onClose } = this.props
    if (error) return <FailCard label={label} chunk={isChunkError(error)} onRetry={this.retry} onClose={this.close} />
    return (
      <Fragment key={round}>
        {lazy ? <Suspense fallback={<PageLoading label={label} onClose={onClose} />}>{children}</Suspense> : children}
      </Fragment>
    )
  }
}

function FailCard({ label, chunk, onRetry, onClose }) {
  const [open, setOpen] = useState(true)
  const titleId = useId()
  // The card leaves the way every sheet does before it is taken away.
  const close = () => {
    if (!open) return
    setOpen(false)
    setTimeout(() => onClose?.(), 230)
  }
  return (
    <Sheet open={open} onClose={close} labelledBy={titleId}
      footer={(
        <div className="sys-fail-actions">
          <Button variant="primary" size="lg" full onClick={onRetry} data-testid="page-retry">جرّب مرة ثانية</Button>
          <Button variant="secondary" size="lg" full onClick={close} data-testid="page-fail-close">رجوع</Button>
        </div>
      )}>
      <div className="sys-fail" data-testid="page-fail" role="alert">
        <span className="sys-fail-mark" aria-hidden="true"><ArrowsClockwise size={30} weight="bold" /></span>
        <h2 id={titleId} className="sys-fail-title">ما قدرنا نفتح {label}</h2>
        <p className="sys-fail-line">{chunk ? 'يمكن التطبيق تحدّث أو النت ضعيف.' : 'صار خلل بسيط وما كمّلت.'}</p>
        <p className="sys-fail-line">بياناتك كلها محفوظة.</p>
      </div>
    </Sheet>
  )
}

/** «نفتح خطتي…», after 300 ms, until the page arrives (or he closes it). */
export function PageLoading({ label, onClose, delay = 300 }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  useEffect(() => (shown ? lockScroll() : undefined), [shown])
  if (!shown) return null
  return createPortal(
    <div className="sys-load" data-testid="page-loading">
      <div className="sys-load-card" role="status" aria-live="polite">
        <span className="sys-load-ring" aria-hidden="true" />
        <span className="sys-load-text">نفتح {label}…</span>
        {onClose && <IconButton icon={X} label="إغلاق" onClick={onClose} className="sys-load-x" />}
      </div>
    </div>,
    document.body,
  )
}

/** Around the whole app (main.jsx): never a black screen. */
export class AppGuard extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error) {
    quietLog('مران', error)
    // Everything that held the page is gone; make sure the card can be tapped.
    try {
      document.body.style.overflow = ''
      const root = document.getElementById('root')
      if (root) root.inert = false
    } catch { /* no DOM */ }
    // Code of a version the server no longer has: one automatic reload.
    if (isChunkError(error) && reloadPossible() && claimReload()) reloadIntoUpdate()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="sys-crash" role="alert" data-testid="app-fail">
        <img src="/assets/meran-app-icon-transparent-180.png" alt="" width="76" height="76" />
        <h1>صار خلل ووقف التطبيق</h1>
        <p>بياناتك كلها محفوظة على جوالك. افتحه من جديد وكمّل.</p>
        <button type="button" className="k-btn k-btn-primary k-btn-lg" onClick={() => location.reload()}>
          <span>افتح من جديد</span>
        </button>
      </div>
    )
  }
}
