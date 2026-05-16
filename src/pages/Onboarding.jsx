import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { COMMITMENT_CATEGORIES, GOAL_CATEGORIES, getCatData } from '../components/CategoryData.js';
import { uid } from '../utils/format.js';
import { calcGoalMonthly } from '../utils/calc.js';

export default function Onboarding() {
  const { updateSettings, addCommitment, addGoal, setPage } = useApp();
  const [step, setStep] = useState(1);
  const [salary, setSalary] = useState('');
  const [salaryDay, setSalaryDay] = useState(25);
  const [expenseBudget, setExpenseBudget] = useState('');
  const [commitments, setCommitments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);

  const [cForm, setCForm] = useState({ name: '', amount: '', category: 'rent', dayOfMonth: 1 });
  const [gForm, setGForm] = useState({ name: '', targetAmount: '', targetDate: '', category: 'travel' });

  async function finish() {
    await updateSettings({
      salary: Number(salary),
      salaryDay,
      expenseBudget: Number(expenseBudget) || 1500,
      onboardingComplete: true,
    });
    for (const c of commitments) await addCommitment(c);
    for (const g of goals) await addGoal(g);
    setPage('salaryDay');
  }

  function addLocalCommitment() {
    if (!cForm.name || !cForm.amount) return;
    setCommitments(prev => [...prev, { ...cForm, id: uid(), amount: Number(cForm.amount), active: true }]);
    setCForm({ name: '', amount: '', category: 'rent', dayOfMonth: 1 });
    setShowAddCommitment(false);
  }

  function addLocalGoal() {
    if (!gForm.name || !gForm.targetAmount || !gForm.targetDate) return;
    const g = { ...gForm, id: uid(), targetAmount: Number(gForm.targetAmount), savedAmount: 0, completed: false };
    g.monthlyContribution = calcGoalMonthly(g);
    setGoals(prev => [...prev, g]);
    setGForm({ name: '', targetAmount: '', targetDate: '', category: 'travel' });
    setShowAddGoal(false);
  }

  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: '0 0 40px' }}>
      {/* Progress */}
      <div style={{ padding: '52px 24px 24px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background .3s',
            }} />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="anim-fadeup">
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>الخطوة ١ من ٣</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>راتبك الشهري</h1>
            <p style={{ color: 'var(--text2)', marginBottom: 32, fontSize: 14 }}>هذا هو أساس تخطيطك المالي</p>

            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">المبلغ (ريال)</label>
              <input className="input" type="number" inputMode="numeric"
                placeholder="مثال: 10000" value={salary} onChange={e => setSalary(e.target.value)}
                style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }} />
            </div>

            <div className="input-group" style={{ marginBottom: 24 }}>
              <label className="input-label">ميزانية المصروف الشهري (ريال)</label>
              <input className="input" type="number" inputMode="numeric"
                placeholder="مثال: 1500" value={expenseBudget} onChange={e => setExpenseBudget(e.target.value)} />
            </div>

            <div className="input-group" style={{ marginBottom: 32 }}>
              <label className="input-label">أي يوم ينزل راتبك؟</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {DAYS.map(d => (
                  <button key={d} onClick={() => setSalaryDay(d)} style={{
                    width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 14,
                    background: salaryDay === d ? 'var(--primary)' : 'var(--card2)',
                    color: salaryDay === d ? '#fff' : 'var(--text2)',
                    transition: 'all .15s',
                  }}>{d}</button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => salary && setStep(2)} style={{ opacity: salary ? 1 : .5 }}>
              التالي ←
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="anim-fadeup">
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>الخطوة ٢ من ٣</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>التزاماتك الشهرية</h1>
            <p style={{ color: 'var(--text2)', marginBottom: 24, fontSize: 14 }}>إيجار، أقساط، اشتراكات، فواتير...</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {commitments.map(c => {
                const cat = getCatData(COMMITMENT_CATEGORIES, c.category);
                return (
                  <div key={c.id} className="list-item">
                    <div className="cat-icon" style={{ background: cat.bg }}>{cat.emoji}</div>
                    <div className="list-item-info">
                      <div className="list-item-name">{c.name}</div>
                      <div className="list-item-sub">{cat.label} · يوم {c.dayOfMonth}</div>
                    </div>
                    <div className="list-item-amount">{c.amount.toLocaleString()} ريال</div>
                    <button className="btn-icon" onClick={() => setCommitments(p => p.filter(x => x.id !== c.id))}
                      style={{ color: 'var(--danger)', fontSize: 16 }}>✕</button>
                  </div>
                );
              })}
            </div>

            {!showAddCommitment ? (
              <button className="btn btn-outline" style={{ marginBottom: 24 }} onClick={() => setShowAddCommitment(true)}>
                + أضف التزاماً
              </button>
            ) : (
              <div className="card anim-fadeup" style={{ marginBottom: 20 }}>
                <CommitmentForm form={cForm} setForm={setCForm} />
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={addLocalCommitment}>إضافة</button>
                  <button className="btn btn-ghost" onClick={() => setShowAddCommitment(false)}>إلغاء</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>← رجوع</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}>التالي ←</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="anim-fadeup">
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>الخطوة ٣ من ٣</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>أهدافك المالية</h1>
            <p style={{ color: 'var(--text2)', marginBottom: 24, fontSize: 14 }}>سفر، سيارة، ادخار طوارئ...</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {goals.map(g => {
                const cat = getCatData(GOAL_CATEGORIES, g.category);
                return (
                  <div key={g.id} className="list-item">
                    <div className="cat-icon" style={{ background: cat.bg }}>{cat.emoji}</div>
                    <div className="list-item-info">
                      <div className="list-item-name">{g.name}</div>
                      <div className="list-item-sub">{g.monthlyContribution.toLocaleString()} ريال / شهر</div>
                    </div>
                    <div className="list-item-amount">{g.targetAmount.toLocaleString()} ريال</div>
                    <button className="btn-icon" onClick={() => setGoals(p => p.filter(x => x.id !== g.id))}
                      style={{ color: 'var(--danger)', fontSize: 16 }}>✕</button>
                  </div>
                );
              })}
            </div>

            {!showAddGoal ? (
              <button className="btn btn-outline" style={{ marginBottom: 24 }} onClick={() => setShowAddGoal(true)}>
                + أضف هدفاً
              </button>
            ) : (
              <div className="card anim-fadeup" style={{ marginBottom: 20 }}>
                <GoalForm form={gForm} setForm={setGForm} />
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={addLocalGoal}>إضافة</button>
                  <button className="btn btn-ghost" onClick={() => setShowAddGoal(false)}>إلغاء</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>← رجوع</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={finish}>ابدأ التطبيق 🎉</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CommitmentForm({ form, setForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="input-group">
        <label className="input-label">اسم الالتزام</label>
        <input className="input" placeholder="مثال: إيجار الشقة" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">المبلغ (ريال)</label>
          <input className="input" type="number" inputMode="numeric" placeholder="0"
            value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">يوم الدفع</label>
          <input className="input" type="number" inputMode="numeric" min="1" max="31" placeholder="1"
            value={form.dayOfMonth} onChange={e => setForm(p => ({ ...p, dayOfMonth: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="input-group">
        <label className="input-label">الفئة</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COMMITMENT_CATEGORIES.map(c => (
            <button key={c.id} className={`chip chip-ghost ${form.category === c.id ? 'active' : ''}`}
              onClick={() => setForm(p => ({ ...p, category: c.id }))}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalForm({ form, setForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="input-group">
        <label className="input-label">اسم الهدف</label>
        <input className="input" placeholder="مثال: رحلة إلى اليابان" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">المبلغ المطلوب</label>
          <input className="input" type="number" inputMode="numeric" placeholder="0"
            value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">تاريخ التحقيق</label>
          <input className="input" type="date" value={form.targetDate}
            onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))}
            style={{ colorScheme: 'dark' }} />
        </div>
      </div>
      <div className="input-group">
        <label className="input-label">الفئة</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_CATEGORIES.map(c => (
            <button key={c.id} className={`chip chip-ghost ${form.category === c.id ? 'active' : ''}`}
              onClick={() => setForm(p => ({ ...p, category: c.id }))}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
