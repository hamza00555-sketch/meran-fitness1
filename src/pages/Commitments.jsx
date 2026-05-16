import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatAmount, daysUntil } from '../utils/format.js';
import { getCatData, COMMITMENT_CATEGORIES } from '../components/CategoryData.js';
import BottomSheet from '../components/BottomSheet.jsx';

const EMPTY_FORM = { name: '', amount: '', category: 'rent', dayOfMonth: 1 };

export default function Commitments() {
  const { commitments, addCommitment, updateCommitment, deleteCommitment } = useApp();
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const enriched = commitments.map(c => ({
    ...c,
    days: daysUntil(c.dayOfMonth || 1),
  }));

  const filtered = enriched.filter(c => {
    if (filter === 'paid') return c.paidThisMonth;
    if (filter === 'upcoming') return !c.paidThisMonth && c.days <= 7;
    return true;
  });

  const total = commitments.filter(c => c.active !== false).reduce((s, c) => s + (c.amount || 0), 0);
  const paidCount = commitments.filter(c => c.paidThisMonth).length;

  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSheet(true);
  }

  function openEdit(c) {
    setEditItem(c);
    setForm({ name: c.name, amount: String(c.amount), category: c.category, dayOfMonth: c.dayOfMonth || 1 });
    setSheet(true);
  }

  async function handleSave() {
    if (!form.name || !form.amount) return;
    const data = { ...form, amount: Number(form.amount) };
    if (editItem) {
      await updateCommitment({ ...editItem, ...data });
    } else {
      await addCommitment(data);
    }
    setSheet(false);
  }

  async function togglePaid(c) {
    await updateCommitment({ ...c, paidThisMonth: !c.paidThisMonth });
  }

  function getBadge(c) {
    if (c.paidThisMonth) return { label: 'مدفوع ✓', cls: 'badge-green' };
    if (c.days === 0) return { label: 'اليوم!', cls: 'badge-red' };
    if (c.days <= 3) return { label: `بعد ${c.days} أيام`, cls: 'badge-red' };
    if (c.days <= 7) return { label: `بعد ${c.days} أيام`, cls: 'badge-yellow' };
    return { label: `يوم ${c.dayOfMonth}`, cls: 'badge-purple' };
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '52px 16px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900 }}>التزاماتي</h1>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{paidCount} / {commitments.length} مدفوع</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--danger)' }}>{formatAmount(total)}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>ريال / شهر</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['all', 'الكل'], ['upcoming', 'قادم'], ['paid', 'مدفوع']].map(([id, label]) => (
            <button key={id} className={`chip chip-ghost ${filter === id ? 'active' : ''}`}
              onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div>لا توجد التزامات هنا</div>
            </div>
          )}
          {filtered.map(c => {
            const cat = getCatData(COMMITMENT_CATEGORIES, c.category);
            const badge = getBadge(c);
            return (
              <div key={c.id} className="anim-fadeup">
                <div className="list-item" style={{ opacity: c.paidThisMonth ? 0.7 : 1 }}>
                  <div className="cat-icon" style={{ background: cat.bg }}>{cat.emoji}</div>
                  <div className="list-item-info">
                    <div className="list-item-name" style={{ textDecoration: c.paidThisMonth ? 'line-through' : 'none' }}>
                      {c.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="list-item-amount" style={{ color: 'var(--danger)' }}>{formatAmount(c.amount)}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => togglePaid(c)} style={{
                        background: c.paidThisMonth ? 'var(--accent-dim)' : 'var(--card2)',
                        border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                        color: c.paidThisMonth ? 'var(--accent)' : 'var(--text2)', fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✓</button>
                      <button onClick={() => openEdit(c)} className="btn-icon" style={{ color: 'var(--text2)', fontSize: 14 }}>✎</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <button className="fab" onClick={openAdd}>+</button>

      {/* Confirm Delete */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} className="anim-fadein">
          <div className="card" style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>حذف {confirmDelete.name}؟</div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>لا يمكن التراجع عن هذا الإجراء</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>إلغاء</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={async () => {
                await deleteCommitment(confirmDelete.id);
                setConfirmDelete(null);
              }}>حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={editItem ? 'تعديل الالتزام' : 'التزام جديد'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">الاسم</label>
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
              <input className="input" type="number" inputMode="numeric" min="1" max="31"
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
          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            {editItem && (
              <button className="btn btn-danger" style={{ flex: 1 }}
                onClick={() => { setSheet(false); setConfirmDelete(editItem); }}>حذف</button>
            )}
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
              {editItem ? 'حفظ التعديل' : 'إضافة'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
