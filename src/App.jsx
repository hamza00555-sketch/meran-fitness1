import { AppProvider, useApp } from './context/AppContext.jsx';
import BottomNav from './components/BottomNav.jsx';
import Onboarding from './pages/Onboarding.jsx';
import SalaryDay from './pages/SalaryDay.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Commitments from './pages/Commitments.jsx';
import Banks from './pages/Banks.jsx';
import Goals from './pages/Goals.jsx';
import Settings from './pages/Settings.jsx';

const NAV_PAGES = ['dashboard', 'commitments', 'banks', 'goals', 'settings'];

function AppRouter() {
  const { page, loading } = useApp();

  if (loading) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0,
      background: 'var(--bg)',
    }}>
      <img src="/icon.svg" alt="راتبي" style={{ width: 120, height: 120, borderRadius: 28, marginBottom: 20 }} />
      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>راتبي</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>تحكم في مالك، وحقق أهدافك</div>
      <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'var(--primary)', borderRadius: 2, width: '60%',
          animation: 'loadbar 1s ease infinite alternate',
        }} />
      </div>
      <style>{`@keyframes loadbar { from{transform:translateX(-100%)} to{transform:translateX(200%)} }`}</style>
    </div>
  );

  if (page === 'onboarding') return <Onboarding />;
  if (page === 'salaryDay') return <SalaryDay />;

  return (
    <>
      {page === 'dashboard'   && <Dashboard />}
      {page === 'commitments' && <Commitments />}
      {page === 'banks'       && <Banks />}
      {page === 'goals'       && <Goals />}
      {page === 'settings'    && <Settings />}
      {NAV_PAGES.includes(page) && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
