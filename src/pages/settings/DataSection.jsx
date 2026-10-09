// ── Settings › البيانات والنسخ الاحتياطي ──────────────────────
// Everything lives in this phone's storage, so the backup has to work
// where the owner is: an installed PWA on iOS, which ignores <a
// download>. The share sheet comes first («حفظ في الملفات»), a download
// where one works, and the clipboard as the last rung. Failures are said
// in the page, in plain Arabic — never a browser alert (critique F64).
//
// The file is the same backup exportAllData writes (version 2.1, the
// same keys), so old and new backups restore into either design.

import { useRef, useState } from 'react'
import { ListGroup, ListRow, ConfirmSheet } from '../../components/kit/index.jsx'
import { Export, DownloadSimple, ArrowCounterClockwise, Trash, CheckCircle, Warning } from '../../components/kit/icons.js'
import { MapTrifold } from '@phosphor-icons/react'
import { Notice, Ar } from './parts.jsx'
import { exportAllData, importAllData, ls, PER_USER_KEYS } from '../../utils.js'
import { canShareFiles, supportsDownload } from '../../reportPoster.js'
import { todayKey } from '../../day.js'

const backupJson = ({ sessions, xp, profile, unlockedAchievements, challengeState, photos }) => JSON.stringify({
  version: '2.1',
  exportDate: new Date().toISOString(),
  sessions, xp, profile, unlockedAchievements, challengeState, photos,
  recovery: ls.get('hf_recovery', null),
})

const looksLikeBackup = (d) => d && typeof d === 'object' &&
  (d.sessions !== undefined || d.xp !== undefined || d.profile || d.type === 'exercise_mapping')

export default function DataSection({
  sessions, xp, profile, unlockedAchievements, challengeState, photos,
  exerciseMapping = {}, onImport, onImportMapping,
}) {
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(null)        // 'backup' | 'restore' | 'mapping'
  const [confirm, setConfirm] = useState(null)  // 'weights' | 'wipe'
  const importRef = useRef(null)
  const mappingRef = useRef(null)

  const ok = (text) => setNotice({ tone: 'accent', icon: CheckCircle, text })
  const fail = (text) => setNotice({ tone: 'danger', icon: Warning, text })

  const handleBackup = async () => {
    setNotice(null)
    setBusy('backup')
    const all = { sessions, xp, profile, unlockedAchievements, challengeState, photos }
    const json = backupJson(all)
    const name = `meran-backup-${todayKey()}.json`
    try {
      // 1. The share sheet — «حفظ في الملفات» on iOS.
      if (typeof File === 'function') {
        for (const type of ['application/json', 'text/plain']) {
          const file = new File([json], name, { type })
          if (!canShareFiles(file)) continue
          try {
            await navigator.share({ files: [file], title: 'نسخة مران' })
            ok('انحفظت النسخة.')
            return
          } catch (err) {
            if (err?.name === 'AbortError') return
          }
        }
      }
      // 2. A download, where the browser honours one.
      if (supportsDownload()) {
        exportAllData(sessions, xp, profile, unlockedAchievements, challengeState, photos)
        ok('نزّلنا ملف النسخة — تلقاه في التنزيلات.')
        return
      }
      // 3. The clipboard.
      await navigator.clipboard.writeText(json)
      ok('نسخنا النسخة — الصقها في الملاحظات أو أرسلها لنفسك.')
    } catch {
      fail('ما قدرنا نحفظ النسخة على هذا الجهاز.')
    } finally {
      setBusy(null)
    }
  }

  const readFile = async (e, kind) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNotice(null)
    setBusy(kind)
    try {
      const data = await importAllData(file)
      if (kind === 'mapping') {
        if (data?.type === 'exercise_mapping' && data.mapping) onImportMapping?.(data.mapping)
        else fail('هذا الملف مو خريطة تمارين من مران.')
      } else if (looksLikeBackup(data)) {
        onImport?.(data)
      } else {
        fail('هذا الملف مو نسخة من مران.')
      }
    } catch {
      fail(kind === 'mapping' ? 'ما قدرنا نقرأ ملف الخريطة.' : 'ما قدرنا نقرأ الملف — تأكد إنه نسخة من مران.')
    } finally {
      setBusy(null)
      e.target.value = ''
    }
  }

  const handleResetWeights = () => {
    ls.remove('hf_last_weights')
    ls.remove('hf_weight_backups')
    ls.set('hf_weights_reset_at', Date.now())
    window.location.reload()
  }

  const handleReset = () => {
    // ls.remove is user-namespaced — clears only the active user's data
    PER_USER_KEYS.forEach(k => ls.remove(k))
    window.location.reload()
  }

  const mapped = Object.keys(exerciseMapping).length

  return (
    <>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <ListGroup header="النسخ الاحتياطي" footer="بياناتك محفوظة على هذا الجوال بس. احفظ نسخة كل شهر في الملفات.">
        <ListRow leading={Export} title={busy === 'backup' ? 'نجهّز النسخة…' : 'احفظ نسخة'}
          subtitle="الجلسات والصور والإنجازات في ملف واحد" onClick={handleBackup} />
        <ListRow leading={DownloadSimple} title={busy === 'restore' ? 'نسترجع…' : 'استرجع من نسخة'}
          subtitle="ملف نسخة حفظته قبل" onClick={() => importRef.current?.click()} />
      </ListGroup>

      <ListGroup header="خريطة التمارين">
        <ListRow leading={MapTrifold} title={busy === 'mapping' ? 'نحدّث…' : 'استيراد خريطة التمارين'}
          subtitle={<Ar>{`${mapped} تمرين موحّد الحين`}</Ar>}
          onClick={() => mappingRef.current?.click()} />
      </ListGroup>

      <ListGroup header="البداية من جديد">
        <ListRow leading={ArrowCounterClockwise} title="صفّر الأوزان المقترحة"
          subtitle="سجل جلساتك وإنجازاتك ما يتأثر" onClick={() => setConfirm('weights')} />
        <ListRow leading={Trash} title="امسح كل البيانات" className="st-danger"
          subtitle="كل الجلسات والإنجازات والنقاط" onClick={() => setConfirm('wipe')} />
      </ListGroup>

      <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={e => readFile(e, 'restore')} />
      <input ref={mappingRef} type="file" accept=".json,application/json" hidden onChange={e => readFile(e, 'mapping')} />

      <ConfirmSheet open={confirm === 'weights'} onClose={() => setConfirm(null)} destructive
        title="تصفّر الأوزان المقترحة؟"
        message="التطبيق ينسى الأوزان اللي يقترحها لك ويبدأ يتعلمها من جلساتك الجاية."
        confirmLabel="صفّر الأوزان" onConfirm={handleResetWeights} />
      <ConfirmSheet open={confirm === 'wipe'} onClose={() => setConfirm(null)} destructive
        title="تمسح كل البيانات؟"
        message="تنحذف كل الجلسات والإنجازات والنقاط من هذا الجوال، وما ترجع. احفظ نسخة قبل لو تبي."
        confirmLabel="امسح الكل" onConfirm={handleReset} />
    </>
  )
}
