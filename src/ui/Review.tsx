import { useMemo, useState } from 'react'
import { dueSkills, recordReview, recordPractice, getApp, skillState } from '../engine/store'
import { makeRng } from '../engine/rng'
import { SKILL, SKILLS } from '../content'
import { ProblemCard, type Outcome } from './ProblemCard'
import { unitColor } from './common'
import type { Skill } from '../engine/types'

// Spaced, *interleaved* review: due skills are mixed together so you have to recognise
// which method a problem needs — the part of a test that block practice never trains.

export function Review() {
  // freeze the queue when the session starts
  const [queue] = useState<{ skill: Skill; kind: 'due' | 'mixed' }[]>(() => {
    const due = dueSkills(getApp()).map((id) => SKILL[id]).filter(Boolean)
    if (due.length) return makeRng().shuffle(due).map((s) => ({ skill: s, kind: 'due' as const }))
    // nothing due: interleaved mix of skills in progress or mastered
    const pool = SKILLS.filter((s) => {
      const st = skillState(getApp(), s.id)
      return st.mastered || st.meter >= 35
    })
    const rng = makeRng()
    return rng
      .shuffle(pool)
      .slice(0, 8)
      .map((s) => ({ skill: s, kind: 'mixed' as const }))
  })
  const [i, setI] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const item = queue[i]
  const problem = useMemo(() => (item ? item.skill.generate(makeRng(), skillState(getApp(), item.skill.id).mastered ? 3 : 2) : null), [item])

  if (!queue.length)
    return (
      <div className="review-page empty">
        <h1>Nothing to review yet</h1>
        <p>Skills you master come back here on a schedule — 1 day, 3 days, a week, two weeks… — right before you’d forget them. Go master your first skill.</p>
        <a className="btn primary" href="#/">
          Back to the plan
        </a>
      </div>
    )

  if (!item) {
    const right = results.filter(Boolean).length
    return (
      <div className="review-page empty">
        <h1>
          Review done: {right}/{results.length}
        </h1>
        <p>
          {right === results.length
            ? 'Everything held. Those skills now wait longer before coming back.'
            : 'The ones you missed dropped back to practice — a few quick problems will lock them in again.'}
        </p>
        <ul className="review-list">
          {queue.map((q, k) => (
            <li key={k} className={results[k] ? 'ok' : 'no'}>
              <a href={`#/skill/${q.skill.id}`}>
                {results[k] ? '✓' : '✗'} {q.skill.title}
              </a>
            </li>
          ))}
        </ul>
        <a className="btn primary" href="#/">
          Back to the plan
        </a>
      </div>
    )
  }

  const done = (o: Outcome) => {
    const ok = o.correct && !o.gaveUp && o.hints <= 1
    if (item.kind === 'due') recordReview(item.skill.id, ok)
    else recordPractice(item.skill.id, o)
    setResults([...results, ok])
    setI(i + 1)
  }

  return (
    <div className="review-page">
      <header className="review-head">
        <p className="eyebrow">{item.kind === 'due' ? 'Spaced review' : 'Mixed practice'} · {i + 1} of {queue.length}</p>
        <div className="review-bar">
          {queue.map((_, k) => (
            <span key={k} className={k < i ? (results[k] ? 'ok' : 'no') : k === i ? 'now' : ''} />
          ))}
        </div>
        <p className="review-help">Problems are mixed on purpose — part of the skill is recognising which method to use.</p>
      </header>
      {problem && (
        <ProblemCard
          key={i}
          problem={problem}
          mode="review"
          onDone={done}
          accent={unitColor(item.skill.unit)}
          label={<span className="plabel">{item.skill.title}</span>}
        />
      )}
    </div>
  )
}
