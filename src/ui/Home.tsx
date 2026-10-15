import { useApp, dueSkills, streak, today, skillState, setGoal } from '../engine/store'
import { UNITS, SKILL } from '../content'
import { nextUp, unitProgress, Ring } from './common'

export function Home() {
  const app = useApp()
  const due = dueSkills(app)
  const solved = app.days[today()] ?? 0
  const st = streak(app)
  const next = nextUp(app)
  const started = Object.keys(app.skills).length > 0
  const nextState = next ? skillState(app, next.id) : null

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{started ? 'Today’s flight plan' : 'Math, actually taught'}</p>
          <h1>
            {started ? (
              <>
                Keep the streak.
                <br />
                <em>Understand</em> one more thing.
              </>
            ) : (
              <>
                Don’t memorise math.
                <br />
                <em>See why</em> it works.
              </>
            )}
          </h1>
          <p className="hero-sub">
            Every skill starts with a model you can play with, then a worked example you reveal step by step, then practice that adapts to you — with feedback on the <b>exact mistake</b> you made, not just “wrong.”
          </p>
          <div className="hero-cta">
            {due.length > 0 && (
              <a className="btn primary big" href="#/review">
                Review {due.length} skill{due.length > 1 ? 's' : ''} <small>~{Math.max(2, due.length * 1)} min</small>
              </a>
            )}
            {next && (
              <a className={`btn ${due.length ? 'ghost' : 'primary'} big`} href={`#/skill/${next.id}`}>
                {nextState && nextState.meter > 0 ? 'Continue' : 'Start'}: {next.title}
              </a>
            )}
            {!started && (
              <a className="btn ghost big" href="#/place/arith">
                Find my level
              </a>
            )}
          </div>
        </div>

        <aside className="today">
          <Ring value={solved / app.dailyGoal} size={128} stroke={10} color="var(--red)">
            <span className="today-n">{solved}</span>
            <span className="today-of">of {app.dailyGoal}</span>
          </Ring>
          <div className="today-meta">
            <div>
              <b>{st}</b> day streak
            </div>
            <div>
              <b>{due.length}</b> due for review
            </div>
            <label className="goal">
              daily goal
              <select value={app.dailyGoal} onChange={(e) => setGoal(+e.target.value)}>
                {[6, 12, 20, 30].map((g) => (
                  <option key={g} value={g}>
                    {g} problems
                  </option>
                ))}
              </select>
            </label>
          </div>
        </aside>
      </section>

      <section className="units">
        {UNITS.map((u, i) => {
          const pr = unitProgress(app, u.id)
          const placed = app.placementDone.includes(u.id)
          return (
            <article key={u.id} className="unit-card" style={{ ['--uc' as string]: u.color, animationDelay: `${i * 70}ms` }}>
              <a href={`#/unit/${u.id}`} className="unit-link">
                <span className="unit-num">0{i + 1}</span>
                <h2>{u.title}</h2>
                <p>{u.tagline}</p>
                <div className="unit-bar">
                  <div style={{ width: `${pr.frac * 100}%` }} />
                </div>
                <span className="unit-count">
                  {pr.mastered}/{pr.total} mastered
                </span>
              </a>
              {!placed && pr.mastered === 0 && (
                <a className="unit-place" href={`#/place/${u.id}`}>
                  Already know some? Test out →
                </a>
              )}
            </article>
          )
        })}
      </section>

      <section className="method">
        <h2 className="section-title">How AXIOM teaches</h2>
        <ol className="method-steps">
          <li>
            <b>See it.</b> Every concept has an interactive model — drag, slide and watch the rule appear.
          </li>
          <li>
            <b>Watch one.</b> A worked example, revealed one step at a time. Predict each move before you see it.
          </li>
          <li>
            <b>Do it.</b> Endless fresh problems with a hint ladder. Wrong answers are diagnosed — “you added the denominators” — not just marked wrong.
          </li>
          <li>
            <b>Master it.</b> Difficulty rises as you improve. You only master a skill by solving the hardest level unaided.
          </li>
          <li>
            <b>Keep it.</b> Mastered skills come back for review after 1, 3, 7, 16, 35 days — right before you’d forget.
          </li>
        </ol>
      </section>

      {started && <RecentList />}
    </div>
  )
}

function RecentList() {
  const app = useApp()
  const recent = Object.entries(app.skills)
    .filter(([id]) => SKILL[id])
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, 5)
  if (!recent.length) return null
  return (
    <section className="recent">
      <h2 className="section-title">Recently practiced</h2>
      <ul>
        {recent.map(([id, s]) => (
          <li key={id}>
            <a href={`#/skill/${id}`}>
              <span>{SKILL[id].title}</span>
              <span className="recent-meter">
                <span style={{ width: `${s.meter}%` }} />
              </span>
              <span className="recent-state">{s.mastered ? 'mastered' : `${s.meter}%`}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
