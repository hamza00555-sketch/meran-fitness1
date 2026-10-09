import { Num } from '../kit/index.jsx'

// A run of digits or Latin letters, with the punctuation and single
// spaces inside it: «100», «8 يوليو 2026» → «8», «2026»,
// «Bench Press», «6:40».
const RUN = /([A-Za-z0-9](?:[A-Za-z0-9.,:/+\-]|\s(?=[A-Za-z0-9]))*)/

/**
 * Text that mixes Arabic with numbers or Latin — a formatted date, an
 * achievement title written in constants.js («أول 100 كجم»), a
 * description naming a lift — with every such run isolated in <Num>, so
 * it sits in the numeric face and never reorders inside the Arabic line.
 */
export default function Numify({ children }) {
  const s = String(children ?? '')
  const parts = s.split(RUN)
  return <>{parts.map((p, i) => (i % 2 ? <Num key={i}>{p}</Num> : p))}</>
}
