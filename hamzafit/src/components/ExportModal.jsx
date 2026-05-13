import { useState } from 'react'
import { Card, Btn, CloseBtn, Overlay } from './ui.jsx'
import { exportToCSV, exportToPDF } from '../utils/exportUtils.js'

export default function ExportModal({ sessions, onClose }) {
  const [exporting, setExporting] = useState(false)

  const handleCSV = async () => {
    setExporting(true)
    try {
      exportToCSV(sessions)
      setTimeout(() => {
        onClose()
        setExporting(false)
      }, 500)
    } catch (err) {
      console.error('CSV export error:', err)
      alert('خطأ في تصدير CSV')
      setExporting(false)
    }
  }

  const handlePDF = async () => {
    setExporting(true)
    try {
      exportToPDF(sessions)
      setTimeout(() => {
        onClose()
        setExporting(false)
      }, 500)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('خطأ في تصدير PDF')
      setExporting(false)
    }
  }

  return (
    <Overlay onClose={onClose} align="bottom">
      <Card style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>
              📥 تصدير البيانات
            </div>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* CSV Option */}
          <button
            onClick={handleCSV}
            disabled={exporting}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              textAlign: 'right',
              transition: 'all 0.15s',
              opacity: exporting ? 0.5 : 1,
            }}
            onMouseOver={e => !exporting && (e.currentTarget.style.borderColor = '#3B82F6')}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              📊 CSV (Excel)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              جدول بيانات قابل للتعديل · متوافق مع Excel
            </div>
          </button>

          {/* PDF Option */}
          <button
            onClick={handlePDF}
            disabled={exporting}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              textAlign: 'right',
              transition: 'all 0.15s',
              opacity: exporting ? 0.5 : 1,
            }}
            onMouseOver={e => !exporting && (e.currentTarget.style.borderColor = '#EF4444')}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              📄 PDF (Report)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              تقرير مُنسّق · آمن للطباعة والمشاركة
            </div>
          </button>

          {/* Info */}
          <div style={{
            background: 'var(--orange-lo)',
            border: '1px solid var(--orange-md)',
            borderRadius: 10,
            padding: 12,
            fontFamily: 'var(--font-ar)',
            fontSize: 12,
            color: 'var(--orange)',
          }}>
            ⓘ يتم تصدير {sessions.length} جلسة مع جميع التفاصيل والإحصائيات
          </div>
        </div>
      </Card>
    </Overlay>
  )
}
