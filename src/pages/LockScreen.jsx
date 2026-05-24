import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { hashPin, isBiometricAvailable, authenticateBiometric } from '../utils/notifications.js';

function FaceIdIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2H5a3 3 0 0 0-3 3v2"/>
      <path d="M17 2h2a3 3 0 0 1 3 3v2"/>
      <path d="M7 22H5a3 3 0 0 1-3-3v-2"/>
      <path d="M17 22h2a3 3 0 0 0 3-3v-2"/>
      <path d="M9 10v1.2" strokeWidth="2.2"/>
      <path d="M15 10v1.2" strokeWidth="2.2"/>
      <path d="M12 11v2.5"/>
      <path d="M9 16.5c.8 1.2 5.2 1.2 6 0"/>
    </svg>
  );
}

function BackspaceIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7H8l-7 5 7 5h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
      <line x1="18" y1="11" x2="14" y2="15"/>
      <line x1="14" y1="11" x2="18" y2="15"/>
    </svg>
  );
}

const ROWS = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
const PIN_LENGTH = 4;

export default function LockScreen() {
  const { settings, unlock } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const autoTriggered = useRef(false);

  useEffect(() => {
    isBiometricAvailable().then(ok => {
      if (!ok) return;
      const credId = localStorage.getItem('ratebi-biometric-id');
      if (settings.biometricEnabled && credId) {
        setHasBiometric(true);
        if (!autoTriggered.current) {
          autoTriggered.current = true;
          // Small delay to let the page render before triggering
          setTimeout(() => handleBiometricInner(), 400);
        }
      }
    });
  }, []);

  async function handleBiometricInner() {
    setBiometricLoading(true);
    try {
      const ok = await authenticateBiometric();
      if (ok) {
        unlock();
        return;
      }
    } catch {}
    setBiometricLoading(false);
  }

  const handleBiometric = useCallback(async () => {
    if (biometricLoading) return;
    setBiometricLoading(true);
    try {
      const ok = await authenticateBiometric();
      if (ok) { unlock(); return; }
      setError('تعذّر التحقق بالبصمة');
      setTimeout(() => setError(''), 2500);
    } catch {
      setError('البصمة غير متاحة');
      setTimeout(() => setError(''), 2500);
    }
    setBiometricLoading(false);
  }, [biometricLoading, unlock]);

  const addDigit = useCallback(async (d) => {
    if (shaking) return;
    const next = pin + d;
    if (next.length > PIN_LENGTH) return;
    setPin(next);
    setError('');

    if (next.length === PIN_LENGTH) {
      const hash = await hashPin(next);
      if (hash === settings.pinHash) {
        unlock();
      } else {
        setShaking(true);
        setError('رمز الدخول غير صحيح');
        setTimeout(() => { setPin(''); setShaking(false); }, 650);
      }
    }
  }, [pin, shaking, settings.pinHash, unlock]);

  const removeDigit = useCallback(() => {
    setPin(p => p.slice(0, -1));
    setError('');
  }, []);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      WebkitUserSelect: 'none',
      userSelect: 'none',
    }}>
      {/* Top greeting section */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px 16px',
      }}>
        <img
          src="/assets/icons/app-icon.png"
          alt="راتبي"
          style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
        />
        <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
          👋 مرحباً
        </div>
        <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 36 }}>
          أدخل رمز الدخول السريع
        </div>

        {/* PIN boxes */}
        <div style={{
          display: 'flex',
          gap: 14,
          marginBottom: 14,
          animation: shaking ? 'lock-shake 0.55s ease' : 'none',
        }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              background: pin.length > i ? 'var(--primary)' : 'var(--card)',
              border: `2px solid ${pin.length > i ? 'var(--primary)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all .15s',
              boxShadow: pin.length > i ? '0 0 18px rgba(108,99,255,.45)' : 'none',
            }}>
              {pin.length > i && (
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
              )}
            </div>
          ))}
        </div>

        {/* Error / status */}
        <div style={{ minHeight: 22, textAlign: 'center' }}>
          {error && (
            <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{error}</span>
          )}
        </div>

        {/* Forgot PIN */}
        <button
          onClick={() => setError('تواصل مع الدعم لإعادة تعيين رمز الدخول')}
          style={{
            marginTop: 12,
            background: 'none', border: 'none',
            color: 'var(--text3)', fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'Mestika, Cairo, sans-serif',
            padding: '4px 0',
          }}>
          نسيت رمز الدخول؟
        </button>
      </div>

      {/* Numpad */}
      <div style={{ padding: '0 20px 44px', direction: 'ltr' }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', marginBottom: 4 }}>
            {row.map(d => (
              <NumBtn key={d} label={String(d)} onClick={() => addDigit(String(d))} />
            ))}
          </div>
        ))}

        {/* Bottom row: biometric | 0 | backspace */}
        <div style={{ display: 'flex', marginBottom: 4 }}>
          {hasBiometric ? (
            <NumBtn
              label={biometricLoading
                ? <div style={{ width: 24, height: 24, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                : <FaceIdIcon size={28} />
              }
              onClick={handleBiometric}
              sub
            />
          ) : (
            <div style={{ flex: 1 }} />
          )}
          <NumBtn label="0" onClick={() => addDigit('0')} />
          <NumBtn label={<BackspaceIcon size={22} />} onClick={removeDigit} sub />
        </div>
      </div>

      <style>{`
        @keyframes lock-shake {
          0%,100% { transform: translateX(0); }
          15%,55% { transform: translateX(-10px); }
          35%,75% { transform: translateX(10px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function NumBtn({ label, onClick, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 78,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: sub ? 'var(--text2)' : 'var(--text)',
        fontSize: typeof label === 'string' ? 32 : 18,
        fontWeight: 300,
        fontFamily: 'Cairo, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        transition: 'background .12s',
        WebkitTapHighlightColor: 'transparent',
        letterSpacing: 0,
      }}
      onPointerDown={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
      onPointerUp={e => e.currentTarget.style.background = 'transparent'}
      onPointerLeave={e => e.currentTarget.style.background = 'transparent'}
      onPointerCancel={e => e.currentTarget.style.background = 'transparent'}
    >
      {label}
    </button>
  );
}
