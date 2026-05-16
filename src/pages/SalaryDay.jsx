import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { currentMonth } from '../utils/format.js';
import { calcCommitmentsTotal, calcGoalsMonthlyTotal, calcRemaining } from '../utils/calc.js';
import { getCatData, COMMITMENT_CATEGORIES, GOAL_CATEGORIES } from '../components/CategoryData.js';
import CatIcon from '../components/CategoryIcons.jsx';

export default function SalaryDay() {
  const { settings, commitments, goals, confirmSalaryDay, fmt } = useApp();
  const [salary, setSalary] = useState(String(settings.salary));
  const [goalContribs, setGoalContribs] = useState(
    Object.fromEntries(goals.filter(g => !g.completed).map(g => [g.id, String(g.monthlyContribution || 0)]))
  );

  const month = currentMonth();
  const activeCommitments = commitments.filter(c => c.active !== false);
  const activeGoals = goals.filter(g => !g.completed);

  const commitmentsTotal = useMemo(() => calcCommitmentsTotal(activeCommitments), [activeCommitments]);
  const goalsTotal = useMemo(
    () => activeGoals.reduce((s, g) => s + (Number(goalContribs[g.id]) || 0), 0),
    [activeGoals, goalContribs]
  );
  const remaining = calcRemaining(Number(salary), commitmentsTotal, goalsTotal);

  async function handleConfirm() {
    await confirmSalaryDay({
      month,
      salary: Number(salary),
      commitmentsTotal,
      goalsTotal,
      remaining,
      goalContribs: Object.fromEntries(activeGoals.map(g => [g.id, Number(goalContribs[g.id]) || 0])),
      confirmedAt: new Date().toISOString(),
    });
  }

  const remainingColor = remaining >= 0 ? 'var(--accent)' : 'var(--danger)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1650 0%, #13103A 100%)',
        padding: '52px 20px 24px', textAlign: 'center',
        borderBottom: '1px solid var(--border)',
      }}>
        <img src="/assets/icons/illus-salary.png" alt="" style={{ width: 110, marginBottom: 4 }} />
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>يوم الراتب</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>راجع توزيع راتبك قبل ما يتطير</p>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text2)', fontSize: 13 }}>راتبك هذا الشهر</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text" inputMode="decimal" value={salary}
              onChange={e => setSalary(e.target.value)}
              style={{
                background: 'transparent', border: 'none', borderBottom: '2px solid var(--primary)',
                color: 'var(--accent)', fontSize: 36, fontWeight: 900, fontFamily: 'Cairo, sans-serif',
                textAlign: 'center', outline: 'none', width: `${Math.max(4, salary.length)}ch`,
              }}
            />
            <span style={{ color: 'var(--text2)', fontSize: 18, fontWeight: 700 }}>ريال</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px 50px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Commitments */}
        <Section title="التزاماتك" icon="📋" total={commitmentsTotal} totalColor="var(--danger)">
          {activeCommitments.length === 0 ? (
            <EmptyRow text="لا توجد التزامات" />
          ) : (
            activeCommitments.map(c => {
              const cat = getCatData(COMMITMENT_CATEGORIES, c.category);
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CatIcon id={cat.id} size={18} />
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 14 }}>
                    <span className="num">{fmt(c.amount)}</span> ريال
                  </span>
                </div>
              );
            })
          )}
        </Section>

        {/* Goals */}
        {activeGoals.length > 0 && (
          <Section title="أهدافك الشهرية" icon="🎯" total={goalsTotal} totalColor="var(--primary)">
            {activeGoals.map(g => {
              const cat = getCatData(GOAL_CATEGORIES, g.category);
              return (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CatIcon id={cat.id} size={18} />
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                  <input
                    type="text" inputMode="decimal" value={goalContribs[g.id] || ''}
                    onChange={e => setGoalContribs(p => ({ ...p, [g.id]: e.target.value }))}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                      color: 'var(--primary)', fontFamily: 'Cairo, sans-serif', fontWeight: 700,
                      fontSize: 14, textAlign: 'center', width: 90, padding: '6px 8px', outline: 'none',
                    }}
                  />
                  <span style={{ color: 'var(--text2)', fontSize: 12 }}>ريال</span>
                </div>
              );
            })}
          </Section>
        )}

        {/* Summary */}
        <div style={{
          background: remaining >= 0
            ? 'linear-gradient(135deg, rgba(0,201,167,.15), rgba(0,201,167,.05))'
            : 'linear-gradient(135deg, rgba(255,107,107,.15), rgba(255,107,107,.05))',
          border: `1px solid ${remaining >= 0 ? 'rgba(0,201,167,.3)' : 'rgba(255,107,107,.3)'}`,
          borderRadius: 'var(--r)', padding: '20px', textAlign: 'center',
        }}>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>يتبقى لك هذا الشهر</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: remainingColor }}>
            <span className="num">{fmt(Math.abs(remaining))}</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}> ريال</span>
          </div>
          {remaining < 0 && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              ⚠️ المصروف يتجاوز الراتب بـ <span className="num">{fmt(Math.abs(remaining))}</span> ريال
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            <SummaryRow label="التزامات" value={commitmentsTotal} color="var(--danger)" />
            {goalsTotal > 0 && <SummaryRow label="أهداف" value={goalsTotal} color="var(--primary)" />}
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleConfirm} style={{ marginTop: 4 }}>
          تأكيد وابدأ شهري ✓
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, total, totalColor, children }) {
  const { fmt } = useApp();
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontWeight: 700 }}>{title}</span>
        </div>
        <span style={{ color: totalColor, fontWeight: 800, fontSize: 15 }}>
          <span className="num">{fmt(total)}</span> ريال
        </span>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  const { fmt } = useApp();
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color, fontWeight: 800, fontSize: 15 }}>
        <span className="num">{fmt(value)}</span>
      </div>
      <div style={{ color: 'var(--text2)', fontSize: 11 }}>{label}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p style={{ color: 'var(--text3)', fontSize: 13, padding: '10px 0', textAlign: 'center' }}>{text}</p>;
}
