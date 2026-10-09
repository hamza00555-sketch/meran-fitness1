// ── Settings › الإشعارات ──────────────────────────────────────
// Two reminders, both decided by the streak (src/notify.js): the
// workout hour on a day still owed, and one warning before the streak
// can break. The copy promises no more than the page timers deliver.

import { useState } from 'react'
import { ListGroup, ListRow, Banner, Num } from '../../components/kit/index.jsx'
import { Bell, Barbell, Flame, Warning, Info } from '../../components/kit/icons.js'
import { SwitchControl, Ar } from './parts.jsx'
import { requestNotifPermission, scheduleNotificationsForToday } from '../../utils.js'
import { NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS } from '../../constants.js'
import { hourLabel } from './PreferencesSection.jsx'

export const readNotifEnabled = () => {
  try { return localStorage.getItem('hf_notif_enabled') === 'true' } catch { return false }
}

export default function NotificationsSection({ profile }) {
  const [enabled, setEnabled] = useState(readNotifEnabled)
  const [status, setStatus] = useState(() => (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported')

  const toggle = async () => {
    if (enabled) {
      try {
        localStorage.setItem('hf_notif_enabled', 'false')
        localStorage.removeItem('hf_notif_scheduled')
      } catch { /* storage blocked */ }
      setEnabled(false)
      return
    }
    const s = await requestNotifPermission()
    setStatus(s)
    if (s === 'granted') {
      try {
        localStorage.setItem('hf_notif_enabled', 'true')
        localStorage.removeItem('hf_notif_scheduled')
      } catch { /* storage blocked */ }
      setEnabled(true)
      scheduleNotificationsForToday(profile?.workoutTime || 'المساء', NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS)
    }
  }

  return (
    <>
      <ListGroup footer="بأيام التمرين بس، وما يوصلك شي لو تمرّنت.">
        <ListRow leading={Bell} title="التذكيرات"
          trailing={<SwitchControl checked={enabled} onChange={toggle} label="التذكيرات" disabled={status === 'unsupported'} />} />
      </ListGroup>

      {status === 'denied' && (
        <Banner tone="danger" icon={Warning} title="الإشعارات مقفلة من الجوال" className="st-notice">
          افتح إعدادات الجوال وعطِ مران إذن الإشعارات، وبعدين شغّلها من هنا.
        </Banner>
      )}
      {status === 'unsupported' && (
        <Banner tone="neutral" icon={Info} title="متصفحك ما يدعم الإشعارات" className="st-notice">
          ثبّت مران على الشاشة الرئيسية أول، وبعدها تقدر تشغّلها.
        </Banner>
      )}

      {enabled && (
        <ListGroup header="وش يوصلك" footer="التذكير يوصلك والتطبيق شغّال أو بالخلفية.">
          <ListRow leading={Barbell} title="وقت التمرين" subtitle="لو اليوم يوم تمرين وما تمرّنت للحين"
            trailing={<Num>{hourLabel(profile?.workoutTime || 'المساء')}</Num>} />
          <ListRow leading={Flame} title="الستريك بخطر"
            subtitle={<Ar>{'23:00 لو ما عندك تذاكر، و1:00 قبل لا تنصرف تذكرة'}</Ar>} />
        </ListGroup>
      )}
    </>
  )
}
