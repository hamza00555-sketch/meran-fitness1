import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { CaretLeft, MagnifyingGlass, X, ChartLineUp, Barbell } from '../components/kit/icons.js'
import { Segmented, Num, Weight, IconButton, Button } from '../components/kit/index.jsx'
import Art from '../assets/Art.jsx'
import { MUSCLE_GROUPS } from '../constants.js'
import { detectEquipment } from '../utils.js'
import { arabicName, equipLabel } from '../exerciseMedia.js'
import { searchExercises, buildIndex, search } from '../search.js'
import ExerciseInfoModal from '../components/ExerciseInfoModal.jsx'
import Thumb, { webp } from '../components/library/Thumb.jsx'
import Sparkline from '../components/library/Sparkline.jsx'
import {
  buildProgress, summarize, countWord, fmtKg, SESSION_WORDS, EXERCISE_WORDS,
} from '../components/library/progress.js'
import '../styles/screens/library.css'

// ── المكتبة ───────────────────────────────────────────────────
//
// «تحت الأضواء» for the library (critique: page-exercises, F36, F37,
// F39, F61, F62, F08). The large title «المكتبة» is drawn by App above
// this page. Then:
//
//   · a 44pt search pill that stays put and understands the gym's
//     words (src/search.js): «بنش», «سكوات», «لات», «بايسبس»…
//   · «الكل · تقدمي · المعدات», fixed weights, no emoji
//   · الكل: a row of muscle tiles — small lit stages, the muscle art,
//     the label and how many lifts — that filter the list under them;
//     no colour per muscle, the only green is the art's own light.
//     Rows are 64pt: a 48pt thumbnail, the Arabic name over the English
//     one, the last weight in the numeric face.
//   · تقدمي: per lift a 64×24 trend of the estimated one-rep max, the
//     current estimate, and the best weight — the screen's only gold.
//     Deload sessions stay out of the estimate (progress.js summarize).
//   · المعدات: the lifts you have done, grouped by what they use.
//
// Any row opens the exercise sheet (components/ExerciseInfoModal.jsx).

const RESULT_WORDS = ['نتيجة وحدة', 'نتيجتين', 'نتائج', 'نتيجة']

// The same equipment words the exercise card uses (exerciseMedia.js);
// names the media map does not know fall back to reading the name.
const DETECTED = {
  'Barbell': 'بار', 'Dumbbell': 'دمبل', 'Cable': 'كيبل', 'Machine': 'جهاز',
  'Smith Machine': 'سميث', 'Resistance Band': 'مطاط', 'Kettlebell': 'كيتل بل',
  'Bodyweight': 'وزن الجسم',
}
const EQUIP_ORDER = ['بار', 'دمبل', 'جهاز', 'كيبل', 'سميث', 'وزن الجسم', 'كارديو']
const equipOf = (name, mapping) => equipLabel(name, mapping) || DETECTED[detectEquipment(name)] || 'أخرى'

const MUSCLE_ORDER = Object.keys(MUSCLE_GROUPS)
const orderOf = (list, key) => { const i = list.indexOf(key); return i === -1 ? list.length : i }

export default function ExercisesPage({ sessions = [], exerciseMapping = {} }) {
  const [view, setView] = useState('all')
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState(null)
  const [infoEx, setInfoEx] = useState(null)
  const q = useDeferredValue(query.trim())

  const progress = useMemo(() => buildProgress(sessions, exerciseMapping), [sessions, exerciseMapping])

  // name (and every alias it was logged under) → the last session's top weight
  const lastWeightMap = useMemo(() => {
    const map = {}
    for (const ex of progress) {
      if (!ex.entries.length) continue
      const last = ex.entries[ex.entries.length - 1]
      map[ex.name.toLowerCase()] = last.maxW
      for (const alias of ex.aliases || []) map[alias.toLowerCase()] = last.maxW
    }
    return map
  }, [progress])

  const open = (name, muscleKey) => setInfoEx({ name, muscle: muscleKey })
  const lastOf = (name) => lastWeightMap[name.toLowerCase()]

  return (
    <div className="lib">
      <SearchField value={query} onChange={setQuery} />

      <Segmented className="lib-seg" label="طريقة العرض" value={view} onChange={setView}
        options={[
          { value: 'all', label: 'الكل' },
          { value: 'progress', label: 'تقدمي' },
          { value: 'equipment', label: 'المعدات' },
        ]} />

      {view === 'all' && (q
        ? <SearchResults q={q} mapping={exerciseMapping} lastOf={lastOf} onOpen={open} />
        : <Browse muscle={muscle} setMuscle={setMuscle} mapping={exerciseMapping} lastOf={lastOf} onOpen={open} />)}

      {view === 'progress' && (
        <ProgressView progress={progress} q={q} mapping={exerciseMapping} onOpen={open} />
      )}

      {view === 'equipment' && (
        <EquipmentView progress={progress} q={q} mapping={exerciseMapping} onOpen={open} />
      )}

      {infoEx && (
        <ExerciseInfoModal exercise={infoEx} sessions={sessions} mapping={exerciseMapping}
          onClose={() => setInfoEx(null)} />
      )}
    </div>
  )
}

// ── The search pill ───────────────────────────────────────────
// Stays under the title while the list scrolls. Not autofocused: the
// keyboard would cover the tiles, which are the faster way in.
function SearchField({ value, onChange }) {
  const input = useRef(null)
  return (
    <div className="lib-bar">
      <label className="lib-search">
        <MagnifyingGlass size={20} weight="bold" className="lib-search-icon" aria-hidden="true" />
        <input ref={input} type="search" value={value} onChange={e => onChange(e.target.value)}
          placeholder="ابحث: بنش، سكوات، لات…" aria-label="ابحث عن تمرين"
          enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
        {value && (
          <IconButton icon={X} label="مسح البحث" iconSize={18} weight="bold" className="lib-search-clear"
            onClick={() => { onChange(''); input.current?.focus() }} />
        )}
      </label>
    </div>
  )
}

// ── الكل: tiles + the list they filter ────────────────────────
function Browse({ muscle, setMuscle, mapping, lastOf, onOpen }) {
  const groups = Object.entries(MUSCLE_GROUPS)
  const shown = muscle ? groups.filter(([k]) => k === muscle) : groups
  return (
    <>
      <div className="lib-tiles" role="group" aria-label="العضلات">
        {groups.map(([key, g]) => (
          <button key={key} type="button" className="lib-tile" aria-pressed={muscle === key}
            onClick={() => setMuscle(muscle === key ? null : key)}>
            {g.img && <img className="lib-tile-art" src={webp(g.img)} alt="" decoding="async" />}
            <span className="lib-tile-text">
              <span className="lib-tile-label">{g.label}</span>
              <Num className="lib-tile-count">{(g.exercises || []).length}</Num>
            </span>
          </button>
        ))}
      </div>

      {shown.map(([key, g]) => (
        <section key={key} className="lib-sec" aria-label={g.label}>
          <SectionHead title={g.label} count={(g.exercises || []).length} words={EXERCISE_WORDS}
            action={muscle && (
              <Button variant="plain" size="md" onClick={() => setMuscle(null)}>كل العضلات</Button>
            )} />
          <div className="lib-list">
            {(g.exercises || []).map(ex => (
              <ExerciseRow key={ex.name} name={ex.name} muscle={key} mapping={mapping}
                last={lastOf(ex.name)} onOpen={() => onOpen(ex.name, key)} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function SearchResults({ q, mapping, lastOf, onOpen }) {
  const hits = useMemo(() => searchExercises(q), [q])
  if (!hits.length) {
    return (
      <LibEmpty icon={MagnifyingGlass} title={<>ما لقينا «{q}»</>}>
        جرّب اسم ثاني مثل: بنش، سكوات، سحب أمامي، أو اسم العضلة.
      </LibEmpty>
    )
  }
  return (
    <section className="lib-sec" aria-label="نتائج البحث">
      <SectionHead title="النتائج" count={hits.length} words={RESULT_WORDS} />
      <div className="lib-list">
        {hits.map(({ entry }) => (
          <ExerciseRow key={entry.name} name={entry.name} muscle={entry.muscle} mapping={mapping}
            last={lastOf(entry.name)} showMuscle onOpen={() => onOpen(entry.name, entry.muscle)} />
        ))}
      </div>
    </section>
  )
}

// ── تقدمي ─────────────────────────────────────────────────────
function ProgressView({ progress, q, mapping, onOpen }) {
  const rows = useFiltered(progress, q)
  if (!progress.length) {
    return (
      <LibEmpty art="empty_progress" icon={ChartLineUp} title="تقدمك يطلع هنا">
        خلّص أول جلسة، ونرسم لك خط تقدم كل تمرين.
      </LibEmpty>
    )
  }
  if (!rows.length) return <NoMatch q={q} />
  if (q) {
    return (
      <section className="lib-sec" aria-label="نتائج البحث">
        <SectionHead title="النتائج" count={rows.length} words={RESULT_WORDS} />
        <div className="lib-list">{rows.map(p => <ProgressRow key={p.name} p={p} mapping={mapping} onOpen={onOpen} />)}</div>
      </section>
    )
  }
  const byMuscle = groupBy(rows, p => p.muscle || 'other')
  const keys = Object.keys(byMuscle).sort((a, b) => orderOf(MUSCLE_ORDER, a) - orderOf(MUSCLE_ORDER, b))
  return (
    <>
      <p className="lib-note">الخط: تقدير أقصى وزن تشيله مرة وحدة، والأحدث على اليسار.</p>
      {keys.map(k => {
        const list = byMuscle[k].sort((a, b) => lastId(b) - lastId(a))
        return (
          <section key={k} className="lib-sec" aria-label={MUSCLE_GROUPS[k]?.label || k}>
            <SectionHead title={MUSCLE_GROUPS[k]?.label || 'أخرى'} count={list.length} words={EXERCISE_WORDS} />
            <div className="lib-list">{list.map(p => <ProgressRow key={p.name} p={p} mapping={mapping} onOpen={onOpen} />)}</div>
          </section>
        )
      })}
    </>
  )
}

function ProgressRow({ p, mapping, onOpen }) {
  const s = summarize(p)
  if (!s) return null
  const ar = arabicName(p.name, mapping)
  const sw = countWord(s.sessions, SESSION_WORDS)
  const trend = s.trend.slice(-12)
  return (
    <button type="button" className="lib-row lib-prow" onClick={() => onOpen(p.name, p.muscle)}>
      <span className="lib-row-main">
        <span className="lib-row-title">{ar || p.name}</span>
        <span className="lib-row-sub lib-row-sub-wrap">
          <span>آخر <Num>{fmtKg(s.last.maxW)}{s.last.reps ? ` × ${s.last.reps}` : ''}</Num></span>
          {/* A deload is why «آخر» sits under the estimate: say so, in place
              of the session count (which the sheet still shows). */}
          {s.lastDeload
            ? <span className="lib-sub-keep">ديلود</span>
            : <span>{sw.n != null && <><Num>{sw.n}</Num> </>}{sw.word}</span>}
        </span>
      </span>
      <Sparkline values={trend} width={64} height={24}
        label={`التقدير في آخر ${trend.length} جلسات: من ${Math.round(trend[0])} إلى ${s.e1rm}`} />
      <span className="lib-prow-vals">
        <span className="lib-prow-est"><span className="lib-val-label">تقدير</span> <Num>{s.e1rm}</Num></span>
        <span className="lib-prow-best">أعلى <Num>{fmtKg(s.best)}</Num><span className="lib-prow-unit"> كجم</span></span>
      </span>
    </button>
  )
}

// ── المعدات ───────────────────────────────────────────────────
function EquipmentView({ progress, q, mapping, onOpen }) {
  const rows = useFiltered(progress, q)
  if (!progress.length) {
    return (
      <LibEmpty art="empty_equipment" icon={Barbell} title="معداتك تطلع هنا">
        خلّص جلساتك، ونجمع لك تمارينك حسب المعدّة مع أعلى وزن في كل وحدة.
      </LibEmpty>
    )
  }
  if (!rows.length) return <NoMatch q={q} />
  const byEquip = groupBy(rows.map(p => ({ ...p, allMax: Math.max(...p.entries.map(e => e.maxW)) })), p => equipOf(p.name, mapping))
  const keys = Object.keys(byEquip).sort((a, b) => orderOf(EQUIP_ORDER, a) - orderOf(EQUIP_ORDER, b))
  return keys.map(eq => {
    const list = byEquip[eq].sort((a, b) => b.allMax - a.allMax)
    const top = list[0]?.allMax || 0
    return (
      <section key={eq} className="lib-sec" aria-label={eq}>
        <SectionHead title={eq} count={list.length} words={EXERCISE_WORDS} />
        <div className="lib-list">
          {list.map(p => {
            const ar = arabicName(p.name, mapping)
            const sw = countWord(p.entries.length, SESSION_WORDS)
            const last = p.entries[p.entries.length - 1]
            return (
              <button key={p.name} type="button" className="lib-row" onClick={() => onOpen(p.name, p.muscle)}>
                <Thumb name={p.name} art={MUSCLE_GROUPS[p.muscle]?.img} mapping={mapping} />
                <span className="lib-row-main">
                  <span className="lib-row-title">{ar || p.name}</span>
                  <span className="lib-row-sub">
                    {sw.n != null && <><Num>{sw.n}</Num> </>}{sw.word}
                    {last.maxW !== p.allMax && <>{' · آخر '}<Num>{fmtKg(last.maxW)}</Num></>}
                  </span>
                </span>
                <span className="lib-row-val">
                  <span className="lib-val-label">أعلى</span>
                  <Weight kg={p.allMax} className={p.allMax === top ? 'lib-best' : undefined} />
                </span>
                <CaretLeft size={16} weight="bold" className="lib-row-chev" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>
    )
  })
}

// ── Pieces ────────────────────────────────────────────────────

function ExerciseRow({ name, muscle, mapping, last, showMuscle, onOpen }) {
  const ar = arabicName(name, mapping)
  const g = MUSCLE_GROUPS[muscle]
  const muscleLabel = showMuscle && g ? g.label : null
  return (
    <button type="button" className="lib-row" onClick={onOpen}>
      <Thumb name={name} art={g?.img} mapping={mapping} />
      <span className="lib-row-main">
        <span className="lib-row-title">{ar || name}</span>
        {(ar || muscleLabel) && (
          <span className="lib-row-sub">
            {muscleLabel}
            {ar && muscleLabel && ' · '}
            {ar && <bdi dir="ltr" className="lib-en">{name}</bdi>}
          </span>
        )}
      </span>
      {last != null && (
        <span className="lib-row-val">
          <span className="lib-val-label">آخر</span>
          <Weight kg={last} />
        </span>
      )}
      <CaretLeft size={16} weight="bold" className="lib-row-chev" aria-hidden="true" />
    </button>
  )
}

function SectionHead({ title, count, words, action }) {
  const c = countWord(count, words)
  return (
    <div className="lib-sec-h">
      <h2 className="lib-sec-title">{title}</h2>
      <span className="lib-sec-count">{c.n != null && <><Num>{c.n}</Num> </>}{c.word}</span>
      {action && <span className="lib-sec-action">{action}</span>}
    </div>
  )
}

function LibEmpty({ art, icon: Icon, title, children }) {
  const glyph = <Icon size={40} weight="regular" className="k-empty-icon" aria-hidden="true" />
  return (
    <div className="k-empty lib-empty">
      {art ? <Art id={art} size={96} fallback={glyph} /> : glyph}
      <strong className="k-empty-title">{title}</strong>
      {children && <p className="k-empty-body">{children}</p>}
    </div>
  )
}

function NoMatch({ q }) {
  return (
    <LibEmpty icon={MagnifyingGlass} title={<>ما لقينا «{q}» في تمارينك</>}>
      البحث هنا في التمارين اللي سجّلتها. للمكتبة كلها ارجع لـ«الكل».
    </LibEmpty>
  )
}

// Search over the lifts in the history (which may include names the
// catalogue does not know), best match first.
function useFiltered(progress, q) {
  const index = useMemo(() => buildIndex(progress.map(p => ({ name: p.name, muscle: p.muscle, p }))), [progress])
  return useMemo(() => (q ? search(index, q).map(h => h.entry.p) : progress), [index, q, progress])
}

function groupBy(list, keyOf) {
  const out = {}
  for (const item of list) (out[keyOf(item)] ||= []).push(item)
  return out
}

const lastId = (p) => p.entries[p.entries.length - 1]?.sessionId || 0
