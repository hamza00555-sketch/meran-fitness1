// ── Settings › حزمة الصور ─────────────────────────────────
// Download, update, retry and remove the external art pack. The
// data-pack hooks are what tests/pack.e2e.mjs drives; keep them.

import { useState } from 'react'
import { ListGroup, ListRow, Button, Gauge, Banner, Sheet, Num } from './kit/index.jsx'
import { Image, Warning, Info } from './kit/icons.js'
import { usePackState, installPack, deletePack, cancelInstall } from '../assets/pack.js'
import { ALL_SLOT_IDS } from '../assets/slots.js'
import { getUsers } from '../utils.js'
import { Ar } from '../pages/settings/parts.jsx'

const mb = (bytes) => (bytes / 1048576).toFixed(1)

export const PACK_LABELS = {
  unknown:     { text: 'نتأكد…',              tone: 'ink' },
  checking:    { text: 'ندوّر على تحديث…',     tone: 'ink' },
  idle:        { text: 'مو منزّلة',            tone: 'ink' },
  downloading: { text: 'تتنزّل…',              tone: 'accent' },
  verifying:   { text: 'نتحقق منها…',          tone: 'accent' },
  ready:       { text: 'منزّلة',               tone: 'accent' },
  error:       { text: 'ما اكتمل التنزيل',     tone: 'danger' },
  offline:     { text: 'ما فيه اتصال',          tone: 'danger' },
  nospace:     { text: 'المساحة ما تكفي',      tone: 'danger' },
  unsupported: { text: 'المتصفح ما يدعمها',    tone: 'ink' },
}

const FAIL_REASON = {
  hash:    'ملف خربان',
  http:    'الملف مو موجود على الخادم',
  network: 'انقطع النت',
  decode:  'ما قدرنا نفتح الصورة',
}

export default function AssetPackSection() {
  const state = usePackState()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const busy = state.phase === 'downloading' || state.phase === 'checking' || state.phase === 'verifying'
  const label = PACK_LABELS[state.phase] || PACK_LABELS.unknown
  const total = state.filesTotal || ALL_SLOT_IDS.length
  const pct = total ? Math.round((state.filesDone / total) * 100) : 0
  const multiUser = getUsers().length > 1
  const failed = state.failed || []
  const canDelete = (state.phase === 'ready' || state.phase === 'error' || state.phase === 'offline') && !busy && state.filesDone > 0
  const ready = state.phase === 'ready'

  const installLabel = ready ? 'دوّر على تحديث'
    : (state.phase === 'error' || state.phase === 'offline') ? 'حاول مرة ثانية'
    : state.remoteBytes > 0 ? <Ar>{`نزّل الحزمة · ${mb(state.remoteBytes)} ميجا تقريباً`}</Ar>
    : 'نزّل الحزمة'

  return (
    <>
      <ListGroup footer="صور التمارين وحركاتها والجوائز والاحتفالات. تتنزّل مرة وحدة وتشتغل بدون نت.">
        <ListRow leading={Image} title="صور مران"
          trailing={<span className="ap-phase" data-pack-phase={state.phase} data-tone={label.tone}>{label.text}</span>} />
        {busy && (
          <div className="ap-progress">
            <Gauge value={state.filesDone} max={total} tone="accent" label="تقدم التنزيل" />
            <div className="ap-progress-meta">
              <span><Num>{state.filesDone}</Num> من <Num>{total}</Num></span>
              <span><Num>{`${pct}%`}</Num>{state.bytesDone > 0 && <> · <Num>{mb(state.bytesDone)}</Num> ميجا</>}</span>
            </div>
          </div>
        )}
        {ready && <ListRow title="عدد الصور" trailing={<Num>{state.filesDone}</Num>} />}
        {ready && state.packVersion && <ListRow title="الإصدار" trailing={<Num>{`v${state.packVersion}`}</Num>} />}
      </ListGroup>

      {/* crypto.subtle is missing outside a secure context — LAN
          testing over plain HTTP. Say so rather than implying the
          files were hash-checked when they weren't. */}
      {state.verified === false && ready && (
        <Banner tone="neutral" icon={Info} className="st-notice">
          <Ar>{'تأكدنا من الحجم بس. التحقق الكامل يحتاج اتصال آمن (HTTPS).'}</Ar>
        </Banner>
      )}

      {(state.phase === 'error' || state.phase === 'nospace' || state.phase === 'offline') && (
        <Banner tone="danger" icon={Warning} className="st-notice"
          title={state.phase === 'offline' ? 'ما فيه اتصال بالنت'
            : state.phase === 'nospace' ? 'المساحة على الجوال ما تكفي'
            : failed.length === 0 ? 'ما وصلنا لخادم الصور'
            : <Ar>{`ما تنزّلت ${failed.length} من ${total} صورة`}</Ar>}>
          {state.phase === 'nospace' ? 'فضّي شوي مساحة وحاول مرة ثانية.'
            : state.phase === 'error' && failed.length === 0
              // Nothing individually failed, so the manifest itself
              // never arrived — a different problem, and a different fix.
              ? 'حاول مرة ثانية بعد شوي.'
              : <>
                  {state.phase === 'error' && <>السبب: {FAIL_REASON[failed[0]?.reason] || 'خطأ ما نعرفه'}. </>}
                  اللي تنزّل محفوظ، والمحاولة الثانية تكمّل الناقص بس.
                </>}
        </Banner>
      )}

      <div className="st-actions">
        {busy ? (
          <Button data-pack="cancel" variant="secondary" size="lg" full onClick={cancelInstall}>وقّف التنزيل</Button>
        ) : (
          <Button data-pack="install" variant={ready ? 'secondary' : 'primary'} size="lg" full
            onClick={installPack} disabled={state.phase === 'unsupported'}>
            {installLabel}
          </Button>
        )}
        {canDelete && (
          <Button data-pack="delete" variant="destructive" full onClick={() => setConfirmDelete(true)}>حذف الحزمة</Button>
        )}
      </div>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="حذف حزمة الصور؟"
        footer={(
          <div className="k-confirm-actions">
            <Button data-pack="delete-confirm" variant="destructive-fill" size="lg" full
              onClick={() => { deletePack(); setConfirmDelete(false) }}>احذف</Button>
            <Button data-pack="delete-cancel" variant="secondary" size="lg" full autoFocus
              onClick={() => setConfirmDelete(false)}>رجوع</Button>
          </div>
        )}>
        <p className="k-confirm-msg">ترجع الرموز العادية، وتحتاج نت عشان تنزّلها مرة ثانية.</p>
        {multiUser && (
          <p className="k-confirm-msg" style={{ marginTop: 8 }}>الحزمة مشتركة بين كل المستخدمين على هذا الجوال، والحذف يشملهم كلهم.</p>
        )}
      </Sheet>
    </>
  )
}
