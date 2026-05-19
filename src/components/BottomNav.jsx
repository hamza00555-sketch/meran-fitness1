import { useApp } from '../context/AppContext.jsx';

const TABS = [
  { id: 'dashboard',   label: 'الرئيسية',  icon: '/assets/icons/nav-home.png' },
  { id: 'commitments', label: 'التزاماتي', icon: '/assets/icons/nav-commitments.png' },
  { id: 'banks',       label: 'بنوكي',     icon: '/assets/icons/nav-banks.png' },
  { id: 'goals',       label: 'أهدافي',    icon: '/assets/icons/nav-goals.png' },
  { id: 'settings',    label: 'الإعدادات', icon: '/assets/icons/nav-settings.png' },
];

export default function BottomNav() {
  const { page, setPage } = useApp();
  return (
    <nav style={{
      position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 430, margin: '0 auto',
      background: '#13103A', borderTop: '1px solid #2A2660',
      display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {TABS.map(({ id, label, icon }) => {
        const active = page === id;
        return (
          <button key={id} onClick={() => setPage(id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 2px 8px', gap: 3, fontFamily: 'Cairo, sans-serif',
            color: active ? '#00C9A7' : '#5C5A8A', transition: 'color .15s',
          }}>
            <img
              src={icon}
              alt=""
              style={{
                width: 24, height: 24, objectFit: 'contain',
                filter: active ? 'none' : 'grayscale(1) brightness(0.45)',
                transition: 'filter .15s',
              }}
            />
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
