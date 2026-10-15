import { useApp, skillState } from '../engine/store'
import type { UnitId } from '../engine/types'
import { unitOf, SKILL } from '../content'
import { statusOf, unitProgress, nextUp, Ring } from './common'

const LABEL = { review: 'Review due', mastered: 'Mastered', learning: 'In progress', ready: 'Ready', locked: 'Needs earlier skills' } as const

export function UnitMap({ unitId }: { unitId: UnitId }) {
  const app = useApp()
  const unit = unitOf(unitId)
  const pr = unitProgress(app, unitId)
  const next = nextUp(app, unitId)
  const placed = app.placementDone.includes(unitId)

  if (!unit.skills.length)
    return (
      <div className="unitmap" style={{ ['--uc' as string]: unit.color }}>
        <h1 className="unit-title">{unit.title}</h1>
        <p>This unit is being written. Check back soon.</p>
      </div>
    )

  return (
    <div className="unitmap" style={{ ['--uc' as string]: unit.color }}>
      <header className="unit-head">
        <div>
          <p className="eyebrow">Unit · {unit.skills.length} skills</p>
          <h1 className="unit-title">{unit.title}</h1>
          <p className="unit-tag">{unit.tagline}</p>
        </div>
        <div className="unit-head-side">
          <Ring value={pr.frac} size={88} stroke={8} color={unit.color}>
            <span className="ring-big">{Math.round(pr.frac * 100)}%</span>
          </Ring>
          <div className="unit-head-actions">
            {next && (
              <a className="btn primary" href={`#/skill/${next.id}`}>
                {skillState(app, next.id).meter > 0 ? 'Continue' : 'Start'}: {next.title}
              </a>
            )}
            {!placed && (
              <a className="btn ghost" href={`#/place/${unitId}`}>
                Test out of what I know
              </a>
            )}
          </div>
        </div>
      </header>

      <ol className="route">
        {unit.skills.map((s, i) => {
          const status = statusOf(app, s)
          const st = skillState(app, s.id)
          const outside = s.prereqs.filter((p) => SKILL[p] && SKILL[p].unit !== unitId && !skillState(app, p).mastered)
          return (
            <li key={s.id} className={`stop ${status} ${next?.id === s.id ? 'is-next' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
              <a href={`#/skill/${s.id}`}>
                <span className="node">
                  <Ring value={st.mastered ? 1 : st.meter / 100} size={46} stroke={4} color={unit.color}>
                    {st.mastered ? <span className="node-star">★</span> : <span className="node-n">{i + 1}</span>}
                  </Ring>
                </span>
                <span className="stop-body">
                  <span className="stop-title">{s.title}</span>
                  <span className="stop-blurb">{s.blurb}</span>
                  {outside.length > 0 && <span className="stop-pre">builds on: {outside.map((p) => SKILL[p].title).join(', ')}</span>}
                </span>
                <span className={`badge ${status}`}>{next?.id === s.id && status !== 'review' ? 'Up next' : LABEL[status]}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
