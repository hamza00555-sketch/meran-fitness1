import { Num } from '../kit/index.jsx'
import { countParts } from './model.js'

// Arabic text with every number and Latin run isolated LTR and tabular
// (<Num>), so «21 – 27 يونيو», «دفع A» and «1 س 5 د» never reorder and
// digits sit in the numeric face. For strings built from data; JSX that
// already knows where its numbers are uses <Num> directly.
const RUN = /([0-9A-Za-z](?:[0-9A-Za-z.,:'’ -]*[0-9A-Za-z])?)/

export default function Txt({ children }) {
  const s = children == null ? '' : String(children)
  if (!RUN.test(s)) return s
  return s.split(RUN).map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))
}

/** A counted noun: «جلستين», «<Num>18</Num> مجموعة». */
export function Count({ n, noun }) {
  const p = countParts(n, noun)
  return p.n == null ? p.word : <><Num>{p.n}</Num> {p.word}</>
}
