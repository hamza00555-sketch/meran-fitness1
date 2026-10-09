// ── Emoji in, Phosphor out ────────────────────────────────────
//
// The app still hands the system layer emoji — pushAlert(<ticket>, …),
// <EmptyState icon=<clipboard> …>, <Badge>{emoji} {label}</Badge> — from
// code that predates the redesign and is owned elsewhere. Rather than chase
// every caller, the system layer translates at the door: a known emoji
// becomes its Phosphor icon and a colour role, an unknown one becomes a
// neutral bell, and plain text is left as text. The emoji itself never
// reaches the screen as an icon (critique: iconsAr).

import {
  Warning, Star, Trophy, FloppyDisk, SkipForward, Info, CheckCircle, Check, Ticket,
  Drop, Barbell, DownloadSimple, ListChecks, MapTrifold, Confetti, Flame, Bell,
  Camera, Trash, X, ArrowUp, Lightning, Moon, Timer, Medal, Target, Sparkle,
  ShareFat, ChartLineUp, ChartBar, CalendarBlank, Eye, ArrowsClockwise, Sun, Robot,
  ArrowsLeftRight, LockSimple, Crown, Notepad, ClockCounterClockwise, Images,
  PencilSimple, Heartbeat, Scales, HandWaving, Package,
} from '@phosphor-icons/react'
import { Num } from '../kit/index.jsx'

/**
 * emoji → { Icon, tone, mirrored }. Tones are the colour roles: accent
 * (done, saved, on), rest (tickets, rest), streak (the streak only),
 * raise (raise the weight only), danger (warnings), neutral (the rest).
 */
const E = (cp) => String.fromCodePoint(cp)

// Keys are written as code points so this file carries no emoji itself.
const MAP = {
  [E(0x26A0)]: { Icon: Warning, tone: 'danger' },                 // warning
  [E(0x2757)]: { Icon: Warning, tone: 'danger' },                 // exclamation
  [E(0x1F6AB)]: { Icon: Warning, tone: 'danger' },                // prohibited
  [E(0x2139)]: { Icon: Info },                                    // information
  [E(0x1F4A1)]: { Icon: Info },                                   // light bulb
  [E(0x2705)]: { Icon: CheckCircle, tone: 'accent' },             // check box
  [E(0x2714)]: { Icon: Check, tone: 'accent' },                   // heavy check
  [E(0x2713)]: { Icon: Check, tone: 'accent' },                   // check mark
  [E(0x2611)]: { Icon: CheckCircle, tone: 'accent' },             // ballot box with check
  [E(0x1F389)]: { Icon: Confetti, tone: 'accent' },               // party popper
  [E(0x1F973)]: { Icon: Confetti, tone: 'accent' },               // partying face
  [E(0x1F4BE)]: { Icon: FloppyDisk },                             // floppy disk
  [E(0x1F4E5)]: { Icon: DownloadSimple, tone: 'accent' },         // inbox tray
  [E(0x2B07)]: { Icon: DownloadSimple },                          // down arrow
  [E(0x1F4E4)]: { Icon: ShareFat },                               // outbox tray
  [E(0x1F4CB)]: { Icon: ListChecks },                             // clipboard
  [E(0x1F4DD)]: { Icon: Notepad },                                // memo
  [E(0x270F)]: { Icon: PencilSimple },                            // pencil
  [E(0x1F5FA)]: { Icon: MapTrifold },                             // world map
  [E(0x23ED)]: { Icon: SkipForward, mirrored: true },             // next track
  [E(0x1F39F)]: { Icon: Ticket, tone: 'rest' },                   // admission tickets
  [E(0x1F3AB)]: { Icon: Ticket, tone: 'rest' },                   // ticket
  [E(0x1F319)]: { Icon: Moon, tone: 'rest' },                     // crescent moon
  [E(0x1F634)]: { Icon: Moon, tone: 'rest' },                     // sleeping face
  [E(0x23F1)]: { Icon: Timer, tone: 'rest' },                     // stopwatch
  [E(0x23F0)]: { Icon: Timer, tone: 'rest' },                     // alarm clock
  [E(0x23F3)]: { Icon: Timer, tone: 'rest' },                     // hourglass
  [E(0x1F4A7)]: { Icon: Drop, tone: 'accent' },                   // droplet
  [E(0x1F525)]: { Icon: Flame, tone: 'streak' },                  // fire
  [E(0x2B06)]: { Icon: ArrowUp, tone: 'raise' },                  // up arrow
  [E(0x1F4C8)]: { Icon: ChartLineUp },                            // chart up
  [E(0x1F4CA)]: { Icon: ChartBar },                               // bar chart
  [E(0x1F4AA)]: { Icon: Barbell },                                // flexed biceps
  [E(0x1F3CB)]: { Icon: Barbell },                                // weight lifter
  [E(0x2B50)]: { Icon: Star },                                    // star
  [E(0x1F31F)]: { Icon: Star },                                   // glowing star
  [E(0x2728)]: { Icon: Sparkle },                                 // sparkles
  [E(0x1F680)]: { Icon: Sparkle },                                // rocket
  [E(0x1F3C6)]: { Icon: Trophy },                                 // trophy
  [E(0x1F3C5)]: { Icon: Medal },                                  // sports medal
  [E(0x1F947)]: { Icon: Medal },                                  // gold medal
  [E(0x1F451)]: { Icon: Crown },                                  // crown
  [E(0x1F3AF)]: { Icon: Target },                                 // direct hit
  [E(0x26A1)]: { Icon: Lightning },                               // high voltage
  [E(0x1F514)]: { Icon: Bell },                                   // bell
  [E(0x1F4F8)]: { Icon: Camera },                                 // camera with flash
  [E(0x1F4F7)]: { Icon: Camera },                                 // camera
  [E(0x1F5BC)]: { Icon: Images },                                 // framed picture
  [E(0x1F5D1)]: { Icon: Trash },                                  // wastebasket
  [E(0x274C)]: { Icon: X },                                       // cross mark
  [E(0x2716)]: { Icon: X },                                       // multiply
  [E(0x1F4C5)]: { Icon: CalendarBlank },                          // calendar
  [E(0x1F5D3)]: { Icon: CalendarBlank },                          // spiral calendar
  [E(0x1F441)]: { Icon: Eye },                                    // eye
  [E(0x1F504)]: { Icon: ArrowsClockwise },                        // counterclockwise arrows
  [E(0x1F501)]: { Icon: ArrowsClockwise },                        // repeat
  [E(0x1F500)]: { Icon: ArrowsLeftRight },                        // shuffle
  [E(0x1F506)]: { Icon: Sun },                                    // bright
  [E(0x2600)]: { Icon: Sun },                                     // sun
  [E(0x1F916)]: { Icon: Robot },                                  // robot
  [E(0x1F512)]: { Icon: LockSimple },                             // lock
  [E(0x1F4DC)]: { Icon: ClockCounterClockwise },                  // scroll
  [E(0x2764)]: { Icon: Heartbeat },                               // heart
  [E(0x2696)]: { Icon: Scales },                                  // balance scale
  [E(0x1F44B)]: { Icon: HandWaving },                             // waving hand
  [E(0x1F4E6)]: { Icon: Package },                                // package
}

const PICTO = /\p{Extended_Pictographic}/u
const JOINERS = /[\uFE0E\uFE0F\u200D]|[\u{1F3FB}-\u{1F3FF}]/gu

/** The first pictograph of a string, with variation selectors and skin tones dropped. */
function keyOf(s) {
  const clean = String(s).replace(JOINERS, '').trim()
  return [...clean][0] || ''
}

/** True if the string carries any emoji / pictograph. */
export const hasEmoji = (s) => typeof s === 'string' && PICTO.test(s)

/** Strip emoji from a string (for text that should never carry them). */
export function stripEmoji(s) {
  if (typeof s !== 'string') return s
  return s.replace(/\p{Extended_Pictographic}/gu, '').replace(JOINERS, '').replace(/\s{2,}/g, ' ')
}

/**
 * What to draw for an `icon` the old API passed in.
 * Returns { Icon, tone, mirrored } for a mapped emoji or a component,
 * { text } for plain text worth keeping, or null for nothing.
 */
export function resolveGlyph(icon, { fallback = Bell } = {}) {
  if (icon == null || icon === false || icon === '') return null
  if (typeof icon === 'function' || (typeof icon === 'object' && icon.$$typeof && icon.render)) {
    return { Icon: icon, tone: 'neutral' }
  }
  if (typeof icon !== 'string') return null
  const hit = MAP[keyOf(icon)]
  if (hit) return { tone: 'neutral', ...hit }
  if (hasEmoji(icon)) return fallback ? { Icon: fallback, tone: 'neutral' } : null
  const text = icon.trim()
  return text ? { text } : null
}

/** <Glyph glyph={resolveGlyph(icon)} size={20} /> — the resolved icon, or the text it was. */
export function Glyph({ glyph, size = 20, weight = 'bold', className }) {
  if (!glyph) return null
  if (glyph.Icon) {
    const { Icon } = glyph
    return <Icon size={size} weight={weight} mirrored={glyph.mirrored} className={className} aria-hidden="true" />
  }
  return <Num className="sys-toast-glyph">{glyph.text}</Num>
}

// ── Numbers and Latin inside Arabic ───────────────────────────
// Messages arrive as plain strings ("إنجازات +150 XP"). Every number or
// Latin run is isolated LTR and tabular, so it never prints backwards
// inside the Arabic line.
const RUN = /[+\-−×]?[0-9A-Za-z](?:[0-9A-Za-z.,:%/×+\-–'’]*[0-9A-Za-z%])?(?:[  ]+[+\-−×]?[0-9A-Za-z](?:[0-9A-Za-z.,:%/×+\-–'’]*[0-9A-Za-z%])?)*/g

export function isolateRuns(text) {
  if (typeof text !== 'string' || !text) return text
  const out = []
  let last = 0
  let m
  RUN.lastIndex = 0
  while ((m = RUN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<Num key={m.index}>{m[0]}</Num>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
