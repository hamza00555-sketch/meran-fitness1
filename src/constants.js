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
      { name: 'Bench Press',         videoUrl: 'https://www.youtube.com/watch?v=ysUTNll8JQ8', tips: ['اثبت الكتفين على المقعد طوال الحركة', 'المسكة أعرض من الكتفين قليلاً', 'نزّل البار لمنتصف الصدر وليس الحلق'] },
      { name: 'Incline Bench Press', videoUrl: 'https://www.youtube.com/watch?v=DbFgADa2PL8', tips: ['زاوية 30-45 درجة للاستهداف الأمثل', 'الجزء العلوي من الصدر هو المحرك', 'لا ترفع الأرداف عن المقعد'] },
      { name: 'Decline Bench Press', videoUrl: 'https://www.youtube.com/watch?v=LfyQBUKR8SE', tips: ['يستهدف الجزء السفلي من الصدر', 'المسكة أوسع قليلاً من Bench عادي', 'لف المعصمين للأمام لحماية المفصل'] },
      { name: 'Cable Fly',           videoUrl: 'https://www.youtube.com/watch?v=8Um35Es-ROE', tips: ['أبقِ المرفقين مثنيين قليلاً طوال الحركة', 'الحركة في قوس واسع كأنك تعانق شجرة', 'التوتر مستمر على الصدر في كل المدى'] },
      { name: 'Dumbbell Fly',        videoUrl: 'https://www.youtube.com/watch?v=eozdVDA78K0', tips: ['لا تفرد المرفقين كلياً لحماية المفصل', 'ارجع الدمبل بتحكم وببطء', 'أعلى نقطة: الدمبلان فوق الصدر مباشرة'] },
      { name: 'Push-Up',             videoUrl: 'https://www.youtube.com/watch?v=vh72hbUqqfs', tips: ['الجسم خط مستقيم من الرأس للقدمين', 'المرفقان بزاوية 45 درجة عن الجذع', 'اضغط الصدر للأسفل حتى يلامس الأرض'] },
      { name: 'Chest Dip',           videoUrl: 'https://www.youtube.com/watch?v=8UugSoVJLag', tips: ['أمِل الجسم للأمام لاستهداف الصدر', 'المرفقان للخارج قليلاً', 'لا تنزل تحت 90 درجة في البداية'] },
      { name: 'Pec Deck',            videoUrl: 'https://www.youtube.com/watch?v=10hg4LAa7UQ', tips: ['اسند الظهر كاملاً على المسند', 'الحركة فقط من الصدر لا من الكوعين', 'لا تعود للخلف أكثر مما يسمح المفصل'] },
      { name: 'Landmine Press',      videoUrl: 'https://www.youtube.com/watch?v=BQE4_5yTVf8', tips: ['القدم المقابلة للأمام لثبات أفضل', 'اضغط للأعلى وللأمام بشكل مائل', 'يستهدف الصدر العلوي والكتف الأمامي'] },
    ],
  },
  Back: {
    label: 'الظهر', emoji: '🗂️', color: '#3B82F6', img: '/assets/muscle_back.png',
    exercises: [
      { name: 'Deadlift',             videoUrl: 'https://www.youtube.com/watch?v=n454SpMZRt8', tips: ['الظهر مستقيم طوال الحركة — لا قوس', 'البار يلصق بالجسم من البداية للنهاية', 'ابدأ بدفع الأرض بالأرجل وليس سحب الظهر'] },
      { name: 'Pull-Up',              videoUrl: 'https://www.youtube.com/watch?v=ylVmNQlKdAI', tips: ['اسحب بالظهر لا بالذراعين', 'الكتفان للأسفل والخلف قبل بدء السحب', 'انزل بالتحكم البطيء للمدى الكامل'] },
      { name: 'Barbell Row',          videoUrl: 'https://www.youtube.com/watch?v=9efgcAjQe7E', tips: ['الظهر موازٍ للأرض أو قريب منه', 'اسحب نحو السرة لا الصدر', 'اضغط لوحَي الكتف معاً في نهاية الحركة'] },
      { name: 'Cable Row',            videoUrl: 'https://www.youtube.com/watch?v=7o2oolbmzeI', tips: ['الظهر مستقيم لا تميل للخلف', 'اسحب للسرة مع الضغط على الظهر', 'المرفقان للخلف وليس للجانبين'] },
      { name: 'Lat Pulldown',         videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc', tips: ['اسحب للأسفل حتى ذقنك أو الصدر العلوي', 'الظهر مائل للخلف قليلاً', 'افتح الصدر وارفع الذقن في نهاية الحركة'] },
      { name: 'T-Bar Row',            videoUrl: 'https://www.youtube.com/watch?v=OrrKhAcb62o', tips: ['الصدر على المسند لمنع الغش', 'اسحب للأعلى مع الضغط على لوحَي الكتف', 'الظهر ثابت ومستقيم'] },
      { name: 'Face Pull',            videoUrl: 'https://www.youtube.com/watch?v=rep-qVOkqgk', tips: ['البكرة على مستوى الوجه أو أعلى قليلاً', 'اسحب نحو الوجه مع إبعاد المرفقين للأعلى', 'مهم جداً لصحة مفصل الكتف'] },
      { name: 'Single Arm Row',       videoUrl: 'https://www.youtube.com/watch?v=sUqz6oaISkQ', tips: ['الظهر موازٍ للأرض والجذع ثابت', 'اسحب الكوع للأعلى والخلف', 'لا تدور بالجذع أثناء السحب'] },
      { name: 'Chest-Supported Row',  videoUrl: 'https://www.youtube.com/watch?v=FU6YQawma2Q', tips: ['الصدر ملاصق للمسند طوال الحركة', 'يمنع الغش ويعزل الظهر تماماً', 'ركز على السحب بالمرفقين للخلف'] },
    ],
  },
  Shoulders: {
    label: 'الأكتاف', emoji: '🦾', color: '#A855F7', img: '/assets/muscle_shoulders.png',
    exercises: [
      { name: 'Overhead Press',        videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI', tips: ['الظهر مستقيم لا تقوس أسفل الظهر', 'ارفع البار عمودياً فوق الرأس', 'اشد البطن لحماية أسفل الظهر'] },
      { name: 'Dumbbell OHP',          videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog', tips: ['ابدأ بالمرفقين على زاوية 90 درجة', 'ارفع للأعلى مبتعداً عن الأذنين', 'الدمبلان يلتقيان في الأعلى دون تصادم'] },
      { name: 'Lateral Raise',         videoUrl: 'https://www.youtube.com/watch?v=yPzAmmuH-H8', tips: ['لا ترفع الأكتاف أثناء الرفع — أبقِها منخفضة', 'ارفع حتى مستوى الكتف فقط', 'المرفقان مثنيان قليلاً لحماية المفصل'] },
      { name: 'Front Raise',           videoUrl: 'https://www.youtube.com/watch?v=-t7fuZ0KhDA', tips: ['المرفقان مفرودان قليلاً لا مثنيان', 'ارفع حتى مستوى الكتف أو أعلى قليلاً', 'الإرجاع بالتحكم لا تهوي الذراع'] },
      { name: 'Rear Delt Fly',         videoUrl: 'https://www.youtube.com/watch?v=d1QEddtoOq0', tips: ['أمِل للأمام من الوسط 45 درجة', 'ارفع الذراعين للجانبين محافظاً على الخم', 'ركز على الشعور بالضغط خلف الكتف'] },
      { name: 'Arnold Press',          videoUrl: 'https://www.youtube.com/watch?v=ris9tKqMwgU', tips: ['يجمع بين الدوران والرفع في حركة واحدة', 'يستهدف ثلاثة رؤوس الكتف', 'الدوران في البداية مهم لتفعيل الأمامي'] },
      { name: 'Upright Row',           videoUrl: 'https://www.youtube.com/watch?v=amCU-ziHITM', tips: ['الأيدي أقرب من عرض الكتفين', 'المرفقان للأعلى دائماً', 'احذر: قد يسبب ضغطاً على الكتف إذا أُسيء استخدامه'] },
      { name: 'Cable Lateral Raise',   videoUrl: 'https://www.youtube.com/watch?v=BGw_YA3KiHs', tips: ['البكرة من الأسفل لتوتر مستمر', 'الجسم مائل قليلاً للجانب الآخر', 'أفضل من الدمبل للشعور بالضغط المستمر'] },
      { name: 'Machine Shoulder Press',videoUrl: 'https://www.youtube.com/watch?v=DV-Fimmnk4Y', tips: ['اضبط ارتفاع المقعد بحيث المقبض عند الكتف', 'اسند الظهر كاملاً على المسند', 'مناسب للمبتدئين وللتضخيم'] },
    ],
  },
  Legs: {
    label: 'الأرجل', emoji: '🦵', color: '#22C55E', img: '/assets/muscle_legs.png',
    exercises: [
      { name: 'Barbell Squat',         videoUrl: 'https://www.youtube.com/watch?v=1oed-UmAxFs', tips: ['الظهر مستقيم طوال الحركة', 'الركبتان تتجهان نحو أصابع القدم', 'انزل حتى الفخذ موازٍ للأرض على الأقل'] },
      { name: 'Leg Press',             videoUrl: 'https://www.youtube.com/watch?v=cDGOn-yfKJA', tips: ['القدمان بعرض الكتفين على اللوحة', 'لا تقفل الركبتين كلياً في الأعلى', 'الظهر ملاصق للمسند طوال الحركة'] },
      { name: 'Romanian Deadlift',     videoUrl: 'https://www.youtube.com/watch?v=JCXUYuzwNrM', tips: ['الظهر مستقيم — الحركة من الوركين لا الظهر', 'انزل الوركين للخلف وليس للأسفل', 'ممتاز لتمديد وتضخيم أوتار الركبة'] },
      { name: 'Leg Extension',         videoUrl: 'https://www.youtube.com/watch?v=ECt7bZ9zc4c', tips: ['لا تضرب الوزن ولا تستخدم الزخم', 'ارفع حتى الامتداد الكامل وحافظ ثانية', 'الإرجاع بالتحكم لا تهوي السقوط'] },
      { name: 'Leg Curl',              videoUrl: 'https://www.youtube.com/watch?v=ELOCsoDSmrg', tips: ['الوركان ثابتان على المقعد', 'اثنِ حتى 90 درجة أو أكثر', 'الإرجاع البطيء يضاعف التأثير'] },
      { name: 'Lunge',                 videoUrl: 'https://www.youtube.com/watch?v=g8x9ck225ZE', tips: ['الركبة الأمامية لا تتعدى القدم', 'الظهر مستقيم والصدر مرفوع', 'الخطوة الطويلة تستهدف الأرداف أكثر'] },
      { name: 'Hip Thrust',            videoUrl: 'https://www.youtube.com/watch?v=BbC60C78ARU', tips: ['الكتفان على المقعد والقدمان ثابتتان', 'ارفع الوركين حتى الامتداد الكامل', 'اضغط الأرداف بقوة في أعلى نقطة'] },
      { name: 'Calf Raise',            videoUrl: 'https://www.youtube.com/watch?v=3UWi44yN-wM', tips: ['اسحب على أصابع القدم بالكامل', 'الإرجاع البطيء للأسفل لمدى كامل', 'الساق مفردة أصعب وأكثر تأثيراً'] },
      { name: 'Hack Squat',            videoUrl: 'https://www.youtube.com/watch?v=fE5BWPy7uRc', tips: ['الظهر ملاصق للمسند', 'القدمان أمام الجسم لحماية الركبة', 'انزل بالتحكم ولا تقفز'] },
      { name: 'Bulgarian Split Squat', videoUrl: 'https://www.youtube.com/watch?v=ohCX9HFi9vA', tips: ['القدم الخلفية على مسند بارتفاع الركبة', 'الركبة الأمامية تتجه نحو الأصابع', 'حافظ على توازنك وابدأ ببطء'] },
    ],
  },
  Biceps: {
    label: 'البايسبس', emoji: '💪', color: '#EAB308', img: '/assets/muscle_biceps.png',
    exercises: [
      { name: 'Barbell Curl',         videoUrl: 'https://www.youtube.com/watch?v=LY1V6UbRHFM', tips: ['المرفقان ثابتان جانب الجذع', 'اثنِ حتى الأعلى واضغط على البايسبس', 'لا تتأرجح بالجذع للمساعدة'] },
      { name: 'Dumbbell Curl',        videoUrl: 'https://www.youtube.com/watch?v=sAq_ocpRh_I', tips: ['يمكن تناوبهما أو معاً حسب الهدف', 'أضف دوران المعصم في الأعلى للضغط', 'الإرجاع بالتحكم لا تسقطهما'] },
      { name: 'Hammer Curl',          videoUrl: 'https://www.youtube.com/watch?v=8XLxfXROrTo', tips: ['الإمساك محايد — الإبهام للأعلى', 'يستهدف عضلة العضد والساعد أيضاً', 'يساعد على سمك الذراع إجمالاً'] },
      { name: 'Preacher Curl',        videoUrl: 'https://www.youtube.com/watch?v=nbcgEmZ0Be4', tips: ['الذراع ملاصق للمسند يمنع الغش', 'لا تفرد المرفق كلياً لحماية الوتر', 'التركيز الكامل على البايسبس'] },
      { name: 'Cable Curl',           videoUrl: 'https://www.youtube.com/watch?v=2MUEL4nL6hA', tips: ['التوتر مستمر على البايسبس في كل المدى', 'جرب زوايا مختلفة للبكرة', 'يختلف عن الدمبل بالتوتر المستمر'] },
      { name: 'Incline Dumbbell Curl',videoUrl: 'https://www.youtube.com/watch?v=MVSccftvAQw', tips: ['المقعد مائل للخلف يمدد البايسبس أكثر', 'توتر أعلى في الجزء السفلي من الحركة', 'يضرب رأس البايسبس الطويل بشكل ممتاز'] },
      { name: 'Concentration Curl',   videoUrl: 'https://www.youtube.com/watch?v=cn0jmGzXIXY', tips: ['الكوع على الفخذ الداخلي ثابت تماماً', 'ركيز كامل على البايسبس بلا غش', 'اعمل بإبطاء لأقصى استشعار'] },
      { name: 'Spider Curl',          videoUrl: 'https://www.youtube.com/watch?v=BsE9zhhTU1A', tips: ['الجسم على مقعد مائل للأمام', 'الجاذبية تزيد التوتر في الأعلى', 'ممتاز لتطوير ذروة البايسبس'] },
    ],
  },
  Triceps: {
    label: 'الترايسبس', emoji: '🔱', color: '#F97316', img: '/assets/muscle_triceps.png',
    exercises: [
      { name: 'Triceps Pushdown',  videoUrl: 'https://www.youtube.com/watch?v=_w-HpW70nSQ', tips: ['المرفقان ثابتان جانب الجذع', 'اضغط للأسفل حتى الامتداد الكامل', 'الإرجاع بالتحكم لا تدع الوزن يرفعك'] },
      { name: 'Skull Crusher',     videoUrl: 'https://www.youtube.com/watch?v=RavQHfFxbdA', tips: ['المرفقان ثابتان وموجهان للأعلى', 'انزل البار خلف الرأس أو للجبهة', 'لا تسرع — خطر على الكوع إذا أُسيء'] },
      { name: 'Overhead Triceps',  videoUrl: 'https://www.youtube.com/watch?v=fYqswDVbJDg', tips: ['المرفقان قريبان من الرأس لا بعيدان', 'امتداد كامل للأعلى في كل تكرار', 'يستهدف الرأس الطويل — أكبر جزء في الترايسبس'] },
      { name: 'Diamond Push-Up',   videoUrl: 'https://www.youtube.com/watch?v=J0DnG1_S92I', tips: ['الأيدي على شكل ماسة تحت الصدر', 'المرفقان للداخل أثناء النزول', 'الجسم خط مستقيم طوال الحركة'] },
      { name: 'Triceps Dip',       videoUrl: 'https://www.youtube.com/watch?v=8UugSoVJLag', tips: ['الكوعان للخلف لا للجانبين', 'انزل حتى 90 درجة لاستهداف الترايسبس', 'ثبت الجسم رأسياً لا أمامياً'] },
      { name: 'Close-Grip Bench',  videoUrl: 'https://www.youtube.com/watch?v=UYJsFzqdgK4', tips: ['المسكة بعرض الكتف أو أضيق قليلاً', 'المرفقان للداخل أثناء النزول', 'يستهدف الترايسبس والصدر الأوسط'] },
      { name: 'Cable Kickback',    videoUrl: 'https://www.youtube.com/watch?v=xu_Y1BqubEk', tips: ['الكوع ثابت جانب الجذع', 'امتداد كامل للخلف في كل تكرار', 'الجذع موازٍ للأرض لعزل الترايسبس'] },
    ],
  },
  Core: {
    label: 'الكور', emoji: '🎯', color: '#EC4899', img: '/assets/muscle_core.png',
    exercises: [
      { name: 'Plank',              videoUrl: 'https://www.youtube.com/watch?v=fqzUlmyTpJk', tips: ['الجسم خط مستقيم من الرأس للقدمين', 'لا ترفع الوركين أو تخفضهما', 'اضغط البطن بشكل إرادي طوال المدة'] },
      { name: 'Crunches',           videoUrl: 'https://www.youtube.com/watch?v=vqvZ5WtEZYw', tips: ['لا تشد الرقبة بيديك', 'ارفع الكتفين لا الظهر كاملاً', 'التنفس منتظم: زفير عند الرفع'] },
      { name: 'Leg Raise',          videoUrl: 'https://www.youtube.com/watch?v=QTpTqhd_DR0', tips: ['أسفل الظهر لاصق بالأرض', 'الإرجاع البطيء أكثر تأثيراً من السريع', 'ثنِ الركبتين لتخفيف الصعوبة'] },
      { name: 'Russian Twist',      videoUrl: 'https://www.youtube.com/watch?v=IJDOoVyVjhc', tips: ['ارفع القدمين لزيادة الصعوبة', 'لف الجذع وليس الكتفين فقط', 'الحركة تنبع من عضلات الخصر'] },
      { name: 'Ab Wheel',           videoUrl: 'https://www.youtube.com/watch?v=j6lR4u193gE', tips: ['ابدأ من الركبتين قبل من الوقوف', 'الظهر مستقيم لا يقوس', 'لا تتمدد أبعد مما تستطيع العودة منه'] },
      { name: 'Cable Crunch',       videoUrl: 'https://www.youtube.com/watch?v=OSSlsHz8lZA', tips: ['اثنِ من الوسط لا من الوركين', 'الوجه للأسفل والوركان ثابتة', 'الحركة قصيرة ومركزة في البطن'] },
      { name: 'Hanging Knee Raise', videoUrl: 'https://www.youtube.com/watch?v=l7OroezzX9k', tips: ['لا تتأرجح واستخدم الزخم', 'اضغط البطن قبل بدء الرفع', 'ارفع الركبتين حتى الصدر للمدى الكامل'] },
      { name: 'Hollow Body Hold',   videoUrl: 'https://www.youtube.com/watch?v=9C15UEAyKqE', tips: ['الظهر مسطح تماماً على الأرض', 'ارفع الكتفين والقدمين معاً في آنٍ واحد', 'ضغط مستمر لا يتوقف'] },
    ],
  },
  Cardio: {
    label: 'الكارديو', emoji: '❤️', color: '#EF4444', img: '/assets/cardio.png',
    exercises: [
      { name: 'Treadmill Run',    videoUrl: 'https://www.youtube.com/watch?v=kwtpGFQ4Xew', tips: ['ابدأ بالمشي السريع للإحماء دقيقتين', 'الخطوة المتوسطة أفضل للمفاصل', 'المشي بزاوية ميل يحرق سعرات أكثر'] },
      { name: 'Rowing Machine',   videoUrl: 'https://www.youtube.com/watch?v=lXjvoUeRLxU', tips: ['الترتيب: الأرجل ثم الظهر ثم الذراعين', 'لا تقوس الظهر — احذر من هذا', 'وتيرة 22-28 شوطاً في الدقيقة مثالية'] },
      { name: 'Jump Rope',        videoUrl: 'https://www.youtube.com/watch?v=s-8tbwbEZ68', tips: ['انط على أصابع القدمين لا الكعبين', 'ابدأ ببطء وزد الوتيرة تدريجياً', 'يحرق السعرات بشكل ممتاز في وقت قصير'] },
      { name: 'Stationary Bike',  videoUrl: 'https://www.youtube.com/watch?v=ufhbfTWpYEk', tips: ['اضبط ارتفاع المقعد: الركبة شبه ممدودة في أسفل الدورة', 'الركبة الأمامية لا تتعدى القدم عند أعلى نقطة', 'مريح جداً للمفاصل مقارنة بالجري'] },
      { name: 'Stair Climber',    videoUrl: 'https://www.youtube.com/watch?v=6eMPlQ95gXI', tips: ['لا تعتمد على الدرابزين كثيراً', 'الخطوات بعمق للاستهداف الأمثل للأرداف', 'يستهدف الأرداف والساق والكور معاً'] },
      { name: 'Battle Ropes',     videoUrl: 'https://www.youtube.com/watch?v=zw0OMi00X5g', tips: ['الجسم في وضع التمريرة: ركبتان مثنيتان', 'حرك الحبلين معاً أو بالتناوب', 'يتطلب قوة هائلة ويرفع معدل ضربات القلب بسرعة'] },
      { name: 'Sled Push',        videoUrl: 'https://www.youtube.com/watch?v=YJbKlXj4WhI', tips: ['أمِل الجسم للأمام بزاوية 45 درجة', 'الخطوات قصيرة وسريعة', 'يطوّر القوة الانفجارية للساق والكور'] },
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
    title: '500 كجم حجم',
    desc: 'ارفع 500 كيلوغرام إجمالي في جلسة واحدة',
    icon: '💪', xp: 65, target: 500,
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
    title: 'حجم 5000 كجم أسبوعي',
    desc: 'ارفع 5000 كيلوغرام إجمالي خلال الأسبوع',
    icon: '🏋️', xp: 200, target: 5000,
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
    title: 'تحدي الأسطورة: 10 طن',
    desc: 'ارفع 10,000 كيلوغرام في جلسة واحدة — إنجاز الأبطال!',
    icon: '🏔️', xp: 750, target: 10000,
    check: (sessions) => {
      return Math.max(0, ...sessions.map(s =>
        s.exercises.flatMap(e => e.sets)
          .reduce((t, ss) => ss.done ? t + (parseFloat(ss.weight) || 0) * (parseInt(ss.reps) || 0) : t, 0)))
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
  { id: 'profile',      label: 'الملف',    icon: '👤' },
  { id: 'achievements', label: 'جوائز',    icon: '🏆' },
  { id: 'challenges',   label: 'تحديات',   icon: '🏳️' },
  { id: 'workout',      label: 'تمرين',    icon: '⚔️' },
  { id: 'home',         label: 'الرئيسية', icon: '🏠' },
]
// Settings accessible via gear icon in header (not a nav tab)

export const PLAN_TEMPLATE = {
  version: '1.0',
  planName: 'اسم الخطة',
  startDate: new Date().toISOString().split('T')[0],
  durationWeeks: 12,
  goal: 'muscle',
  weeklySchedule: [
    {
      dayOfWeek: 1,
      name: 'Push Day',
      exercises: [
        { muscle: 'Chest',     name: 'Bench Press',      sets: 4, repsMin: 8,  repsMax: 12, restSeconds: 120 },
        { muscle: 'Chest',     name: 'Incline Bench Press', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
        { muscle: 'Shoulders', name: 'Overhead Press',   sets: 3, repsMin: 8,  repsMax: 10, restSeconds: 120 },
        { muscle: 'Shoulders', name: 'Lateral Raise',    sets: 4, repsMin: 12, repsMax: 15, restSeconds: 60  },
        { muscle: 'Triceps',   name: 'Triceps Pushdown', sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60  },
      ],
    },
    {
      dayOfWeek: 3,
      name: 'Pull Day',
      exercises: [
        { muscle: 'Back',   name: 'Deadlift',      sets: 4, repsMin: 5,  repsMax: 8,  restSeconds: 180 },
        { muscle: 'Back',   name: 'Lat Pulldown',  sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90  },
        { muscle: 'Back',   name: 'Barbell Row',   sets: 3, repsMin: 8,  repsMax: 10, restSeconds: 120 },
        { muscle: 'Biceps', name: 'Barbell Curl',  sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60  },
        { muscle: 'Biceps', name: 'Hammer Curl',   sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60  },
      ],
    },
    {
      dayOfWeek: 5,
      name: 'Legs Day',
      exercises: [
        { muscle: 'Legs', name: 'Barbell Squat',     sets: 4, repsMin: 6,  repsMax: 10, restSeconds: 180 },
        { muscle: 'Legs', name: 'Romanian Deadlift', sets: 3, repsMin: 8,  repsMax: 12, restSeconds: 120 },
        { muscle: 'Legs', name: 'Leg Press',         sets: 3, repsMin: 10, repsMax: 15, restSeconds: 90  },
        { muscle: 'Legs', name: 'Leg Extension',     sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60  },
        { muscle: 'Legs', name: 'Calf Raise',        sets: 4, repsMin: 15, repsMax: 20, restSeconds: 45  },
      ],
    },
  ],
}

export const AI_PLAN_PROMPT = `أنا أستخدم تطبيق HamzaFit لتتبع التمارين. أحتاج منك ملء الـ JSON التالي بخطة تمرين مخصصة بناءً على [PDF/الفيديو/البرنامج] المرفق.

قواعد مهمة:
- قيم "muscle" يجب أن تكون فقط من: Chest, Back, Shoulders, Legs, Biceps, Triceps, Core, Cardio
- "dayOfWeek": 0=الأحد، 1=الاثنين، 2=الثلاثاء، 3=الأربعاء، 4=الخميس، 5=الجمعة، 6=السبت
- "goal": muscle | strength | fat_loss | endurance | recomp | maintain
- أبقِ نفس هيكل JSON بالضبط، فقط غيّر القيم

هيكل JSON:
TEMPLATE_PLACEHOLDER

أعطني الـ JSON المكتمل فقط بدون أي شرح إضافي.`

export const NOTIFICATION_MESSAGES = {
  morning: [
    { title: '🌅 صباح التحدي', body: 'كل يوم فرصة جديدة تكون أقوى من أمس.' },
    { title: '⚔️ يوم جديد', body: 'المحارب الحقيقي لا ينتظر الحافز — هو يصنعه.' },
    { title: '💜 صباح الطاقة', body: 'بدنك ينتظر التحدي — أطعمه الحركة اليوم.' },
    { title: '🔥 بداية النهار', body: 'الفرق بينك وبين أهدافك: الاستمرارية.' },
    { title: '🌄 الصباح للأبطال', body: 'اليوم تكتب صفحة جديدة في رحلتك.' },
  ],
  tip: [
    { title: '💡 نصيحة التمرين', body: 'استرح دقيقتين بين السيتات للعضلات الكبيرة.' },
    { title: '📊 معلومة عضلية', body: 'العضلة تنمو وقت الراحة لا وقت التمرين — نم جيداً.' },
    { title: '🔬 علم الجسم', body: 'الحمل التدريجي هو السر الوحيد للنمو العضلي.' },
    { title: '⚡ تقنية السيت', body: 'البطء في الإرجاع أكثر فائدة من السرعة في الرفع.' },
    { title: '🏋️ حكمة الجيم', body: 'الشكل الصحيح أهم من الوزن — الإصابة تضيع أشهر.' },
    { title: '💧 تذكير مائي', body: 'اشرب ماءً الآن — الجفاف يقلل قوتك ٢٠٪.' },
    { title: '🧠 نصيحة ذهنية', body: 'تخيل العضلة تعمل أثناء التمرين — أثبتها الأبحاث.' },
    { title: '🥩 بروتين اليوم', body: 'تناول بروتيناً بعد التمرين بـ 30 دقيقة للحصول على أفضل نتيجة.' },
  ],
  hydration: [
    { title: '💧 حان وقت الماء', body: 'اشرب ٥٠٠مل ماء الآن — جسمك يحتاجه.' },
    { title: '🥤 تذكير مائي', body: 'الجفاف يقلل الأداء ٢٠٪ — اشرب الآن!' },
    { title: '⚗️ الهيدرا أولاً', body: 'لا تنسَ الماء — هو الأساس قبل أي مكمل.' },
  ],
  workout: [
    { title: '⚔️ حان وقت الجيم!', body: 'الجيم ينتظرك — هيا نحصد القوة اليوم!' },
    { title: '💪 لا عذر اليوم!', body: 'أغلق الهاتف وافتح الشنطة — وقت التمرين.' },
    { title: '🔥 النار تشتعل!', body: 'جسمك جاهز والجيم ينتظر — قم الآن.' },
    { title: '⚡ انطلق يا حمزة!', body: 'كل جلسة تمرين تقربك من النسخة الأفضل.' },
    { title: '🏆 وقت الإنجاز!', body: 'المحاربون لا يتأخرون — حان دورك.' },
  ],
  evening: [
    { title: '🌙 مراجعة اليوم', body: 'هل أكملت تمرينك اليوم؟ سجّله في التطبيق.' },
    { title: '⭐ يوم قوي آخر', body: 'الاستمرارية هي الفوز — فخور بك اليوم.' },
    { title: '😴 قبل النوم', body: 'النوم الجيد = نمو عضلي أفضل — استرح مبكراً.' },
    { title: '🗓️ جهّز لغد', body: 'جهّز شنطتك الآن حتى لا يكون لديك عذر غداً.' },
    { title: '💜 احتفل بنفسك', body: 'كل يوم تستمر فيه هو انتصار — أنت رائع.' },
  ],
}

export const WORKOUT_TIME_HOURS = {
  'الصباح':  7,
  'الظهيرة': 12,
  'المساء':  17,
  'الليل':   20,
}

// ── XP Rates ──────────────────────────────────────────────────
export const XP_RATES = {
  set_done:       10,
  session_finish: 50,
  session_hour:   30,
  challenge:      1,
}
