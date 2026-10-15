import { useEffect, useMemo, useState } from 'react'
import { placeSkill, finishPlacement } from '../engine/store'
import { makeRng } from '../engine/rng'
import { unitOf } from '../content'
import type { UnitId } from '../engine/types'
import { ProblemCard, type Outcome } from './ProblemCard'

// Adaptive placement: binary search over the unit's skill sequence.
// Pass a probe (2 problems) → you're credited with it and everything before it; aim higher.
// Miss → aim lower. ~4 probes covers a 10–11 skill unit.

export function Placement({ unitId }: { unitId: UnitId }) {
  const unit = unitOf(unitId)
  const n = unit.skills.length
  const [lo, setLo] = useState(0)
  const [hi, setHi] = useState(n - 1)
  const [credited, setCredited] = useState(-1)
  const [sub, setSub] = useState(0) // which of the 2 probe problems
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const mid = Math.floor((lo + hi) / 2)
  const finished = lo > hi || n === 0
  const skill = unit.skills[mid]
  const problem = useMemo(() => (skill && !finished ? skill.generate(makeRng(), 2) : null), [skill, sub, count, finished])
  useEffect(() => {
    if (finished && started) finishPlacement(unitId)
  }, [finished, started, unitId])

  if (!started)
    return (
      <div className="place intro" style={{ ['--uc' as string]: unit.color }}>
        <p className="eyebrow">Placement · {unit.title}</p>
        <h1>Skip what you already know.</h1>
        <p>
          About 6–8 questions. They adapt: get one right and the next jumps ahead; miss one and it steps back. No hints, no penalty — “I don’t know this yet” is a perfectly good answer.
        </p>
        <p className="side-note">Skills you test out of still come back for a quick review in 2 days, just to make sure.</p>
        <button className="btn primary big" onClick={() => setStarted(true)}>
          Start placement
        </button>
      </div>
    )

  if (finished) {
    const placed = unit.skills.slice(0, credited + 1)
    const next = unit.skills[credited + 1]
    return (
      <div className="place intro" style={{ ['--uc' as string]: unit.color }}>
        <p className="eyebrow">Placement complete</p>
        <h1>{placed.length ? `You tested out of ${placed.length} skill${placed.length > 1 ? 's' : ''}.` : 'Let’s start from the beginning.'}</h1>
        {placed.length > 0 && (
          <ul className="placed">
            {placed.map((s) => (
              <li key={s.id}>★ {s.title}</li>
            ))}
          </ul>
        )}
        {next ? (
          <a className="btn primary big" href={`#/skill/${next.id}`}>
            Start: {next.title} →
          </a>
        ) : (
          <a className="btn primary big" href="#/review">
            You know this whole unit — try mixed practice →
          </a>
        )}
      </div>
    )
  }

  const done = (o: Outcome) => {
    const ok = o.correct && !o.gaveUp
    setCount(count + 1)
    if (!ok) {
      setHi(mid - 1)
      setSub(0)
    } else if (sub === 0) setSub(1)
    else {
      for (let k = credited + 1; k <= mid; k++) placeSkill(unit.skills[k].id)
      setCredited(Math.max(credited, mid))
      setLo(mid + 1)
      setSub(0)
    }
  }

  return (
    <div className="place" style={{ ['--uc' as string]: unit.color }}>
      <header className="review-head">
        <p className="eyebrow">Placement · {unit.title} · question {count + 1}</p>
        <div className="place-range">
          {unit.skills.map((s, k) => (
            <span key={s.id} title={s.title} className={k <= credited ? 'ok' : k === mid ? 'now' : k < lo || k > hi ? 'out' : ''} />
          ))}
        </div>
      </header>
      {problem && <ProblemCard key={count} problem={problem} mode="test" onDone={done} accent={unit.color} label={<span className="plabel">{skill.title}</span>} />}
    </div>
  )
}
