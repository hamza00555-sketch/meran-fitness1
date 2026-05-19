import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { currentMonth, currentMonthLabel, daysUntil, formatDate } from '../utils/format.js';
import { calcCommitmentsTotal, calcGoalsMonthlyTotal, calcGoalProgress } from '../utils/calc.js';
import { getCatData, GOAL_CATEGORIES } from '../components/CategoryData.js';
import CatIcon from '../components/CategoryIcons.jsx';
import ExtraIncomeSheet from './ExtraIncomeSheet.jsx';

export default function Dashboard() {
  const {
    settings, commitments, goals, banks, extraIncome,
    currentMonthRecord, setPage, privacyMode, togglePrivacy,
    fmt, deleteExtraIncome,
  } = useApp();
  const [showIncomeSheet, setShowIncomeSheet] = useState(false);

  const record = currentMonthRecord;
  const salary = record?.salary || settings.salary || 0;
  const commitmentsTotal = calcCommitmentsTotal(commitments);
  const goalsTotal = calcGoalsMonthlyTotal(goals);
  const remaining = salary - commitmentsTotal - goalsTotal;

  // Extra income this month
  const thisMonth = currentMonth();
  const monthlyExtraIncome = extraIncome.filter(e => e.date?.startsWith(thisMonth));
  const extraIncomeTotal = monthlyExtraIncome.reduce((s, e) => s + (e.amount || 0), 0);

  // Bank totals (compact)
  const bankTransfers = banks.map(bank => {
    const total =
      commitments.filter(c => c.active !== false && c.bankId === bank.id)
        .reduce((s, c) => s + (c.amount || 0), 0) +
      goals.filter(g => !g.completed && g.bankId === bank.id)
        .reduce((s, g) => s + (g.monthlyContribution || 0), 0);
    return { ...bank, total };
  }).filter(b => b.total > 0);

  // Upcoming unpaid commitments (≤7 days, max 3)
  const upcomingCommitments = commitments
    .filter(c => c.active !== false && !c.paidThisMonth)
    .map(c => ({ ...c, days: daysUntil(c.dayOfMonth || 1) }))
    .filter(c => c.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  // Recent activity (horizontal scroll cards)
  const recentActivity = useMemo(() => {
    const items = [];
    if (record) items.push({ type: 'salary', label: '+ راتب', name: 'تم إيداع الراتب', amount: salary });
    extraIncome.slice(0, 2).forEach(e =>
      items.push({ type: 'income', label: '+ دخل', name: e.source || 'دخل إضافي', amount: e.amount })
    );
    commitments.filter(c => c.paidThisMonth).slice(0, 3).forEach(c =>
      items.push({ type: 'paid', label: '✓ مدفوع', name: c.name, amount: c.amount })
    );
    return items.slice(0, 5);
  }, [commitments, extraIncome, record, salary]);

  // Top 2 active goals by progress
  const topGoals = goals
    .filter(g => !g.completed)
    .sort((a, b) => calcGoalProgress(b) - calcGoalProgress(a))
    .slice(0, 2);

  const positiveRemaining = remaining >= 0;

  return (
    <div className="page">

      {/* ── Header ── */}
      <header style={{
        padding: '52px 20px 16px',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>{currentMonthLabel()}</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.3 }}>راتبي</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={togglePrivacy}
              style={{
                background: privacyMode ? 'rgba(255,107,107,.15)' : 'var(--card2)',
                border: `1.5px solid ${privacyMode ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 10, width: 38, height: 38, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: privacyMode ? 'var(--danger)' : 'var(--text2)',
                transition: 'all .2s', flexShrink: 0,
              }}
            >
              {privacyMode ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {record && (
              <div style={{
                background: 'rgba(0,201,167,.1)',
                border: '1px solid rgba(0,201,167,.2)',
                borderRadius: 10, padding: '6px 14px', textAlign: 'left',
              }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 1 }}>الراتب</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
                  <span className="num">{fmt(salary)}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(0,201,167,.7)', marginRight: 3 }}>ريال</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Summary Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

          {/* متبقي — full width, prominent */}
          <div style={{
            gridColumn: 'span 2',
            borderRadius: 'var(--r)',
            background: positiveRemaining
              ? 'linear-gradient(135deg, rgba(0,201,167,.18) 0%, rgba(0,201,167,.06) 100%)'
              : 'linear-gradient(135deg, rgba(255,107,107,.18) 0%, rgba(255,107,107,.06) 100%)',
            border: `1px solid ${positiveRemaining ? 'rgba(0,201,167,.3)' : 'rgba(255,107,107,.3)'}`,
            padding: '18px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>المتبقي هذا الشهر</div>
              <div style={{
                fontSize: 36, fontWeight: 900, lineHeight: 1,
                color: positiveRemaining ? 'var(--accent)' : 'var(--danger)',
              }}>
                <span className="num">{fmt(Math.abs(remaining))}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 5 }}>ريال</div>
            </div>
            <div style={{
              width: 54, height: 54, borderRadius: 16, flexShrink: 0,
              background: positiveRemaining ? 'rgba(0,201,167,.15)' : 'rgba(255,107,107,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: positiveRemaining ? 'var(--accent)' : 'var(--danger)',
            }}>
              <WalletIcon size={26} />
            </div>
          </div>

          {/* التزامات */}
          <div
            className="card"
            style={{ padding: '14px 16px', cursor: 'pointer' }}
            onClick={() => setPage('commitments')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>التزامات</div>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'rgba(255,107,107,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--danger)',
              }}>
                <ReceiptIcon size={13} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--danger)' }}>
              <span className="num">{fmt(commitmentsTotal)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>ريال / شهر</div>
          </div>

          {/* أهداف */}
          <div
            className="card"
            style={{ padding: '14px 16px', cursor: 'pointer' }}
            onClick={() => setPage('goals')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>أهداف</div>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'rgba(167,139,250,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#A78BFA',
              }}>
                <TargetIcon size={13} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#A78BFA' }}>
              <span className="num">{fmt(goalsTotal)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>ريال / شهر</div>
          </div>

          {/* دخل إضافي — يظهر فقط إذا وجد */}
          {extraIncomeTotal > 0 && (
            <div
              className="card"
              style={{ gridColumn: 'span 2', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => setShowIncomeSheet(true)}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>دخل إضافي هذا الشهر</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>
                  <span className="num">{fmt(extraIncomeTotal)}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text2)', marginRight: 4 }}>ريال</span>
                </div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(0,201,167,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)',
              }}>
                <PlusCircleIcon size={18} />
              </div>
            </div>
          )}
        </div>

        {/* ── المطلوب منك الآن ── */}
        {(upcomingCommitments.length > 0 || bankTransfers.length > 0) && (
          <div>
            <SectionHeader title="المطلوب منك الآن" icon={<CalendarIcon size={14} />} />
            <div className="card" style={{ padding: '4px 0', overflow: 'hidden' }}>
              {upcomingCommitments.map((c, i) => (
                <ActionRow
                  key={c.id}
                  icon={<CalendarIcon size={13} />}
                  iconBg="rgba(255,107,107,.12)"
                  iconColor="var(--danger)"
                  title={c.name}
                  sub={c.days === 0 ? 'اليوم!' : c.days === 1 ? 'غداً' : `بعد ${c.days} أيام`}
                  amount={c.amount}
                  divider={i < upcomingCommitments.length - 1 || bankTransfers.length > 0}
                  fmt={fmt}
                />
              ))}
              {bankTransfers.map((bank, i) => (
                <ActionRow
                  key={bank.id}
                  icon={<BankIcon size={13} />}
                  iconBg={`${bank.color}18`}
                  iconColor={bank.color}
                  title={`حوّل إلى ${bank.name}`}
                  sub="تحويل شهري"
                  amount={bank.total}
                  divider={i < bankTransfers.length - 1}
                  fmt={fmt}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── آخر التحديثات ── */}
        {recentActivity.length > 0 && (
          <div>
            <SectionHeader title="آخر التحديثات" icon={<CheckCircleIcon size={14} />} />
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {recentActivity.map((item, i) => (
                <div key={i} className="card" style={{
                  flexShrink: 0, minWidth: 148, padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: item.type === 'paid' ? '#00C9A7' : item.type === 'income' ? '#A78BFA' : 'var(--accent)',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
                  }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    <span className="num">{fmt(item.amount)}</span> ريال
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── الأهداف (2 فقط) ── */}
        {topGoals.length > 0 && (
          <div>
            <SectionHeader
              title="الأهداف"
              icon={<TargetIcon size={14} />}
              action="عرض الكل"
              onAction={() => setPage('goals')}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topGoals.map(g => {
                const progress = calcGoalProgress(g);
                const cat = getCatData(GOAL_CATEGORIES, g.category);
                return (
                  <div key={g.id} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CatIcon id={cat.id} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          <span className="num">{fmt(g.savedAmount || 0)}</span>
                          {' / '}
                          <span className="num">{fmt(g.targetAmount)}</span> ريال
                        </div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)', flexShrink: 0 }}>
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

        {/* ── الدخل الإضافي ── */}
        <div>
          <SectionHeader
            title="الدخل الإضافي"
            icon={<PlusCircleIcon size={14} />}
            action="+ إضافة"
            onAction={() => setShowIncomeSheet(true)}
          />
          {extraIncome.length === 0 ? (
            <button
              onClick={() => setShowIncomeSheet(true)}
              className="card"
              style={{
                width: '100%', padding: 16, cursor: 'pointer', background: 'transparent',
                border: '1.5px dashed var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>أضف دخلاً إضافياً</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>مكافأة، عمل حر، هدية… وزّعه بذكاء</div>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {extraIncome.slice(0, 2).map(income => (
                <div key={income.id} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>
                        {income.source || 'دخل'} · {formatDate(income.date)}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>
                        <span className="num">{fmt(income.amount)}</span>
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text2)', marginRight: 4 }}>ريال</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteExtraIncome(income.id)}
                      style={{
                        background: 'var(--card2)', border: 'none', borderRadius: 8,
                        width: 28, height: 28, cursor: 'pointer',
                        color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, flexShrink: 0,
                      }}
                    >✕</button>
                  </div>
                  <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 2 }}>
                    {income.distribution?.debtsPct > 0 && <div style={{ flex: income.distribution.debtsPct, background: '#FF6B6B', borderRadius: 2 }} />}
                    {(income.distribution?.taggedPct || income.distribution?.goalsPct || 0) > 0 && <div style={{ flex: income.distribution.taggedPct || income.distribution.goalsPct, background: '#F59E0B', borderRadius: 2 }} />}
                    {income.distribution?.personalPct > 0 && <div style={{ flex: income.distribution.personalPct, background: '#00C9A7', borderRadius: 2 }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── No Record Notice ── */}
        {!record && (
          <div style={{
            background: 'var(--gold-dim)', border: '1px solid var(--gold)',
            borderRadius: 'var(--r)', padding: 16, textAlign: 'center',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>لم تؤكد راتب هذا الشهر بعد</div>
            <button
              className="btn"
              style={{ background: 'var(--gold)', color: '#0D0A26', marginTop: 8, padding: '10px 20px', borderRadius: 10 }}
              onClick={() => setPage('salaryDay')}
            >
              ابدأ توزيع الراتب
            </button>
          </div>
        )}

        <div style={{ height: 8 }} />
      </div>

      {showIncomeSheet && <ExtraIncomeSheet onClose={() => setShowIncomeSheet(false)} />}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function SectionHeader({ title, icon, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <span style={{ color: 'var(--text2)', display: 'flex' }}>{icon}</span>}
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
      </div>
      {action && (
        <button onClick={onAction} className="section-action">{action}</button>
      )}
    </div>
  );
}

function ActionRow({ icon, iconBg, iconColor, title, sub, amount, divider, fmt }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ textAlign: 'left', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            <span className="num">{fmt(amount)}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>ريال</div>
        </div>
      </div>
      {divider && <div style={{ height: 1, background: 'var(--border)', margin: '0 16px 0 56px' }} />}
    </>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function WalletIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
      <path d="M20 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function ReceiptIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}

function TargetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function PlusCircleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function CalendarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function BankIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12,2 2,7 22,7" />
    </svg>
  );
}

function CheckCircleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}
