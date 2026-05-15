// ── Player ────────────────────────────────────────────────────
export const PLAYER_NAME = 'حمزة'

// ── Greetings (25 Arabic motivational phrases) ────────────────
export const GREETINGS = [
  `يلا ${PLAYER_NAME} 💪 اليوم بنكسر الجيم!`,
  `مرحبا ${PLAYER_NAME} 🔥 جاهز تتفوق على أمس؟`,
  `${PLAYER_NAME}! الألم مؤقت، القوة دايمة 🏆`,
  `صباح العضلات يا ${PLAYER_NAME} ⚡ بنشتغل اليوم؟`,
  `${PLAYER_NAME} في البيت 🔥 الجيم يستاهل جهدك`,
  `هيا ${PLAYER_NAME}، الـ PRs ما تجي بدون عرق 🎯`,
  `${PLAYER_NAME} 🦾 كل سيت بيقربك من نسختك الأفضل`,
  `يا ${PLAYER_NAME}، العظماء ما يستسلمون 👑`,
  `${PLAYER_NAME}! اليوم تكتب تاريخك في الجيم 📖`,
  `استيقظ يا ${PLAYER_NAME}، الأوزان تنتظرك ⚔️`,
  `${PLAYER_NAME}، كل تمرين هو خطوة نحو الأسطورة 🌟`,
  `بسم الله يا ${PLAYER_NAME}، اليوم نكسر أرقامنا 💥`,
  `${PLAYER_NAME} قيم لا يُكسر 🛡️ اليوم للجيم!`,
  `لا عذر اليوم يا ${PLAYER_NAME}، الجيم أولاً 🥇`,
  `${PLAYER_NAME} البطل، الجيم ينتظر حضورك 🏟️`,
  `صح النوم يا ${PLAYER_NAME} ⚡ وقت الشغل جاء!`,
  `${PLAYER_NAME}، من جد وجد، ومن زرع حصد 🌱`,
  `اليوم بنعمل شغلة يا ${PLAYER_NAME} 💣`,
  `${PLAYER_NAME} 🔱 الإرادة أقوى من أي عقبة`,
  `يلا نشتغل يا ${PLAYER_NAME}، التحدي يبدأ الآن ⚡`,
  `${PLAYER_NAME}، جسمك يشكرك على كل تمرين 💚`,
  `اليوم بنثبت إننا الأفضل يا ${PLAYER_NAME} 👊`,
  `${PLAYER_NAME} 🦁 الأسد لا يتوقف، يواصل!`,
  `كل يوم تمرين هو استثمار يا ${PLAYER_NAME} 📈`,
  `${PLAYER_NAME}، العقل يستسلم قبل الجسم بكثير 🧠💪`,
]

// ── Ranks ─────────────────────────────────────────────────────
export const RANKS = [
  { label: 'المبتدئ',  tier: 'E',  minLevel: 1,  color: '#9CA3AF', bg: '#9CA3AF20', img: '/assets/rank_e.png' },
  { label: 'الجاد',    tier: 'D',  minLevel: 5,  color: '#22C55E', bg: '#22C55E20', img: '/assets/rank_d.png' },
  { label: 'الحديدي',  tier: 'C',  minLevel: 10, color: '#3B82F6', bg: '#3B82F620', img: '/assets/rank_c.png' },
  { label: 'المتمرس',  tier: 'B',  minLevel: 20, color: '#9B59B6', bg: '#9B59B620', img: '/assets/rank_b.png' },
  { label: 'النخبة',   tier: 'A',  minLevel: 35, color: '#F97316', bg: '#F9731620', img: '/assets/rank_a.png' },
  { label: 'الأسطورة', tier: 'S',  minLevel: 50, color: '#EAB308', bg: '#EAB30820', img: '/assets/rank_s.png' },
  { label: 'الظاهرة',  tier: 'S+', minLevel: 75, color: '#C39BD3', bg: '#C39BD320', img: '/assets/rank_s_plus.png' },
]

// ── Commitment Levels (0-5 flames based on streak) ───────────
export const COMMITMENT_LEVELS = [
  { min: 0,  label: 'غير نشط',      flames: 0, color: '#4B5563', desc: 'ابدأ رحلتك اليوم!' },
  { min: 1,  label: 'مبتدئ',        flames: 1, color: '#F97316', desc: 'خطوة رائعة، استمر!' },
  { min: 3,  label: 'منتظم',        flames: 2, color: '#EAB308', desc: 'الانتظام هو المفتاح!' },
  { min: 7,  label: 'ملتزم',        flames: 3, color: '#22C55E', desc: 'أسبوع كامل، ممتاز!' },
  { min: 14, label: 'مخضرم',        flames: 4, color: '#00D4C8', desc: 'أسبوعان متواصلان!' },
  { min: 30, label: 'أسطورة الجيم', flames: 5, color: '#9B59B6', desc: 'شهر كامل، أنت أسطورة!' },
]

// ── Goals ─────────────────────────────────────────────────────
export const GOALS = [
  { id: 'muscle',   label: 'بناء العضلات',    icon: '💪', desc: 'زيادة الكتلة العضلية والقوة',          img: '/assets/goalc_muscle.png' },
  { id: 'fat_loss', label: 'حرق الدهون',      icon: '🔥', desc: 'تقليل نسبة الدهون وتحسين الجسم',      img: '/assets/goalc_fatloss.png' },
  { id: 'strength', label: 'زيادة القوة',     icon: '⚔️', desc: 'رفع أوزان أثقل وتحسين الأداء',        img: '/assets/goalc_strength.png' },
  { id: 'endurance',label: 'التحمل واللياقة', icon: '🏃', desc: 'تحسين اللياقة والقدرة على التحمل',    img: '/assets/goalc_endurance.png' },
  { id: 'recomp',   label: 'إعادة التشكيل',   icon: '⚡', desc: 'بناء العضل وحرق الدهون معاً',         img: '/assets/goalc_recomp.png' },
  { id: 'maintain', label: 'المحافظة',         icon: '🛡️', desc: 'الحفاظ على مستوى اللياقة الحالي',    img: '/assets/goalc_muscle.png' },
]

// ── Gym Types ─────────────────────────────────────────────────
export const GYM_TYPES = [
  { id: 'commercial', label: 'جيم تجاري',  icon: '🏋️' },
  { id: 'home',       label: 'جيم منزلي',  icon: '🏠' },
  { id: 'outdoor',    label: 'في الهواء',  icon: '🌳' },
  { id: 'crossfit',   label: 'كروسفيت',    icon: '⚡' },
]

// ── Training Systems ──────────────────────────────────────────
export const TRAINING_SYSTEMS = [
  { id: 'ppl',        label: 'Push/Pull/Legs' },
  { id: 'upper_lower', label: 'Upper/Lower' },
  { id: 'fullbody',   label: 'Full Body' },
  { id: 'bro_split',  label: 'Bro Split' },
  { id: 'custom',     label: 'مخصص' },
]

// ── Week Days ─────────────────────────────────────────────────
export const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const WEEK_DAYS_SHORT = ['ح', 'ن', 'ث', 'أ', 'خ', 'ج', 'س']

// ── Muscle Groups ─────────────────────────────────────────────
export const MUSCLE_GROUPS = {
  Chest: {
    label: 'الصدر', emoji: '🫁', color: '#FF6B35', img: '/assets/muscle_chest.png',
    exercises: [
      { name: 'Bench Press' }, { name: 'Incline Bench Press' },
      { name: 'Decline Bench Press' }, { name: 'Cable Fly' },
      { name: 'Dumbbell Fly' }, { name: 'Push-Up' },
      { name: 'Chest Dip' }, { name: 'Pec Deck' },
      { name: 'Landmine Press' },
    ],
  },
  Back: {
    label: 'الظهر', emoji: '🗂️', color: '#3B82F6', img: '/assets/muscle_back.png',
    exercises: [
      { name: 'Deadlift' }, { name: 'Pull-Up' },
      { name: 'Barbell Row' }, { name: 'Cable Row' },
      { name: 'Lat Pulldown' }, { name: 'T-Bar Row' },
      { name: 'Face Pull' }, { name: 'Single Arm Row' },
      { name: 'Chest-Supported Row' },
    ],
  },
  Shoulders: {
    label: 'الأكتاف', emoji: '🦾', color: '#A855F7', img: '/assets/muscle_shoulders.png',
    exercises: [
      { name: 'Overhead Press' }, { name: 'Dumbbell OHP' },
      { name: 'Lateral Raise' }, { name: 'Front Raise' },
      { name: 'Rear Delt Fly' }, { name: 'Arnold Press' },
      { name: 'Upright Row' }, { name: 'Cable Lateral Raise' },
      { name: 'Machine Shoulder Press' },
    ],
  },
  Legs: {
    label: 'الأرجل', emoji: '🦵', color: '#22C55E', img: '/assets/muscle_legs.png',
    exercises: [
      { name: 'Barbell Squat' }, { name: 'Leg Press' },
      { name: 'Romanian Deadlift' }, { name: 'Leg Extension' },
      { name: 'Leg Curl' }, { name: 'Lunge' },
      { name: 'Hip Thrust' }, { name: 'Calf Raise' },
      { name: 'Hack Squat' }, { name: 'Bulgarian Split Squat' },
    ],
  },
  Biceps: {
    label: 'البايسبس', emoji: '💪', color: '#EAB308', img: '/assets/muscle_biceps.png',
    exercises: [
      { name: 'Barbell Curl' }, { name: 'Dumbbell Curl' },
      { name: 'Hammer Curl' }, { name: 'Preacher Curl' },
      { name: 'Cable Curl' }, { name: 'Incline Dumbbell Curl' },
      { name: 'Concentration Curl' }, { name: 'Spider Curl' },
    ],
  },
  Triceps: {
    label: 'الترايسبس', emoji: '🔱', color: '#F97316', img: '/assets/muscle_triceps.png',
    exercises: [
      { name: 'Triceps Pushdown' }, { name: 'Skull Crusher' },
      { name: 'Overhead Triceps' }, { name: 'Diamond Push-Up' },
      { name: 'Triceps Dip' }, { name: 'Close-Grip Bench' },
      { name: 'Cable Kickback' },
    ],
  },
  Core: {
    label: 'الكور', emoji: '🎯', color: '#EC4899', img: '/assets/muscle_core.png',
    exercises: [
      { name: 'Plank' }, { name: 'Crunches' },
      { name: 'Leg Raise' }, { name: 'Russian Twist' },
      { name: 'Ab Wheel' }, { name: 'Cable Crunch' },
      { name: 'Hanging Knee Raise' }, { name: 'Hollow Body Hold' },
    ],
  },
  Cardio: {
    label: 'الكارديو', emoji: '❤️', color: '#EF4444', img: '/assets/cardio.png',
    exercises: [
      { name: 'Treadmill Run' }, { name: 'Rowing Machine' },
      { name: 'Jump Rope' }, { name: 'Stationary Bike' },
      { name: 'Stair Climber' }, { name: 'Battle Ropes' },
      { name: 'Sled Push' },
    ],
  },
}

// ── Routines ──────────────────────────────────────────────────
export const ROUTINES = [
  {
    name: 'Chest Day 🫁',
    muscles: ['Chest', 'Triceps'],
    exercises: [
      { muscle: 'Chest',   name: 'Bench Press',         defaultSets: 4 },
      { muscle: 'Chest',   name: 'Incline Bench Press', defaultSets: 3 },
      { muscle: 'Chest',   name: 'Cable Fly',           defaultSets: 3 },
      { muscle: 'Chest',   name: 'Pec Deck',            defaultSets: 3 },
      { muscle: 'Triceps', name: 'Triceps Pushdown',    defaultSets: 3 },
      { muscle: 'Triceps', name: 'Skull Crusher',       defaultSets: 3 },
    ],
  },
  {
    name: 'Pull Day 🗂️',
    muscles: ['Back', 'Biceps'],
    exercises: [
      { muscle: 'Back',   name: 'Deadlift',       defaultSets: 4 },
      { muscle: 'Back',   name: 'Lat Pulldown',   defaultSets: 3 },
      { muscle: 'Back',   name: 'Barbell Row',    defaultSets: 3 },
      { muscle: 'Back',   name: 'Face Pull',      defaultSets: 3 },
      { muscle: 'Biceps', name: 'Barbell Curl',   defaultSets: 3 },
      { muscle: 'Biceps', name: 'Hammer Curl',    defaultSets: 3 },
    ],
  },
  {
    name: 'Push Day 🦾',
    muscles: ['Chest', 'Shoulders', 'Triceps'],
    exercises: [
      { muscle: 'Chest',     name: 'Bench Press',         defaultSets: 4 },
      { muscle: 'Shoulders', name: 'Overhead Press',      defaultSets: 3 },
      { muscle: 'Chest',     name: 'Incline Bench Press', defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Lateral Raise',       defaultSets: 4 },
      { muscle: 'Triceps',   name: 'Triceps Pushdown',    defaultSets: 3 },
    ],
  },
  {
    name: 'Legs Day 🦵',
    muscles: ['Legs'],
    exercises: [
      { muscle: 'Legs', name: 'Barbell Squat',      defaultSets: 4 },
      { muscle: 'Legs', name: 'Romanian Deadlift',  defaultSets: 3 },
      { muscle: 'Legs', name: 'Leg Press',          defaultSets: 3 },
      { muscle: 'Legs', name: 'Leg Extension',      defaultSets: 3 },
      { muscle: 'Legs', name: 'Leg Curl',           defaultSets: 3 },
      { muscle: 'Legs', name: 'Calf Raise',         defaultSets: 4 },
    ],
  },
  {
    name: 'Full Body ⚡',
    muscles: ['Chest', 'Back', 'Legs', 'Shoulders'],
    exercises: [
      { muscle: 'Chest',     name: 'Bench Press',    defaultSets: 3 },
      { muscle: 'Back',      name: 'Deadlift',       defaultSets: 3 },
      { muscle: 'Legs',      name: 'Barbell Squat',  defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Overhead Press', defaultSets: 3 },
      { muscle: 'Back',      name: 'Pull-Up',        defaultSets: 3 },
      { muscle: 'Core',      name: 'Plank',          defaultSets: 3 },
    ],
  },
  {
    name: 'Upper Body 🏆',
    muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
    exercises: [
      { muscle: 'Chest',     name: 'Bench Press',      defaultSets: 4 },
      { muscle: 'Back',      name: 'Barbell Row',      defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Overhead Press',   defaultSets: 3 },
      { muscle: 'Biceps',    name: 'Barbell Curl',     defaultSets: 3 },
      { muscle: 'Triceps',   name: 'Triceps Pushdown', defaultSets: 3 },
      { muscle: 'Shoulders', name: 'Lateral Raise',    defaultSets: 3 },
    ],
  },
]

// ── Daily Challenge Pool (9 challenges) ───────────────────────
export const DAILY_CHALLENGE_POOL = [
  {
    id: 'dc1', type: 'daily',
    title: 'أنهِ جلسة اليوم',
    desc: 'أكمل جلسة تدريبية واحدة على الأقل اليوم',
    icon: '⚡', xp: 50, target: 1,
    check: (sessions) => sessions.filter(s => s.date.split('T')[0] === new Date().toISOString().split('T')[0]).length,
  },
  {
    id: 'dc2', type: 'daily',
    title: '10 سيتات مكتملة',
    desc: 'أكمل 10 سيتات على الأقل في جلسة واحدة',
    icon: '🎯', xp: 40, target: 10,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      return todaySessions.reduce((max, s) =>
        Math.max(max, s.exercises.flatMap(e => e.sets).filter(ss => ss.done).length), 0)
    },
  },
  {
    id: 'dc3', type: 'daily',
    title: '3 مجموعات عضلية',
    desc: 'تدرب على 3 مجموعات عضلية مختلفة في يوم واحد',
    icon: '🦾', xp: 60, target: 3,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      const muscles = new Set(todaySessions.flatMap(s => s.exercises.map(e => e.muscle)))
      return muscles.size
    },
  },
  {
    id: 'dc4', type: 'daily',
    title: 'جلسة 45 دقيقة',
    desc: 'أكمل جلسة تدريبية مدتها 45 دقيقة أو أكثر',
    icon: '⏱️', xp: 55, target: 45,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      return sessions.filter(s => s.date.split('T')[0] === today && s.duration >= 45).length > 0 ? 45 : 0
    },
  },
  {
    id: 'dc5', type: 'daily',
    title: '2000 كجم حجم',
    desc: 'ارفع 2000 كجم إجمالي وزن×تكرارات في جلسة واحدة',
    icon: '💪', xp: 65, target: 2000,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      return Math.max(0, ...todaySessions.map(s =>
        s.exercises.flatMap(e => e.sets).reduce((t, ss) =>
          ss.done ? t + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : t, 0)))
    },
  },
  {
    id: 'dc6', type: 'daily',
    title: 'تمرين الصدر اليوم',
    desc: 'قم بتمارين الصدر بـ 3 سيتات على الأقل',
    icon: '🫁', xp: 45, target: 3,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      return todaySessions.flatMap(s => s.exercises.filter(e => e.muscle === 'Chest').flatMap(e => e.sets.filter(ss => ss.done))).length
    },
  },
  {
    id: 'dc7', type: 'daily',
    title: 'تمرين الأرجل اليوم',
    desc: 'قم بتمارين الأرجل بـ 3 سيتات على الأقل',
    icon: '🦵', xp: 45, target: 3,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      return todaySessions.flatMap(s => s.exercises.filter(e => e.muscle === 'Legs').flatMap(e => e.sets.filter(ss => ss.done))).length
    },
  },
  {
    id: 'dc8', type: 'daily',
    title: '5 تمارين مختلفة',
    desc: 'قم بـ 5 تمارين مختلفة في جلسة واحدة',
    icon: '📋', xp: 70, target: 5,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      return Math.max(0, ...todaySessions.map(s => s.exercises.length))
    },
  },
  {
    id: 'dc9', type: 'daily',
    title: 'سجل وزن اليوم',
    desc: 'سجل وزن في كل سيت تكمله اليوم',
    icon: '⚖️', xp: 30, target: 1,
    check: (sessions) => {
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = sessions.filter(s => s.date.split('T')[0] === today)
      const hasSetsWithWeight = todaySessions.some(s =>
        s.exercises.some(e => e.sets.some(ss => ss.done && ss.weight)))
      return hasSetsWithWeight ? 1 : 0
    },
  },
]

// ── Weekly Challenge Pool (4 challenges) ──────────────────────
export const WEEKLY_CHALLENGE_POOL = [
  {
    id: 'wc1', type: 'weekly',
    title: '4 جلسات هذا الأسبوع',
    desc: 'أكمل 4 جلسات تدريبية خلال 7 أيام',
    icon: '📅', xp: 150, target: 4,
    check: (sessions) => {
      const weekAgo = Date.now() - 7 * 86400000
      return sessions.filter(s => new Date(s.date) > weekAgo).length
    },
  },
  {
    id: 'wc2', type: 'weekly',
    title: 'حجم 15,000 كجم أسبوعي',
    desc: 'ارفع 15,000 كجم إجمالي وزن×تكرارات خلال الأسبوع',
    icon: '🏋️', xp: 200, target: 15000,
    check: (sessions) => {
      const weekAgo = Date.now() - 7 * 86400000
      return sessions.filter(s => new Date(s.date) > weekAgo)
        .reduce((t, s) => t + s.exercises.flatMap(e => e.sets)
          .reduce((tt, ss) => ss.done ? tt + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : tt, 0), 0)
    },
  },
  {
    id: 'wc3', type: 'weekly',
    title: 'تدرب على كل مجموعة عضلية',
    desc: 'تدرب على 5 مجموعات عضلية مختلفة هذا الأسبوع',
    icon: '🎯', xp: 180, target: 5,
    check: (sessions) => {
      const weekAgo = Date.now() - 7 * 86400000
      const muscles = new Set(sessions.filter(s => new Date(s.date) > weekAgo)
        .flatMap(s => s.exercises.map(e => e.muscle)))
      return muscles.size
    },
  },
  {
    id: 'wc4', type: 'weekly',
    title: 'ساعتان تدريب أسبوعياً',
    desc: 'اجمع 120 دقيقة من التدريب هذا الأسبوع',
    icon: '⏰', xp: 160, target: 120,
    check: (sessions) => {
      const weekAgo = Date.now() - 7 * 86400000
      return sessions.filter(s => new Date(s.date) > weekAgo)
        .reduce((t, s) => t + (s.duration || 0), 0)
    },
  },
]

// ── Boss Challenges (2 challenges) ────────────────────────────
export const BOSS_CHALLENGES = [
  {
    id: 'bc1', type: 'boss',
    title: 'تحدي الشهر: 20 جلسة',
    desc: 'أكمل 20 جلسة تدريبية في شهر واحد — تحدي الزعيم!',
    icon: '👹', xp: 500, target: 20,
    check: (sessions) => {
      const monthAgo = Date.now() - 30 * 86400000
      return sessions.filter(s => new Date(s.date) > monthAgo).length
    },
  },
  {
    id: 'bc2', type: 'boss',
    title: 'تحدي الأسطورة: 50 طن',
    desc: 'اجمع 50,000 كجم إجمالي خلال الشهر (وزن×تكرارات) — إنجاز الأبطال!',
    icon: '🏔️', xp: 750, target: 50000,
    check: (sessions) => {
      const monthAgo = Date.now() - 30 * 86400000
      return sessions.filter(s => new Date(s.date) > monthAgo)
        .reduce((t, s) => t + s.exercises.flatMap(e => e.sets)
          .reduce((tt, ss) => ss.done ? tt + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : tt, 0), 0)
    },
  },
]

// ── Achievements (40 achievements across 4 categories) ────────
export const ACHIEVEMENT_CATS = [
  { id: 'all',       label: 'الكل' },
  { id: 'sessions',  label: 'الجلسات' },
  { id: 'strength',  label: 'القوة' },
  { id: 'streak',    label: 'الالتزام' },
  { id: 'volume',    label: 'الحجم' },
]

export const RARITY_COLORS = {
  common:    { color: '#9CA3AF', label: 'عادي' },
  rare:      { color: '#3B82F6', label: 'نادر' },
  epic:      { color: '#9B59B6', label: 'ملحمي' },
  legendary: { color: '#EAB308', label: 'أسطوري' },
}

export const ACHIEVEMENTS = [
  // ── Sessions ──────────────────────────────────────────────────
  {
    id: 'a1', cat: 'sessions', rarity: 'common',
    icon: '🌱', title: 'الخطوة الأولى', desc: 'أنهِ جلستك الأولى', xp: 100,
    check: (sessions) => sessions.length >= 1,
  },
  {
    id: 'a2', cat: 'sessions', rarity: 'common',
    icon: '🏋️', title: '5 جلسات', desc: 'أنهِ 5 جلسات تدريبية', xp: 150,
    check: (sessions) => sessions.length >= 5,
  },
  {
    id: 'a3', cat: 'sessions', rarity: 'common',
    icon: '📋', title: '10 جلسات', desc: 'أنهِ 10 جلسات تدريبية', xp: 200,
    check: (sessions) => sessions.length >= 10,
  },
  {
    id: 'a4', cat: 'sessions', rarity: 'rare',
    icon: '🥈', title: '25 جلسة', desc: 'أنهِ 25 جلسة تدريبية', xp: 300,
    check: (sessions) => sessions.length >= 25,
  },
  {
    id: 'a5', cat: 'sessions', rarity: 'rare',
    icon: '🥇', title: '50 جلسة', desc: 'أنهِ 50 جلسة تدريبية', xp: 500,
    check: (sessions) => sessions.length >= 50,
  },
  {
    id: 'a6', cat: 'sessions', rarity: 'epic',
    icon: '💯', title: '100 جلسة', desc: 'أنهِ 100 جلسة تدريبية', xp: 800,
    check: (sessions) => sessions.length >= 100,
  },
  {
    id: 'a7', cat: 'sessions', rarity: 'legendary',
    icon: '🏆', title: 'مئتا جلسة', desc: 'أنهِ 200 جلسة تدريبية', xp: 1500,
    check: (sessions) => sessions.length >= 200,
  },
  {
    id: 'a8', cat: 'sessions', rarity: 'common',
    icon: '⏱️', title: 'ساعة في الجيم', desc: 'أكمل جلسة مدتها 60 دقيقة أو أكثر', xp: 120,
    check: (sessions) => sessions.some(s => (s.duration || 0) >= 60),
  },
  {
    id: 'a9', cat: 'sessions', rarity: 'rare',
    icon: '🕐', title: 'ساعتان متواصلتان', desc: 'أكمل جلسة مدتها 120 دقيقة أو أكثر', xp: 250,
    check: (sessions) => sessions.some(s => (s.duration || 0) >= 120),
  },
  {
    id: 'a10', cat: 'sessions', rarity: 'common',
    icon: '🌅', title: 'رياضي الصباح', desc: 'سجل 3 جلسات في يوم واحد', xp: 180,
    check: (sessions) => {
      const byday = {}
      sessions.forEach(s => {
        const d = s.date.split('T')[0]
        byday[d] = (byday[d] || 0) + 1
      })
      return Object.values(byday).some(c => c >= 3)
    },
  },
  // ── Strength ──────────────────────────────────────────────────
  {
    id: 'b1', cat: 'strength', rarity: 'common',
    icon: '🏋️', title: 'أول 100 كجم', desc: 'ارفع 100 كجم في أي تمرين', xp: 150,
    check: (sessions) => sessions.some(s =>
      s.exercises.some(e => e.sets.some(ss => ss.done && parseFloat(ss.weight) >= 100))),
  },
  {
    id: 'b2', cat: 'strength', rarity: 'rare',
    icon: '⚡', title: '140 كجم', desc: 'ارفع 140 كجم في أي تمرين', xp: 300,
    check: (sessions) => sessions.some(s =>
      s.exercises.some(e => e.sets.some(ss => ss.done && parseFloat(ss.weight) >= 140))),
  },
  {
    id: 'b3', cat: 'strength', rarity: 'epic',
    icon: '🦁', title: '180 كجم', desc: 'ارفع 180 كجم في أي تمرين', xp: 500,
    check: (sessions) => sessions.some(s =>
      s.exercises.some(e => e.sets.some(ss => ss.done && parseFloat(ss.weight) >= 180))),
  },
  {
    id: 'b4', cat: 'strength', rarity: 'legendary',
    icon: '👑', title: 'تحدي 200 كجم', desc: 'ارفع 200 كجم في أي تمرين', xp: 1000,
    check: (sessions) => sessions.some(s =>
      s.exercises.some(e => e.sets.some(ss => ss.done && parseFloat(ss.weight) >= 200))),
  },
  {
    id: 'b5', cat: 'strength', rarity: 'common',
    icon: '🎯', title: '15 سيت في جلسة', desc: 'أكمل 15 سيت في جلسة واحدة', xp: 120,
    check: (sessions) => sessions.some(s =>
      s.exercises.flatMap(e => e.sets).filter(ss => ss.done).length >= 15),
  },
  {
    id: 'b6', cat: 'strength', rarity: 'rare',
    icon: '🔥', title: '30 سيت في جلسة', desc: 'أكمل 30 سيت في جلسة واحدة', xp: 250,
    check: (sessions) => sessions.some(s =>
      s.exercises.flatMap(e => e.sets).filter(ss => ss.done).length >= 30),
  },
  {
    id: 'b7', cat: 'strength', rarity: 'common',
    icon: '🏗️', title: 'بناء الأساس', desc: 'قم بـ Deadlift و Bench Press في نفس الجلسة', xp: 130,
    check: (sessions) => sessions.some(s => {
      const names = s.exercises.map(e => e.name)
      return names.includes('Deadlift') && names.includes('Bench Press')
    }),
  },
  {
    id: 'b8', cat: 'strength', rarity: 'epic',
    icon: '🦍', title: 'الثلاثية الكبرى', desc: 'قم بـ Deadlift و Squat و Bench Press في نفس الجلسة', xp: 400,
    check: (sessions) => sessions.some(s => {
      const names = s.exercises.map(e => e.name)
      return names.includes('Deadlift') && names.includes('Barbell Squat') && names.includes('Bench Press')
    }),
  },
  {
    id: 'b9', cat: 'strength', rarity: 'rare',
    icon: '🌊', title: 'تنوع العضلات', desc: 'تدرب على 6 مجموعات عضلية مختلفة في جلسة واحدة', xp: 280,
    check: (sessions) => sessions.some(s =>
      new Set(s.exercises.map(e => e.muscle)).size >= 6),
  },
  {
    id: 'b10', cat: 'strength', rarity: 'legendary',
    icon: '🧠', title: 'عقل المحارب', desc: 'أكمل 500 سيت إجمالية عبر كل جلساتك', xp: 800,
    check: (sessions) =>
      sessions.flatMap(s => s.exercises.flatMap(e => e.sets)).filter(ss => ss.done).length >= 500,
  },
  // ── Streak ────────────────────────────────────────────────────
  {
    id: 'c1', cat: 'streak', rarity: 'common',
    icon: '🔥', title: '3 أيام متواصلة', desc: 'تدرب 3 أيام متتالية', xp: 100,
    check: (s, xp, streak) => streak >= 3,
  },
  {
    id: 'c2', cat: 'streak', rarity: 'common',
    icon: '🔥🔥', title: 'أسبوع نار', desc: 'تدرب 7 أيام متتالية', xp: 250,
    check: (s, xp, streak) => streak >= 7,
  },
  {
    id: 'c3', cat: 'streak', rarity: 'rare',
    icon: '🔥🔥🔥', title: 'أسبوعان متواصلان', desc: 'تدرب 14 يوماً متتالياً', xp: 450,
    check: (s, xp, streak) => streak >= 14,
  },
  {
    id: 'c4', cat: 'streak', rarity: 'epic',
    icon: '🌙', title: 'شهر النار', desc: 'تدرب 30 يوماً متتالياً', xp: 800,
    check: (s, xp, streak) => streak >= 30,
  },
  {
    id: 'c5', cat: 'streak', rarity: 'legendary',
    icon: '⚡', title: 'لا يُوقَف', desc: 'تدرب 60 يوماً متتالياً', xp: 2000,
    check: (s, xp, streak) => streak >= 60,
  },
  {
    id: 'c6', cat: 'streak', rarity: 'legendary',
    icon: '🌟', title: 'أسطورة اليد الحديدية', desc: 'تدرب 100 يوم متتالٍ', xp: 3000,
    check: (s, xp, streak) => streak >= 100,
  },
  {
    id: 'c7', cat: 'streak', rarity: 'common',
    icon: '📅', title: 'عاد من جديد', desc: 'ابدأ من جديد بعد انقطاع — كل يوم فرصة جديدة', xp: 50,
    check: (sessions) => sessions.length >= 1,
  },
  {
    id: 'c8', cat: 'streak', rarity: 'rare',
    icon: '🏆', title: '5 أيام هذا الأسبوع', desc: 'تدرب 5 أيام في أسبوع واحد', xp: 200,
    check: (sessions) => {
      const weekAgo = Date.now() - 7 * 86400000
      const days = new Set(sessions.filter(s => new Date(s.date) > weekAgo).map(s => s.date.split('T')[0]))
      return days.size >= 5
    },
  },
  {
    id: 'c9', cat: 'streak', rarity: 'epic',
    icon: '💎', title: 'ملتزم بالأهداف', desc: 'لا تغب عن الجيم أكثر من يومين متتاليين لمدة شهر', xp: 600,
    check: (sessions) => {
      if (sessions.length < 5) return false
      const monthAgo = Date.now() - 30 * 86400000
      const monthSessions = sessions.filter(s => new Date(s.date) > monthAgo)
      if (monthSessions.length < 5) return false
      const days = [...new Set(monthSessions.map(s => s.date.split('T')[0]))].sort()
      for (let i = 1; i < days.length; i++) {
        const diff = (new Date(days[i]) - new Date(days[i - 1])) / 86400000
        if (diff > 3) return false
      }
      return true
    },
  },
  {
    id: 'c10', cat: 'streak', rarity: 'rare',
    icon: '📆', title: 'الشهر كامل', desc: 'سجل جلسات في 20 يوم مختلف خلال شهر واحد', xp: 400,
    check: (sessions) => {
      const monthAgo = Date.now() - 30 * 86400000
      const days = new Set(sessions.filter(s => new Date(s.date) > monthAgo).map(s => s.date.split('T')[0]))
      return days.size >= 20
    },
  },
  // ── Volume ────────────────────────────────────────────────────
  {
    id: 'd1', cat: 'volume', rarity: 'common',
    icon: '📦', title: 'أول طن', desc: 'ارفع 1000 كجم في جلسة واحدة', xp: 150,
    check: (sessions) => sessions.some(s =>
      s.exercises.flatMap(e => e.sets)
        .reduce((t, ss) => ss.done ? t + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : t, 0) >= 1000),
  },
  {
    id: 'd2', cat: 'volume', rarity: 'rare',
    icon: '📦📦', title: '5 طن في جلسة', desc: 'ارفع 5000 كجم في جلسة واحدة', xp: 300,
    check: (sessions) => sessions.some(s =>
      s.exercises.flatMap(e => e.sets)
        .reduce((t, ss) => ss.done ? t + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : t, 0) >= 5000),
  },
  {
    id: 'd3', cat: 'volume', rarity: 'epic',
    icon: '🏔️', title: '10 طن في جلسة', desc: 'ارفع 10,000 كجم في جلسة واحدة', xp: 600,
    check: (sessions) => sessions.some(s =>
      s.exercises.flatMap(e => e.sets)
        .reduce((t, ss) => ss.done ? t + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : t, 0) >= 10000),
  },
  {
    id: 'd4', cat: 'volume', rarity: 'legendary',
    icon: '🌋', title: 'جبل من الحديد', desc: 'ارفع 100,000 كجم إجمالي عبر كل جلساتك', xp: 1000,
    check: (sessions) =>
      sessions.reduce((t, s) => t + s.exercises.flatMap(e => e.sets)
        .reduce((tt, ss) => ss.done ? tt + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : tt, 0), 0) >= 100000,
  },
  {
    id: 'd5', cat: 'volume', rarity: 'legendary',
    icon: '🪐', title: 'نجم الأثقال', desc: 'ارفع 1,000,000 كجم إجمالياً — مليون! ', xp: 5000,
    check: (sessions) =>
      sessions.reduce((t, s) => t + s.exercises.flatMap(e => e.sets)
        .reduce((tt, ss) => ss.done ? tt + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : tt, 0), 0) >= 1000000,
  },
  {
    id: 'd6', cat: 'volume', rarity: 'common',
    icon: '⚖️', title: 'وزن ثابت', desc: 'دوّن الوزن في 10 سيتات', xp: 80,
    check: (sessions) =>
      sessions.flatMap(s => s.exercises.flatMap(e => e.sets))
        .filter(ss => ss.done && ss.weight).length >= 10,
  },
  {
    id: 'd7', cat: 'volume', rarity: 'rare',
    icon: '📊', title: 'بيانات دقيقة', desc: 'دوّن الوزن في 100 سيت', xp: 200,
    check: (sessions) =>
      sessions.flatMap(s => s.exercises.flatMap(e => e.sets))
        .filter(ss => ss.done && ss.weight).length >= 100,
  },
  {
    id: 'd8', cat: 'volume', rarity: 'common',
    icon: '🎪', title: 'تنوع ممتاز', desc: 'تدرب على 5 تمارين مختلفة تماماً', xp: 100,
    check: (sessions) =>
      new Set(sessions.flatMap(s => s.exercises.map(e => e.name))).size >= 5,
  },
  {
    id: 'd9', cat: 'volume', rarity: 'epic',
    icon: '🧬', title: 'مكتبة الحركات', desc: 'تدرب على 20 تمريناً مختلفاً عبر جلساتك', xp: 400,
    check: (sessions) =>
      new Set(sessions.flatMap(s => s.exercises.map(e => e.name))).size >= 20,
  },
  {
    id: 'd10', cat: 'volume', rarity: 'epic',
    icon: '🌊', title: 'موجة الحجم', desc: 'ارفع 50,000 كجم في أسبوع واحد', xp: 700,
    check: (sessions) => {
      const weekAgo = Date.now() - 7 * 86400000
      return sessions.filter(s => new Date(s.date) > weekAgo)
        .reduce((t, s) => t + s.exercises.flatMap(e => e.sets)
          .reduce((tt, ss) => ss.done ? tt + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : tt, 0), 0) >= 50000
    },
  },
]

// ── Rest Timer Presets (seconds) ──────────────────────────────
export const REST_PRESETS = [45, 60, 90, 120, 180]

// ── Nav Tabs (RTL order: Profile | Achievements | Challenges | Workout | Home) ─
export const NAV_TABS = [
  { id: 'home',         label: 'الرئيسية', icon: '🏠' },
  { id: 'workout',      label: 'تمرين',    icon: '⚔️' },
  { id: 'challenges',   label: 'تحديات',   icon: '🏳️' },
  { id: 'achievements', label: 'جوائز',    icon: '🏆' },
  { id: 'profile',      label: 'الملف',    icon: '👤' },
  { id: 'settings',     label: 'إعدادات',  icon: '⚙️' },
]

// ── XP Rates ──────────────────────────────────────────────────
export const XP_RATES = {
  set_done:       10,
  session_finish: 50,
  session_hour:   30,
  challenge:      1,  // multiplier for challenge xp
}
