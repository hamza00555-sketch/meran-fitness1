import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import * as db from '../db/index.js';
import { uid } from '../utils/format.js';
import {
  getPermissionStatus, requestPermission, registerPeriodicSync,
  hashPin, isBiometricAvailable, registerBiometric, removeBiometric,
} from '../utils/notifications.js';

const TEMPLATE = `الراتب:
يوم الراتب: 25

التزامات:
الاسم | المبلغ | يوم الدفع
إيجار الشقة | 2000 | 1
فاتورة الإنترنت | 250 | 5

الأهداف:
الاسم | المبلغ المستهدف | تاريخ التحقيق | المساهمة الشهرية
رحلة اليابان | 15000 | 2026-06-01 | 1000`;

const AI_PROMPT = `أنا أريدك تساعدني أملأ القالب التالي ببياناتي المالية. أبقِ الهيكل كما هو وبدّل الأرقام والأسماء فقط بمعلوماتي:

${TEMPLATE}

معلوماتي:
[هنا اكتب معلوماتك لـ ChatGPT/Claude/Grok ويملأ القالب عنك]`;

function parseTemplate(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let salary = 0, salaryDay = 25;
  const commitments = [], goals = [];
  let mode = null;

  for (const line of lines) {
    if (line.startsWith('#')) continue;

    const salaryMatch = line.match(/^الراتب:\s*(\d+)/);
    if (salaryMatch) { salary = Number(salaryMatch[1]); continue; }

    const dayMatch = line.match(/^يوم الراتب:\s*(\d+)/);
    if (dayMatch) { salaryDay = Number(dayMatch[1]); continue; }

    if (line === 'التزامات:') { mode = 'c'; continue; }
    if (line === 'الأهداف:') { mode = 'g'; continue; }

    if (!line.includes('|')) continue;
    const parts = line.split('|').map(p => p.trim());

    if (mode === 'c' && parts.length >= 2) {
      const name = parts[0], amount = Number(parts[1]);
      if (name && amount && name !== 'الاسم') {
        commitments.push({ name, amount, dayOfMonth: Number(parts[2]) || 1 });
      }
    }
    if (mode === 'g' && parts.length >= 3) {
      const name = parts[0], targetAmount = Number(parts[1]);
      if (name && targetAmount && name !== 'الاسم') {
        goals.push({
          name, targetAmount,
          targetDate: parts[2] || '',
          monthlyContribution: Number(parts[3]) || 0,
        });
      }
    }
  }

  return { salary, salaryDay, commitments, goals };
}

export default function Settings() {
  const { settings, updateSettings, setPage } = useApp();
  const [salary, setSalary] = useState(String(settings.salary));
  const [salaryDay, setSalaryDay] = useState(settings.salaryDay);
  const [saved, setSaved] = useState(false);
  const [backupError, setBackupError] = useState('');

  // Notifications state
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus());

  // Security / lock state
  const [lockEnabled, setLockEnabledState] = useState(!!settings.lockEnabled);
  const [pinSetup, setPinSetup] = useState(null); // null | 'enter' | 'confirm' | 'disable'
  const [pinInput, setPinInput] = useState('');
  const [pinFirst, setPinFirst] = useState('');
  const [pinError, setPinError] = useState('');
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(!!settings.biometricEnabled);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(ok => setBiometricAvail(ok && !!settings.lockEnabled && !!settings.pinHash));
  }, [settings.lockEnabled, settings.pinHash]);

  async function handleNotifToggle() {
    if (notifStatus === 'granted') return;
    const ok = await requestPermission();
    const status = ok ? 'granted' : 'denied';
    setNotifStatus(status);
    if (ok) registerPeriodicSync();
  }

  async function startLockSetup() {
    setPinInput(''); setPinFirst(''); setPinError('');
    if (lockEnabled) {
      // Disabling: confirm current PIN first
      setPinSetup('disable');
    } else {
      // Enabling: set new PIN
      setPinSetup('enter');
    }
  }

  async function handlePinDigit(d) {
    if (pinInput.length >= 4) return;
    const next = pinInput + d;
    setPinInput(next);
    setPinError('');

    if (next.length < 4) return;

    if (pinSetup === 'enter') {
      setPinFirst(next);
      setPinInput('');
      setPinSetup('confirm');
    } else if (pinSetup === 'confirm') {
      if (next !== pinFirst) {
        setPinError('الرمزان غير متطابقين، حاول مجدداً');
        setPinInput('');
        setPinSetup('enter');
        setPinFirst('');
      } else {
        const hash = await hashPin(next);
        await updateSettings({ lockEnabled: true, pinHash: hash });
        setLockEnabledState(true);
        setPinSetup(null);
        setBiometricAvail(await isBiometricAvailable());
      }
    } else if (pinSetup === 'disable') {
      const hash = await hashPin(next);
      if (hash !== settings.pinHash) {
        setPinError('رمز الدخول غير صحيح');
        setPinInput('');
      } else {
        await updateSettings({ lockEnabled: false, pinHash: null, biometricEnabled: false });
        setLockEnabledState(false);
        setBiometricEnabledState(false);
        removeBiometric();
        setPinSetup(null);
      }
    }
  }

  async function handleBiometricToggle() {
    if (biometricEnabled) {
      await updateSettings({ biometricEnabled: false });
      setBiometricEnabledState(false);
      removeBiometric();
      return;
    }
    setBiometricLoading(true);
    const ok = await registerBiometric();
    if (ok) {
      await updateSettings({ biometricEnabled: true });
      setBiometricEnabledState(true);
    } else {
      setPinError('فشل تسجيل البصمة — تأكد من دعم الجهاز');
    }
    setBiometricLoading(false);
  }

  const [updateStatus, setUpdateStatus] = useState('idle'); // idle | checking | updating | current | error

  async function handleAppUpdate() {
    setUpdateStatus('checking');
    try {
      if (!('serviceWorker' in navigator)) { window.location.reload(); return; }

      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) { window.location.reload(); return; }

      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloaded) { reloaded = true; window.location.reload(); }
      }, { once: true });

      await reg.update();

      const activatePending = sw => {
        setUpdateStatus('updating');
        sw.postMessage({ type: 'SKIP_WAITING' });
      };

      if (reg.waiting) {
        activatePending(reg.waiting);
      } else if (reg.installing) {
        setUpdateStatus('updating');
        const installing = reg.installing;
        installing.addEventListener('statechange', function () {
          if (installing.state === 'installed' && reg.waiting) activatePending(reg.waiting);
          else if (installing.state === 'activating' || installing.state === 'activated') {
            // skipWaiting already called (self.skipWaiting at top of sw.js)
          }
        });
      } else {
        // No new SW found — wait briefly in case controllerchange fires from a fast-activating SW
        setTimeout(() => {
          if (!reloaded) {
            setUpdateStatus('current');
            setTimeout(() => setUpdateStatus('idle'), 3000);
          }
        }, 2500);
      }
    } catch {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  }

  const [importText, setImportText] = useState(TEMPLATE);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  async function handleSave() {
    await updateSettings({ salary: Number(salary), salaryDay });
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

  async function handleBackupImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBackupError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await db.importAll(data);
      window.location.reload();
    } catch {
      setBackupError('الملف غير صالح أو تالف');
    }
    e.target.value = '';
  }

  async function handleTextImport() {
    setImportError('');
    setImporting(true);
    try {
      const { salary: s, salaryDay: sd, commitments, goals } = parseTemplate(importText);

      if (s > 0) await updateSettings({ salary: s, salaryDay: sd });

      for (const c of commitments) {
        await db.saveCommitment({
          id: uid(), name: c.name, amount: c.amount,
          category: 'other', dayOfMonth: c.dayOfMonth,
          paidThisMonth: false, active: true,
        });
      }

      for (const g of goals) {
        await db.saveGoal({
          id: uid(), name: g.name, targetAmount: g.targetAmount,
          savedAmount: 0, targetDate: g.targetDate,
          category: 'other', monthlyContribution: g.monthlyContribution,
          completed: false,
        });
      }

      const total = (s > 0 ? 1 : 0) + commitments.length + goals.length;
      if (total === 0) {
        setImportError('ما وُجدت بيانات — تأكد من تعبئة القالب بشكل صحيح');
        setImporting(false);
        return;
      }

      setImportDone(true);
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setImportError('خطأ في قراءة البيانات — تحقق من القالب');
    }
    setImporting(false);
  }

  async function copyText(text, setter) {
    try { await navigator.clipboard.writeText(text); setter(true); setTimeout(() => setter(false), 2500); } catch {}
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
              <input className="input" type="text" inputMode="decimal"
                value={salary} onChange={e => setSalary(e.target.value)} />
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

        {/* Smart Import */}
        <section>
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 700, marginBottom: 12 }}>🤖 استيراد البيانات</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>
              عبّئ القالب بيدك، أو انسخ برومبت الذكاء الاصطناعي وأعطه لـ ChatGPT / Claude / Grok، ثم الصق الناتج هنا واضغط استيراد.
            </p>

            {/* How to use steps */}
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['١', 'انسخ "برومبت الذكاء الاصطناعي" أدناه'],
                ['٢', 'أرسله لـ ChatGPT وأخبره بمعلوماتك'],
                ['٣', 'الصق الرد هنا مكان القالب'],
                ['٤', 'اضغط استيراد'],
              ].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{n}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>

            {/* Copy AI prompt button */}
            <button onClick={() => copyText(AI_PROMPT, setPromptCopied)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: promptCopied ? 'var(--accent-dim)' : 'var(--card2)',
              border: `1.5px solid ${promptCopied ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10, padding: '12px', cursor: 'pointer',
              fontFamily: 'Mestika, Cairo, sans-serif', fontWeight: 700, fontSize: 14,
              color: promptCopied ? 'var(--accent)' : 'var(--text)', transition: 'all .2s',
            }}>
              {promptCopied ? '✓ تم النسخ!' : '🤖 نسخ برومبت الذكاء الاصطناعي'}
            </button>

            {/* Template textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setImportError(''); setImportDone(false); }}
                rows={10}
                style={{
                  background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10,
                  color: 'var(--text)', fontFamily: 'Cairo, sans-serif', fontSize: 13,
                  padding: '12px 12px 12px 12px', width: '100%', outline: 'none', resize: 'vertical',
                  direction: 'rtl', lineHeight: 2,
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button onClick={() => copyText(TEMPLATE, setTemplateCopied)}
                style={{
                  position: 'absolute', top: 8, left: 8,
                  background: templateCopied ? 'var(--accent-dim)' : 'var(--card2)',
                  border: `1px solid ${templateCopied ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                  fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 11,
                  color: templateCopied ? 'var(--accent)' : 'var(--text2)', transition: 'all .2s',
                }}>
                {templateCopied ? '✓' : '📋 نسخ'}
              </button>
            </div>

            {importError && (
              <div style={{ background: 'var(--danger-dim)', borderRadius: 10, padding: '10px 14px', color: 'var(--danger)', fontSize: 13 }}>
                ⚠️ {importError}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleTextImport}
              disabled={importing || importDone}
              style={{
                opacity: importing ? 0.7 : 1,
                background: importDone ? 'var(--accent)' : 'var(--primary)',
              }}>
              {importDone ? '✓ تمت الإضافة! جاري التحديث...' : importing ? 'جاري الاستيراد...' : '⬇️ استيراد البيانات'}
            </button>
          </div>
        </section>

        {/* Salary Day */}
        <section>
          <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>📅 يوم الراتب</div>
          <div className="card">
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14 }}>
              فتح شاشة توزيع الراتب مجدداً لهذا الشهر
            </p>
            <button className="btn btn-outline" onClick={() => setPage('salaryDay')}>
              فتح شاشة يوم الراتب
            </button>
          </div>
        </section>

        {/* Security */}
        <section>
          <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>🔒 أمان التطبيق</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Lock toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>قفل التطبيق برمز سري</div>
                <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>
                  {lockEnabled ? 'مفعّل — التطبيق محمي برمز دخول' : 'غير مفعّل'}
                </div>
              </div>
              <button onClick={startLockSetup} style={{
                background: lockEnabled ? 'var(--accent)' : 'var(--border)',
                border: 'none', borderRadius: 20, width: 52, height: 28, cursor: 'pointer',
                position: 'relative', transition: 'background .25s',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  right: lockEnabled ? 4 : 'auto',
                  left: lockEnabled ? 'auto' : 4,
                  transition: 'all .25s',
                  boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                }} />
              </button>
            </div>

            {/* PIN setup inline numpad */}
            {pinSetup && (
              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}>
                  {pinSetup === 'enter' && 'أدخل رمز الدخول الجديد (4 أرقام)'}
                  {pinSetup === 'confirm' && 'أكد رمز الدخول'}
                  {pinSetup === 'disable' && 'أدخل رمزك الحالي لإيقاف القفل'}
                </div>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 16 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: pinInput.length > i ? 'var(--primary)' : 'var(--border)',
                      transition: 'background .15s',
                    }} />
                  ))}
                </div>
                {pinError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{pinError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 220, margin: '0 auto', direction: 'ltr' }}>
                  {[1,2,3,4,5,6,7,8,9].map(d => (
                    <button key={d} onClick={() => handlePinDigit(String(d))} style={{
                      height: 52, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'var(--card)', color: 'var(--text)',
                      fontSize: 20, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                    }}>{d}</button>
                  ))}
                  <div />
                  <button onClick={() => handlePinDigit('0')} style={{
                    height: 52, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'var(--card)', color: 'var(--text)',
                    fontSize: 20, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                  }}>0</button>
                  <button onClick={() => { setPinInput(p => p.slice(0, -1)); setPinError(''); }} style={{
                    height: 52, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'var(--card)', color: 'var(--text2)', fontSize: 18,
                  }}>⌫</button>
                </div>
                <button onClick={() => { setPinSetup(null); setPinInput(''); setPinError(''); }}
                  style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13 }}>
                  إلغاء
                </button>
              </div>
            )}

            {/* Biometric toggle — only when lock is enabled */}
            {lockEnabled && biometricAvail && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>البصمة / التعرف على الوجه</div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>
                    {biometricEnabled ? 'مفعّل — يمكنك الدخول ببصمتك' : 'غير مفعّل'}
                  </div>
                </div>
                <button onClick={handleBiometricToggle} disabled={biometricLoading} style={{
                  background: biometricEnabled ? 'var(--accent)' : 'var(--border)',
                  border: 'none', borderRadius: 20, width: 52, height: 28, cursor: 'pointer',
                  position: 'relative', transition: 'background .25s', opacity: biometricLoading ? .6 : 1,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    right: biometricEnabled ? 4 : 'auto',
                    left: biometricEnabled ? 'auto' : 4,
                    transition: 'all .25s',
                    boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                  }} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 12 }}>🔔 الإشعارات</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>إشعارات التطبيق</div>
                <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>
                  {notifStatus === 'granted' && 'مفعّلة ✓'}
                  {notifStatus === 'denied' && 'محظورة — فعّلها من إعدادات الجهاز'}
                  {notifStatus === 'default' && 'اضغط للسماح بالإشعارات'}
                  {notifStatus === 'unsupported' && 'غير مدعومة على هذا المتصفح'}
                </div>
              </div>
              {notifStatus !== 'granted' && notifStatus !== 'unsupported' && notifStatus !== 'denied' && (
                <button onClick={handleNotifToggle} className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
                  تفعيل
                </button>
              )}
              {notifStatus === 'granted' && (
                <div style={{ color: 'var(--accent)', fontSize: 18 }}>✓</div>
              )}
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.8 }}>
                ستتلقى إشعارات عند:
                <br />• استحقاق أي التزام مالي اليوم أو غداً
                <br />• نصائح مالية مفيدة بين الحين والآخر
              </div>
            </div>
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
                <input type="file" accept=".json" onChange={handleBackupImport} style={{ display: 'none' }} />
              </label>
            </div>
            {backupError && (
              <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>{backupError}</div>
            )}
            <p style={{ color: 'var(--text3)', fontSize: 12 }}>
              جميع البيانات محفوظة محلياً على جهازك فقط
            </p>
          </div>
        </section>

        {/* App Update */}
        <section>
          <div style={{ fontSize: 13, color: '#6C63FF', fontWeight: 700, marginBottom: 12 }}>🔄 تحديث التطبيق</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>
              اضغط للتحقق من وجود نسخة جديدة وتثبيتها فوراً بدون حذف التطبيق
            </p>
            <button
              onClick={handleAppUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'updating'}
              style={{
                padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontFamily: 'Mestika, Cairo, sans-serif', fontWeight: 700, fontSize: 15,
                transition: 'all .2s',
                background: updateStatus === 'current' ? 'var(--accent-dim)'
                  : updateStatus === 'error' ? 'var(--danger-dim)'
                  : '#6C63FF',
                color: updateStatus === 'current' ? 'var(--accent)'
                  : updateStatus === 'error' ? 'var(--danger)'
                  : '#fff',
                opacity: (updateStatus === 'checking' || updateStatus === 'updating') ? 0.75 : 1,
              }}
            >
              {updateStatus === 'idle' && '🔄 تحديث التطبيق'}
              {updateStatus === 'checking' && '⏳ جاري الفحص...'}
              {updateStatus === 'updating' && '⬇️ جاري التحديث...'}
              {updateStatus === 'current' && '✓ التطبيق محدّث بالفعل'}
              {updateStatus === 'error' && '⚠️ حدث خطأ، حاول مجدداً'}
            </button>
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
