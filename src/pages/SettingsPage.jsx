import { useLayoutEffect, useRef, useState } from 'react'
import { ListGroup, ListRow, Num } from '../components/kit/index.jsx'
import { CalendarBlank, Repeat, Drop, Clock, Bell, Image, Export } from '../components/kit/icons.js'
import { Wrench } from '@phosphor-icons/react'
import AssetPackSection, { PACK_LABELS } from '../components/AssetPackSection.jsx'
import RestLedgerPanel from '../components/RestLedgerPanel.jsx'
import DeloadSection from '../components/DeloadSection.jsx'
import DesignSwitch from '../components/DesignSwitch.jsx'
import { usePackState } from '../assets/pack.js'
import { APP_VERSION } from '../constants.js'
import { todayKey } from '../day.js'
import { DEFAULT_REP_TARGET, repTargetOf } from '../progression.js'
import { deloadState } from '../deload.js'
import { getUsers } from '../utils.js'
import { SubPage, Saved, Ar } from './settings/parts.jsx'
import AccountSection from './settings/AccountSection.jsx'
import PlanSection from './settings/PlanSection.jsx'
import RepsSection from './settings/RepsSection.jsx'
import PreferencesSection from './settings/PreferencesSection.jsx'
import NotificationsSection, { readNotifEnabled } from './settings/NotificationsSection.jsx'
import DataSection from './settings/DataSection.jsx'

// ── Settings ──────────────────────────────────────────────────
//
// An inset-grouped root, iOS Settings style, whose rows push sub-pages
// (critique F44: twelve sections in one scroll buried the programme and
// the deload). The sub-pages are local state, not App pages: each draws
// its own back bar and App's «الإعدادات» bar steps aside while one is
// open (settings.css). `section` opens one directly — Home's deload
// chip can land on the deload page.

const TITLES = {
  account: 'الحساب والمستخدمون',
  plan:    'الخطة وعدد الأيام',
  reps:    'التكرارات',
  prefs:   'وقت التمرين ونوع الجيم',
  deload:  'الديلود',
  pack:    'حزمة الصور',
  notif:   'الإشعارات',
  data:    'البيانات والنسخ الاحتياطي',
  advanced: 'متقدم',
}
// The back bar has room for a short name only.
const BAR_TITLES = { ...TITLES, account: 'الحساب', plan: 'الخطة', prefs: 'الوقت والجيم', data: 'البيانات' }

export default function SettingsPage({
  profile, onUpdateProfile, sessions, xp, unlockedAchievements, challengeState, photos,
  onImport, plan, onImportPlan, onClearPlan, exerciseMapping = {}, onImportMapping,
  recoveryCfg = {}, onUpdateRecovery, recovery = {}, changeCooldownLeft = 0, currentStreak = 0,
  repTarget = DEFAULT_REP_TARGET, onUpdateRepTarget, today = todayKey(), onStartDeload, onEndDeload,
  section: initialSection = null,
}) {
  const [section, setSection] = useState(TITLES[initialSection] ? initialSection : null)
  const [came, setCame] = useState(null)   // 'push' | 'pop', for the slide direction
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef(null)
  const rootScroll = useRef(0)
  const pack = usePackState()

  const update = (key, val) => {
    onUpdateProfile({ ...profile, [key]: val })
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const open = (id) => { rootScroll.current = window.scrollY; setCame('push'); setSection(id) }
  const back = () => { setCame('pop'); setSection(null) }

  // A sub-page opens at its top; back lands where the root was left.
  useLayoutEffect(() => {
    if (!came) return
    window.scrollTo(0, section ? 0 : rootScroll.current)
  }, [section]) // eslint-disable-line react-hooks/exhaustive-deps

  if (section) {
    const body = {
      account: <AccountSection profile={profile} update={update} />,
      plan: (
        <PlanSection recoveryCfg={recoveryCfg} onUpdateRecovery={onUpdateRecovery}
          changeCooldownLeft={changeCooldownLeft} currentStreak={currentStreak}
          plan={plan} onImportPlan={onImportPlan} onClearPlan={onClearPlan}
          onImportMapping={onImportMapping} onImport={onImport} />
      ),
      reps: <RepsSection repTarget={repTarget} onUpdateRepTarget={onUpdateRepTarget} />,
      prefs: <PreferencesSection profile={profile} update={update} />,
      deload: <DeloadSection recoveryCfg={recoveryCfg} today={today} onStart={onStartDeload} onEnd={onEndDeload} />,
      pack: <AssetPackSection />,
      notif: <NotificationsSection profile={profile} />,
      data: (
        <DataSection sessions={sessions} xp={xp} profile={profile}
          unlockedAchievements={unlockedAchievements} challengeState={challengeState} photos={photos}
          exerciseMapping={exerciseMapping} onImport={onImport} onImportMapping={onImportMapping} />
      ),
      advanced: <RestLedgerPanel recovery={recovery} />,
    }[section]
    return (
      <div className="st" data-sub={section}>
        <SubPage title={BAR_TITLES[section]} onBack={back} actions={<Saved show={saved} />}>
          {body}
        </SubPage>
      </div>
    )
  }

  // ── Root ──
  const users = getUsers()
  const freq = recoveryCfg.daysPerWeek
  const daysLabel = freq === 'custom' ? 'أيام مخصصة' : freq ? `${freq} أيام` : null
  const reps = repTargetOf(repTarget)
  const deload = deloadState(recoveryCfg, today)
  const packLabel = (PACK_LABELS[pack.phase] || PACK_LABELS.unknown).text

  return (
    <div className={came === 'pop' ? 'st st-pop' : 'st'}>
      {/* ── Design: new or the old one, same data ─────────── */}
      <div className="st-design">
        <DesignSwitch isNew={true} />
      </div>

      <ListGroup>
        <ListRow chevron onClick={() => open('account')}
          leading={<span className="st-avatar" aria-hidden="true">{(profile?.name || '؟')[0]}</span>}
          title={profile?.name || 'أضف اسمك'}
          subtitle={users.length > 1 ? <>{TITLES.account} · <Num>{users.length}</Num></> : TITLES.account} />
      </ListGroup>

      <ListGroup header="التدريب">
        <ListRow leading={CalendarBlank} title={TITLES.plan} chevron onClick={() => open('plan')}
          subtitle={<Ar>{[plan?.planName, daysLabel].filter(Boolean).join(' · ')}</Ar>} />
        <ListRow leading={Repeat} title={TITLES.reps} chevron onClick={() => open('reps')}
          trailing={<Num>{`${reps.base}–${reps.top}`}</Num>} />
        <ListRow leading={Drop} title={TITLES.deload} chevron onClick={() => open('deload')}
          trailing={deload.active ? <Ar>{`اليوم ${deload.day} من ${deload.totalDays}`}</Ar> : null} />
        <ListRow leading={Clock} title={TITLES.prefs} chevron onClick={() => open('prefs')}
          trailing={profile?.workoutTime ? <span className="st-row-value">{profile.workoutTime}</span> : null} />
      </ListGroup>

      <ListGroup header="التطبيق">
        <ListRow leading={Bell} title={TITLES.notif} chevron onClick={() => open('notif')}
          trailing={readNotifEnabled() ? 'شغّالة' : 'مطفّية'} />
        <ListRow leading={Image} title={TITLES.pack} chevron onClick={() => open('pack')}
          trailing={<span className="st-row-value">{packLabel}</span>} />
      </ListGroup>

      <ListGroup header="البيانات">
        <ListRow leading={Export} title={TITLES.data} chevron onClick={() => open('data')} />
        <ListRow leading={Wrench} title={TITLES.advanced} subtitle="سجل الراحة" chevron onClick={() => open('advanced')} />
      </ListGroup>

      <p className="st-version">مران · الإصدار <Num>{APP_VERSION}</Num></p>
    </div>
  )
}
