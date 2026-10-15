import { ExplorerView } from '../widgets/Explorers'
import type { Explorer } from '../engine/types'

// Hidden gallery of every explorer (#/lab) — handy when authoring content.
const ALL: Explorer[] = [
  { w: 'numberline', mode: 'integers' }, { w: 'placevalue' }, { w: 'area' }, { w: 'groups' }, { w: 'array' }, { w: 'fraction' },
  { w: 'fractionadd' }, { w: 'percent' }, { w: 'exponent' }, { w: 'ratio' }, { w: 'balance' }, { w: 'line' }, { w: 'parabola' },
  { w: 'triangle' }, { w: 'pythag' }, { w: 'circle' }, { w: 'rect' }, { w: 'angles' },
]

export function Lab() {
  return (
    <div className="skill">
      <h1 className="skill-title">Explorer lab</h1>
      {ALL.map((e, i) => (
        <section key={i} className="card" style={{ marginBottom: 20 }} data-w={e.w}>
          <span className="card-kind">{e.w}</span>
          <ExplorerView spec={e} />
        </section>
      ))}
    </div>
  )
}
