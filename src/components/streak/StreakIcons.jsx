// The streak's icons, from the one icon family (Phosphor), with the
// same names and props they always had so the header chip and the
// scoreboard did not have to change. Each takes its colour from the
// role around it — orange for the streak, blue for rest and tickets —
// through currentColor. None of them mirror under RTL: a flame, a
// ticket and a moon have no direction.

import {
  Flame as PFlame, Moon as PMoon, Ticket as PTicket,
  Hourglass as PHourglass, X as PX,
} from '../kit/icons.js'

const hide = { 'aria-hidden': true, focusable: 'false' }

/** Filled once today counts; an outline while today still needs doing. */
export const Flame = ({ size = 24, filled = false }) => (
  <PFlame size={size} weight={filled ? 'fill' : 'regular'} {...hide} />
)

export const Moon = ({ size = 16 }) => <PMoon size={size} weight="fill" {...hide} />

export const Ticket = ({ size = 16 }) => <PTicket size={size} weight="bold" {...hide} />

export const Hourglass = ({ size = 16 }) => <PHourglass size={size} weight="bold" {...hide} />

export const Cross = ({ size = 14 }) => <PX size={size} weight="bold" {...hide} />

export const BADGES = { moon: Moon, ticket: Ticket, hourglass: Hourglass }
