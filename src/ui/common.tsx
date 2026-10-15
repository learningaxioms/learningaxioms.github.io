import type { AppState } from '../engine/store'
import { skillState } from '../engine/store'
import type { Skill, UnitId } from '../engine/types'
import { SKILL, SKILLS, UNITS } from '../content'

export type Status = 'review' | 'mastered' | 'learning' | 'ready' | 'locked'

export function statusOf(app: AppState, s: Skill, now = Date.now()): Status {
  const st = skillState(app, s.id)
  if (st.mastered) return st.due !== null && st.due <= now ? 'review' : 'mastered'
  if (st.meter > 0 || st.learned) return 'learning'
  return s.prereqs.every((p) => !SKILL[p] || skillState(app, p).mastered) ? 'ready' : 'locked'
}

/** Unmet prerequisites (only ones that exist). */
export const missingPrereqs = (app: AppState, s: Skill) => s.prereqs.filter((p) => SKILL[p] && !skillState(app, p).mastered).map((p) => SKILL[p])

/** What to do next: the most recent in-progress skill, else the first ready one. */
export function nextUp(app: AppState, unit?: UnitId): Skill | null {
  const pool = unit ? UNITS.find((u) => u.id === unit)!.skills : SKILLS
  const learning = pool.filter((s) => statusOf(app, s) === 'learning').sort((a, b) => skillState(app, b.id).last - skillState(app, a.id).last)
  if (learning.length) return learning[0]
  return pool.find((s) => statusOf(app, s) === 'ready') ?? pool.find((s) => statusOf(app, s) === 'locked') ?? null
}

export function unitProgress(app: AppState, unit: UnitId) {
  const skills = UNITS.find((u) => u.id === unit)!.skills
  const mastered = skills.filter((s) => skillState(app, s.id).mastered).length
  const partial = skills.reduce((sum, s) => sum + skillState(app, s.id).meter / 100, 0)
  return { mastered, total: skills.length, frac: skills.length ? partial / skills.length : 0 }
}

export function Ring({ value, size = 44, stroke = 5, color = 'var(--ink)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children !== undefined && <span className="ring-in">{children}</span>}
    </span>
  )
}

/** The mastery meter, with the three difficulty bands marked. */
export function Meter({ value, color, bump }: { value: number; color: string; bump?: number | null }) {
  return (
    <div className="meter" style={{ ['--mc' as string]: color }}>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${value}%` }} />
        <span className="meter-tick" style={{ left: '35%' }} />
        <span className="meter-tick" style={{ left: '70%' }} />
        {bump ? (
          <span key={value} className={`meter-bump ${bump > 0 ? 'up' : 'down'}`} style={{ left: `${value}%` }}>
            {bump > 0 ? '+' : ''}
            {bump}
          </span>
        ) : null}
      </div>
      <div className="meter-labels">
        <span>Foundations</span>
        <span>Standard</span>
        <span>Challenge</span>
        <span>Mastered</span>
      </div>
    </div>
  )
}

export function unitColor(id: UnitId) {
  return UNITS.find((u) => u.id === id)!.color
}
