import { useEffect, useState } from 'react'
import { useApp, streak, dueSkills, today } from './engine/store'
import { Home } from './ui/Home'
import { UnitMap } from './ui/UnitMap'
import { SkillPage } from './ui/SkillPage'
import { Review } from './ui/Review'
import { Placement } from './ui/Placement'
import { Lab } from './ui/Lab'
import { SKILL, UNITS } from './content'
import type { UnitId } from './engine/types'

// Tiny hash router: #/ · #/unit/alg · #/skill/slope/practice · #/review · #/place/geo
function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => {
      setHash(location.hash.slice(1) || '/')
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.split('/').filter(Boolean)
}

export const go = (path: string) => {
  location.hash = path
}

export function App() {
  const parts = useRoute()
  const app = useApp()
  const st = streak(app)
  const due = dueSkills(app).length
  const solvedToday = app.days[today()] ?? 0

  let page: React.ReactNode
  const [head, a, b] = parts
  if (head === 'unit' && UNITS.some((u) => u.id === a)) page = <UnitMap unitId={a as UnitId} />
  else if (head === 'skill' && SKILL[a]) page = <SkillPage key={a} skill={SKILL[a]} tab={(b as 'learn' | 'example' | 'practice') ?? undefined} />
  else if (head === 'review') page = <Review />
  else if (head === 'place' && UNITS.some((u) => u.id === a)) page = <Placement key={a} unitId={a as UnitId} />
  else if (head === 'lab') page = <Lab />
  else page = <Home />

  return (
    <div className="shell">
      <header className="topbar">
        <a href="#/" className="wordmark" aria-label="AXIOM home">
          <span className="wm-a">A</span>XIOM
          <span className="wm-dot" />
        </a>
        <nav className="topnav">
          {UNITS.map((u) => (
            <a key={u.id} href={`#/unit/${u.id}`} className={parts[0] === 'unit' && parts[1] === u.id ? 'on' : ''} style={{ ['--uc' as string]: u.color }}>
              {u.title}
            </a>
          ))}
        </nav>
        <div className="stats">
          <a href="#/review" className={`stat review ${due ? 'hot' : ''}`} title="Spaced review">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
              <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {due}
          </a>
          <span className="stat" title={`${solvedToday} solved today`}>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
              <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5z" fill={st ? 'var(--red)' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            {st}
          </span>
          <span className="stat xp" title="Experience">
            {app.xp.toLocaleString()} <small>XP</small>
          </span>
        </div>
      </header>
      <main className="page">{page}</main>
      <footer className="foot">
        AXIOM · progress is saved in this browser · <a href="#/review">review</a>
      </footer>
    </div>
  )
}
