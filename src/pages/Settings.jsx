import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatAmount } from '../utils/format.js';
import * as db from '../db/index.js';
import { uid } from '../utils/format.js';

const GPT_PROMPT = `أريد مساعدتك في تنظيم بيانات راتبي. عندي المعلومات التالية:

راتبي الشهري: [اكتب راتبك]
يوم نزول الراتب: [اكتب اليوم، مثال: 1]
ميزانية المصروف الشهري: [اكتب الميزانية]

التزاماتي الشهرية:
[اكتب كل التزام في سطر بهذا الشكل: الاسم - المبلغ - يوم الدفع]
مثال:
إيجار - 2000 - 1
إنترنت - 250 - 5
قسط سيارة - 800 - 10

أهدافي:
[اكتب كل هدف بهذا الشكل: الاسم - المبلغ المطلوب - تاريخ التحقيق - المساهمة الشهرية]
مثال:
سيارة - 50000 - 2026-12-01 - 2000

الآن حوّل هذه المعلومات لـ JSON بهذا الشكل بالضبط (لا تضيف أي نص آخر):
{
  "salary": 0,
  "salaryDay": 1,
  "expenseBudget": 0,
  "commitments": [
    { "name": "الاسم", "amount": 0, "category": "rent", "dayOfMonth": 1 }
  ],
  "goals": [
    { "name": "الاسم", "targetAmount": 0, "targetDate": "YYYY-MM-DD", "category": "other", "monthlyContribution": 0 }
  ]
}

الفئات المتاحة للالتزامات: rent, bills, electricity, internet, subscription, gym, installment, investment, savings, family, other
الفئات المتاحة للأهداف: travel, car, electronics, emergency, education, investment, home, debt, other`;

export default function Settings() {
  const { settings, updateSettings, setPage } = useApp();
  const [salary, setSalary] = useState(String(settings.salary));
  const [salaryDay, setSalaryDay] = useState(settings.salaryDay);
  const [expenseBudget, setExpenseBudget] = useState(String(settings.expenseBudget || ''));
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState('');

  const [gptPasteOpen, setGptPasteOpen] = useState(false);
  const [gptJson, setGptJson] = useState('');
  const [gptImporting, setGptImporting] = useState(false);
  const [gptImportDone, setGptImportDone] = useState(false);
  const [gptError, setGptError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  async function handleSave() {
    await updateSettings({
      salary: Number(salary),
      salaryDay,
      expenseBudget: Number(expenseBudget),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExport() {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ratebi-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await db.importAll(data);
      window.location.reload();
    } catch {
      setImportError('الملف غير صالح أو تالف');
    }
    e.target.value = '';
  }

  async function handleResetSalaryDay() {
    setPage('salaryDay');
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(GPT_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      setPromptCopied(false);
    }
  }

  async function handleGptImport() {
    setGptError('');
    setGptImporting(true);
    try {
      let jsonText = gptJson.trim();
      // Extract JSON block if wrapped in markdown code fences
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonText = match[1].trim();

      const data = JSON.parse(jsonText);

      // Update salary settings
      if (data.salary) await updateSettings({
        salary: Number(data.salary),
        salaryDay: Number(data.salaryDay) || settings.salaryDay,
        expenseBudget: Number(data.expenseBudget) || settings.expenseBudget,
      });

      // Import commitments
      if (Array.isArray(data.commitments)) {
        for (const c of data.commitments) {
          await db.saveCommitment({
            id: uid(),
            name: c.name || 'التزام',
            amount: Number(c.amount) || 0,
            category: c.category || 'other',
            dayOfMonth: Number(c.dayOfMonth) || 1,
            paidThisMonth: false,
            active: true,
          });
        }
      }

      // Import goals
      if (Array.isArray(data.goals)) {
        for (const g of data.goals) {
          await db.saveGoal({
            id: uid(),
            name: g.name || 'هدف',
            targetAmount: Number(g.targetAmount) || 0,
            savedAmount: 0,
            targetDate: g.targetDate || '',
            category: g.category || 'other',
            monthlyContribution: Number(g.monthlyContribution) || 0,
            completed: false,
          });
        }
      }

      setGptImportDone(true);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setGptError('تأكد أن النص هو JSON صحيح من ChatGPT');
    }
    setGptImporting(false);
  }

  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="page">
      <div style={{ padding: '52px 16px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>الإعدادات</h1>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Salary Settings */}
        <section>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 12 }}>💰 إعدادات الراتب</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">الراتب الشهري (ريال)</label>
              <input className="input" type="number" inputMode="numeric"
                value={salary} onChange={e => setSalary(e.target.value)} />
            </div>

            <div className="input-group">
              <label className="input-label">ميزانية المصروف الشهري (ريال)</label>
              <input className="input" type="number" inputMode="numeric"
                value={expenseBudget} onChange={e => setExpenseBudget(e.target.value)} />
            </div>

            <div className="input-group">
              <label className="input-label">يوم نزول الراتب</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DAYS.map(d => (
                  <button key={d} onClick={() => setSalaryDay(d)} style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 13,
                    background: salaryDay === d ? 'var(--primary)' : 'var(--card2)',
                    color: salaryDay === d ? '#fff' : 'var(--text2)',
                  }}>{d}</button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSave}>
              {saved ? '✓ تم الحفظ' : 'حفظ الإعدادات'}
            </button>
          </div>
        </section>

        {/* ChatGPT Import */}
        <section>
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 700, marginBottom: 12 }}>🤖 استيراد من ChatGPT</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.6 }}>
              انسخ البرامبت وأعطه لـ ChatGPT مع معلومات راتبك، ثم الصق الـ JSON الناتج هنا.
            </p>

            <button onClick={handleCopyPrompt} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: promptCopied ? 'var(--accent-dim)' : 'var(--card2)',
              border: `1px solid ${promptCopied ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10, padding: '12px', cursor: 'pointer',
              fontFamily: 'GuesswhatExceptional, Cairo, sans-serif', fontWeight: 700, fontSize: 14,
              color: promptCopied ? 'var(--accent)' : 'var(--text)',
              transition: 'all .2s',
            }}>
              {promptCopied ? '✓ تم النسخ!' : '📋 نسخ البرامبت'}
            </button>

            <button onClick={() => setGptPasteOpen(v => !v)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'var(--primary-dim)', border: '1px solid var(--primary)',
              borderRadius: 10, padding: '12px', cursor: 'pointer',
              fontFamily: 'GuesswhatExceptional, Cairo, sans-serif', fontWeight: 700, fontSize: 14,
              color: 'var(--primary)',
            }}>
              {gptPasteOpen ? '▲ إغلاق' : '📥 لصق رد ChatGPT'}
            </button>

            {gptPasteOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={gptJson}
                  onChange={e => { setGptJson(e.target.value); setGptError(''); }}
                  placeholder='الصق الـ JSON هنا...'
                  rows={7}
                  style={{
                    background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10,
                    color: 'var(--text)', fontFamily: 'Cairo, sans-serif', fontSize: 13,
                    padding: '12px', width: '100%', outline: 'none', resize: 'vertical',
                    direction: 'ltr', textAlign: 'left',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                {gptError && (
                  <div style={{ color: 'var(--danger)', fontSize: 13 }}>{gptError}</div>
                )}
                <button className="btn btn-primary" onClick={handleGptImport}
                  disabled={!gptJson.trim() || gptImporting}
                  style={{
                    opacity: !gptJson.trim() ? 0.5 : 1,
                    background: gptImportDone ? 'var(--accent)' : 'var(--primary)',
                  }}>
                  {gptImportDone ? '✓ تمت الإضافة! جاري التحديث...' : gptImporting ? 'جاري الاستيراد...' : 'استيراد البيانات'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Salary Day */}
        <section>
          <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>📅 يوم الراتب</div>
          <div className="card">
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14 }}>
              فتح شاشة توزيع الراتب مجدداً لهذا الشهر
            </p>
            <button className="btn btn-outline" onClick={handleResetSalaryDay}>
              فتح شاشة يوم الراتب
            </button>
          </div>
        </section>

        {/* Backup */}
        <section>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, marginBottom: 12 }}>💾 البيانات والنسخ الاحتياطي</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{
                flex: 1, background: 'var(--accent-dim)', color: 'var(--accent)',
                borderRadius: 10, padding: '12px',
              }} onClick={handleExport}>
                ⬆️ تصدير نسخة
              </button>
              <label style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--primary-dim)', color: 'var(--primary)', borderRadius: 10,
                padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: 15,
              }}>
                ⬇️ استيراد نسخة
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </div>
            {importError && (
              <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>{importError}</div>
            )}
            <p style={{ color: 'var(--text3)', fontSize: 12 }}>
              جميع البيانات محفوظة محلياً على جهازك فقط
            </p>
          </div>
        </section>

        {/* App Info */}
        <section>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>راتبي</div>
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>الإصدار 1.0 · أوفلاين كامل</div>
          </div>
        </section>
      </div>
    </div>
  );
}
