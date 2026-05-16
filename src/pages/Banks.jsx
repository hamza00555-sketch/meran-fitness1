import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatAmount, currentMonth } from '../utils/format.js';
import { calcBankTotal, calcAllBanksTotal, isAccountDue } from '../utils/calc.js';
import { uid } from '../utils/format.js';
import BottomSheet from '../components/BottomSheet.jsx';

const BANK_EMOJIS = ['🏦', '🏧', '💳', '💰', '💵', '📊', '🏛️', '🌱', '🛡️', '📈', '🏠', '🚗'];
const BANK_COLORS = ['#6C63FF', '#00C9A7', '#FFB830', '#FF6B6B', '#FF6B9D', '#FF8C42', '#A78BFA', '#10B981'];
const FREQ_OPTIONS = [
  { value: 1, label: 'كل شهر' },
  { value: 2, label: 'كل شهرين' },
  { value: 3, label: 'كل 3 أشهر' },
  { value: 6, label: 'كل 6 أشهر' },
  { value: 12, label: 'سنوي' },
];

function emptyBank() {
  return { name: '', emoji: '🏦', color: '#6C63FF', accounts: [{ id: uid(), name: '', amount: '', frequency: 1 }] };
}

export default function Banks() {
  const { banks, addBank, updateBank, deleteBank } = useApp();
  const [sheet, setSheet] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyBank());

  const month = currentMonth();
  const totalThisMonth = calcAllBanksTotal(banks, month);

  function openAdd() {
    setEditItem(null);
    setForm(emptyBank());
    setSheet(true);
  }

  function openEdit(b) {
    setEditItem(b);
    setForm({
      name: b.name, emoji: b.emoji, color: b.color,
      accounts: b.accounts.map(a => ({ ...a, amount: String(a.amount) })),
    });
    setSheet(true);
  }

  async function handleSave() {
    if (!form.name) return;
    const accounts = form.accounts
      .filter(a => a.name && a.amount)
      .map(a => ({ ...a, id: a.id || uid(), amount: Number(a.amount), frequency: Number(a.frequency) || 1 }));
    if (accounts.length === 0) return;
    const data = {
      name: form.name, emoji: form.emoji, color: form.color, accounts,
      transferredMonths: editItem?.transferredMonths || [],
    };
    if (editItem) {
      await updateBank({ ...editItem, ...data });
    } else {
      await addBank(data);
    }
    setSheet(false);
  }

  async function toggleTransferred(bank) {
    const transferred = bank.transferredMonths?.includes(month);
    const updatedAccounts = bank.accounts.map(a => ({
      ...a,
      lastTransferredMonth: (!transferred && isAccountDue(a, month)) ? month : a.lastTransferredMonth,
    }));
    const updatedMonths = transferred
      ? (bank.transferredMonths || []).filter(m => m !== month)
      : [...(bank.transferredMonths || []), month];
    await updateBank({ ...bank, transferredMonths: updatedMonths, accounts: updatedAccounts });
  }

  function addAccount() {
    setForm(p => ({ ...p, accounts: [...p.accounts, { id: uid(), name: '', amount: '', frequency: 1 }] }));
  }

  function removeAccount(idx) {
    if (form.accounts.length <= 1) return;
    setForm(p => ({ ...p, accounts: p.accounts.filter((_, i) => i !== idx) }));
  }

  function updateAccount(idx, field, value) {
    setForm(p => {
      const accounts = [...p.accounts];
      accounts[idx] = { ...accounts[idx], [field]: value };
      return { ...p, accounts };
    });
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '52px 16px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>بنوكي</h1>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>
              <span className="num">{banks.length}</span> بنك · <span className="num">{formatAmount(totalThisMonth)}</span> ريال هذا الشهر
            </p>
          </div>
          {banks.length > 0 && (
            <div style={{ textAlign: 'left', background: 'var(--gold-dim)', borderRadius: 10, padding: '6px 14px', border: '1px solid var(--gold)' }}>
              <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 2 }}>إجمالي البنوك</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>
                <span className="num">{formatAmount(totalThisMonth)}</span>
                <span style={{ fontSize: 12, fontWeight: 400 }}> ريال</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {banks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏦</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>لا توجد بنوك بعد</div>
            <div style={{ fontSize: 13 }}>أضف بنكك الأول وحدد توزيع حساباته</div>
          </div>
        )}

        {banks.map(bank => (
          <BankCard key={bank.id} bank={bank} month={month} onEdit={openEdit} onToggle={toggleTransferred} />
        ))}

        {banks.length > 1 && (
          <div style={{ background: 'var(--card2)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 14 }}>المجموع الكلي هذا الشهر</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)' }}>
              <span className="num">{formatAmount(totalThisMonth)}</span>
              <span style={{ fontSize: 13, fontWeight: 400 }}> ريال</span>
            </span>
          </div>
        )}
      </div>

      <button className="fab" onClick={openAdd}>+</button>

      {/* Add/Edit Sheet */}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={editItem ? 'تعديل البنك' : 'بنك جديد'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="input-group">
            <label className="input-label">اسم البنك</label>
            <input className="input" placeholder="مثال: بنك الراجحي" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">الأيقونة</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BANK_EMOJIS.map(e => (
                <button key={e} onClick={() => setForm(p => ({ ...p, emoji: e }))} style={{
                  width: 42, height: 42, borderRadius: 10,
                  border: `2px solid ${form.emoji === e ? form.color : 'var(--border)'}`,
                  background: form.emoji === e ? `${form.color}22` : 'var(--card2)',
                  fontSize: 20, cursor: 'pointer', transition: 'all .15s',
                }}>{e}</button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">اللون</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {BANK_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                  width: 34, height: 34, borderRadius: '50%', background: c,
                  border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`,
                  outline: form.color === c ? `2px solid ${c}` : 'none',
                  cursor: 'pointer', transition: 'all .15s',
                }} />
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">الحسابات</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.accounts.map((acc, idx) => (
                <div key={acc.id || idx} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" placeholder="اسم الحساب (مثال: ادخار)" value={acc.name}
                      onChange={e => updateAccount(idx, 'name', e.target.value)}
                      style={{ flex: 1 }} />
                    {form.accounts.length > 1 && (
                      <button onClick={() => removeAccount(idx)} style={{
                        background: 'var(--danger-dim)', border: 'none', borderRadius: 8,
                        color: 'var(--danger)', width: 36, cursor: 'pointer', fontSize: 18, flexShrink: 0,
                      }}>✕</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input className="input" type="number" inputMode="numeric" placeholder="المبلغ"
                        value={acc.amount} onChange={e => updateAccount(idx, 'amount', e.target.value)}
                        style={{ textAlign: 'center', paddingLeft: 36 }} />
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)' }}>ريال</span>
                    </div>
                    <select value={acc.frequency} onChange={e => updateAccount(idx, 'frequency', Number(e.target.value))}
                      style={{
                        flex: 1, background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 8,
                        color: 'var(--text)', fontFamily: 'Cairo, sans-serif', fontSize: 13,
                        padding: '0 8px', outline: 'none', direction: 'rtl',
                      }}>
                      {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={addAccount} style={{
                background: 'transparent', border: '1.5px dashed var(--border)', borderRadius: 10,
                color: 'var(--primary)', padding: '10px', cursor: 'pointer',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 14,
              }}>+ إضافة حساب</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            {editItem && (
              <button className="btn btn-danger" style={{ flex: 1 }}
                onClick={async () => { await deleteBank(editItem.id); setSheet(false); }}>حذف</button>
            )}
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
              {editItem ? 'حفظ التعديل' : 'إضافة البنك'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function BankCard({ bank, month, onEdit, onToggle }) {
  const transferred = bank.transferredMonths?.includes(month);
  const total = calcBankTotal(bank, month);

  return (
    <div className="card anim-fadeup" style={{ borderRight: `4px solid ${bank.color}`, padding: '16px' }}>
      {/* Bank Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, fontSize: 22,
            background: `${bank.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{bank.emoji}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{bank.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              <span className="num">{bank.accounts.length}</span> {bank.accounts.length === 1 ? 'حساب' : 'حسابات'}
            </div>
          </div>
        </div>
        <button onClick={() => onEdit(bank)} className="btn-icon" style={{ color: 'var(--text2)', fontSize: 14 }}>✎</button>
      </div>

      {/* Accounts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {bank.accounts.map(acc => {
          const due = isAccountDue(acc, month);
          const freqLabel = FREQ_OPTIONS.find(f => f.value === (acc.frequency || 1))?.label;
          return (
            <div key={acc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', background: 'var(--bg2)', borderRadius: 10,
              opacity: due ? 1 : 0.5,
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{acc.name}</span>
                {(acc.frequency || 1) > 1 && (
                  <span style={{
                    marginRight: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: due ? `${bank.color}22` : 'var(--card2)',
                    color: due ? bank.color : 'var(--text3)',
                  }}>
                    {due ? '● هذا الشهر' : freqLabel}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: due ? bank.color : 'var(--text3)' }}>
                <span className="num">{formatAmount(acc.amount)}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}> ريال</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Total + Transfer Button */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 12, borderTop: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>الإجمالي هذا الشهر</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: bank.color }}>
            <span className="num">{formatAmount(total)}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}> ريال</span>
          </div>
        </div>
        <button onClick={() => onToggle(bank)} style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          background: transferred ? 'var(--accent-dim)' : `${bank.color}18`,
          border: `1.5px solid ${transferred ? 'var(--accent)' : bank.color}`,
          borderRadius: 12, padding: '10px 16px',
          fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 14,
          color: transferred ? 'var(--accent)' : bank.color,
          transition: 'all .2s',
        }}>
          {transferred ? '✓ تم التحويل' : '↗ حوّل الآن'}
        </button>
      </div>
    </div>
  );
}
