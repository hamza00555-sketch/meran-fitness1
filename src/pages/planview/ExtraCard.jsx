// ── «تسويه بالجلسة — مو بخطتك»: one exercise he does that his plan doesn't say ──
//
// حمزة: «في خطتي تمارين الرجلين مالقيت تمرين abdication و addactor معناها في
// تمارين كثير مو مضافه». Under a day's cards, what his recent sessions of
// that day had and the day hasn't (src/plan/view.js doneNotInPlan), each
// as a card of its own — the plan card's picture and names, so the same
// machine looks the same — but not one of the plan's: no fill, a dashed
// edge where a plan card has its surface, and its first line says so.
// Then what he did on it last time and how often he does it, and two
// answers: «ثبّته بخطتي» (into the plan, the card moves up into the list)
// and «مو هنا» (not on this day; remembered).

import { useMemo } from 'react'
import { Num } from '../../components/kit/index.jsx'
import { PushPin, ClockCounterClockwise } from '../../components/kit/icons.js'
import SessionMedia from '../../components/player/SessionMedia.jsx'
import SetPhrase from '../../components/player/SetPhrase.jsx'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { previousSets, setsPhrase } from '../../components/player/sessionWords.js'
import { kindLine, topSet } from './PlanCard.jsx'

/** «سوّيته بـ3 من آخر 4 جلسات», «… بآخر 4 جلسات كلها», «سوّيته آخر جلسة». */
export function oftenParts({ count = 0, of = 0 } = {}) {
  if (of <= 1 || (of === 2 && count < 2)) return { pre: 'سوّيته آخر جلسة', n: null }
  if (of === 2) return { pre: 'سوّيته بآخر جلستين', n: null }
  if (count >= of) return { pre: 'سوّيته بآخر', n: of, post: 'جلسات كلها' }
  return { pre: 'سوّيته بـ', n: count, mid: 'من آخر', m: of, post: 'جلسات' }
}

function Often({ item }) {
  const p = oftenParts(item)
  if (p.n == null) return <>{p.pre}</>
  if (p.m == null) return <>{p.pre} <Num>{p.n}</Num> {p.post}</>
  return <>{p.pre}<Num>{p.n}</Num> {p.mid} <Num>{p.m}</Num> {p.post}</>
}

export default function ExtraCard({ item, mapping = {}, sessions = [], onPin, onDismiss }) {
  const { ar, en } = exerciseNames(item.name, mapping)
  const kind = kindLine(item.name, item.muscle, mapping)
  const prev = useMemo(() => previousSets(sessions, item.name, mapping), [sessions, item.name, mapping])
  const last = topSet(prev)
  const did = setsPhrase(prev.length)

  return (
    <div className="pv-xcard" data-testid="extra-card" data-key={item.key} data-name={item.name}>
      <span className="pv-xtag">
        <ClockCounterClockwise size={16} weight="bold" aria-hidden="true" />تسويه بالجلسة — مو بخطتك
      </span>

      <span className="pv-art" aria-hidden="true">
        <SessionMedia name={item.name} mapping={mapping} muscle={item.muscle} className="pv-art-img" />
      </span>

      <span className="pv-head">
        <span className="pv-ar" dir={/[؀-ۿ]/.test(ar) ? undefined : 'ltr'}>{ar}</span>
        {en && <bdi className="pv-en" dir="ltr">{en}</bdi>}
        {kind && <span className="pv-kind">{kind}</span>}
      </span>

      <span className="pv-xfacts">
        {last ? (
          <span className="pv-xfact">
            آخر مرة <SetPhrase set={last} />
            {prev.length > 0 && <> · {did.num != null && <><Num>{did.num}</Num> </>}{did.word}</>}
          </span>
        ) : null}
        <span className="pv-xfact pv-xoften"><Often item={item} /></span>
      </span>

      <span className="pv-xacts">
        <button type="button" className="pv-pin" data-testid="extra-pin" onClick={onPin}>
          <PushPin size={18} weight="bold" aria-hidden="true" />ثبّته بخطتي
        </button>
        <button type="button" className="pv-skip" data-testid="extra-dismiss" aria-label={`مو هنا: ${ar}`} onClick={onDismiss}>
          مو هنا
        </button>
      </span>
    </div>
  )
}
