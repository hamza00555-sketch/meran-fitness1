import { useState } from 'react'
import { Card, SectionTitle } from './ui.jsx'
import { DropletIcon } from './Icons.jsx'
import { toWesternDigits } from '../day.js'
import {
  deloadState, daysSinceLastDeload, deloadWeight,
  MIN_PCT, MAX_PCT, MIN_DAYS, MAX_DAYS, DELOAD_DAYS, DELOAD_PCT,
} from '../deload.js'

// Three shapes people actually reach for, and a fourth for everyone
// else. The middle one is the default because it is the one the
// evidence is about — a week at roughly 60% of working weight.
const PRESETS = [
  { id: 'light',  days: 5,           pct: 25,         label: 'خفيف',   desc: '٥ أيام · أخف ٢٥٪' },
  { id: 'usual',  days: DELOAD_DAYS, pct: DELOAD_PCT, label: 'المعتاد', desc: '٧ أيام · أخف ٤٠٪' },
  { id: 'deep',   days: 10,          pct: 55,         label: 'عميق',   desc: '١٠ أيام · أخف ٥٥٪' },
]

const fmtDate = (key) => {
  if (!key) return ''
  const [y, m, d] = key.split('-')
  return `${toWesternDigits(d)}/${toWesternDigits(m)}/${toWesternDigits(y)}`
}

const numBox = {
  width: '100%', background: 'var(--bg3)',
  border: '1px solid var(--border2)', borderRadius: 10,
  padding: '10px 12px', color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: 16, outline: 'none',
  textAlign: 'center', boxSizing: 'border-box',
}

/**
 * The deload control panel.
 *
 * Everything the period needs is here in one place: starting one,
 * watching it run, ending it early, and what came before. The engine
 * itself is in deload.js — this only decides what to show and hands
 * back the two verbs.
 */
export default function DeloadSection({ recoveryCfg = {}, today, onStart, onEnd }) {
  const state = deloadState(recoveryCfg, today)
  const history = [...(recoveryCfg.deloadHistory || [])].reverse()
  const since = daysSinceLastDeload(recoveryCfg, today)

  const [preset, setPreset] = useState('usual')
  const [days, setDays] = useState(DELOAD_DAYS)
  const [pct, setPct]   = useState(DELOAD_PCT)
  const [confirming, setConfirming] = useState(false)

  const chosen = preset === 'custom'
    ? { days, pct }
    : PRESETS.find(p => p.id === preset) || PRESETS[1]

  // The inputs are free text while being typed, so the guard rails live
  // here rather than in the field — clamping mid-keystroke fights the
  // person typing.
  const validDays = chosen.days >= MIN_DAYS && chosen.days <= MAX_DAYS
  const validPct  = chosen.pct  >= MIN_PCT  && chosen.pct  <= MAX_PCT

  return (
    <div style={{ marginBottom: 10 }}>
      <SectionTitle>الديلود · فترة تخفيف</SectionTitle>

      {state.active ? (
        /* ── Running ─────────────────────────────────────────── */
        <Card style={{ padding: 14 }} topColor="var(--cyan)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <DropletIcon size={22} color="var(--cyan)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800, color: 'var(--cyan)' }}>
                الديلود شغّال الآن
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                اليوم {toWesternDigits(state.day)} من {toWesternDigits(state.totalDays)}
                {' · '}أوزانك أخف {toWesternDigits(state.pct)}٪
              </div>
            </div>
          </div>

          {/* One bar, one number. The count is the whole point of the
              card and it should be readable without reading. */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {Array.from({ length: state.totalDays }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: i < state.day ? 'var(--cyan)' : 'var(--bg3)',
                opacity: i < state.day ? (0.45 + 0.55 * ((i + 1) / state.day)) : 1,
              }} />
            ))}
          </div>

          <div style={{
            background: 'var(--bg3)', borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.8,
          }}>
            {state.daysLeft > 0
              ? `باقي ${toWesternDigits(state.daysLeft)} ${state.daysLeft === 1 ? 'يوم' : 'أيام'} — ينتهي ${fmtDate(state.until)} وترجع أوزانك وحدها.`
              : 'اليوم آخر يوم — بكرة ترجع أوزانك كما كانت.'}
            {' '}التمارين والسيتات والتكرارات ما تغيّرت، الوزن فقط.
          </div>

          <button
            onClick={() => onEnd?.()}
            style={{
              width: '100%', marginTop: 10, padding: '12px 10px', borderRadius: 12,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              color: 'var(--text2)', fontFamily: 'var(--font-ar)', fontSize: 14,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            أنهِ الديلود الآن
          </button>
        </Card>
      ) : (
        /* ── Idle ────────────────────────────────────────────── */
        <Card style={{ padding: 12 }}>
          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)',
            lineHeight: 1.8, marginBottom: 10, padding: '0 4px',
          }}>
            فترة تنزل فيها أوزانك المقترحة مؤقتاً وتكمل نفس تمارينك. التطبيق
            يتحول للأزرق طول الفترة، ويجمّد نظام التقدم عشان الأسبوع الخفيف
            ما يُقرأ تراجعاً. وبعد آخر يوم ترجع أوزانك بالضبط كما كانت.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.map(p => {
              const isActive = preset === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => { setPreset(p.id); setConfirming(false) }}
                  style={{
                    flex: '1 1 calc(33% - 6px)', padding: '12px 6px', borderRadius: 12,
                    background: isActive ? 'var(--cyan-lo)' : 'var(--bg3)',
                    border: `2px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                    color: isActive ? 'var(--cyan)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: isActive ? 800 : 600 }}>
                    {p.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                    {p.desc}
                  </div>
                </button>
              )
            })}
            <button
              onClick={() => { setPreset('custom'); setConfirming(false) }}
              style={{
                flex: '1 1 100%', padding: '10px', borderRadius: 12,
                background: preset === 'custom' ? 'var(--cyan-lo)' : 'var(--bg3)',
                border: `2px solid ${preset === 'custom' ? 'var(--cyan)' : 'var(--border)'}`,
                color: preset === 'custom' ? 'var(--cyan)' : 'var(--text2)',
                fontFamily: 'var(--font-ar)', fontSize: 14,
                fontWeight: preset === 'custom' ? 800 : 600, cursor: 'pointer',
              }}
            >
              إعداد مخصص
            </button>
          </div>

          {preset === 'custom' && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                  كم يوم؟ ({toWesternDigits(MIN_DAYS)}-{toWesternDigits(MAX_DAYS)})
                </div>
                <input
                  type="text" inputMode="numeric" value={days}
                  onChange={e => { setDays(parseInt(toWesternDigits(e.target.value)) || 0); setConfirming(false) }}
                  style={{ ...numBox, borderColor: validDays ? 'var(--border2)' : 'var(--red)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                  كم ينزل الوزن؟ ({toWesternDigits(MIN_PCT)}-{toWesternDigits(MAX_PCT)}٪)
                </div>
                <input
                  type="text" inputMode="numeric" value={pct}
                  onChange={e => { setPct(parseInt(toWesternDigits(e.target.value)) || 0); setConfirming(false) }}
                  style={{ ...numBox, borderColor: validPct ? 'var(--border2)' : 'var(--red)' }}
                />
              </div>
            </div>
          )}

          <div style={{
            marginTop: 12, background: 'var(--bg3)', borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.8,
          }}>
            {validDays && validPct
              ? `يبدأ من اليوم ولمدة ${toWesternDigits(chosen.days)} أيام · وزن ١٠٠ كجم يصير ${toWesternDigits(deloadWeight(100, chosen.pct))} كجم`
              : 'راجع الأرقام — المدة والنسبة لازم تكون داخل المدى.'}
          </div>

          {/* Starting one is a week-long commitment, so it asks once. */}
          {confirming ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => { onStart?.({ days: chosen.days, pct: chosen.pct }); setConfirming(false) }}
                className="btn-cyan"
                style={{
                  flex: 2, padding: '12px 10px', borderRadius: 12, border: 'none',
                  background: 'var(--grad-primary)', color: '#0A0A0A',
                  fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                }}
              >
                أكيد — ابدأ الآن
              </button>
              <button
                onClick={() => setConfirming(false)}
                style={{
                  flex: 1, padding: '12px 10px', borderRadius: 12,
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  color: 'var(--text2)', fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
                }}
              >
                رجوع
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={!validDays || !validPct}
              style={{
                width: '100%', marginTop: 10, padding: '13px 10px', borderRadius: 12,
                border: `2px solid ${validDays && validPct ? 'var(--cyan)' : 'var(--border)'}`,
                background: 'transparent',
                color: validDays && validPct ? 'var(--cyan)' : 'var(--text3)',
                fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800,
                cursor: validDays && validPct ? 'pointer' : 'not-allowed',
              }}
            >
              ابدأ فترة ديلود
            </button>
          )}

          {since !== null && (
            <div style={{
              marginTop: 8, textAlign: 'center',
              fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)',
            }}>
              آخر ديلود انتهى قبل {toWesternDigits(since)} يوم
            </div>
          )}
        </Card>
      )}

      {/* ── What came before ──────────────────────────────────── */}
      {history.length > 0 && (
        <Card style={{ padding: 12, marginTop: 8 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)',
            letterSpacing: 2, marginBottom: 8,
          }}>
            سجل الديلودات · {toWesternDigits(history.length)}
          </div>
          {history.map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0',
              borderTop: i ? '1px solid var(--border)' : 'none',
            }}>
              <DropletIcon size={13} color="var(--text3)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>
                  {fmtDate(h.from)} — {fmtDate(h.until || h.plannedUntil)}
                </div>
                {h.endedEarly && (
                  <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    أُنهي بدري — كان مخططاً إلى {fmtDate(h.plannedUntil)}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>
                أخف {toWesternDigits(h.pct)}٪
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
