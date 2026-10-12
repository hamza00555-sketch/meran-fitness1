import { useEffect, useMemo, useRef, useState } from 'react'
import { ACHIEVEMENTS, ACHIEVEMENT_CATS, RARITY_COLORS } from '../constants.js'
import { getRank, xpProgress } from '../utils.js'
import { Num, Gauge, Chip, Sheet, Chapter } from '../components/kit/index.jsx'
import Medal from '../components/progress/Medal.jsx'
import MedalReveal from '../components/progress/MedalReveal.jsx'
import { warmMedals, dropWarm } from '../components/progress/medalStage.js'
import RankLadder from '../components/progress/RankLadder.jsx'
import RankCrest from '../components/progress/RankCrest.jsx'
import Numify from '../components/progress/Numify.jsx'
import { progressContext, progressOf, nearestLocked, fmtEarned, fmtDate, achText } from '../components/progress/achievementMeta.js'
import '../styles/screens/progress.css'

// ── الإنجازات ─────────────────────────────────────────────────
//
// One lit moment: the rank crest on a stage, the letter beside its
// Arabic name, and the one number that moves — XP to the next level.
// Under it the ladder E → S+, then «التالي» (the three badges closest
// to flipping, with how far along they are), then the medal wall in
// three columns. Tapping a medal opens it in a sheet — an earned one
// spins there on its metal edge every time it opens (حمزة: «كل ما
// أفتحها»), and a tap on it spins it again; a locked one stays flat.
// Once the page has settled, the 3D stage is built for the medal earned
// last, and parked; each sheet takes it, prepares its own medal on it (a
// medal's pictures start being made as a finger lands on its tile) and
// parks it again on closing — one GL context for the whole wall, freed
// with the page. So the sheet's medal is ready for its beat (SHEET_BEAT);
// when it isn't, the flat medal turns in its place, on time.
//
// No gold on this page at all: gold means «raise the weight». XP and
// the level are neutral or accent.

const fmt = (n) => Math.round(n).toLocaleString('en-US')

export default function AchievementsPage({ sessions = [], xp = 0, streak = 0, unlockedAchievements, unlockedAt = {}, level: levelProp }) {
  const [cat, setCat] = useState('all')
  const [open, setOpenId] = useState(null)
  // Every opening is a new reveal, even of the medal just closed.
  const [opens, setOpens] = useState(0)
  const setOpen = (id) => { if (id) setOpens(n => n + 1); setOpenId(id) }

  const unlocked = unlockedAchievements || []
  const satisfied = useMemo(() => new Set(
    ACHIEVEMENTS.filter(a => { try { return a.check(sessions, xp, streak) } catch { return false } }).map(a => a.id),
  ), [sessions, xp, streak])
  const isEarned = (id) => unlocked.includes(id) || satisfied.has(id)
  const ctx = useMemo(() => progressContext(sessions, streak), [sessions, streak])

  const prog = xpProgress(xp)
  const level = levelProp || prog.level
  const rank = getRank(level)
  const left = Math.max(0, prog.neededXP - prog.currentXP)

  const earnedCount = ACHIEVEMENTS.filter(a => isEarned(a.id)).length
  const next = nearestLocked(ACHIEVEMENTS, isEarned, ctx, 3)
  const shown = cat === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => a.cat === cat)
  const openA = open && ACHIEVEMENTS.find(a => a.id === open)

  // An earned medal will spin here: its stage, built ahead (never when
  // there is nothing earned to open), and freed with the page.
  const sheetOpen = useRef(false)
  sheetOpen.current = !!open
  useEffect(() => {
    if (!earnedCount) return
    const t = setTimeout(() => {
      if (sheetOpen.current) return   // a sheet already has its own
      const last = ACHIEVEMENTS.filter(a => isEarned(a.id))
        .sort((x, y) => (unlockedAt[y.id] || 0) - (unlockedAt[x.id] || 0))[0]
      if (last) warmMedals([last], { queue: false, variant: 'sheet', date: sheetDate(unlockedAt[last.id]) })
    }, 1200)
    return () => clearTimeout(t)
  }, [earnedCount > 0]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => dropWarm(), [])
  const press = (a) => () => {
    if (isEarned(a.id)) warmMedals([a], { gl: false, queue: false, variant: 'sheet', date: sheetDate(unlockedAt[a.id]) })
  }

  return (
    <div className="pg" data-testid="achievements">
      {/* ── The rank on a lit stage ── */}
      <section className="pg-stage" aria-label="رتبتك">
        <RankCrest rank={rank} size={160} className="pg-stage-art" />
        <div className="pg-stage-body">
          <span className="k-eyebrow">رتبتك</span>
          <div className="pg-rank">
            <bdi dir="ltr" className="pg-rank-letter">{rank.tier}</bdi>
            <span className="pg-rank-name">{rank.label}</span>
          </div>
          <span className="pg-level">المستوى <Num>{level}</Num></span>
        </div>
      </section>

      <div className="pg-xp">
        <Gauge value={prog.currentXP} max={prog.neededXP} tone="accent" label={`التقدم للمستوى ${level + 1}`} />
        <div className="pg-xp-row">
          <span>باقي <Num>{fmt(left)} XP</Num> للمستوى <Num>{level + 1}</Num></span>
          <Num className="pg-xp-of">{fmt(prog.currentXP)} / {fmt(prog.neededXP)}</Num>
        </div>
      </div>

      <RankLadder level={level} className="pg-ladder" />

      {/* ── Next up ── */}
      {next.length > 0 && (
        <Chapter eyebrow="أقرب ميداليات لك" title="التالي">
          <div className="pg-next">
            {next.map(({ a, p }) => {
              const { title, desc } = achText(a)
              return (
                <button key={a.id} type="button" className="pg-next-row" onClick={() => setOpen(a.id)}>
                  <Medal achievement={a} earned={false} size={44} compact />
                  <span className="pg-next-main">
                    <span className="pg-next-top">
                      <span className="pg-next-title"><Numify>{title}</Numify></span>
                      <Num className="pg-next-count">{p.value}/{p.target}</Num>
                    </span>
                    <Gauge value={p.ratio} max={1} tone="accent" label={`${title}: ${p.value} من ${p.target}`} />
                    <span className="pg-next-sub"><Numify>{desc}</Numify></span>
                  </span>
                </button>
              )
            })}
          </div>
        </Chapter>
      )}

      {/* ── The medal wall ── */}
      <Chapter
        eyebrow="الميداليات"
        title={<><Num>{earnedCount}</Num> من <Num>{ACHIEVEMENTS.length}</Num></>}
      >
        <div className="pg-filters" role="group" aria-label="نوع الميداليات">
          {ACHIEVEMENT_CATS.map(c => (
            <Chip key={c.id} selected={cat === c.id} onClick={() => setCat(c.id)} className="hit44">{c.label}</Chip>
          ))}
        </div>
        <div className="pg-grid">
          {shown.map(a => {
            const earned = isEarned(a.id)
            const { title } = achText(a)
            return (
              <button key={a.id} type="button" className={`pg-tile${earned ? ' on' : ''}`}
                onPointerDown={earned ? press(a) : undefined}
                onClick={() => setOpen(a.id)}
                aria-label={`${title} — ${earned ? 'محققة' : 'مقفلة'}`}>
                <Medal achievement={a} earned={earned} />
                <span className="pg-tile-title"><Numify>{title}</Numify></span>
              </button>
            )
          })}
        </div>
      </Chapter>

      <MedalSheet
        a={openA}
        open={!!openA}
        earned={openA ? isEarned(openA.id) : false}
        earnedAt={openA ? unlockedAt[openA.id] : null}
        progress={openA ? progressOf(openA, ctx) : null}
        opens={opens}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}

// The date engraved on the back of a medal in its sheet.
const sheetDate = (earnedAt) => (earnedAt ? fmtDate(earnedAt) : '')

// The medal's beat in the sheet: the sheet is most of the way up. Its 3D
// stage has until then; not ready, the flat medal turns instead.
const SHEET_BEAT = 320
function SheetMedal({ m, date }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGo(true), SHEET_BEAT)
    return () => clearTimeout(t)
  }, [])
  return <MedalReveal items={[m]} variant="sheet" play={go} date={date} />
}

function MedalSheet({ a, open, earned, earnedAt, progress, opens, onClose }) {
  // Keep the last medal while the sheet animates out.
  const last = useRef(a)
  if (a) last.current = a
  const m = a || last.current
  if (!m) return null
  const catLabel = ACHIEVEMENT_CATS.find(c => c.id === m.cat)?.label
  const rarity = RARITY_COLORS[m.rarity]?.label || 'عادي'
  const { title, desc } = achText(m)

  return (
    <Sheet open={open} onClose={onClose} title={<Numify>{title}</Numify>}>
      <div className="pg-sheet">
        {earned
          ? <SheetMedal key={`${m.id}:${opens}`} m={m} date={sheetDate(earnedAt)} />
          : <Medal achievement={m} earned={false} size={132} showUnit />}
        <p className="pg-sheet-desc"><Numify>{desc}</Numify></p>
        <div className="pg-sheet-chips">
          <Chip>{rarity}</Chip>
          {catLabel && <Chip>{catLabel}</Chip>}
          <Chip tone={earned ? 'accent' : 'neutral'}><Num>+{m.xp} XP</Num></Chip>
        </div>
        {earned ? (
          <p className="pg-sheet-state on">
            {earnedAt ? <>حققتها <span className="pg-sheet-date"><Numify>{fmtEarned(earnedAt)}</Numify></span></> : 'محققة'}
          </p>
        ) : progress ? (
          <div className="pg-sheet-prog">
            <div className="pg-sheet-prog-row">
              <span>وصلت</span>
              <span><Num>{progress.value}</Num> من <Num>{progress.target}</Num>{progress.unit ? ` ${progress.unit}` : ''}</span>
            </div>
            <Gauge value={progress.ratio} max={1} tone="accent" label="التقدم" />
          </div>
        ) : (
          <p className="pg-sheet-state">مقفلة — تنفتح لما يتحقق الشرط</p>
        )}
      </div>
    </Sheet>
  )
}

