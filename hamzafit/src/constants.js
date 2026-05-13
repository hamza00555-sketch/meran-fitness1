// ── User ──────────────────────────────────────────────────────
export const USER = 'حمزة'

export const GREETINGS = [
  `يلا ${USER} 💪 اليوم بنكسر الجيم!`,
  `مرحبا ${USER} 👋🔥 جاهز تتفوق على أمس؟`,
  `${USER}! الألم مؤقت، الـ gains دايمة 🏆`,
  `صباح العضلات يا ${USER} ⚡ بنشتغل اليوم؟`,
  `${USER} في البيت 🔥 الجيم ما يستاهل أكثر منك`,
  `هيا ${USER}، الـ PRs ما تجي بدون عرق 🎯`,
  `${USER} 🦾 كل سيت بيقربك من نسختك الأفضل`,
]

// ── Muscle Groups & Exercises ─────────────────────────────────
export const MUSCLE_GROUPS = {
  Chest: {
    emoji: '🫁', color: '#FF6B35',
    exercises: [
      { name: 'Bench Press',          emoji: '🏋️' },
      { name: 'Incline Bench Press',  emoji: '📐' },
      { name: 'Decline Bench Press',  emoji: '📉' },
      { name: 'Cable Fly',            emoji: '🔄' },
      { name: 'Dumbbell Fly',         emoji: '🦋' },
      { name: 'Push-Up',              emoji: '👐' },
      { name: 'Chest Dip',            emoji: '⬇️' },
      { name: 'Pec Deck',             emoji: '🦅' },
      { name: 'Landmine Press',       emoji: '💥' },
    ],
  },
  Back: {
    emoji: '🗂️', color: '#3B82F6',
    exercises: [
      { name: 'Deadlift',             emoji: '⚔️' },
      { name: 'Pull-Up',              emoji: '🪝' },
      { name: 'Barbell Row',          emoji: '🚣' },
      { name: 'Cable Row',            emoji: '🎯' },
      { name: 'Lat Pulldown',         emoji: '⬇️' },
      { name: 'T-Bar Row',            emoji: '🔱' },
      { name: 'Face Pull',            emoji: '😤' },
      { name: 'Single Arm Row',       emoji: '🤜' },
      { name: 'Chest-Supported Row',  emoji: '🛏️' },
    ],
  },
  Shoulders: {
    emoji: '🦾', color: '#A855F7',
    exercises: [
      { name: 'Overhead Press',       emoji: '☝️' },
      { name: 'Dumbbell OHP',         emoji: '🏋️' },
      { name: 'Lateral Raise',        emoji: '🦅' },
      { name: 'Front Raise',          emoji: '⬆️' },
      { name: 'Rear Delt Fly',        emoji: '🔙' },
      { name: 'Arnold Press',         emoji: '💪' },
      { name: 'Upright Row',          emoji: '🧲' },
      { name: 'Cable Lateral Raise',  emoji: '🔄' },
      { name: 'Machine Shoulder Press', emoji: '🤖' },
    ],
  },
  Legs: {
    emoji: '🦵', color: '#22C55E',
    exercises: [
      { name: 'Barbell Squat',        emoji: '👑' },
      { name: 'Leg Press',            emoji: '🔧' },
      { name: 'Romanian Deadlift',    emoji: '🇷🇴' },
      { name: 'Leg Extension',        emoji: '🦵' },
      { name: 'Leg Curl',             emoji: '🌀' },
      { name: 'Lunge',                emoji: '🚶' },
      { name: 'Hip Thrust',           emoji: '🍑' },
      { name: 'Calf Raise',           emoji: '🧦' },
      { name: 'Hack Squat',           emoji: '🔩' },
      { name: 'Bulgarian Split Squat', emoji: '🇧🇬' },
    ],
  },
  Biceps: {
    emoji: '💪', color: '#EAB308',
    exercises: [
      { name: 'Barbell Curl',         emoji: '🏋️' },
      { name: 'Dumbbell Curl',        emoji: '🤜' },
      { name: 'Hammer Curl',          emoji: '🔨' },
      { name: 'Preacher Curl',        emoji: '🙏' },
      { name: 'Cable Curl',           emoji: '🔄' },
      { name: 'Incline Dumbbell Curl', emoji: '📐' },
      { name: 'Concentration Curl',   emoji: '🎯' },
      { name: 'Spider Curl',          emoji: '🕷️' },
    ],
  },
  Triceps: {
    emoji: '🔱', color: '#F97316',
    exercises: [
      { name: 'Triceps Pushdown',     emoji: '⬇️' },
      { name: 'Skull Crusher',        emoji: '💀' },
      { name: 'Overhead Triceps',     emoji: '☝️' },
      { name: 'Diamond Push-Up',      emoji: '💎' },
      { name: 'Triceps Dip',          emoji: '🏊' },
      { name: 'Close-Grip Bench',     emoji: '🤏' },
      { name: 'Cable Kickback',       emoji: '🦵' },
    ],
  },
  Core: {
    emoji: '🎯', color: '#EC4899',
    exercises: [
      { name: 'Plank',                emoji: '📏' },
      { name: 'Crunches',             emoji: '🌀' },
      { name: 'Leg Raise',            emoji: '🦵' },
      { name: 'Russian Twist',        emoji: '🌪️' },
      { name: 'Ab Wheel',             emoji: '⚙️' },
      { name: 'Cable Crunch',         emoji: '🔄' },
      { name: 'Hanging Knee Raise',   emoji: '🪝' },
      { name: 'Hollow Body Hold',     emoji: '🌙' },
    ],
  },
  Cardio: {
    emoji: '❤️', color: '#EF4444',
    exercises: [
      { name: 'Treadmill Run',        emoji: '🏃' },
      { name: 'Rowing Machine',       emoji: '🚣' },
      { name: 'Jump Rope',            emoji: '🪢' },
      { name: 'Stationary Bike',      emoji: '🚴' },
      { name: 'Stair Climber',        emoji: '🪜' },
      { name: 'Battle Ropes',         emoji: '🌊' },
      { name: 'Sled Push',            emoji: '🛷' },
    ],
  },
}

// ── Ready-made Routines ───────────────────────────────────────
export const ROUTINES = [
  {
    name: 'Chest Day 🫁',
    muscles: ['Chest', 'Triceps'],
    exercises: [
      { muscle: 'Chest',   name: 'Bench Press',         emoji: '🏋️', defaultSets: 4 },
      { muscle: 'Chest',   name: 'Incline Bench Press', emoji: '📐', defaultSets: 3 },
      { muscle: 'Chest',   name: 'Cable Fly',           emoji: '🔄', defaultSets: 3 },
      { muscle: 'Chest',   name: 'Pec Deck',            emoji: '🦅', defaultSets: 3 },
      { muscle: 'Triceps', name: 'Triceps Pushdown',    emoji: '⬇️', defaultSets: 3 },
      { muscle: 'Triceps', name: 'Skull Crusher',       emoji: '💀', defaultSets: 3 },
    ],
  },
  {
    name: 'Pull Day 🗂️',
    muscles: ['Back', 'Biceps'],
    exercises: [
      { muscle: 'Back',   name: 'Deadlift',       emoji: '⚔️', defaultSets: 4 },
      { muscle: 'Back',   name: 'Lat Pulldown',   emoji: '⬇️', defaultSets: 3 },
      { muscle: 'Back',   name: 'Barbell Row',    emoji: '🚣', defaultSets: 3 },
      { muscle: 'Back',   name: 'Face Pull',      emoji: '😤', defaultSets: 3 },
      { muscle: 'Biceps', name: 'Barbell Curl',   emoji: '🏋️', defaultSets: 3 },
      { muscle: 'Biceps', name: 'Hammer Curl',    emoji: '🔨', defaultSets: 3 },
    ],
  },
  {
    name: 'Push Day 🦾',
    muscles: ['Chest', 'Shoulders', 'Triceps'],
    exercises: [
      { muscle: 'Chest',     name: 'Bench Press',      emoji: '🏋️', defaultSets: 4 },
      { muscle: 'Shoulders', name: 'Overhead Press',   emoji: '☝️', defaultSets: 3 },
      { muscle: 'Chest',     name: 'Incline Bench Press', emoji: '📐', defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Lateral Raise',    emoji: '🦅', defaultSets: 4 },
      { muscle: 'Triceps',   name: 'Triceps Pushdown', emoji: '⬇️', defaultSets: 3 },
    ],
  },
  {
    name: 'Legs Day 🦵',
    muscles: ['Legs'],
    exercises: [
      { muscle: 'Legs', name: 'Barbell Squat',      emoji: '👑', defaultSets: 4 },
      { muscle: 'Legs', name: 'Romanian Deadlift',  emoji: '🇷🇴', defaultSets: 3 },
      { muscle: 'Legs', name: 'Leg Press',          emoji: '🔧', defaultSets: 3 },
      { muscle: 'Legs', name: 'Leg Extension',      emoji: '🦵', defaultSets: 3 },
      { muscle: 'Legs', name: 'Leg Curl',           emoji: '🌀', defaultSets: 3 },
      { muscle: 'Legs', name: 'Calf Raise',         emoji: '🧦', defaultSets: 4 },
    ],
  },
  {
    name: 'Full Body ⚡',
    muscles: ['Chest', 'Back', 'Legs', 'Shoulders'],
    exercises: [
      { muscle: 'Chest',     name: 'Bench Press',    emoji: '🏋️', defaultSets: 3 },
      { muscle: 'Back',      name: 'Deadlift',       emoji: '⚔️', defaultSets: 3 },
      { muscle: 'Legs',      name: 'Barbell Squat',  emoji: '👑', defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Overhead Press', emoji: '☝️', defaultSets: 3 },
      { muscle: 'Back',      name: 'Pull-Up',        emoji: '🪝', defaultSets: 3 },
      { muscle: 'Core',      name: 'Plank',          emoji: '📏', defaultSets: 3 },
    ],
  },
  {
    name: 'Upper Body 🏆',
    muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
    exercises: [
      { muscle: 'Chest',     name: 'Bench Press',      emoji: '🏋️', defaultSets: 4 },
      { muscle: 'Back',      name: 'Barbell Row',       emoji: '🚣', defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Overhead Press',    emoji: '☝️', defaultSets: 3 },
      { muscle: 'Biceps',    name: 'Barbell Curl',      emoji: '🏋️', defaultSets: 3 },
      { muscle: 'Triceps',   name: 'Triceps Pushdown',  emoji: '⬇️', defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Lateral Raise',     emoji: '🦅', defaultSets: 3 },
    ],
  },
]

// ── Rest Timer Presets (seconds) ──────────────────────────────
export const REST_PRESETS = [45, 60, 90, 120, 180]

// ── Nav Tabs ──────────────────────────────────────────────────
export const NAV_TABS = [
  { id: 'home',    label: 'الرئيسية',    icon: '🏠' },
  { id: 'today',   label: 'اليوم',       icon: '🔥' },
  { id: 'history', label: 'السجل',       icon: '📋' },
  { id: 'photos',  label: 'الصور',       icon: '📸' },
  { id: 'stats',   label: 'الإحصائيات', icon: '📊' },
]
