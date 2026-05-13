// ── CSV Export ──────────────────────────────────────────────

export function exportToCSV(sessions) {
  if (!sessions.length) {
    alert('لا توجد جلسات للتصدير')
    return
  }

  let csv = 'التاريخ,الوقت,عدد التمارين,السيتات المكتملة,الحد الأقصى (kg),المدة (دقائق)\n'

  sessions.forEach(s => {
    const date = s.date.split('T')[0]
    const time = new Date(s.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    const exercises = s.exercises.length
    const doneSets = s.exercises.flatMap(e => e.sets).filter(ss => ss.done).length
    const maxW = Math.max(...s.exercises.flatMap(e => e.sets).map(ss => parseFloat(ss.weight) || 0), 0)
    const duration = s.duration || '—'

    csv += `${date},${time},${exercises},${doneSets},${maxW},${duration}\n`
  })

  // Add stats summary
  csv += '\n\n=== الإحصائيات ===\n'
  csv += `إجمالي الجلسات,${sessions.length}\n`
  
  const totalVol = sessions.reduce((a, s) => {
    return a + s.exercises.flatMap(e => e.sets).reduce((b, ss) => {
      const w = parseFloat(ss.weight) || 0
      const r = (parseInt(ss.sets?.r1) || 0) + (parseInt(ss.sets?.r2) || 0) + (parseInt(ss.sets?.r3) || 0)
      return b + (ss.done ? w * r : 0)
    }, 0)
  }, 0)
  
  csv += `إجمالي الحجم (kg),${Math.round(totalVol)}\n`

  // Download
  downloadFile(csv, 'hamzafit-sessions.csv', 'text/csv')
}

// ── PDF Export ──────────────────────────────────────────────

export function exportToPDF(sessions) {
  if (!sessions.length) {
    alert('لا توجد جلسات للتصدير')
    return
  }

  // Simple HTML-to-PDF conversion
  let html = `
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { text-align: center; color: #FF6B35; margin-bottom: 30px; }
        .session { border-bottom: 2px solid #ddd; padding: 15px 0; margin-bottom: 15px; }
        .session:last-child { border-bottom: none; }
        .session-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; }
        .exercises { margin-right: 20px; }
        .exercise { margin: 5px 0; font-size: 14px; }
        .stats { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 30px; }
        .stats h2 { color: #333; margin-bottom: 10px; }
        .stat-item { display: flex; justify-content: space-between; margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>تقرير HamzaFit 💪</h1>
  `

  sessions.forEach((s, idx) => {
    const date = new Date(s.date).toLocaleDateString('ar-SA')
    const time = new Date(s.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    const doneSets = s.exercises.flatMap(e => e.sets).filter(ss => ss.done).length
    const totalSets = s.exercises.flatMap(e => e.sets).length

    html += `
      <div class="session">
        <div class="session-header">
          <span>${date} · ${time}</span>
          <span>${doneSets}/${totalSets} sets</span>
        </div>
        <div class="exercises">
    `

    s.exercises.forEach(ex => {
      html += `<div class="exercise">• ${ex.emoji} ${ex.name}</div>`
    })

    html += `
        </div>
      </div>
    `
  })

  // Stats
  const totalVol = sessions.reduce((a, s) => {
    return a + s.exercises.flatMap(e => e.sets).reduce((b, ss) => {
      const w = parseFloat(ss.weight) || 0
      const r = (parseInt(ss.r1) || 0) + (parseInt(ss.r2) || 0) + (parseInt(ss.r3) || 0)
      return b + (ss.done ? w * r : 0)
    }, 0)
  }, 0)

  html += `
    <div class="stats">
      <h2>📊 الإحصائيات</h2>
      <div class="stat-item">
        <span>إجمالي الجلسات:</span>
        <span><strong>${sessions.length}</strong></span>
      </div>
      <div class="stat-item">
        <span>إجمالي الحجم (kg):</span>
        <span><strong>${Math.round(totalVol)}</strong></span>
      </div>
    </div>
      </div>
    </body>
    </html>
  `

  // Convert to PDF
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  
  // Open in new tab (user can save as PDF using browser)
  const win = window.open(url, '_blank')
  if (win) {
    win.print()
  }
}

// ── Helper: Download File ──────────────────────────────────

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
