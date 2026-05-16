import { useApp } from '../context/AppContext.jsx';

const TABS = [
  { id: 'dashboard',   label: 'الرئيسية',  Icon: HomeIcon },
  { id: 'commitments', label: 'التزاماتي', Icon: CommitIcon },
  { id: 'banks',       label: 'بنوكي',     Icon: BankIcon },
  { id: 'goals',       label: 'أهدافي',    Icon: GoalIcon },
  { id: 'settings',    label: 'الإعدادات', Icon: SettingsIcon },
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
      {TABS.map(({ id, label, Icon }) => {
        const active = page === id;
        return (
          <button key={id} onClick={() => setPage(id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 2px 8px', gap: 3, fontFamily: 'Cairo, sans-serif',
            color: active ? '#00C9A7' : '#5C5A8A', transition: 'color .15s',
          }}>
            <Icon active={active} />
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HomeIcon({ active }) {
  const c = active ? '#00C9A7' : '#5C5A8A';
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function CommitIcon({ active }) {
  const c = active ? '#00C9A7' : '#5C5A8A';
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>;
}
function BankIcon({ active }) {
  const c = active ? '#00C9A7' : '#5C5A8A';
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}
function GoalIcon({ active }) {
  const c = active ? '#00C9A7' : '#5C5A8A';
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
function SettingsIcon({ active }) {
  const c = active ? '#00C9A7' : '#5C5A8A';
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
}
