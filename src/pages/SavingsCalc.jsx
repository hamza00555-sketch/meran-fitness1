import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { currentMonth } from '../utils/format.js';
import { calcCommitmentsTotal, calcGoalsMonthlyTotal, calcSpent } from '../utils/calc.js';
import { GOAL_CATEGORIES, getCatData } from '../components/CategoryData.js';

const SCENARIOS = [3, 6, 12, 18, 24, 36];

function getAffordability(monthly, freeBudget) {
  if (freeBudget <= 0) return { level: 4, label: 'مستحيل حالياً', color: '#FF6B6B', emoji: '🚫' };
  const pct = monthly / freeBudget;
  if (pct <= 0.15) return { level: 0, label: 'سهل جداً', color: '#00C9A7', emoji: '✅' };
  if (pct <= 0.30) return { level: 1, label: 'مريح', color: '#00C9A7', emoji: '🟢' };
  if (pct <= 0.50) return { level: 2, label: 'معقول', color: '#FFB830', emoji: '🟡' };
  if (pct <= 0.80) return { level: 3, label: 'يثقل شوي', color: '#FF8C42', emoji: '🟠' };
  return { level: 4, label: 'يثقل كثير', color: '#FF6B6B', emoji: '🔴' };
}

export default function SavingsCalc({ onClose, onAddGoal }) {
  const { settings, commitments, goals, expenses, currentMonthRecord, fmt } = useApp();

  const [mode, setMode] = useState('duration'); // 'duration' | 'amount'
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [saved, setSaved] = useState('');
  const [months, setMonths] = useState('12');
  const [maxMonthly, setMaxMonthly] = useState('');
  const [selectedMonths, setSelectedMonths] = useState(12);
  const [goalCategory, setGoalCategory] = useState('other');
  const [addedAsGoal, setAddedAsGoal] = useState(false);

  const month = currentMonth();
  const salary = currentMonthRecord?.salary || settings.salary || 0;
  const commitmentsTotal = calcCommitmentsTotal(commitments);
  const goalsMonthly = calcGoalsMonthlyTotal(goals);
  const spentBudget = currentMonthRecord?.expenseBudget || settings.expenseBudget || 0;
  const freeBudget = salary - commitmentsTotal - goalsMonthly - spentBudget;

  const priceNum = Number(price) || 0;
  const savedNum = Number(saved) || 0;
  const remaining = Math.max(0, priceNum - savedNum);

  const resultMonthly = useMemo(() => {
    if (mode === 'duration') {
      const m = Number(months);
      return m > 0 && remaining > 0 ? Math.ceil(remaining / m) : 0;
    }
    return 0;
  }, [mode, months, remaining]);

  const resultMonths = useMemo(() => {
    if (mode === 'amount') {
      const m = Number(maxMonthly);
      return m > 0 && remaining > 0 ? Math.ceil(remaining / m) : 0;
    }
    return 0;
  }, [mode, maxMonthly, remaining]);

  const mainAffordability = mode === 'duration'
    ? getAffordability(resultMonthly, freeBudget)
    : getAffordability(Number(maxMonthly), freeBudget);

  const scenarios = useMemo(() =>
    SCENARIOS.map(m => ({
      months: m,
      monthly: remaining > 0 ? Math.ceil(remaining / m) : 0,
      affordability: getAffordability(remaining > 0 ? Math.ceil(remaining / m) : 0, freeBudget),
    })),
    [remaining, freeBudget]
  );

  function handleAddGoal() {
    if (!priceNum) return;
    const targetDate = new Date();
    const m = mode === 'duration' ? Number(months) : resultMonths;
    targetDate.setMonth(targetDate.getMonth() + (m || 12));
    onAddGoal({
      name: itemName || 'هدف جديد',
      targetAmount: priceNum,
      savedAmount: savedNum,
      targetDate: targetDate.toISOString().split('T')[0],
      category: goalCategory,
      monthlyContribution: mode === 'duration' ? resultMonthly : Number(maxMonthly),
    });
    setAddedAsGoal(true);
    setTimeout(() => { setAddedAsGoal(false); onClose(); }, 1200);
  }

  const hasResult = priceNum > 0 && (
    (mode === 'duration' && resultMonthly > 0) ||
    (mode === 'amount' && Number(maxMonthly) > 0)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 8 }}>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 4 }}>
        {[['duration', '📅 أحدد المدة'], ['amount', '💵 أحدد المبلغ']].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: 10, cursor: 'pointer',
            fontFamily: 'GuesswhatExceptional, Cairo, sans-serif', fontWeight: 700, fontSize: 13,
            background: mode === id ? 'var(--primary)' : 'transparent',
            color: mode === id ? '#fff' : 'var(--text2)', transition: 'all .2s',
          }}>{label}</button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="input-group">
          <label className="input-label">اسم الشيء (اختياري)</label>
          <input className="input" placeholder="مثال: لاب توب، ساعة، رحلة..." value={itemName}
            onChange={e => setItemName(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">السعر (ريال)</label>
            <input className="input" type="number" inputMode="numeric" placeholder="0"
              value={price} onChange={e => setPrice(e.target.value)}
              style={{ fontWeight: 800, fontSize: 18, textAlign: 'center' }} />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">عندي بالفعل (ريال)</label>
            <input className="input" type="number" inputMode="numeric" placeholder="0"
              value={saved} onChange={e => setSaved(e.target.value)}
              style={{ textAlign: 'center' }} />
          </div>
        </div>

        {savedNum > 0 && priceNum > 0 && (
          <div style={{
            background: 'var(--accent-dim)', borderRadius: 10, padding: '8px 14px',
            fontSize: 13, color: 'var(--accent)', fontWeight: 600, textAlign: 'center',
          }}>
            المتبقي للادخار: <span className="num">{fmt(remaining)}</span> ريال
            (<span className="num">{Math.round((savedNum / priceNum) * 100)}</span>% مكتمل)
          </div>
        )}

        {mode === 'duration' ? (
          <div className="input-group">
            <label className="input-label">خلال كم شهر؟</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SCENARIOS.map(m => (
                <button key={m} onClick={() => { setMonths(String(m)); setSelectedMonths(m); }} style={{
                  padding: '8px 14px', border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'GuesswhatExceptional, Cairo, sans-serif', fontWeight: 700, fontSize: 13,
                  background: Number(months) === m ? 'var(--primary)' : 'var(--card2)',
                  color: Number(months) === m ? '#fff' : 'var(--text2)', transition: 'all .15s',
                }}><span className="num">{m}</span> شهر</button>
              ))}
              <input className="input" type="number" inputMode="numeric" placeholder="أو اكتب..."
                value={!SCENARIOS.includes(Number(months)) ? months : ''}
                onChange={e => setMonths(e.target.value)}
                style={{ width: 100, textAlign: 'center', padding: '8px' }} />
            </div>
          </div>
        ) : (
          <div className="input-group">
            <label className="input-label">أقدر أشيل كل شهر (ريال)</label>
            <input className="input" type="number" inputMode="numeric" placeholder="0"
              value={maxMonthly} onChange={e => setMaxMonthly(e.target.value)}
              style={{ fontWeight: 800, fontSize: 18, textAlign: 'center' }} />
          </div>
        )}
      </div>

      {/* Result */}
      {hasResult && (
        <div className="anim-fadeup" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Main Result Card */}
          <div style={{
            background: `linear-gradient(135deg, ${mainAffordability.color}22, ${mainAffordability.color}08)`,
            border: `1.5px solid ${mainAffordability.color}44`,
            borderRadius: 16, padding: '20px', textAlign: 'center',
          }}>
            {mode === 'duration' ? (
              <>
                <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 6 }}>تحتاج كل شهر</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: mainAffordability.color }}>
                  <span className="num">{fmt(resultMonthly)}</span>
                  <span style={{ fontSize: 18 }}> ريال</span>
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
                  لمدة <span className="num">{months}</span> شهر
                </div>
              </>
            ) : (
              <>
                <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 6 }}>ستحقق هدفك خلال</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: mainAffordability.color }}>
                  <span className="num">{resultMonths}</span>
                  <span style={{ fontSize: 18 }}> شهر</span>
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
                  بادخار <span className="num">{fmt(maxMonthly)}</span> ريال / شهر
                </div>
              </>
            )}
            <div style={{
              marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${mainAffordability.color}22`, borderRadius: 20, padding: '6px 14px',
            }}>
              <span style={{ fontSize: 16 }}>{mainAffordability.emoji}</span>
              <span style={{ color: mainAffordability.color, fontWeight: 700, fontSize: 14 }}>
                {mainAffordability.label}
              </span>
            </div>
          </div>

          {/* Budget Impact */}
          {salary > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 14 }}>📊 أثره على ميزانيتك</div>
              <BudgetImpactBar
                label="ميزانيتك الحرة الآن"
                value={Math.max(0, freeBudget)}
                max={salary}
                color="var(--accent)"
              />
              <div style={{ height: 8 }} />
              <BudgetImpactBar
                label="بعد هذا الادخار"
                value={Math.max(0, freeBudget - (mode === 'duration' ? resultMonthly : Number(maxMonthly)))}
                max={salary}
                color={mainAffordability.color}
              />
              <div style={{
                marginTop: 12, padding: '10px 12px', background: 'var(--bg2)',
                borderRadius: 10, fontSize: 13, color: 'var(--text2)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>يتبقى بعد الادخار</span>
                <span style={{ fontWeight: 800, color: mainAffordability.color }}>
                  <span className="num">{fmt(Math.max(0, freeBudget - (mode === 'duration' ? resultMonthly : Number(maxMonthly))))}</span> ريال
                </span>
              </div>
            </div>
          )}

          {/* Scenarios Table */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>⚡ جدول السيناريوهات</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scenarios.map(s => (
                <div key={s.months} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'var(--bg2)', borderRadius: 10,
                  border: `1px solid ${Number(months) === s.months && mode === 'duration' ? 'var(--primary)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all .15s',
                }} onClick={() => { setMode('duration'); setMonths(String(s.months)); }}>
                  <div style={{ width: 52, fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                    <span className="num">{s.months}</span> شهر
                  </div>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>
                    <span className="num">{fmt(s.monthly)}</span> <span style={{ fontSize: 12, color: 'var(--text2)' }}>ريال/شهر</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14 }}>{s.affordability.emoji}</span>
                    <span style={{ fontSize: 12, color: s.affordability.color, fontWeight: 700 }}>
                      {s.affordability.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add as Goal */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>🎯 أضف كهدف</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {GOAL_CATEGORIES.map(c => (
                <button key={c.id} className={`chip chip-ghost ${goalCategory === c.id ? 'active' : ''}`}
                  onClick={() => setGoalCategory(c.id)}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleAddGoal}
              style={{ background: addedAsGoal ? 'var(--accent)' : 'var(--primary)' }}>
              {addedAsGoal ? '✓ تمت الإضافة!' : `أضف "${itemName || 'الهدف'}" لأهدافي`}
            </button>
          </div>
        </div>
      )}

      {!hasResult && priceNum === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧮</div>
          <div style={{ fontSize: 14 }}>أدخل سعر الشيء اللي تبيه</div>
        </div>
      )}
    </div>
  );
}

function BudgetImpactBar({ label, value, max, color }) {
  const { fmt } = useApp();
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          <span className="num">{fmt(value)}</span> ريال
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
