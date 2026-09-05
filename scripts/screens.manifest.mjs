// What to photograph, and the state each shot needs.
//
// Data only. Every selector strategy and every browser call lives in
// screens.mjs; this file says WHAT, never HOW. That split is the reason
// adding a screen is one object here and nothing else.
//
// The fixtures are lifted from the e2e suites rather than reinvented —
// tests/deload.e2e.mjs for the seeded history and the pinned clock,
// tests/player.e2e.mjs for an active session, tests/report.e2e.mjs for a
// month worth reporting on. Those fixtures are already known to produce
// the app in the state they claim; a second, parallel set of made-up
// data would only drift away from them.

import { NAV_TABS, ACHIEVEMENTS, APP_VERSION, BUILT_IN_PLANS } from '../src/constants.js'

export { NAV_TABS }

// ── Ingredients ───────────────────────────────────────────────

/** Every achievement, already unlocked.
 *
 *  Not decoration. A long seeded history unlocks about twenty
 *  achievements on the first paint; each one calls addXP, the level
 *  crosses, and LevelUpScreen — position:fixed, z-index 1000 — covers
 *  the app and eats every click. Three failed runs were spent finding
 *  that out. A fixture with history seeds this. */
const ALL_ACHIEVEMENTS = ACHIEVEMENTS.map(a => a.id)

/** Ten weeks of bench at a steady 80kg, every other day through May and
 *  June 2026. Long enough to have earned rest credits and unlocked the
 *  history-shaped achievements, short of the stall that would suggest a
 *  deload. From tests/deload.e2e.mjs. */
const VETERAN_SESSIONS = (() => {
  const out = []
  let seq = 0
  for (let n = 0; n < 30; n++) {
    const d = new Date(2026, 4, 1 + n * 2, 18)
    out.push({
      id: d.getTime() + (++seq),
      date: d.toISOString(),
      duration: 45,
      exercises: [{
        id: 'e' + seq, muscle: 'Chest', name: 'Bench Press',
        sets: [['80', '12'], ['80', '12']].map(([weight, reps]) => ({ weight, reps, done: true })),
      }],
    })
  }
  return out
})()

/** Two lifts held flat for ten weeks, reps under target — the shape
 *  suggestDeload() looks for. Deliberately different from
 *  VETERAN_SESSIONS, which is progressing and must never trip it. */
const STALLED_SESSIONS = (() => {
  const out = []
  let seq = 0
  for (let n = 0; n < 30; n++) {
    const d = new Date(2026, 4, 1 + n * 2, 18)
    out.push({
      id: d.getTime() + (++seq),
      date: d.toISOString(),
      duration: 50,
      exercises: [
        { id: 's' + seq, muscle: 'Chest', name: 'Bench Press',
          sets: [['80', '8'], ['80', '7'], ['80', '7']].map(([weight, reps]) => ({ weight, reps, done: true })) },
        { id: 'q' + seq, muscle: 'Legs', name: 'Leg Press',
          sets: [['140', '8'], ['140', '8'], ['140', '7']].map(([weight, reps]) => ({ weight, reps, done: true })) },
      ],
    })
  }
  return out
})()

/** Sessions on the given days of July 2026 — the calendar the rest-day
 *  credit states are built on. From tests/deload.e2e.mjs. */
const julySessions = (...days) => days.map((n, i) => ({
  id: Date.UTC(2026, 6, n) + i,
  date: new Date(2026, 6, n, 18).toISOString(),
  duration: 45,
  exercises: [{
    id: 'j' + i, muscle: 'Chest', name: 'Bench Press',
    sets: [{ weight: '80', reps: '12', done: true }],
  }],
}))

/** A month with something to report: March 2026, trained every other
 *  day, three lifts, volume climbing. From tests/report.e2e.mjs. */
const MARCH_SESSIONS = (() => {
  const out = []
  let seq = 0
  for (let n = 1; n <= 31; n += 2) {
    const d = new Date(2026, 2, n, 18)
    const w = 70 + Math.floor(n / 6) * 2.5
    out.push({
      id: d.getTime() + (++seq),
      date: d.toISOString(),
      duration: 52,
      exercises: [
        { id: 'm' + seq, muscle: 'Chest', name: 'Bench Press',
          sets: [[String(w), '10'], [String(w), '10'], [String(w), '9']].map(([weight, reps]) => ({ weight, reps, done: true })) },
        { id: 'n' + seq, muscle: 'Back', name: 'Lat Pulldown',
          sets: [['60', '12'], ['60', '12']].map(([weight, reps]) => ({ weight, reps, done: true })) },
        { id: 'o' + seq, muscle: 'Legs', name: 'Leg Press',
          sets: [['150', '10'], ['150', '10']].map(([weight, reps]) => ({ weight, reps, done: true })) },
      ],
    })
  }
  return out
})()

/** A session already under way. From tests/player.e2e.mjs. */
const ACTIVE = {
  id: Date.now() - 5 * 60000, date: new Date().toISOString(), name: 'Push — صدر وأكتاف',
  exercises: [
    { id: 'a', muscle: 'Chest', name: 'Hammer Strength Machine Bench Press',
      sets: [{ weight: '75', reps: '12', done: false }, { weight: '75', reps: '12', done: false }] },
    { id: 'b', muscle: 'Chest', name: 'Pec Deck',
      sets: [{ weight: '50', reps: '12', done: false }, { weight: '50', reps: '12', done: false }] },
    { id: 'c', muscle: 'Shoulders', name: 'Machine Shoulder Press',
      sets: [{ weight: '40', reps: '12', done: false }] },
  ],
}

const BASE_RECOVERY = {
  daysPerWeek: 3, overrides: [], restDays: [],
  patternHistory: [], streakResetAt: null, autoSpendFrom: null,
  deload: null, deloadHistory: [], deloadSuggestDismissedAt: null,
}

const DELOAD = { from: '2026-07-06', plannedUntil: '2026-07-12', pct: 40 }

const PLAN = BUILT_IN_PLANS[0]

// ── Fixtures ──────────────────────────────────────────────────
//
// `seed` is a plain object of localStorage key → value; the runner
// JSON-stringifies anything that is not already a string. `clock` is
// pinned by replacing globalThis.Date, so a screenshot taken in
// September shows an app that believes it is July.

export const FIXTURES = {
  /** A returning user with ten weeks behind him. Most pages. */
  veteran: {
    clock: '2026-07-08T10:00:00+03:00',
    seed: {
      hf_sessions: VETERAN_SESSIONS,
      hf_recovery: BASE_RECOVERY,
      hf_xp: 4200,
      hf_profile: { name: 'حمزة' },
      hf_plan: PLAN,
      hf_plan_index: 4,
      hf_unlocked: ALL_ACHIEVEMENTS,
      hf_pack_prompted: true,
      hf_seen_version: APP_VERSION,
      hf_weights_reset_v2: true,
      hf_last_weights: { 'bench press': 80 },
    },
  },

  /** The same user, three days into a seven-day deload. The whole point
   *  of this one: it proves the accent is a role, not a colour. */
  'veteran-deload': {
    clock: '2026-07-08T10:00:00+03:00',
    extend: 'veteran',
    seed: { hf_recovery: { ...BASE_RECOVERY, deload: DELOAD } },
  },

  /** Day one. Nothing done, nothing earned — the empty states. */
  fresh: {
    clock: '2026-07-08T10:00:00+03:00',
    seed: {
      hf_pack_prompted: true,
      hf_seen_version: APP_VERSION,
      hf_weights_reset_v2: true,
      hf_profile: { name: 'حمزة' },
    },
  },

  /** Nothing seeded at all, so the app greets a new install. */
  'first-run': { clock: '2026-07-08T10:00:00+03:00', seed: {} },

  /** Version seen, pack never offered — so the art-pack offer is the
   *  one thing waiting on the home screen. */
  'pack-offer': {
    clock: '2026-07-08T10:00:00+03:00',
    extend: 'veteran',
    seed: { hf_pack_prompted: null, hf_seen_version: APP_VERSION },
  },

  /** Ten days of adherence, then one missed workout day the balance
   *  paid for. The state the whole rest-credit fix exists to show. */
  'credit-spent': {
    clock: '2026-07-12T10:00:00+03:00',
    seed: {
      hf_sessions: julySessions(1, 3, 5, 7, 9),
      hf_recovery: { ...BASE_RECOVERY, autoSpendFrom: '2026-07-01' },
      hf_xp: 4200,
      hf_profile: { name: 'حمزة' },
      hf_unlocked: ALL_ACHIEVEMENTS,
      hf_pack_prompted: true,
      hf_seen_version: APP_VERSION,
      hf_weights_reset_v2: true,
    },
  },

  /** One day further on: both credits gone, the streak still alive, and
   *  today is a training day — the last moment the warning is useful. */
  'credit-warning': {
    clock: '2026-07-13T10:00:00+03:00',
    extend: 'credit-spent',
    seed: {},
  },

  /** The morning after a deload period lapses. */
  'deload-ended': {
    clock: '2026-07-13T10:00:00+03:00',
    extend: 'veteran',
    seed: { hf_recovery: { ...BASE_RECOVERY, deload: DELOAD } },
  },

  /** Two lifts flat for ten weeks — enough for the app to suggest a
   *  deload on its own. */
  stalled: {
    clock: '2026-07-08T10:00:00+03:00',
    extend: 'veteran',
    seed: { hf_sessions: STALLED_SESSIONS, hf_last_weights: { 'bench press': 80, 'leg press': 140 } },
  },

  /** Standing in April looking back at March. Reduced motion, because
   *  the report opens with a sequence and a screenshot of a transition
   *  is a screenshot of nothing. */
  report: {
    clock: '2026-04-02T18:00:00+03:00',
    reducedMotion: 'reduce',
    seed: {
      hf_sessions: MARCH_SESSIONS,
      hf_recovery: BASE_RECOVERY,
      hf_xp: 4200,
      hf_profile: { name: 'حمزة' },
      hf_unlocked: ALL_ACHIEVEMENTS,
      hf_pack_prompted: true,
      hf_seen_version: APP_VERSION,
      hf_weights_reset_v2: true,
    },
  },

  /** A session under way. The clock stays live here — the player shows
   *  elapsed time and a pinned clock freezes it at zero. */
  player: {
    seed: {
      hf_active: ACTIVE,
      hf_sessions: VETERAN_SESSIONS,
      hf_recovery: BASE_RECOVERY,
      hf_xp: 4200,
      hf_profile: { name: 'حمزة' },
      hf_unlocked: ALL_ACHIEVEMENTS,
      hf_pack_prompted: true,
      hf_seen_version: APP_VERSION,
      hf_weights_reset_v2: true,
      hf_last_weights: { 'hammer strength machine bench press': 75 },
    },
  },

  /** A session with nothing in it yet — where the add and routine
   *  sheets are offered. */
  'player-empty': {
    extend: 'player',
    seed: { hf_active: { ...ACTIVE, exercises: [] } },
  },

  /** Ten XP short of level five, mid-session. Completing one set
   *  crosses it and the level-up screen takes over. */
  'player-levelup': { extend: 'player', seed: { hf_xp: 4190 } },

  /** The same player on the smallest screen the app supports. */
  'player-se': { extend: 'player', device: 'iPhone SE' },
}

// ── The screens ───────────────────────────────────────────────
//
// reach: a list of steps the runner interprets. See STEPS in screens.mjs
//        for the whole vocabulary.
// expect: proof the screen really rendered before the shutter opens.
// shot:  'fold' = what a phone shows without scrolling (the canonical
//        form — a fullPage shot of this app floats the fixed nav bar
//        through the middle of the image). 'full' only where the whole
//        column is the subject.

export const SCREENS = [
  // ── Pages ───────────────────────────────────────────────────
  {
    id: 'page-home', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'الرئيسية', labelEn: 'Home',
    reach: [{ tab: 'home' }],
    expect: { text: /ابدأ التمرين|جلسة حرة|يوم تمرين/, accent: '#5EC32A' },
    covers: ['src/pages/HomePage.jsx', 'src/components/TodayHero.jsx'],
    state: 'مستخدم عائد، خطة مفعّلة، يوم تمرين — الحالة الافتراضية',
  },
  {
    id: 'page-home-full', group: 'pages', fixture: 'veteran', shot: 'full',
    label: 'الرئيسية — العمود كاملاً', labelEn: 'Home — full column',
    reach: [{ tab: 'home' }],
    // Not «دورة التعافي» — that card ships inside a collapsed <details>,
    // and innerText does not see through one.
    expect: { text: /تقدم البرنامج/, accent: '#5EC32A' },
    covers: ['src/pages/HomePage.jsx', 'src/components/ui.jsx', 'src/components/Icons.jsx'],
    state: 'الصفحة كلها: البطل، الجيمفكيشن، تقدم البرنامج، التعافي مطوياً',
  },
  {
    id: 'page-workout', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'تمرين — بلا جلسة جارية', labelEn: 'Workout — no active session',
    reach: [{ tab: 'workout' }],
    expect: { accent: '#5EC32A' },
    covers: ['src/pages/WorkoutPage.jsx'],
    state: 'مدخل التمرين وسجل الجلسات السابقة',
  },
  {
    id: 'page-exercises', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'التمارين', labelEn: 'Exercise library',
    reach: [{ tab: 'exercises' }],
    expect: { accent: '#5EC32A' },
    covers: ['src/pages/ExercisesPage.jsx', 'src/components/ExerciseCard.jsx'],
    state: 'مكتبة التمارين مصنّفة بالعضلات',
  },
  {
    id: 'page-achievements', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'الجوائز', labelEn: 'Achievements',
    reach: [{ tab: 'achievements' }],
    expect: { accent: '#5EC32A' },
    covers: ['src/pages/AchievementsPage.jsx'],
    state: 'كل الإنجازات مفتوحة',
  },
  {
    id: 'page-achievements-locked', group: 'pages', fixture: 'fresh', shot: 'fold',
    label: 'الجوائز — مقفلة', labelEn: 'Achievements — locked',
    reach: [{ tab: 'achievements' }],
    expect: { accent: '#5EC32A' },
    covers: ['src/pages/AchievementsPage.jsx'],
    state: 'الحالة الفارغة — لا شيء مفتوح بعد',
  },
  {
    id: 'page-profile', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'الملف', labelEn: 'Profile',
    reach: [{ tab: 'profile' }],
    expect: { text: /حمزة/, accent: '#5EC32A' },
    covers: ['src/pages/ProfilePage.jsx', 'src/components/CalendarHeatmap.jsx', 'src/components/BarChart.jsx'],
    state: 'المستوى، الرتبة، الإحصائيات',
  },
  {
    id: 'page-settings', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'الإعدادات', labelEn: 'Settings',
    reach: [{ settings: true }],
    expect: { accent: '#5EC32A' },
    covers: ['src/pages/SettingsPage.jsx'],
    state: 'أعلى الإعدادات',
  },
  {
    id: 'page-settings-deload', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'الإعدادات — قسم الديلود', labelEn: 'Settings — deload section',
    reach: [{ settings: true }, { scrollTo: 'الديلود' }],
    expect: { text: /ديلود/ },
    covers: ['src/components/DeloadSection.jsx'],
    state: 'قسم فترة التخفيف داخل الإعدادات',
  },

  // ── States ──────────────────────────────────────────────────
  {
    id: 'state-home-deload', group: 'states', fixture: 'veteran-deload', shot: 'fold',
    label: 'الرئيسية — وضع الديلود', labelEn: 'Home — deload mode',
    reach: [{ tab: 'home' }],
    expect: { accent: '#5CC9EE', deload: true },
    covers: ['src/pages/HomePage.jsx', 'src/index.css'],
    state: 'اليوم الثالث من ٧ — الأكسنت أزرق جليدي، الزوايا أدور، الوهج أخفت',
  },
  {
    id: 'state-home-deload-full', group: 'states', fixture: 'veteran-deload', shot: 'full',
    label: 'الرئيسية — الديلود، العمود كاملاً', labelEn: 'Home — deload, full column',
    reach: [{ tab: 'home' }],
    expect: { accent: '#5CC9EE', deload: true },
    covers: ['src/pages/HomePage.jsx'],
    state: 'كل الصفحة وقد انتقلت إلى الوضع الأزرق دفعة واحدة',
  },
  {
    id: 'state-recovery-open', group: 'states', fixture: 'veteran', shot: 'fold',
    label: 'كرت دورة التعافي مفتوحاً', labelEn: 'Recovery cycle, expanded',
    reach: [{ tab: 'home' }, { openDetails: true }, { scrollTo: 'دورة التعافي' }],
    expect: { text: /أيام التزام/ },
    covers: ['src/pages/HomePage.jsx'],
    state: 'الفقاعات، شريط الرصيد، والستريكان',
  },
  {
    id: 'state-credit-spent', group: 'states', fixture: 'credit-spent', shot: 'fold',
    label: 'يوم راحة دُفع من الرصيد', labelEn: 'A rest day paid from the balance',
    reach: [{ tab: 'home' }, { openDetails: true }, { scrollTo: 'دورة التعافي' }],
    expect: { selector: '[data-testid="credit-spent"]' },
    covers: ['src/pages/HomePage.jsx', 'src/recovery.js'],
    state: 'غياب يوم واحد امتصّه الرصيد — السطر يذكر التاريخ والباقي',
  },
  {
    id: 'state-credit-warning', group: 'states', fixture: 'credit-warning', shot: 'fold',
    label: 'إنذار قبل كسر الستريك', labelEn: 'Warning before the streak breaks',
    reach: [{ tab: 'home' }, { openDetails: true }, { scrollTo: 'دورة التعافي' }],
    expect: { selector: '[data-testid="credit-warning"]' },
    covers: ['src/pages/HomePage.jsx'],
    state: 'الرصيد صفر واليوم يوم تمرين — آخر لحظة يفيد فيها التحذير',
  },
  {
    id: 'state-deload-suggestion', group: 'states', fixture: 'stalled', shot: 'fold',
    label: 'اقتراح الديلود', labelEn: 'Deload suggestion',
    reach: [{ tab: 'home' }],
    expect: { text: /ديلود/ },
    covers: ['src/components/DeloadBanner.jsx', 'src/deload.js'],
    state: 'رفعتان ثابتتان عشرة أسابيع — التطبيق يقترح فترة تخفيف',
  },
  {
    id: 'state-home-fresh', group: 'states', fixture: 'fresh', shot: 'fold',
    label: 'الرئيسية — يوم أول', labelEn: 'Home — day one',
    reach: [{ tab: 'home' }],
    expect: { accent: '#5EC32A' },
    covers: ['src/pages/HomePage.jsx'],
    state: 'الحالة الفارغة: لا تاريخ، لا ستريك، لا خطة',
  },

  // ── Player ──────────────────────────────────────────────────
  {
    id: 'player-working', group: 'player', fixture: 'player', shot: 'fold',
    label: 'مشغّل التمرين', labelEn: 'Workout player',
    reach: [{ tab: 'workout' }],
    expect: { text: /إنهاء المجموعة|Bench Press|Hammer/ },
    covers: ['src/components/player/WorkoutPlayer.jsx', 'src/components/player/ExerciseHero.jsx',
             'src/components/player/WorkingArea.jsx', 'src/components/player/ExerciseQueue.jsx',
             'src/components/player/ExerciseTags.jsx', 'src/components/player/SetHistory.jsx'],
    state: 'تمرين جارٍ: الأوزان، العدّات، والمجموعة القادمة',
  },
  {
    id: 'player-rest', group: 'player', fixture: 'player', shot: 'fold',
    label: 'المشغّل — الراحة بين المجموعات', labelEn: 'Player — rest between sets',
    reach: [{ tab: 'workout' }, { text: /إنهاء المجموعة/ }, { settle: 900 }],
    covers: ['src/components/player/InlineRest.jsx'],
    state: 'مؤقّت الراحة يعمل داخل المشغّل بعد إنهاء مجموعة',
  },
  {
    id: 'player-se', group: 'player', fixture: 'player-se', shot: 'fold',
    label: 'المشغّل — شاشة صغيرة', labelEn: 'Player — small screen',
    reach: [{ tab: 'workout' }],
    expect: { text: /إنهاء المجموعة/ },
    covers: ['src/components/player/WorkoutPlayer.jsx'],
    state: 'نفس المشغّل على iPhone SE — أضيق شاشة يدعمها التطبيق',
  },

  // ── Modals and sheets ───────────────────────────────────────
  {
    id: 'modal-rest-timer', group: 'modals', fixture: 'veteran', shot: 'fold',
    label: 'مؤقّت الراحة', labelEn: 'Rest timer',
    reach: [{ tab: 'home' }, { aria: 'مؤقت الراحة' }, { settle: 600 }],
    covers: ['src/components/RestTimer.jsx'],
    state: 'المؤقّت العائم، مفتوحاً من الهيدر',
  },
  {
    id: 'modal-routines', group: 'modals', fixture: 'player-empty', shot: 'fold',
    label: 'الروتينات', labelEn: 'Routines',
    reach: [{ tab: 'workout' }, { text: /روتين/ }, { settle: 600 }],
    covers: ['src/components/RoutinesModal.jsx'],
    state: 'اختيار روتين محفوظ لجلسة فارغة',
  },
  {
    id: 'modal-add-exercise', group: 'modals', fixture: 'player-empty', shot: 'fold',
    label: 'إضافة تمرين', labelEn: 'Add exercise',
    reach: [{ tab: 'workout' }, { text: /أضف أول تمرين/ }, { settle: 600 }],
    covers: ['src/components/AddExerciseModal.jsx'],
    state: 'بحث وإضافة تمرين إلى الجلسة',
  },
  {
    id: 'modal-whats-new', group: 'modals', fixture: 'first-run', shot: 'fold',
    label: 'ما الجديد', labelEn: "What's new",
    reach: [{ settle: 1200 }],
    covers: ['src/components/WhatsNewModal.jsx'],
    state: 'يظهر مرة واحدة بعد كل تحديث نسخة',
  },
  {
    id: 'modal-asset-pack', group: 'modals', fixture: 'pack-offer', shot: 'fold',
    label: 'عرض حزمة الصور', labelEn: 'Art pack offer',
    reach: [{ settle: 1500 }],
    covers: ['src/components/AssetPackPrompt.jsx'],
    state: 'عرض تنزيل حزمة الفن، يظهر مرة واحدة',
  },

  // ── Full-screen ─────────────────────────────────────────────
  {
    id: 'full-level-up', group: 'fullscreen', fixture: 'player-levelup', shot: 'fold',
    label: 'شاشة المستوى', labelEn: 'Level up',
    reach: [{ tab: 'workout' }, { text: /إنهاء المجموعة/ }, { settle: 1200 }],
    expect: { text: /استمر/ },
    covers: ['src/components/LevelUpScreen.jsx'],
    state: 'إنهاء مجموعة يعبر بالمستوى الرابع إلى الخامس',
  },
  {
    id: 'full-deload-end', group: 'fullscreen', fixture: 'deload-ended', shot: 'fold',
    label: 'نهاية الديلود', labelEn: 'Deload ended',
    reach: [{ settle: 1500 }],
    covers: ['src/components/DeloadEndScreen.jsx'],
    state: 'صباح اليوم التالي لانقضاء فترة التخفيف',
  },
  {
    id: 'overlay-system-alert', group: 'fullscreen', fixture: 'credit-spent', shot: 'fold',
    label: 'تنبيه النظام', labelEn: 'System alert',
    reach: [{ settle: 700 }],
    covers: ['src/components/SystemAlert.jsx'],
    state: 'التنبيه الذي يعلن صرف يوم راحة — يختفي بعد ٣٫٢ ثانية',
    noSettle: true,
  },

  // ── Report ──────────────────────────────────────────────────
  {
    id: 'report-cover', group: 'report', fixture: 'report', shot: 'fold',
    label: 'التقرير الشهري — الغلاف', labelEn: 'Month report — cover',
    reach: [{ text: /^تقرير / }, { settle: 1500 }],
    covers: ['src/components/report/MonthReport.jsx', 'src/components/report/Ambient.jsx'],
    state: 'الشاشة الافتتاحية للتقرير الشهري',
  },
  {
    id: 'report-body', group: 'report', fixture: 'report', shot: 'fold',
    label: 'التقرير الشهري — المتن', labelEn: 'Month report — body',
    reach: [{ text: /^تقرير / }, { settle: 1200 }, { click: 'body' },
            { settle: 1200 }, { scrollReport: 1 }],
    covers: ['src/components/report/Ring.jsx', 'src/components/report/TrendChart.jsx',
             'src/components/report/parts.jsx'],
    state: 'أقسام التقرير: الالتزام، الحجم، العضلات',
  },

  // ── The ones --audit caught missing ─────────────────────────
  {
    id: 'page-photos', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'صور التقدم', labelEn: 'Progress photos',
    reach: [{ tab: 'profile' }, { text: /صور/ }, { settle: 600 }],
    covers: ['src/pages/PhotosPage.jsx'],
    state: 'صفحة صور التقدم، فارغة — تُبلَغ من الملف الشخصي فقط',
  },
  {
    id: 'modal-exercise-info', group: 'modals', fixture: 'veteran', shot: 'fold',
    label: 'تفاصيل التمرين', labelEn: 'Exercise details',
    reach: [{ tab: 'exercises' }, { clickNth: ['button', 3] }, { settle: 700 }],
    covers: ['src/components/ExerciseInfoModal.jsx'],
    state: 'بطاقة تمرين مفتوحة من المكتبة: العضلة، الشرح، الفيديو',
  },
  {
    id: 'sheet-day-preview', group: 'modals', fixture: 'veteran', shot: 'fold',
    label: 'عرض تمارين اليوم', labelEn: "Today's exercises",
    reach: [{ tab: 'home' }, { text: /عرض التمارين/ }, { settle: 700 }],
    covers: ['src/components/DayPreviewSheet.jsx'],
    state: 'ورقة تعرض تمارين اليوم قبل بدء الجلسة',
  },
  {
    id: 'panel-rest-ledger', group: 'modals', fixture: 'credit-spent', shot: 'fold',
    label: 'سجل الراحة', labelEn: 'Rest ledger',
    reach: [{ settings: true }, { scrollTo: 'سجل المكافأة' }],
    expect: { text: /سجل المكافأة/ },
    covers: ['src/components/RestLedgerPanel.jsx'],
    state: 'شريط التشخيص الذي يعرض قرار المحرّك يوماً بيوم',
  },
  {
    id: 'page-settings-pack', group: 'pages', fixture: 'veteran', shot: 'fold',
    label: 'الإعدادات — حزمة الصور', labelEn: 'Settings — art pack',
    reach: [{ settings: true }, { scrollTo: 'حزمة الصور' }],
    expect: { text: /حزمة الصور/ },
    covers: ['src/components/AssetPackSection.jsx'],
    state: 'إدارة حزمة الفن: التنزيل، الحجم، الحذف',
  },
  {
    id: 'sheet-save-poster', group: 'report', fixture: 'report', shot: 'fold',
    label: 'مشاركة البوستر', labelEn: 'Share poster',
    reach: [{ text: /^تقرير / }, { settle: 1200 }, { click: 'body' },
            { settle: 1200 }, { aria: /مشاركة التقرير/ }, { settle: 1800 }],
    covers: ['src/components/report/SavePosterSheet.jsx'],
    state: 'ورقة حفظ البوستر ١٠٨٠×١٩٢٠ التي يولّدها التقرير',
  },
]

/** Files the manifest deliberately does not cover, and why. Checked by
 *  `--audit` so the list stays honest as the app grows. */
export const KNOWN_UNCOVERED = {
  'src/pages/StatsPage.jsx': 'dead — imported by nothing; ProfilePage superseded it',
  'src/pages/HistoryPage.jsx': 'dead — imported by nothing; WorkoutPage has its own history view',
  'src/pages/TodayPage.jsx': 'dead — imported by nothing',
  'src/components/AIPanel.jsx': 'dead — imported by nothing',
  'src/pages/ChallengesPage.jsx':
    'UNREACHABLE IN THE SHIPPED APP: App.jsx renders it at tab === "challenges" '
    + 'but nothing anywhere calls setTab("challenges") and it is absent from '
    + 'NAV_TABS. A whole page ships with no way in.',
}
