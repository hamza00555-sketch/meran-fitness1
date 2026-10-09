import { useState } from 'react'
import { Segmented } from '../components/kit/index.jsx'
import StatsPage from './StatsPage.jsx'
import AchievementsPage from './AchievementsPage.jsx'
import PhotosPage from './PhotosPage.jsx'

// ── التقدم ────────────────────────────────────────────────────
// Progress in one tab: the numbers (is the volume going up, how often
// did I train), the achievements and rank, and the photos. App draws the
// large title «التقدم» above; this is the control under it and the view.
//
// The chosen view is remembered for as long as the app is open, so going
// to Home and back does not reset it — and nothing new is written to
// storage for it.

let lastView = 'achievements'

export default function ProgressPage({ achievements = {}, photos = {}, numbers, initialView }) {
  const [view, setViewState] = useState(initialView || lastView)
  const setView = (v) => { lastView = v; setViewState(v) }
  const numberProps = numbers || { sessions: achievements.sessions || [] }

  return (
    <div className="pv">
      <Segmented
        label="التقدم"
        value={view}
        onChange={setView}
        options={[
          { value: 'numbers', label: 'الأرقام' },
          { value: 'achievements', label: 'الإنجازات' },
          { value: 'photos', label: 'الصور' },
        ]}
        className="f-progress-seg"
      />
      <div className="pv-view" key={view}>
        {view === 'numbers' && <StatsPage {...numberProps} />}
        {view === 'achievements' && <AchievementsPage {...achievements} />}
        {view === 'photos' && <PhotosPage {...photos} embedded />}
      </div>
    </div>
  )
}
