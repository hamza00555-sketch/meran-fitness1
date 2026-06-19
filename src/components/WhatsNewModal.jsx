const FEATURES = [
  {
    icon: '🔆',
    title: 'إضاءة التمرين النشط',
    desc: 'لما تبدأ سيت في تمرين، التمارين الثانية تنطفي تلقائياً وترجع كلها لما تخلص',
  },
  {
    icon: '⬆️',
    title: 'تذكير رفع الوزن',
    desc: 'بعد ما تخلص كل سيتات تمرين يظهر كارد ذهبي يذكرك تجرب ترفع الوزن المرة الجاية',
  },
  {
    icon: '🔄',
    title: 'نقل سيت بين التمارين',
    desc: 'اضغط على رقم السيت وانقله لتمرين ثاني لو غلطت وحطيته في الخانة الغلط',
  },
  {
    icon: '📝',
    title: 'تعديل وحذف سجل الجلسات',
    desc: 'تقدر تعدّل أي جلسة سابقة أو تحذفها من صفحة التمرين',
  },
  {
    icon: '⚡',
    title: 'زر ابدأ التمرين مرتبط بالخطة',
    desc: 'إذا عندك خطة محددة الزر يفتح تمارين اليوم مباشرة بدون إعداد',
  },
  {
    icon: '⭐',
    title: 'نقاط الخبرة عند الإنهاء فقط',
    desc: 'النقاط تُحتسب لما تنهي الجلسة فقط — لو ضغطت تراجع تُسحب كلها',
  },
  {
    icon: '🔔',
    title: 'إشعار واحد في نفس الوقت',
    desc: 'الإشعارات تنتظر في طابور بدل ما تكدّس على الشاشة',
  },
]

export default function WhatsNewModal({ version, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--bg2)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid var(--border2)',
        borderBottom: 'none',
        maxHeight: '88dvh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.5)',
      }}>

        {/* Handle bar */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border2)',
          margin: '12px auto 0',
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--cyan)', letterSpacing: 2, marginBottom: 4,
          }}>
            WHAT&apos;S NEW · v{version}
          </div>
          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 20, fontWeight: 800,
            color: 'var(--text)',
          }}>
            🎉 جديد في MERAN
          </div>
        </div>

        {/* Feature list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, padding: '13px 20px',
              borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : 'none',
              animation: `fadeUp 0.3s ease both`,
              animationDelay: `${i * 50}ms`,
            }}>
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>{f.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700,
                  color: 'var(--text)', marginBottom: 3,
                }}>{f.title}</div>
                <div style={{
                  fontFamily: 'var(--font-ar)', fontSize: 12,
                  color: 'var(--text3)', lineHeight: 1.55,
                }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          padding: '12px 20px calc(var(--safe-bottom) + 12px)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '15px',
              background: 'linear-gradient(135deg, #5EC32A, #3B9D2A)',
              border: 'none', borderRadius: 14,
              color: '#fff', fontFamily: 'var(--font-ar)',
              fontSize: 15, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(94,195,42,0.35)',
            }}
          >تم الاطلاع 🚀</button>
        </div>

      </div>
    </div>
  )
}
