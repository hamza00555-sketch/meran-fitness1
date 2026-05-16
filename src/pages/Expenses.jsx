import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatDate, currentMonth } from '../utils/format.js';
import { calcSpent } from '../utils/calc.js';
import { getCatData, EXPENSE_CATEGORIES } from '../components/CategoryData.js';
import BottomSheet from '../components/BottomSheet.jsx';

export default function Expenses() {
  const { expenses, addExpense, deleteExpense, currentMonthRecord, settings, fmt } = useApp();
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ amount: '', category: 'food', note: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const month = currentMonth();
  const monthExpenses = useMemo(() => expenses.filter(e => e.month === month), [expenses, month]);
  const spent = useMemo(() => calcSpent(expenses, month), [expenses, month]);
  const budget = currentMonthRecord?.expenseBudget || settings.expenseBudget || 0;
  const budgetPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  // Group by date
  const grouped = useMemo(() => {
    const map = {};
    [...monthExpenses].sort((a, b) => b.date.localeCompare(a.date)).forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthExpenses]);

  async function handleAdd() {
    if (!form.amount) return;
    await addExpense({ amount: Number(form.amount), category: form.category, note: form.note });
    setForm({ amount: '', category: 'food', note: '' });
    setSheet(false);
  }

  const isToday = (d) => d === new Date().toISOString().split('T')[0];
  const isYesterday = (d) => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return d === y.toISOString().split('T')[0];
  };
  function dateLabel(d) {
    if (isToday(d)) return 'اليوم';
    if (isYesterday(d)) return 'أمس';
    return formatDate(d);
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '52px 16px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>مصروفاتي</h1>
        {budget > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                صرفت <span className="num">{fmt(spent)}</span> من <span className="num">{fmt(budget)}</span> ريال
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: budgetPct > 90 ? 'var(--danger)' : budgetPct > 70 ? 'var(--gold)' : 'var(--accent)' }}>
                <span className="num">{budgetPct.toFixed(0)}</span>%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${budgetPct}%`,
                background: budgetPct > 90 ? 'var(--danger)' : budgetPct > 70 ? 'var(--gold)' : 'var(--accent)',
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {grouped.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>💸</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>لا توجد مصروفات بعد</div>
            <div style={{ fontSize: 13 }}>سجّل أول مصروف اليوم</div>
          </div>
        )}

        {grouped.map(([date, items]) => (
          <div key={date}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{dateLabel(date)}</span>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                <span className="num">{fmt(items.reduce((s, e) => s + e.amount, 0))}</span> ريال
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(e => {
                const cat = getCatData(EXPENSE_CATEGORIES, e.category);
                return (
                  <div key={e.id} className="list-item anim-fadeup">
                    <div className="cat-icon" style={{ background: cat.bg, width: 40, height: 40, fontSize: 18 }}>{cat.emoji}</div>
                    <div className="list-item-info">
                      <div className="list-item-name">{e.note || cat.label}</div>
                      <div className="list-item-sub">{cat.label}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ textAlign: 'left' }}>
                        <div className="list-item-amount" style={{ color: 'var(--primary)' }}>
                          <span className="num">{fmt(e.amount)}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>ريال</div>
                      </div>
                      <button onClick={() => setConfirmDelete(e)} className="btn-icon"
                        style={{ color: 'var(--danger)', fontSize: 14, width: 32, height: 32 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setSheet(true)}>+</button>

      {/* Confirm Delete */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} className="anim-fadein">
          <div className="card" style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>حذف هذا المصروف؟</div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
              {getCatData(EXPENSE_CATEGORIES, confirmDelete.category).emoji}{' '}
              <span className="num">{fmt(confirmDelete.amount)}</span> ريال
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>إلغاء</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={async () => {
                await deleteExpense(confirmDelete.id); setConfirmDelete(null);
              }}>حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Sheet */}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="مصروف جديد">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <input type="number" inputMode="decimal" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="0"
              style={{
                background: 'transparent', border: 'none', borderBottom: '2px solid var(--border)',
                color: 'var(--text)', fontFamily: 'Cairo, sans-serif', fontWeight: 900,
                fontSize: 44, textAlign: 'center', width: '100%', outline: 'none', padding: '4px 0',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
              autoFocus
            />
            <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>ريال</div>
          </div>

          <div className="input-group">
            <label className="input-label">الفئة</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c.id} className={`chip chip-ghost ${form.category === c.id ? 'active' : ''}`}
                  onClick={() => setForm(p => ({ ...p, category: c.id }))}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">ملاحظة (اختياري)</label>
            <input className="input" placeholder="مثال: غداء مع الزملاء" value={form.note}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
          </div>

          <button className="btn btn-primary" onClick={handleAdd} style={{ opacity: form.amount ? 1 : .5, marginBottom: 8 }}>
            سجّل المصروف
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
