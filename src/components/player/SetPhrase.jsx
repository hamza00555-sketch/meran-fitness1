import { Num } from '../kit/index.jsx'
import { setParts, repsWord } from './sessionWords.js'

// A set in words, its numbers in the numeric face: «72.5 كجم × 9 عدّات»
// — the one format the player prints a set in (sessionWords.setWords is
// the same words as text). Each number stays on a line with its unit; a
// narrow column may break at «×», never between a number and its unit.

export default function SetPhrase({ set, className }) {
  const p = setParts(set)
  if (!p) return null
  return (
    <span className={className ? `s-phrase ${className}` : 's-phrase'}>
      {p.w && <span className="s-pair"><Num>{p.w}</Num> كجم</span>}
      {p.w && p.r ? ' × ' : null}
      {p.r ? <span className="s-pair"><Num>{p.r}</Num> {repsWord(p.r)}</span> : null}
    </span>
  )
}
