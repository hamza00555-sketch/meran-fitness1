import { useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { currentMonth, currentMonthLabel, daysUntil } from '../utils/format.js';
import { calcCommitmentsTotal, calcGoalsMonthlyTotal, calcGoalProgress } from '../utils/calc.js';
import { getCatData, COMMITMENT_CATEGORIES, GOAL_CATEGORIES } from '../components/CategoryData.js';
import DonutChart from '../components/DonutChart.jsx';
import CatIcon from '../components/CategoryIcons.jsx';

export default function Dashboard() {
  const { settings, commitments, goals, currentMonthRecord, setPage, privacyMode, togglePrivacy, fmt } = useApp();

  const record = currentMonthRecord;
  const salary = record?.salary || settings.salary || 0;
  const commitmentsTotal = record?.commitmentsTotal || calcCommitmentsTotal(commitments);
  const goalsTotal = record?.goalsTotal || calcGoalsMonthlyTotal(goals);
  const remaining = salary - commitmentsTotal - goalsTotal;

  const segments = [
    { label: 'التزامات', value: commitmentsTotal, color: '#FF6B6B' },
    { label: 'أهداف', value: goalsTotal, color: '#A78BFA' },
    { label: 'متبقي', value: Math.max(0, remaining), color: '#00C9A7' },
  ].filter(s => s.value > 0 || s.label === 'متبقي');

  const upcomingCommitments = commitments
    .filter(c => c.active !== false)
    .map(c => ({ ...c, days: daysUntil(c.dayOfMonth || 1) }))
    .filter(c => c.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '52px 16px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{currentMonthLabel()}</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>راتبي 💼</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={togglePrivacy} title="إخفاء الأرقام" style={{
              background: privacyMode ? 'var(--danger-dim)' : 'var(--card2)',
              border: `1.5px solid ${privacyMode ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 10, width: 38, height: 38, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .2s',
            }}>
              {privacyMode ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {record && (
              <div style={{ textAlign: 'left', background: 'var(--accent-dim)', borderRadius: 10, padding: '6px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--accent)' }}>الراتب</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
                  <span className="num">{fmt(salary)}</span> ريال
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <DonutChart segments={segments} size={160} strokeWidth={20}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>متبقي</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: remaining >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
              <span className="num">{fmt(Math.abs(remaining))}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>ريال</div>
          </DonutChart>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {segments.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                  <span className="num">{fmt(s.value)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatCard label="التزامات الشهر" value={commitmentsTotal} suffix="ريال" color="var(--danger)" icon="📋" onClick={() => setPage('commitments')} />
          <StatCard label="أهداف الشهر" value={goalsTotal} suffix="ريال" color="#A78BFA" icon="🎯" onClick={() => setPage('goals')} />
        </div>

        {/* Goals Progress */}
        {goals.filter(g => !g.completed).length > 0 && (
          <div>
            <div className="section-header">
              <span className="section-title">تقدم الأهداف 🎯</span>
              <button className="section-action" onClick={() => setPage('goals')}>عرض الكل</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {goals.filter(g => !g.completed).slice(0, 3).map(g => {
                const progress = calcGoalProgress(g);
                const cat = getCatData(GOAL_CATEGORIES, g.category);
                return (
                  <div key={g.id} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CatIcon id={cat.id} size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          <span className="num">{fmt(g.savedAmount || 0)}</span> / <span className="num">{fmt(g.targetAmount)}</span> ريال
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)', flexShrink: 0 }}>
                        <span className="num">{progress}</span>%
                      </div>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%`, background: `linear-gradient(90deg, var(--primary), ${cat.color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Commitments */}
        {upcomingCommitments.length > 0 && (
          <div>
            <div className="section-header">
              <span className="section-title">التزامات قادمة ⏰</span>
              <button className="section-action" onClick={() => setPage('commitments')}>عرض الكل</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingCommitments.map(c => {
                const cat = getCatData(COMMITMENT_CATEGORIES, c.category);
                return (
                  <div key={c.id} className="list-item">
                    <div className="cat-icon" style={{ background: cat.bg }}><CatIcon id={cat.id} /></div>
                    <div className="list-item-info">
                      <div className="list-item-name">{c.name}</div>
                      <div className="list-item-sub">
                        {c.days === 0 ? 'اليوم!' : c.days === 1 ? 'غداً' : <>بعد <span className="num">{c.days}</span> أيام</>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div className="list-item-amount" style={{ color: 'var(--danger)' }}>
                        <span className="num">{fmt(c.amount)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>ريال</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No record notice */}
        {!record && (
          <div style={{
            background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 'var(--r)',
            padding: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>لم تؤكد راتب هذا الشهر بعد</div>
            <button className="btn" style={{ background: 'var(--gold)', color: '#0D0A26', marginTop: 8, padding: '10px 20px', borderRadius: 10 }}
              onClick={() => setPage('salaryDay')}>
              ابدأ توزيع الراتب
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, color, icon, onClick }) {
  const { fmt } = useApp();
  return (
    <div className="card" style={{ textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>
        <span className="num">{fmt(value)}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{suffix}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
