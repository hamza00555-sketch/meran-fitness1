// Line icons for the streak. One family, drawn on a 24 grid with
// currentColor, so each takes its colour from the role around it —
// orange for the streak, blue for rest and tickets — and never from an
// emoji that ignores both.

const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, focusable: 'false',
})

const FLAME = 'M12.3 2.8c.6 3.6 5 5.3 5 10a5.3 5.3 0 0 1-10.6 0c0-2.8 1.5-3.9 2.1-5.4.9 1.4 1.9 1.9 1.9 1.9s-.6-4 1.6-6.5z'

/** Filled once today counts; an outline while today still needs doing. */
export const Flame = ({ size = 24, filled = false }) => (
  <svg {...base(size)} strokeWidth={filled ? 0 : 1.7}>
    <path d={FLAME} fill={filled ? 'currentColor' : 'none'} />
  </svg>
)

export const Moon = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z" /></svg>
)

export const Ticket = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M3.5 9V7a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 7v2a3 3 0 0 0 0 6v2a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-2a3 3 0 0 0 0-6z" />
    <path d="M14.5 6v12" strokeDasharray="1.6 2.2" />
  </svg>
)

export const Hourglass = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M6.5 3.5h11M6.5 20.5h11" />
    <path d="M8 3.5v2.2c0 1.6 1 3 2.4 3.8L12 10.4l1.6-.9A4.4 4.4 0 0 0 16 5.7V3.5M8 20.5v-2.2c0-1.6 1-3 2.4-3.8l1.6-.9 1.6.9c1.4.8 2.4 2.2 2.4 3.8v2.2" />
  </svg>
)

export const Cross = ({ size = 14 }) => (
  <svg {...base(size)} strokeWidth={2.2}><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></svg>
)

export const BADGES = { moon: Moon, ticket: Ticket, hourglass: Hourglass }
