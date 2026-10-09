// ── «جديد في مران» ────────────────────────────────────────────
//
// Shown once after an update (App decides when: never on a fresh
// install — critique F45), and never over a running session: it holds
// until the player is closed. The kit's sheet: one scrim, top corners 16,
// a real way in and a real way out. Every line is a Phosphor icon, a
// title and one or two sentences in plain Saudi Arabic — no emoji, no
// "اضغط <gear>", and no "3 أيام أسبوعياً": the plan is a rolling cycle.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sheet, Button, Num } from './kit/index.jsx'
import { Palette, Flame, Ticket, ListChecks, Barbell, Timer, ArrowUp, Bell } from './kit/icons.js'
import { useScreenClear } from './system/layers.js'
import '../styles/screens/system.css'

const FEATURES = [
  {
    Icon: Palette,
    title: 'شكل جديد بالكامل',
    desc: 'أرقام أكبر تنقرأ من على البنش، وزر أخضر واحد في كل شاشة. تبي القديم؟ طفّ «التصميم الجديد» من الإعدادات وبياناتك نفسها.',
  },
  {
    Icon: Flame, tone: 'streak',
    title: 'الستريك صار يعدّ التزامك',
    desc: 'كل يوم تمرين أو راحة من خطتك ينحسب. اضغط على الرقم وتشوف وش انحسب ووش لا.',
  },
  {
    Icon: Ticket, tone: 'rest',
    title: 'تذاكر الراحة تحمي الستريك',
    desc: 'كل كم يوم محسوب تكسب تذكرة. لو فاتك يوم تمرين تنصرف تذكرة، والستريك يوقف مكانه بدل ما يرجع صفر.',
  },
  {
    Icon: ListChecks,
    title: 'ملخص بعد كل جلسة',
    desc: 'تخلّص تمرينك وتشوف المدة والمجموعات والحجم وأرقامك القياسية مرة وحدة، بدل تنبيهات ورا بعض.',
  },
  {
    Icon: Barbell,
    title: 'الجلسة بملء الشاشة',
    desc: 'وقت التمرين ما قدامك إلا تمرينك. صغّرها بالسهم وتصير شريط فوق التبويبات ترجع له بضغطة.',
  },
  {
    Icon: Timer, tone: 'rest',
    title: 'الراحة داخل الجلسة',
    desc: 'بعد كل مجموعة يبدأ عدّ الراحة في نفس الشاشة، وتزيد أو تنقص منه بضغطة.',
  },
  {
    Icon: ArrowUp, tone: 'raise',
    title: 'متى ترفع الوزن',
    desc: 'لما توصل لأعلى عدد تكرارات، التطبيق يقترح الوزن الجديد بالذهبي. ولو ما تبي، خلّه على وزنك.',
  },
  {
    Icon: Bell,
    title: 'التنبيهات صارت تحت',
    desc: 'تطلع فوق التبويبات وما تغطي شي. اضغطها أو اسحبها وتختفي.',
  },
]

export default function WhatsNewModal({ version, onClose }) {
  // Never over a session: a workout restored at launch opens the player
  // as a cover, and the changelog must not land on top of it between
  // sets. It waits — no sheet, nothing inert — until no full-screen
  // layer is up, then opens and stays open.
  const [started, setStarted] = useState(false)
  const clear = useScreenClear(!started)
  useEffect(() => { if (clear) setStarted(true) }, [clear])

  // Closing plays the sheet's way out before the parent unmounts it.
  const [closing, setClosing] = useState(false)
  const done = useRef(false)
  const close = useCallback(() => {
    if (done.current) return
    done.current = true
    setClosing(true)
    setTimeout(() => onClose?.(), 230)
  }, [onClose])

  return (
    <Sheet
      open={started && !closing}
      onClose={close}
      title={<>جديد في مران <span className="sys-wn-ver">· الإصدار <Num>{version}</Num></span></>}
      footer={<Button variant="primary" size="lg" full onClick={close}>تمام</Button>}
    >
      <ul className="sys-wn-list">
        {FEATURES.map(({ Icon, tone, title, desc }) => (
          <li key={title} className="sys-wn-item">
            <Icon size={24} weight="regular" className={`sys-wn-icon${tone ? ` is-${tone}` : ''}`} aria-hidden="true" />
            <div>
              <h3 className="sys-wn-title">{title}</h3>
              <p className="sys-wn-desc">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
