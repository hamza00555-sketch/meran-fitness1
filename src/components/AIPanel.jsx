import { useState } from 'react'
import { Card, Btn, CloseBtn, Overlay } from './ui.jsx'
import { ls } from '../utils.js'

const QUICK_PROMPTS = [
  'اقترح لي برنامج Push Pull Legs',
  'أفضل تمارين الصدر للمبتدئين',
  'برنامج لزيادة الكتلة العضلية',
  'روتين أيام الأرجل الكامل',
  'تمارين الظهر مع الإطالة',
]

export default function AIPanel({ onImport, onClose }) {
  const [apiKey, setApiKey]   = useState(() => ls.get('hf_api_key', ''))
  const [keyInput, setKeyInput] = useState('')
  const [prompt, setPrompt]   = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [imported, setImported] = useState(false)
  const [error, setError]     = useState('')

  const saveKey = () => {
    const trimmed = keyInput.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setError('المفتاح يجب أن يبدأ بـ sk-ant-')
      return
    }
    ls.set('hf_api_key', trimmed)
    setApiKey(trimmed)
    setKeyInput('')
    setError('')
  }

  const clearKey = () => {
    ls.set('hf_api_key', '')
    setApiKey('')
    setResponse('')
    setError('')
  }

  const ask = async (q) => {
    const query = q || prompt
    if (!query.trim()) return
    if (!apiKey) { setError('أدخل API Key أولاً'); return }
    setLoading(true); setResponse(''); setError(''); setImported(false)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `أنت مدرب لياقة بدنية محترف. المستخدم اسمه حمزة. تحدث بالعربية.

عندما يطلب المستخدم روتيناً أو برنامجاً أو قائمة تمارين، أعطِ ردك كـ JSON فقط بدون أي نص إضافي قبله أو بعده:
{
  "routine_name": "اسم الروتين",
  "exercises": [
    {
      "muscle": "Chest",
      "name": "Bench Press",
      "emoji": "🏋️",
      "sets": 4,
      "reps_suggestion": "8-10"
    }
  ]
}

المجموعات العضلية المتاحة فقط: Chest, Back, Shoulders, Legs, Biceps, Triceps, Core, Cardio

إذا كان السؤال نصيحة عامة وليس روتيناً، أجب نصياً بالعربية بدون JSON.`,
          messages: [{ role: 'user', content: query }],
        }),
      })

      if (res.status === 401) throw new Error('API Key غير صحيح. تحقق من المفتاح.')
      if (res.status === 403) throw new Error('تجاوزت الحد المسموح. تحقق من حسابك.')
      if (res.status === 529) throw new Error('Claude مشغول الآن. حاول بعد قليل.')
      if (!res.ok) throw new Error(`خطأ في الاتصال (HTTP ${res.status})`)

      const data = await res.json()
      const text = data.content?.map(c => c.text || '').join('') || 'لم أحصل على رد.'
      setResponse(text)
    } catch (e) {
      if (e.name === 'TypeError') {
        setError('تأكد من اتصالك بالإنترنت.')
      } else {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  const tryImport = () => {
    try {
      const match = response.match(/\{[\s\S]*\}/)
      if (!match) { alert('ما قدرت أستورد الروتين. جرب سؤالاً أوضح.'); return }
      const data = JSON.parse(match[0])
      if (!data.exercises?.length) { alert('ما في تمارين في الرد.'); return }
      onImport(data)
      setImported(true)
    } catch { alert('خطأ في تحليل الروتين.') }
  }

  const hasJSON = /\{[\s\S]*"exercises"/.test(response)

  return (
    <Overlay onClose={onClose} align="bottom">
      <Card style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>🤖 مساعد الـ AI</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                Powered by Claude Sonnet
              </div>
            </div>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>

          {/* API Key config */}
          <div style={{
            background: 'var(--bg3)',
            border: `1px solid ${apiKey ? '#22C55E30' : 'var(--border)'}`,
            borderRadius: 10, padding: 12, marginBottom: 16,
          }}>
            {apiKey ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)' }}>✓ API Key مُفعَّل</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text4)', marginTop: 2 }}>
                    {apiKey.slice(0, 12)}•••••••••
                  </div>
                </div>
                <button
                  onClick={clearKey}
                  style={{ background: 'none', border: 'none', color: 'var(--text4)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ar)' }}
                >تغيير</button>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  🔑 أدخل Anthropic API Key للاستخدام
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveKey()}
                    placeholder="sk-ant-api03-..."
                    style={{
                      flex: 1, background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 10px',
                      color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12,
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--orange)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  <Btn onClick={saveKey} style={{ padding: '8px 14px', fontSize: 12 }}>حفظ</Btn>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text4)', marginTop: 6 }}>
                  المفتاح يُحفظ محلياً فقط على جهازك
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
            {QUICK_PROMPTS.map(q => (
              <button
                key={q}
                onClick={() => { setPrompt(q); ask(q) }}
                disabled={!apiKey}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '5px 13px',
                  color: apiKey ? 'var(--text3)' : 'var(--text4)', fontSize: 12,
                  fontFamily: 'var(--font-ar)', cursor: apiKey ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  opacity: apiKey ? 1 : 0.5,
                }}
                onMouseOver={e => { if (apiKey) { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)' } }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = apiKey ? 'var(--text3)' : 'var(--text4)' }}
              >{q}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) ask() }}
              placeholder="اسأل عن أي تمرين أو روتين... 💬"
              rows={3}
              style={{
                flex: 1, background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: 12,
                color: 'var(--text)', fontFamily: 'var(--font-ar)', fontSize: 14,
                resize: 'none', outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--orange)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <Btn onClick={() => ask()} disabled={loading || !apiKey} style={{ alignSelf: 'flex-end', padding: '12px 16px' }}>
              {loading ? '⏳' : 'إرسال'}
            </Btn>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{
              textAlign: 'center', color: 'var(--orange)',
              fontFamily: 'var(--font-mono)', fontSize: 13, padding: '20px 0',
            }}>
              <div className="spin" style={{ display: 'inline-block', marginLeft: 8, fontSize: 18 }}>⚡</div>
              {' '}Claude يفكر...
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#EF444412', border: '1px solid #EF444430',
              borderRadius: 10, padding: 12,
              color: '#EF4444', fontFamily: 'var(--font-ar)', fontSize: 13,
            }}>{error}</div>
          )}

          {/* Response */}
          {response && !loading && (
            <div>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 14,
                fontFamily: 'var(--font-ar)', fontSize: 14,
                color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap',
                marginBottom: 12,
              }}>{response}</div>

              {hasJSON && !imported && (
                <Btn onClick={tryImport} variant="gold" full>
                  📥 استورد الروتين تلقائياً
                </Btn>
              )}

              {imported && (
                <div style={{
                  textAlign: 'center', color: 'var(--green)',
                  fontFamily: 'var(--font-ar)', fontSize: 14, padding: '10px 0',
                }}>
                  ✅ تم استيراد الروتين! انتقل لتبويب "اليوم"
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </Overlay>
  )
}
