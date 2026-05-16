import { AppProvider, useApp } from './context/AppContext.jsx';
import BottomNav from './components/BottomNav.jsx';
import Onboarding from './pages/Onboarding.jsx';
import SalaryDay from './pages/SalaryDay.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Commitments from './pages/Commitments.jsx';
import Banks from './pages/Banks.jsx';
import Goals from './pages/Goals.jsx';
import Expenses from './pages/Expenses.jsx';
import Settings from './pages/Settings.jsx';

const NAV_PAGES = ['dashboard', 'commitments', 'banks', 'goals', 'expenses', 'settings'];

function AppRouter() {
  const { page, loading } = useApp();

  if (loading) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 52 }}>💼</div>
      <div style={{ fontSize: 24, fontWeight: 900 }}>راتبي</div>
      <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
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
      {page === 'expenses'    && <Expenses />}
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
