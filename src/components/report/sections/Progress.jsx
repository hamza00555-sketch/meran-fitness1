// ── Chapter 05: where it left you ─────────────────────────────
// The level and rank at the end of the month, and the achievements that
// actually unlocked inside it — read from unlockedAt, so it is the month
// they were earned in and not merely the ones held. No rank colours and
// no rarity colours: those hues mean nothing in a system where colour
// is state. A medal without the pack's artwork shows its category's
// bundled art, never an emoji.

import Art from '../../../assets/Art.jsx'
import { achSlot } from '../../../assets/slots.js'
import { ACHIEVEMENTS } from '../../../constants.js'
import { Num } from '../../kit/index.jsx'
import { Chapter, Bidi } from '../parts.jsx'

const MAX_SHOWN = 9

const webp = (src) => (src ? src.replace(/\.png$/, '.webp') : null)

// Without the pack, a medal is the bundled art for its category — the
// same pictures the achievements page uses — never an emoji.
const CAT_ART = { sessions: 'ach_consistency', streak: 'ach_consistency', strength: 'ach_strength', volume: 'ach_volume' }
const catArt = (id) => {
  const a = ACHIEVEMENTS.find(x => x.id === id)
  const name = a && (a.rarity === 'legendary' || a.rarity === 'epic') ? 'ach_master' : CAT_ART[a?.cat] || 'ach_consistency'
  return `/assets/${name}.webp`
}

export default function Progress({ report, n = 5, id = 'rp-progress' }) {
  const { level, rank, achievements } = report.progress
  const shown = achievements.slice(0, MAX_SHOWN)

  return (
    <Chapter id={id} n={n} title="التقدم" note="مستواك ورتبتك آخر الشهر.">
      <div className="rp-rank rp-in" style={{ '--i': 1 }}>
        {rank?.img && (
          <img className="rp-rank-art" src={webp(rank.img)} alt="" width="72" height="72"
               onError={(e) => { if (!e.currentTarget.dataset.png) { e.currentTarget.dataset.png = '1'; e.currentTarget.src = rank.img } }} />
        )}
        <div className="rp-rank-text">
          <strong>المستوى <Num>{level}</Num></strong>
          <span>الرتبة: {rank?.label || 'مبتدئ'}</span>
        </div>
      </div>

      {achievements.length > 0 ? (
        <div className="rp-block rp-in" style={{ '--i': 2 }}>
          <span className="rp-eyebrow">
            {achievements.length === 1
              ? 'إنجاز فتحته هالشهر'
              : <><Num>{achievements.length}</Num> {achievements.length <= 10 ? 'إنجازات' : 'إنجاز'} فتحتها هالشهر</>}
          </span>
          <ul className="rp-medals">
            {shown.map(a => (
              <li key={a.id} className="rp-medal">
                <span className="rp-medal-art">
                  <Art id={achSlot(a.id)} size={48} alt=""
                       fallback={<img src={catArt(a.id)} alt="" width="48" height="48" loading="lazy" />} />
                </span>
                <span className="rp-medal-t"><Bidi text={a.title} /></span>
                <span className="rp-medal-xp"><Num>+{a.xp} XP</Num></span>
              </li>
            ))}
          </ul>
          {achievements.length > MAX_SHOWN && (
            <p className="rp-caption">و<Num>{achievements.length - MAX_SHOWN}</Num> غيرها — كلها في صفحة الإنجازات.</p>
          )}
        </div>
      ) : (
        <p className="rp-caption rp-in" style={{ '--i': 2 }}>
          ما انفتح إنجاز جديد هالشهر — الإنجازات الجاية تبي وقت أطول شوي.
        </p>
      )}
    </Chapter>
  )
}
