import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext.jsx';
import { uid, todayISO } from '../utils/format.js';

const SOURCES = [
  { id: 'bonus', label: 'مكافأة', icon: '🎁' },
  { id: 'freelance', label: 'عمل حر', icon: '💻' },
  { id: 'gift', label: 'هدية', icon: '🎀' },
  { id: 'investment', label: 'استثمار', icon: '📈' },
  { id: 'other', label: 'غيره', icon: '💰' },
];

export default function ExtraIncomeSheet({ onClose }) {
  const { commitments, goals, debts, addExtraIncome, addDebt, deleteDebt, fmt } = useApp();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('bonus');
  const [debtPct, setDebtPct] = useState(0);
  const [taggedPct, setTaggedPct] = useState(0);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);

  // Lock background scroll and prevent iOS touch-through
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const preventScroll = e => {
      if (sheetRef.current?.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  const activeDebts = debts.filter(d => !d.paid);
  // Only tagged items receive a portion from extra income
  const taggedCommitments = commitments.filter(c => c.active !== false && c.extraIncomeTag);
  const taggedGoals = goals.filter(g => !g.completed && g.extraIncomeTag);
  const taggedItems = [...taggedCommitments.map(c => ({ ...c, _type: 'commitment', _amount: c.amount || 0 })),
                       ...taggedGoals.map(g => ({ ...g, _type: 'goal', _amount: g.monthlyContribution || 0 }))];

  const hasDebts = activeDebts.length > 0;
  const hasTagged = taggedItems.length > 0;

  // Smart init based on what the user has
  useEffect(() => {
    if (hasDebts && hasTagged) { setDebtPct(40); setTaggedPct(40); }
    else if (hasDebts) { setDebtPct(60); setTaggedPct(0); }
    else if (hasTagged) { setDebtPct(0); setTaggedPct(60); }
    else { setDebtPct(0); setTaggedPct(0); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalAmount = parseFloat(amount) || 0;
  const pp = Math.max(0, 100 - debtPct - taggedPct);
  const debtAmount = Math.round(totalAmount * debtPct / 100);
  const taggedAmount = Math.round(totalAmount * taggedPct / 100);
  const personalAmount = totalAmount - debtAmount - taggedAmount;

  function adjustDebt(delta) {
    setDebtPct(prev => Math.max(0, Math.min(prev + delta, 80 - taggedPct)));
  }
  function adjustTagged(delta) {
    setTaggedPct(prev => Math.max(0, Math.min(prev + delta, 80 - debtPct)));
  }

  // Distribute debt portion proportionally among standalone debts by remaining amount
  const debtBreakdown = useMemo(() => {
    if (debtAmount <= 0 || activeDebts.length === 0) return [];
    const totalRem = activeDebts.reduce((s, d) => s + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    if (totalRem <= 0) return [];
    let rem = debtAmount;
    return activeDebts.map((d, i) => {
      const dRem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      const share = i === activeDebts.length - 1 ? rem : Math.round(debtAmount * dRem / totalRem);
      rem -= share;
      return { id: d.id, name: d.name, amount: share };
    }).filter(x => x.amount > 0);
  }, [debtAmount, activeDebts]);

  // Distribute tagged portion proportionally among tagged items by their amount
  const taggedBreakdown = useMemo(() => {
    if (taggedAmount <= 0 || taggedItems.length === 0) return [];
    const total = taggedItems.reduce((s, t) => s + t._amount, 0);
    const base = total > 0 ? total : taggedItems.length;
    let rem = taggedAmount;
    return taggedItems.map((t, i) => {
      const share = i === taggedItems.length - 1 ? rem
        : Math.round(taggedAmount * (total > 0 ? t._amount : 1) / base);
      rem -= share;
      return { id: t.id, name: t.name, amount: share, type: t._type };
    }).filter(x => x.amount > 0);
  }, [taggedAmount, taggedItems]);

  async function handleAddDebt() {
    const name = newDebtName.trim();
    const amt = parseFloat(newDebtAmount);
    if (!name || !amt) return;
    await addDebt({ name, totalAmount: amt, paidAmount: 0, paid: false });
    setNewDebtName(''); setNewDebtAmount(''); setShowDebtForm(false);
    if (debtPct === 0) { setDebtPct(40); setTaggedPct(prev => Math.min(prev, 40)); }
  }

  async function handleConfirm() {
    if (!totalAmount) return;
    setSaving(true);
    await addExtraIncome({
      id: uid(), date: todayISO(), amount: totalAmount, source,
      distribution: { debts: debtAmount, tagged: taggedAmount, personal: personalAmount, debtsPct: debtPct, taggedPct, personalPct: pp },
      debtBreakdown, taggedBreakdown,
    });
    setSaving(false);
    onClose();
  }

  const showDistribution = totalAmount > 0 && (hasDebts || hasTagged);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={sheetRef} style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)', overscrollBehavior: 'contain' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '12px 16px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>دخل إضافي 💰</div>
            <button onClick={onClose} style={{ background: 'var(--card2)', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>المبلغ</div>
            <input type="text" inputMode="decimal" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', background: 'var(--card2)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px', fontSize: 28, fontWeight: 900, color: 'var(--text)', fontFamily: 'Cairo, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
          </div>

          {/* Source chips */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>المصدر</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SOURCES.map(s => (
                <button key={s.id} onClick={() => setSource(s.id)} style={{
                  padding: '7px 14px', borderRadius: 20,
                  border: `1.5px solid ${source === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: source === s.id ? 'var(--accent-dim)' : 'var(--card2)',
                  color: source === s.id ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{s.icon} {s.label}</button>
              ))}
            </div>
          </div>

          {/* Standalone debts */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>الديون المستقلة 🏦</div>
              <button onClick={() => setShowDebtForm(v => !v)} style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ إضافة</button>
            </div>

            {activeDebts.length === 0 && !showDebtForm && (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0' }}>لا يوجد ديون مستقلة</div>
            )}

            {activeDebts.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--card2)', borderRadius: 10, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    متبقي: <span className="num">{fmt(Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)))}</span> ريال
                  </div>
                </div>
                <button onClick={() => deleteDebt(d.id)} style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}

            {showDebtForm && (
              <div style={{ background: 'var(--card2)', borderRadius: 12, padding: 12, marginTop: 4 }}>
                <input type="text" placeholder="اسم الدين" value={newDebtName}
                  onChange={e => setNewDebtName(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" inputMode="decimal" placeholder="المبلغ الكلي" value={newDebtAmount}
                    onChange={e => setNewDebtAmount(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13, color: 'var(--text)', fontFamily: 'Cairo, sans-serif' }} />
                  <button onClick={handleAddDebt} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>حفظ</button>
                </div>
              </div>
            )}
          </div>

          {/* Tagged items info */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>المخصص للدخل الإضافي 🏷️</div>
            {taggedItems.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0', lineHeight: 1.7 }}>
                لا يوجد التزامات أو أهداف مخصصة — فعّل "ضمّن في الدخل الإضافي" من داخل أي التزام أو هدف
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {taggedItems.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F59E0B10', border: '1px solid #F59E0B30', borderRadius: 10 }}>
                    <span style={{ fontSize: 14 }}>{t._type === 'commitment' ? '📋' : '🎯'}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                    <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>
                      <span className="num">{fmt(t._amount)}</span> ريال
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distribution */}
          {showDistribution && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>توزيع المبلغ</div>

              {hasDebts && (
                <DistRow label="الديون" icon="🏦" pct={debtPct} amount={debtAmount} color="#FF6B6B"
                  onDec={() => adjustDebt(-5)} onInc={() => adjustDebt(5)} fmt={fmt} />
              )}
              {hasTagged && (
                <DistRow label="المخصص" icon="🏷️" pct={taggedPct} amount={taggedAmount} color="#F59E0B"
                  onDec={() => adjustTagged(-5)} onInc={() => adjustTagged(5)} fmt={fmt} />
              )}

              {/* Personal — always shown, read-only */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card2)', borderRadius: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>🛍️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>شخصي</div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                    <div style={{ width: `${pp}%`, height: '100%', background: '#00C9A7', borderRadius: 2, transition: 'width .2s' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'left', minWidth: 72 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#00C9A7' }}><span className="num">{fmt(personalAmount)}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>{pp}%</div>
                </div>
              </div>

              {/* Breakdowns */}
              {debtBreakdown.length > 0 && (
                <BreakdownCard title={`الديون (${fmt(debtAmount)} ريال)`} color="#FF6B6B" items={debtBreakdown} fmt={fmt} />
              )}
              {taggedBreakdown.length > 0 && (
                <BreakdownCard title={`المخصص (${fmt(taggedAmount)} ريال)`} color="#F59E0B" items={taggedBreakdown} fmt={fmt} />
              )}
            </div>
          )}

          {/* If no debts and no tagged — show only personal */}
          {totalAmount > 0 && !hasDebts && !hasTagged && (
            <div style={{ background: 'var(--card2)', borderRadius: 12, padding: '14px', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🛍️</div>
              <div style={{ fontWeight: 700, color: '#00C9A7', fontSize: 16 }}>
                <span className="num">{fmt(totalAmount)}</span> ريال
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>كامل المبلغ للاستخدام الشخصي</div>
            </div>
          )}

          {/* Confirm */}
          <button onClick={handleConfirm} disabled={!totalAmount || saving} style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: totalAmount ? 'var(--accent)' : 'var(--card2)',
            color: totalAmount ? 'var(--bg)' : 'var(--text3)',
            border: 'none', fontSize: 15, fontWeight: 900,
            cursor: totalAmount ? 'pointer' : 'default', transition: 'all .2s',
          }}>
            {saving ? '...' : 'حفظ الدخل الإضافي'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DistRow({ label, icon, pct, amount, color, onDec, onInc, fmt }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card2)', borderRadius: 12, marginBottom: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .2s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onDec} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>−</button>
        <div style={{ textAlign: 'center', minWidth: 56 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color }}><span className="num">{fmt(amount)}</span></div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{pct}%</div>
        </div>
        <button onClick={onInc} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>+</button>
      </div>
    </div>
  );
}

function BreakdownCard({ title, color, items, fmt }) {
  return (
    <div style={{ background: 'var(--bg)', border: `1.5px solid ${color}35`, borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8 }}>{title}</div>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{item.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}><span className="num">{fmt(item.amount)}</span> ريال</span>
        </div>
      ))}
    </div>
  );
}
