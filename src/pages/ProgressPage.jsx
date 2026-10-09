import { useState } from 'react'
import { Segmented } from '../components/kit/index.jsx'
import AchievementsPage from './AchievementsPage.jsx'
import PhotosPage from './PhotosPage.jsx'

// ── التقدم ────────────────────────────────────────────────────
// Progress in one tab: the achievements and rank, the photos, and the
// numbers. It replaces a tab spent on badges alone.

export default function ProgressPage({ achievements, photos }) {
  const [view, setView] = useState('achievements')
  return (
    <div>
      <Segmented
        label="التقدم"
        value={view}
        onChange={setView}
        options={[
          { value: 'achievements', label: 'الإنجازات' },
          { value: 'photos', label: 'الصور' },
        ]}
        className="f-progress-seg"
      />
      {view === 'achievements' && <AchievementsPage {...achievements} />}
      {view === 'photos' && <PhotosPage {...photos} embedded />}
    </div>
  )
}
