import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { calcGoalProgress, calcGoalMonthly, monthsUntil } from '../utils/calc.js';
import { getCatData, GOAL_CATEGORIES } from '../components/CategoryData.js';
import BottomSheet from '../components/BottomSheet.jsx';
import SavingsCalc from './SavingsCalc.jsx';
import CatIcon from '../components/CategoryIcons.jsx';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const EMPTY_FORM = { name: '', targetAmount: '', targetDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0,7) + '-01'; })(), category: 'travel', monthlyContribution: '', bankId: null, accountId: null };

export default function Goals() {
  const { goals, banks, addGoal, updateGoal, deleteGoal, addGoalAmount, fmt } = useApp();
  const [sheet, setSheet] = useState(false);
  const [addAmountSheet, setAddAmountSheet] = useState(false);
  const [calcSheet, setCalcSheet] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addAmountGoal, setAddAmountGoal] = useState(null);
  const [addAmountVal, setAddAmountVal] = useState('');

  const active = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSheet(true);
  }
  function openEdit(g) {
    setEditItem(g);
    setForm({
      name: g.name, targetAmount: String(g.targetAmount), targetDate: g.targetDate,
      category: g.category, monthlyContribution: String(g.monthlyContribution || ''),
      bankId: g.bankId || null, accountId: g.accountId || null,
    });
    setSheet(true);
  }

  async function handleSave() {
    if (!form.name || !form.targetAmount) return;
    const base = {
      name: form.name, targetAmount: Number(form.targetAmount),
      targetDate: form.targetDate, category: form.category,
      bankId: form.bankId, accountId: form.accountId,
    };
    const mc = form.monthlyContribution ? Number(form.monthlyContribution) : null;
    if (editItem) {
      await updateGoal({ ...editItem, ...base, monthlyContribution: mc ?? editItem.monthlyContribution });
    } else {
      await addGoal({ ...base, monthlyContribution: mc });
    }
    setSheet(false);
  }

  async function handleAddAmount() {
    if (!addAmountGoal || !addAmountVal) return;
    await addGoalAmount(addAmountGoal.id, Number(addAmountVal));
    setAddAmountSheet(false);
    setAddAmountVal('');
  }

  const selectedBank = banks.find(b => b.id === form.bankId);

  return (
    <div className="page">
      <div style={{ padding: '52px 16px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>أهدافي</h1>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>
              <span className="num">{active.length}</span> هدف جارٍ · <span className="num">{completed.length}</span> مكتمل
            </p>
          </div>
          <button onClick={() => setCalcSheet(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'var(--primary-dim)', border: '1px solid var(--primary)',
            borderRadius: 12, cursor: 'pointer', fontFamily: 'Mestika, Cairo, sans-serif',
            fontWeight: 700, fontSize: 13, color: 'var(--primary)',
          }}>
            🧮 الحاسبة
          </button>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.length === 0 && completed.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎯</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>لا توجد أهداف بعد</div>
            <div style={{ fontSize: 13 }}>أضف هدفك الأول وابدأ الادخار</div>
          </div>
        )}

        {active.map(g => <GoalCard key={g.id} goal={g} banks={banks} onEdit={openEdit}
          onClick={() => openEdit(g)}
          onAdd={() => { setAddAmountGoal(g); setAddAmountSheet(true); }} />)}

        {completed.length > 0 && (
          <>
            <div style={{ color: 'var(--text3)', fontSize: 13, fontWeight: 600, marginTop: 8 }}>مكتملة ✓</div>
            {completed.map(g => <GoalCard key={g.id} goal={g} banks={banks} onEdit={openEdit} completed />)}
          </>
        )}
      </div>

      <button className="fab" onClick={openAdd}>+</button>

      {/* Add/Edit Sheet */}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={editItem ? 'تعديل الهدف' : 'هدف جديد'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">اسم الهدف</label>
            <input className="input" placeholder="مثال: رحلة إلى اليابان" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">المبلغ المطلوب</label>
            <input className="input" type="text" inputMode="decimal" placeholder="0"
              value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">شهر ووقت التحقيق</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" style={{ flex: 1, padding: '12px 8px' }}
                value={form.targetDate ? parseInt(form.targetDate.split('-')[1]) : 1}
                onChange={e => {
                  const m = Number(e.target.value);
                  const y = form.targetDate ? parseInt(form.targetDate.split('-')[0]) : new Date().getFullYear() + 1;
                  setForm(p => ({ ...p, targetDate: `${y}-${String(m).padStart(2,'0')}-01` }));
                }}>
                {ARABIC_MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="input" style={{ flex: 1, padding: '12px 8px' }}
                value={form.targetDate ? parseInt(form.targetDate.split('-')[0]) : new Date().getFullYear() + 1}
                onChange={e => {
                  const y = Number(e.target.value);
                  const m = form.targetDate ? parseInt(form.targetDate.split('-')[1]) : 1;
                  setForm(p => ({ ...p, targetDate: `${y}-${String(m).padStart(2,'0')}-01` }));
                }}>
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">مساهمة شهرية (اختياري)</label>
            <input className="input" type="text" inputMode="decimal"
              placeholder={form.targetAmount && form.targetDate
                ? `مقترح: ${calcGoalMonthly({ targetAmount: Number(form.targetAmount), savedAmount: 0, targetDate: form.targetDate })}`
                : 'تُحسب تلقائياً'}
              value={form.monthlyContribution}
              onChange={e => setForm(p => ({ ...p, monthlyContribution: e.target.value }))} />
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

          {/* Bank/Account Picker */}
          {banks.length > 0 && (
            <div className="input-group">
              <label className="input-label">وين تحفظ مدخراته؟ (اختياري)</label>
              {!form.bankId ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {banks.map(b => (
                    <button key={b.id}
                      onClick={() => setForm(p => ({ ...p, bankId: b.id, accountId: null }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', border: '1.5px solid var(--border)',
                        borderRadius: 10, background: 'var(--card2)', cursor: 'pointer',
                        fontFamily: 'Mestika, Cairo, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text)',
                      }}>
                      {b.emoji} {b.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      background: `${selectedBank.color}18`, borderRadius: 10,
                      border: `1px solid ${selectedBank.color}40`,
                    }}>
                      <span>{selectedBank.emoji}</span>
                      <span style={{ fontWeight: 700, color: selectedBank.color }}>{selectedBank.name}</span>
                    </div>
                    <button onClick={() => setForm(p => ({ ...p, bankId: null, accountId: null }))}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                  </div>
                  {selectedBank.accounts.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedBank.accounts.map(acc => (
                        <button key={acc.id}
                          onClick={() => setForm(p => ({ ...p, accountId: acc.id }))}
                          style={{
                            padding: '7px 14px',
                            border: `1.5px solid ${form.accountId === acc.id ? selectedBank.color : 'var(--border)'}`,
                            borderRadius: 10,
                            background: form.accountId === acc.id ? `${selectedBank.color}18` : 'var(--card2)',
                            cursor: 'pointer', fontFamily: 'Mestika, Cairo, sans-serif', fontSize: 13,
                            fontWeight: form.accountId === acc.id ? 700 : 500,
                            color: form.accountId === acc.id ? selectedBank.color : 'var(--text2)',
                          }}>
                          {acc.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            {editItem && (
              <button className="btn btn-danger" style={{ flex: 1 }}
                onClick={async () => { await deleteGoal(editItem.id); setSheet(false); }}>حذف</button>
            )}
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
              {editItem ? 'حفظ التعديل' : 'إضافة'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Savings Calc Sheet */}
      <BottomSheet open={calcSheet} onClose={() => setCalcSheet(false)} title="🧮 حاسبة الادخار">
        <SavingsCalc onClose={() => setCalcSheet(false)} onAddGoal={async (data) => { await addGoal(data); }} />
      </BottomSheet>

      {/* Add Amount Sheet */}
      <BottomSheet open={addAmountSheet} onClose={() => setAddAmountSheet(false)}
        title={`إضافة مبلغ لـ "${addAmountGoal?.name}"`}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            الرصيد الحالي: <span className="num">{fmt(addAmountGoal?.savedAmount || 0)}</span> ريال
          </div>
          <input type="text" inputMode="decimal" value={addAmountVal}
            onChange={e => setAddAmountVal(e.target.value)}
            placeholder="0"
            style={{
              background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 12,
              color: 'var(--accent)', fontFamily: 'Cairo, sans-serif', fontWeight: 800,
              fontSize: 28, textAlign: 'center', padding: '12px', width: '100%', outline: 'none',
            }}
          />
          <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 8 }}>ريال</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleAddAmount}>
            إضافة للهدف
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function GoalCard({ goal, banks, onEdit, onClick, onAdd, completed }) {
  const { fmt } = useApp();
  const progress = calcGoalProgress(goal);
  const cat = getCatData(GOAL_CATEGORIES, goal.category);
  const months = goal.targetDate ? monthsUntil(goal.targetDate) : null;
  const assignedBank = goal.bankId ? banks.find(b => b.id === goal.bankId) : null;
  const assignedAccount = assignedBank?.accounts.find(a => a.id === goal.accountId);

  return (
    <div className="card anim-fadeup" style={{ opacity: completed ? 0.7 : 1, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div className="cat-icon" style={{ background: cat.bg }}><CatIcon id={cat.id} size={24} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{goal.name}</div>
          <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>
            <span className="num">{fmt(goal.savedAmount || 0)}</span> / <span className="num">{fmt(goal.targetAmount)}</span> ريال
          </div>
          {assignedBank && (
            <div style={{ marginTop: 4 }}>
              <span style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 6,
                background: `${assignedBank.color}18`, color: assignedBank.color, fontWeight: 600,
              }}>
                {assignedBank.emoji} {assignedAccount ? assignedAccount.name : assignedBank.name}
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: completed ? 'var(--accent)' : 'var(--primary)' }}>
            <span className="num">{progress}</span>%
          </div>
          {completed && <div style={{ fontSize: 11, color: 'var(--accent)' }}>✓ مكتمل</div>}
        </div>
      </div>

      <div className="progress-track" style={{ marginBottom: 12 }}>
        <div className="progress-fill" style={{
          width: `${progress}%`,
          background: completed ? 'var(--accent)' : `linear-gradient(90deg, var(--primary), ${cat.color})`,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {goal.monthlyContribution > 0 && !completed && (
            <span>
              <span className="num">{fmt(goal.monthlyContribution)}</span> ريال / شهر · <span className="num">{months}</span> شهر متبقي
            </span>
          )}
        </div>
        {!completed && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onEdit(goal)} className="btn-icon" style={{ color: 'var(--text2)', fontSize: 14 }}>✎</button>
            <button onClick={onAdd} style={{
              background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none',
              borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>+ إضافة</button>
          </div>
        )}
      </div>
    </div>
  );
}
