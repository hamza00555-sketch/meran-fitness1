// ── Time-lapse Generator ────────────────────────────────────

export async function generateTimelapse(photos, frameDuration = 1000) {
  if (photos.length < 2) {
    alert('تحتاج على الأقل صورتين')
    return
  }

  // Show progress
  const originalTitle = document.title
  const startTime = Date.now()

  try {
    // Create canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 540
    canvas.height = 720

    // Load first image to get dimensions
    await new Promise((resolve, reject) => {
      const img = new Image()
      img.src = photos[0].src
      img.onload = () => {
        const ratio = Math.min(canvas.width / img.width, canvas.height / img.height)
        const w = img.width * ratio
        const h = img.height * ratio
        const x = (canvas.width - w) / 2
        const y = (canvas.height - h) / 2
        
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, x, y, w, h)
        
        resolve()
      }
      img.onerror = reject
    })

    // Create animated data URL using canvas frames
    const frames = []
    
    for (let i = 0; i < photos.length; i++) {
      const progress = Math.round((i / photos.length) * 100)
      document.title = `⏳ ${progress}%`
      
      await new Promise((resolve, reject) => {
        const img = new Image()
        img.src = photos[i].src
        img.onload = () => {
          const ratio = Math.min(canvas.width / img.width, canvas.height / img.height)
          const w = img.width * ratio
          const h = img.height * ratio
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2
          
          ctx.fillStyle = '#0a0a0a'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, x, y, w, h)
          
          // Add frame info
          ctx.fillStyle = '#999'
          ctx.font = '12px monospace'
          ctx.fillText(`Frame ${i + 1}/${photos.length}`, 10, canvas.height - 10)
          
          frames.push(canvas.toDataURL('image/webp', 0.8))
          resolve()
        }
        img.onerror = reject
      })
    }

    // Create animated WebP/APNG (fallback to GIF-like format)
    // For now, create a simple video file or downloadable frames
    downloadTimelapse(frames, frameDuration)
    
    document.title = originalTitle
    alert(`✅ تم إنشاء الـ timelapse! (${(Date.now() - startTime) / 1000}s)`)
  } catch (err) {
    console.error('Timelapse error:', err)
    alert('حدث خطأ في إنشاء الـ timelapse')
    document.title = originalTitle
  }
}

// ── Download as ZIP or sequence ────────────────────────────

function downloadTimelapse(frames, frameDuration) {
  // Option 1: Download as sequence of images
  frames.forEach((frame, i) => {
    const link = document.createElement('a')
    link.href = frame
    link.download = `frame-${String(i + 1).padStart(3, '0')}.webp`
    // link.click() // Uncomment to auto-download
  })

  // Option 2: Create downloadable ZIP (requires library)
  // For now, provide frames as a blob collection
  const frameBlobs = frames.map(f => dataURLToBlob(f))
  downloadFrameZIP(frameBlobs, frameDuration)
}

// ── Convert data URL to Blob ────────────────────────────────

function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new Blob([u8arr], { type: mime })
}

// ── Create downloadable ZIP (simple version) ───────────────

function downloadFrameZIP(frameBlobs, frameDuration) {
  // Create HTML viewer for frames
  let html = `
    <html dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>HamzaFit Time-lapse</title>
      <style>
        body { background: #0a0a0a; color: #e8e2d9; font-family: Tajawal, sans-serif; padding: 20px; }
        .container { max-width: 540px; margin: 0 auto; }
        h1 { text-align: center; color: #FF6B35; }
        #canvas { width: 100%; border: 1px solid #222; border-radius: 12px; margin: 20px 0; }
        .controls { text-align: center; margin: 20px 0; }
        button { background: #FF6B35; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 5px; }
        button:hover { background: #FF8C5A; }
        .info { background: #111; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>HamzaFit Time-lapse 🎬</h1>
        <canvas id="canvas" width="540" height="720"></canvas>
        <div class="controls">
          <button onclick="playAnimation()">▶ تشغيل</button>
          <button onclick="stopAnimation()">⏸ إيقاف</button>
        </div>
        <div class="info">
          <p>Frame rate: ${1000 / frameDuration} fps</p>
          <p>Total frames: ${frameBlobs.length}</p>
        </div>
      </div>
      <script>
        const frames = ${JSON.stringify(frameBlobs.map(b => URL.createObjectURL(b)))}
        let currentFrame = 0
        let animationId = null

        async function playAnimation() {
          if (animationId) return
          
          const canvas = document.getElementById('canvas')
          const ctx = canvas.getContext('2d')
          
          const playFrame = async () => {
            const img = new Image()
            img.src = frames[currentFrame]
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              currentFrame = (currentFrame + 1) % frames.length
              animationId = setTimeout(playFrame, ${frameDuration})
            }
          }
          
          await playFrame()
        }

        function stopAnimation() {
          if (animationId) {
            clearTimeout(animationId)
            animationId = null
          }
        }
      </script>
    </body>
    </html>
  `

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ── Alternative: Create video using MediaRecorder (browser support) ──

export async function generateTimelapseVideo(photos, frameDuration = 1000) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 540
    canvas.height = 720
    const ctx = canvas.getContext('2d')

    // Setup MediaRecorder
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []

    recorder.ondataavailable = e => chunks.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hamzafit-timelapse.webm'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }

    recorder.start()

    // Draw frames
    for (const photo of photos) {
      await new Promise(resolve => {
        const img = new Image()
        img.src = photo.src
        img.onload = () => {
          ctx.fillStyle = '#0a0a0a'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          const ratio = Math.min(canvas.width / img.width, canvas.height / img.height)
          const w = img.width * ratio
          const h = img.height * ratio
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2
          ctx.drawImage(img, x, y, w, h)
          
          setTimeout(resolve, frameDuration)
        }
      })
    }

    recorder.stop()
  } catch (err) {
    console.error('Video generation error:', err)
    alert('متصفحك ما يدعم فيديو timelapse. حاول الـ photo sequence بدلاً منه')
  }
}
