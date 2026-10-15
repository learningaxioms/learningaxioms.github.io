import { useMemo, useState } from 'react'
import type { Card, Problem, Skill } from '../engine/types'
import { useApp, skillState, markLearned, recordPractice, levelFor, type PracticeResult } from '../engine/store'
import { makeRng } from '../engine/rng'
import { Rich, Tex } from '../widgets/Rich'
import { Visual } from '../widgets/Visual'
import { ExplorerView } from '../widgets/Explorers'
import { ProblemCard, type Outcome } from './ProblemCard'
import { Meter, missingPrereqs, nextUp, unitColor } from './common'
import { unitOf } from '../content'
import { go } from '../App'

type Tab = 'learn' | 'example' | 'practice'

export function SkillPage({ skill, tab }: { skill: Skill; tab?: Tab }) {
  const app = useApp()
  const st = skillState(app, skill.id)
  const active: Tab = tab ?? (st.learned || st.meter > 0 ? 'practice' : 'learn')
  const color = unitColor(skill.unit)
  const missing = missingPrereqs(app, skill)
  const unit = unitOf(skill.unit)
  const idx = unit.skills.indexOf(skill)

  return (
    <div className="skill" style={{ ['--uc' as string]: color }}>
      <div className="skill-head">
        <a className="crumb" href={`#/unit/${skill.unit}`}>
          ← {unit.title} <span className="crumb-n">· skill {idx + 1} of {unit.skills.length}</span>
        </a>
        <h1 className="skill-title">{skill.title}</h1>
        <p className="skill-blurb">{skill.blurb}</p>
        <div className="why">
          <span className="why-tag">Why it matters</span>
          <Rich text={skill.why} />
        </div>
        {missing.length > 0 && (
          <div className="prereq-note">
            Builds on{' '}
            {missing.map((m, i) => (
              <span key={m.id}>
                {i > 0 && ', '}
                <a href={`#/skill/${m.id}`}>{m.title}</a>
              </span>
            ))}
            . You can still go ahead — if it feels hard, start there.
          </div>
        )}
      </div>

      <nav className="tabs" role="tablist">
        {(['learn', 'example', 'practice'] as Tab[]).map((t, i) => (
          <a key={t} role="tab" aria-selected={active === t} className={active === t ? 'on' : ''} href={`#/skill/${skill.id}/${t}`}>
            <span className="tab-n">{i + 1}</span>
            {t === 'learn' ? 'Learn' : t === 'example' ? 'Worked example' : 'Practice'}
            {t === 'learn' && st.learned && <span className="tab-check">✓</span>}
            {t === 'practice' && <span className="tab-meter">{st.mastered ? '★' : `${st.meter}%`}</span>}
          </a>
        ))}
      </nav>

      {active === 'learn' && <Learn skill={skill} />}
      {active === 'example' && <Example skill={skill} />}
      {active === 'practice' && <Practice skill={skill} />}
    </div>
  )
}

// ── Learn: one card at a time ──────────────────────────────────────────────
function Learn({ skill }: { skill: Skill }) {
  const [i, setI] = useState(0)
  const [answered, setAnswered] = useState<Record<number, number>>({})
  const card = skill.learn[i]
  const last = i === skill.learn.length - 1
  const blocked = card.kind === 'check' && answered[i] !== card.correct
  const next = () => {
    if (last) {
      markLearned(skill.id)
      go(`/skill/${skill.id}/example`)
    } else setI(i + 1)
  }
  return (
    <section className="learn">
      <div className="dots">
        {skill.learn.map((c, k) => (
          <button key={k} className={`dot-step ${k === i ? 'on' : ''} ${k < i ? 'past' : ''}`} onClick={() => k <= i && setI(k)} aria-label={`card ${k + 1}`}>
            <span>{c.kind === 'explore' ? '◐' : c.kind === 'check' ? '?' : c.kind === 'trap' ? '!' : k + 1}</span>
          </button>
        ))}
      </div>
      <div className="card-stage" key={i}>
        <CardView card={card} picked={answered[i]} onPick={(n) => setAnswered((a) => ({ ...a, [i]: n }))} />
      </div>
      <div className="learn-nav">
        <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          ← Back
        </button>
        <button className="btn primary" disabled={blocked} onClick={next} title={blocked ? 'Answer the question to continue' : ''}>
          {last ? 'See a worked example →' : blocked ? 'Answer to continue' : 'Next →'}
        </button>
      </div>
    </section>
  )
}

function CardView({ card, picked, onPick }: { card: Card; picked?: number; onPick: (n: number) => void }) {
  switch (card.kind) {
    case 'idea':
      return (
        <article className="card idea">
          <span className="card-kind">Key idea</span>
          <h2>
            <Rich text={card.title} />
          </h2>
          <Rich text={card.body} as="div" className="card-body" />
          {card.math && <Tex src={card.math} display className="card-math" />}
        </article>
      )
    case 'explore':
      return (
        <article className="card explore">
          <span className="card-kind">Explore</span>
          <h2>{card.title}</h2>
          <Rich text={card.body} as="div" className="card-body" />
          <ExplorerView spec={card.widget} />
          {card.task && (
            <div className="task">
              <span>Try this</span>
              <Rich text={card.task} />
            </div>
          )}
        </article>
      )
    case 'trap':
      return (
        <article className="card trap">
          <span className="card-kind">Common trap</span>
          <h2>{card.title}</h2>
          <div className="trap-grid">
            <div className="trap-wrong">
              <span className="trap-label">✗ Looks right, isn’t</span>
              <Rich text={card.wrong} as="div" />
            </div>
            <div className="trap-right">
              <span className="trap-label">✓ Actually</span>
              <Rich text={card.right} as="div" />
            </div>
          </div>
          <Rich text={card.why} as="p" className="trap-why" />
        </article>
      )
    case 'check': {
      const done = picked === card.correct
      return (
        <article className="card check">
          <span className="card-kind">Quick check</span>
          <h2>
            <Rich text={card.question} />
          </h2>
          <div className="options">
            {card.options.map((o, k) => (
              <button key={k} className={`option ${picked === k ? (k === card.correct ? 'right' : 'wrong') : ''}`} disabled={done} onClick={() => onPick(k)}>
                <span className="opt-key">{String.fromCharCode(65 + k)}</span>
                <Rich text={o} />
              </button>
            ))}
          </div>
          {picked !== undefined && (
            <div className={`fb ${done ? 'fb-right' : 'fb-wrong'}`}>
              <strong>{done ? 'Yes. ' : 'Not that one — think again. '}</strong>
              {done && <Rich text={card.explain} />}
            </div>
          )}
        </article>
      )
    }
  }
}

// ── Worked example: reveal one step at a time ──────────────────────────────
function Example({ skill }: { skill: Skill }) {
  const [seed, setSeed] = useState(() => (Math.random() * 1e9) | 0)
  const problem = useMemo(() => skill.generate(makeRng(seed), 2), [skill, seed])
  const [shown, setShown] = useState(1)
  const all = shown >= problem.steps.length
  return (
    <section className="example">
      <div className="card">
        <span className="card-kind">Worked example</span>
        <Rich text={problem.prompt} as="div" className="prompt" />
        {problem.visual && <Visual v={problem.visual} />}
        <ol className="steps reveal">
          {problem.steps.slice(0, shown).map((s, i) => (
            <li key={i}>
              <Rich text={s.text} />
              {s.math && <Tex src={s.math} display className="step-math" />}
            </li>
          ))}
        </ol>
        {!all ? (
          <div className="think">
            <span>Before you reveal it: what would you do next?</span>
            <button className="btn" onClick={() => setShown(shown + 1)}>
              Reveal step {shown + 1} of {problem.steps.length}
            </button>
          </div>
        ) : (
          <div className="example-end">
            <button
              className="btn ghost"
              onClick={() => {
                setSeed(seed + 1)
                setShown(1)
              }}
            >
              Show another example
            </button>
            <a className="btn primary" href={`#/skill/${skill.id}/practice`}>
              Your turn →
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Practice to mastery ────────────────────────────────────────────────────
function Practice({ skill }: { skill: Skill }) {
  const app = useApp()
  const st = skillState(app, skill.id)
  const [n, setN] = useState(0)
  const [lastWrong, setLastWrong] = useState(false)
  const [res, setRes] = useState<PracticeResult | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const level = levelFor(st.meter)
  // a fresh problem per attempt; level is read when the attempt starts
  const problem: Problem = useMemo(() => skill.generate(makeRng(), level), [skill, n])
  const color = unitColor(skill.unit)

  const done = (o: Outcome) => {
    const r = recordPractice(skill.id, o)
    setRes(r)
    setLastWrong(!o.correct)
    if (r.justMastered) setCelebrate(true)
    setN(n + 1)
  }

  if (celebrate) {
    const nxt = nextUp(app, skill.unit)
    return (
      <section className="mastered-card">
        <div className="seal">
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--uc)" strokeWidth="4" strokeDasharray="6 5" />
            <circle cx="60" cy="60" r="44" fill="var(--uc)" />
            <path d="M40 62 l13 13 28 -30" stroke="var(--paper)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2>Skill mastered</h2>
        <p>
          You solved the hardest version of <b>{skill.title}</b> without help. It’s now in your review deck — you’ll see it again in 1 day, then 3, 7, 16… each time it sticks longer.
        </p>
        <div className="example-end">
          <button className="btn ghost" onClick={() => setCelebrate(false)}>
            Keep practicing
          </button>
          {nxt && nxt.id !== skill.id && (
            <a className="btn primary" href={`#/skill/${nxt.id}`}>
              Next: {nxt.title} →
            </a>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="practice">
      <div className="practice-top">
        <Meter value={st.meter} color={color} bump={res ? res.meterAfter - res.meterBefore : null} />
        <p className="meter-help">
          {st.mastered
            ? 'Mastered. Extra practice keeps it sharp.'
            : `Level ${level} of 3 · ${level === 3 ? 'solve these unaided to finish' : level === 2 ? 'standard problems' : 'warm-up problems'} · no-hint answers move you fastest`}
        </p>
      </div>
      {lastWrong && <div className="twin-note">Here’s a similar one — use the solution you just read.</div>}
      <ProblemCard
        key={n}
        problem={problem}
        onDone={done}
        accent={color}
        label={
          <span className="plabel">
            Problem {n + 1} · <span className={`lvl l${level}`}>{level === 1 ? 'Foundations' : level === 2 ? 'Standard' : 'Challenge'}</span>
          </span>
        }
      />
      {!skillState(app, skill.id).learned && (
        <p className="side-note">
          New to this? <a href={`#/skill/${skill.id}/learn`}>Start with the Learn cards</a> — they take about 3 minutes.
        </p>
      )}
    </section>
  )
}

