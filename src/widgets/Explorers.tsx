import { useMemo, useRef, useState } from 'react'
import type { Explorer } from '../engine/types'
import { Tex } from './Rich'
import { gcd } from '../engine/rng'

// Interactive models for the Learn phase. Each one ties a picture to the symbols,
// so the rule is something you *see* happen rather than something you memorise.

const INK = 'var(--ink)'
const RED = 'var(--red)'
const BLUE = 'var(--blue)'
const FILL = 'var(--fill)'

function Slider({ label, value, min, max, step = 1, onChange, color }: { label: React.ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; color?: string }) {
  return (
    <label className="slider" style={{ ['--c' as string]: color ?? 'var(--ink)' }}>
      <span className="slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="slider-val">{value}</span>
    </label>
  )
}

function Panel({ children, math, note }: { children: React.ReactNode; math?: string; note?: React.ReactNode }) {
  return (
    <div className="explorer">
      <div className="explorer-stage">{children}</div>
      {math && (
        <div className="explorer-math">
          <Tex src={math} display />
        </div>
      )}
      {note && <div className="explorer-note">{note}</div>}
    </div>
  )
}

export function ExplorerView({ spec }: { spec: Explorer }) {
  switch (spec.w) {
    case 'numberline':
      return <NumberLineEx mode={spec.mode} />
    case 'placevalue':
      return <PlaceValueEx />
    case 'area':
      return <AreaEx />
    case 'groups':
      return <GroupsEx />
    case 'array':
      return <ArrayEx />
    case 'fraction':
      return <FractionEx />
    case 'fractionadd':
      return <FractionAddEx />
    case 'percent':
      return <PercentEx />
    case 'exponent':
      return <ExponentEx />
    case 'ratio':
      return <RatioEx />
    case 'balance':
      return <BalanceEx />
    case 'line':
      return <LineEx />
    case 'parabola':
      return <ParabolaEx />
    case 'triangle':
      return <TriangleEx />
    case 'pythag':
      return <PythagEx />
    case 'circle':
      return <CircleEx />
    case 'rect':
      return <RectEx />
    case 'angles':
      return <AnglesEx />
  }
}

// ── Number line ────────────────────────────────────────────────────────────
function NumberLineEx({ mode }: { mode: 'add' | 'subtract' | 'integers' }) {
  const ints = mode === 'integers'
  const [a, setA] = useState(ints ? -3 : 7)
  const [b, setB] = useState(ints ? 5 : 5)
  const [sub, setSub] = useState(mode === 'subtract')
  const min = ints ? -12 : 0
  const max = ints ? 12 : 24
  const result = sub ? a - b : a + b
  const W = 560
  const pad = 22
  const X = (n: number) => pad + ((n - min) / (max - min)) * (W - 2 * pad)
  const inRange = result >= min && result <= max
  const dir = result >= a ? 'right' : 'left'
  const ticks = []
  for (let n = min; n <= max; n++) ticks.push(n)
  return (
    <Panel
      math={`${a} ${sub ? '-' : '+'} ${b < 0 ? `(${b})` : b} = ${result}`}
      note={
        ints ? (
          <>
            Start at <b>{a}</b>. {sub ? 'Subtracting' : 'Adding'} {b < 0 ? 'a negative' : 'a positive'} moves you <b style={{ color: RED }}>{dir}</b>
            {sub && b < 0 && <> — subtracting a negative is the same as adding a positive.</>}
          </>
        ) : (
          <>
            Start at <b>{a}</b> and take <b>{Math.abs(b)}</b> step{Math.abs(b) === 1 ? '' : 's'} {sub ? 'left' : 'right'}. You land on <b>{result}</b>.
          </>
        )
      }
    >
      <svg viewBox={`0 0 ${W} 120`} width="100%">
        <line x1={6} x2={W - 6} y1={80} y2={80} stroke={INK} strokeWidth={2} />
        {ticks.map((n) => (
          <g key={n}>
            <line x1={X(n)} x2={X(n)} y1={74} y2={86} stroke={INK} strokeWidth={n === 0 ? 2.5 : 1} />
            {(ints || n % 2 === 0) && (
              <text x={X(n)} y={102} fontSize={11} textAnchor="middle" fill={n === result ? RED : 'var(--ink-2)'} fontWeight={n === result ? 700 : 400}>
                {n}
              </text>
            )}
          </g>
        ))}
        {Array.from({ length: Math.abs(b) }, (_, i) => {
          const step = (sub ? -1 : 1) * Math.sign(b)
          const from = a + i * step
          const to = from + step
          if (from < min || from > max || to < min || to > max) return null
          return <path key={i} className="hop" style={{ animationDelay: `${i * 60}ms` }} d={`M${X(from)},72 Q${(X(from) + X(to)) / 2},40 ${X(to)},72`} fill="none" stroke={RED} strokeWidth={2} />
        })}
        <circle cx={X(a)} cy={80} r={7} fill={BLUE} />
        {inRange && <circle cx={X(result)} cy={80} r={7} fill={RED} />}
      </svg>
      <div className="controls">
        <Slider label="start" value={a} min={ints ? -10 : 0} max={ints ? 10 : 15} onChange={setA} color={BLUE} />
        <Slider label={sub ? 'subtract' : 'add'} value={b} min={ints ? -10 : 0} max={ints ? 10 : 9} onChange={setB} color={RED} />
        {mode !== 'add' && (
          <div className="seg">
            <button className={!sub ? 'on' : ''} onClick={() => setSub(false)}>+</button>
            <button className={sub ? 'on' : ''} onClick={() => setSub(true)}>−</button>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ── Place value (column addition with regrouping) ──────────────────────────
function PlaceValueEx() {
  const [a, setA] = useState(47)
  const [b, setB] = useState(38)
  const da = [Math.floor(a / 100), Math.floor(a / 10) % 10, a % 10]
  const db = [Math.floor(b / 100), Math.floor(b / 10) % 10, b % 10]
  const onesSum = da[2] + db[2]
  const carry1 = onesSum >= 10 ? 1 : 0
  const tensSum = da[1] + db[1] + carry1
  const carry2 = tensSum >= 10 ? 1 : 0
  const cols = ['hundreds', 'tens', 'ones']
  const blocks = (n: number, kind: number, color: string) =>
    Array.from({ length: n }, (_, i) =>
      kind === 2 ? <span key={i} className="pv-one" style={{ background: color }} /> : kind === 1 ? <span key={i} className="pv-ten" style={{ background: color }} /> : <span key={i} className="pv-hun" style={{ background: color }} />,
    )
  return (
    <Panel
      math={`${a} + ${b} = ${a + b}`}
      note={
        carry1 ? (
          <>
            Ones: {da[2]} + {db[2]} = <b>{onesSum}</b> — that's more than 9, so <b style={{ color: RED }}>trade 10 ones for 1 ten</b>. Write {onesSum % 10}, carry 1.
            {carry2 ? <> Tens: {da[1]} + {db[1]} + 1 = {tensSum}, so trade again into hundreds.</> : null}
          </>
        ) : (
          <>Ones: {da[2]} + {db[2]} = {onesSum}, under 10 — no trade needed. Try making the ones digits add past 9.</>
        )
      }
    >
      <div className="pv">
        {cols.map((c, k) => (
          <div key={c} className="pv-col">
            <div className="pv-head">{c}</div>
            <div className="pv-blocks">
              {blocks(da[k], k, 'var(--blue)')}
              {blocks(db[k], k, 'var(--red)')}
            </div>
            {k === 2 && carry1 ? <div className="pv-trade">10 ones → 1 ten</div> : null}
            {k === 1 && carry2 ? <div className="pv-trade">10 tens → 1 hundred</div> : null}
          </div>
        ))}
      </div>
      <div className="controls">
        <Slider label="blue" value={a} min={10} max={199} onChange={setA} color={BLUE} />
        <Slider label="red" value={b} min={10} max={99} onChange={setB} color={RED} />
      </div>
    </Panel>
  )
}

// ── Area model for multiplication ───────────────────────────────────────────
function AreaEx() {
  const [a, setA] = useState(23)
  const [b, setB] = useState(14)
  const at = Math.floor(a / 10) * 10
  const ao = a % 10
  const bt = Math.floor(b / 10) * 10
  const bo = b % 10
  const S = 7
  const W = a * S
  const H = b * S
  const parts = [
    { x: 0, y: 0, w: at, h: bt, c: BLUE },
    { x: at, y: 0, w: ao, h: bt, c: RED },
    { x: 0, y: bt, w: at, h: bo, c: 'var(--amber)' },
    { x: at, y: bt, w: ao, h: bo, c: 'var(--green)' },
  ].filter((q) => q.w > 0 && q.h > 0)
  const sum = parts.map((q) => `${q.w}\\times${q.h}`).join(' + ')
  return (
    <Panel math={`${a}\\times${b} = ${sum} = ${parts.map((q) => q.w * q.h).join(' + ')} = ${a * b}`} note="Break each number into tens and ones. The big rectangle's area is the product — and it's just the four smaller areas added up.">
      <svg viewBox={`-30 -24 ${W + 40} ${H + 34}`} width="100%" style={{ maxWidth: 420 }}>
        {parts.map((q, i) => (
          <g key={i}>
            <rect x={q.x * S} y={q.y * S} width={q.w * S} height={q.h * S} fill={q.c} fillOpacity={0.22} stroke={q.c} strokeWidth={2} />
            {q.w * S > 28 && q.h * S > 16 && (
              <text x={(q.x + q.w / 2) * S} y={(q.y + q.h / 2) * S} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill={INK} className="svg-label">
                {q.w * q.h}
              </text>
            )}
          </g>
        ))}
        <text x={(at * S) / 2} y={-8} textAnchor="middle" fontSize={13} fill={INK}>{at}</text>
        {ao > 0 && <text x={(at + ao / 2) * S} y={-8} textAnchor="middle" fontSize={13} fill={INK}>{ao}</text>}
        <text x={-8} y={(bt * S) / 2} textAnchor="end" dominantBaseline="middle" fontSize={13} fill={INK}>{bt}</text>
        {bo > 0 && <text x={-8} y={(bt + bo / 2) * S} textAnchor="end" dominantBaseline="middle" fontSize={13} fill={INK}>{bo}</text>}
      </svg>
      <div className="controls">
        <Slider label="width" value={a} min={11} max={49} onChange={setA} />
        <Slider label="height" value={b} min={11} max={29} onChange={setB} />
      </div>
    </Panel>
  )
}

// ── Division as equal groups ────────────────────────────────────────────────
function GroupsEx() {
  const [n, setN] = useState(23)
  const [k, setK] = useState(4)
  const q = Math.floor(n / k)
  const r = n % k
  return (
    <Panel math={`${n} \\div ${k} = ${q}\\ \\text{R}\\ ${r}`} note={<>Deal {n} counters into {k} equal groups. Each group gets <b>{q}</b>{r ? <>, and <b style={{ color: RED }}>{r}</b> are left over — that's the remainder (always less than {k}).</> : <> with none left over — {k} divides {n} evenly.</>}</>}>
      <div className="groups">
        {Array.from({ length: k }, (_, g) => (
          <div key={g} className="group">
            {Array.from({ length: q }, (_, i) => (
              <span key={i} className="dot" style={{ background: BLUE }} />
            ))}
          </div>
        ))}
        {r > 0 && (
          <div className="group rem">
            {Array.from({ length: r }, (_, i) => (
              <span key={i} className="dot" style={{ background: RED }} />
            ))}
          </div>
        )}
      </div>
      <div className="controls">
        <Slider label="total" value={n} min={1} max={60} onChange={setN} />
        <Slider label="groups" value={k} min={1} max={9} onChange={setK} />
      </div>
    </Panel>
  )
}

// ── Factor arrays ───────────────────────────────────────────────────────────
function ArrayEx() {
  const [n, setN] = useState(12)
  const pairs: [number, number][] = []
  for (let i = 1; i * i <= n; i++) if (n % i === 0) pairs.push([i, n / i])
  const [sel, setSel] = useState(0)
  const [r, c] = pairs[Math.min(sel, pairs.length - 1)]
  const prime = pairs.length === 1 && n > 1
  return (
    <Panel
      note={
        prime ? (
          <><b style={{ color: RED }}>{n} is prime</b> — the only rectangle you can make is 1 × {n}.</>
        ) : (
          <>Every rectangle you can build from {n} dots gives a <b>factor pair</b>. Factors of {n}: <b>{pairs.flatMap(([a, b]) => (a === b ? [a] : [a, b])).sort((x, y) => x - y).join(', ')}</b></>
        )
      }
    >
      <div className="pair-tabs">
        {pairs.map(([a, b], i) => (
          <button key={i} className={i === Math.min(sel, pairs.length - 1) ? 'on' : ''} onClick={() => setSel(i)}>
            {a} × {b}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${Math.max(c, 1) * 22 + 4} ${r * 22 + 4}`} width="100%" style={{ maxWidth: Math.min(520, c * 22 + 4), maxHeight: 260 }}>
        {Array.from({ length: r * c }, (_, i) => (
          <circle key={i} cx={13 + (i % c) * 22} cy={13 + Math.floor(i / c) * 22} r={8} fill={prime ? RED : BLUE} fillOpacity={0.85} />
        ))}
      </svg>
      <div className="controls">
        <Slider
          label="dots"
          value={n}
          min={1}
          max={48}
          onChange={(v) => {
            setN(v)
            setSel(99)
          }}
        />
      </div>
    </Panel>
  )
}

// ── Fractions: equivalence ─────────────────────────────────────────────────
function FractionEx() {
  const [num, setNum] = useState(2)
  const [den, setDen] = useState(3)
  const [k, setK] = useState(2)
  const n = Math.min(num, den)
  const bar = (parts: number, shaded: number, color: string) => (
    <svg viewBox="0 0 404 40" width="100%">
      {Array.from({ length: parts }, (_, i) => (
        <rect key={i} x={2 + (i * 400) / parts} y={2} width={400 / parts} height={36} fill={i < shaded ? color : 'transparent'} fillOpacity={0.7} stroke={INK} strokeWidth={1.4} />
      ))}
    </svg>
  )
  const g = gcd(n, den)
  return (
    <Panel
      math={`\\frac{${n}}{${den}} = \\frac{${n}\\times${k}}{${den}\\times${k}} = \\frac{${n * k}}{${den * k}}`}
      note={
        <>
          Cutting every piece into {k} makes {k}× as many pieces <i>and</i> {k}× as many shaded — the shaded <b>amount</b> doesn't change.
          {g > 1 && <> Going backwards (dividing by {g}) simplifies {n}/{den} to <b>{n / g}/{den / g}</b>.</>}
        </>
      }
    >
      {bar(den, n, BLUE)}
      {bar(den * k, n * k, RED)}
      <div className="controls">
        <Slider label="top" value={n} min={0} max={den} onChange={setNum} color={BLUE} />
        <Slider label="bottom" value={den} min={1} max={12} onChange={setDen} color={BLUE} />
        <Slider label="cut each into" value={k} min={1} max={5} onChange={setK} color={RED} />
      </div>
    </Panel>
  )
}

// ── Fractions: adding with common denominators ─────────────────────────────
function FractionAddEx() {
  const [a, setA] = useState(1)
  const [b, setB] = useState(2)
  const [c, setC] = useState(1)
  const [d, setD] = useState(3)
  const A = Math.min(a, b)
  const C = Math.min(c, d)
  const L = (b * d) / gcd(b, d)
  const ka = L / b
  const kc = L / d
  const total = A * ka + C * kc
  const bar = (parts: number, segs: { from: number; to: number; color: string }[]) => (
    <svg viewBox="0 0 404 34" width="100%">
      {segs.map((s, i) => (
        <rect key={'s' + i} x={2 + (s.from * 400) / parts} y={2} width={((s.to - s.from) * 400) / parts} height={30} fill={s.color} fillOpacity={0.7} />
      ))}
      {Array.from({ length: parts }, (_, i) => (
        <rect key={i} x={2 + (i * 400) / parts} y={2} width={400 / parts} height={30} fill="none" stroke={INK} strokeWidth={1.2} />
      ))}
    </svg>
  )
  return (
    <Panel
      math={`\\frac{${A}}{${b}} + \\frac{${C}}{${d}} = \\frac{${A * ka}}{${L}} + \\frac{${C * kc}}{${L}} = \\frac{${total}}{${L}}`}
      note={<>You can't add pieces of different sizes. Re-cut both into <b>{L}ths</b> (a common denominator) — then just count the shaded pieces. The bottom stays {L}; it names the piece size.</>}
    >
      <div className="bar-row"><span>{A}/{b}</span>{bar(b, [{ from: 0, to: A, color: BLUE }])}</div>
      <div className="bar-row"><span>{C}/{d}</span>{bar(d, [{ from: 0, to: C, color: RED }])}</div>
      <div className="bar-row"><span>sum</span>{bar(L, [{ from: 0, to: A * ka, color: BLUE }, { from: A * ka, to: Math.min(L, total), color: RED }])}</div>
      {total > L && <div className="explorer-warn">The sum is more than one whole bar — it's an improper fraction.</div>}
      <div className="controls">
        <Slider label="blue top" value={A} min={1} max={b} onChange={setA} color={BLUE} />
        <Slider label="blue bottom" value={b} min={2} max={8} onChange={setB} color={BLUE} />
        <Slider label="red top" value={C} min={1} max={d} onChange={setC} color={RED} />
        <Slider label="red bottom" value={d} min={2} max={8} onChange={setD} color={RED} />
      </div>
    </Panel>
  )
}

// ── Percent ────────────────────────────────────────────────────────────────
function PercentEx() {
  const [p, setP] = useState(35)
  const [of, setOf] = useState(80)
  return (
    <Panel math={`${p}\\% \\text{ of } ${of} = \\frac{${p}}{100}\\times ${of} = ${+((p / 100) * of).toFixed(2)}`} note={<>Percent means <b>“per hundred.”</b> {p}% is {p} squares out of 100. To take {p}% of {of}, scale {of} down to 1% (÷100), then take {p} of those.</>}>
      <div className="pct-wrap">
        <svg viewBox="0 0 222 222" width={190}>
          {Array.from({ length: 100 }, (_, k) => (
            <rect key={k} x={2 + (k % 10) * 22} y={2 + Math.floor(k / 10) * 22} width={20} height={20} rx={2} fill={k < p ? RED : FILL} fillOpacity={k < p ? 0.85 : 1} />
          ))}
        </svg>
        <div className="pct-bar">
          <div className="pct-fill" style={{ width: `${p}%` }} />
          <span className="pct-a">0</span>
          <span className="pct-b">{of}</span>
          <span className="pct-v" style={{ left: `${p}%` }}>{+((p / 100) * of).toFixed(2)}</span>
        </div>
      </div>
      <div className="controls">
        <Slider label="percent" value={p} min={0} max={100} onChange={setP} color={RED} />
        <Slider label="of" value={of} min={10} max={200} step={10} onChange={setOf} />
      </div>
    </Panel>
  )
}

// ── Exponents ──────────────────────────────────────────────────────────────
function ExponentEx() {
  const [b, setB] = useState(2)
  const [n, setN] = useState(5)
  const vals = Array.from({ length: n + 1 }, (_, i) => b ** i)
  const max = vals[n]
  return (
    <Panel
      math={`${b}^{${n}} = ${n === 0 ? '1' : Array(n).fill(b).join('\\times')} = ${b ** n}`}
      note={<>The exponent counts how many <b>{b}s are multiplied</b> — not {b} × {n} = {b * n}. Each step up multiplies by {b}, which is why powers explode. And {b}<sup>0</sup> = 1: zero factors leaves the multiplying “starting value”, 1.</>}
    >
      <div className="exp-bars">
        {vals.map((v, i) => (
          <div key={i} className="exp-col">
            <div className="exp-bar" style={{ height: `${Math.max(2, (v / max) * 150)}px`, background: i === n ? RED : BLUE }} />
            <span>
              {b}
              <sup>{i}</sup>
            </span>
            <small>{v.toLocaleString()}</small>
          </div>
        ))}
      </div>
      <div className="controls">
        <Slider label="base" value={b} min={1} max={10} onChange={setB} color={BLUE} />
        <Slider label="exponent" value={n} min={0} max={8} onChange={setN} color={RED} />
      </div>
    </Panel>
  )
}

// ── Ratios: double number line ─────────────────────────────────────────────
function RatioEx() {
  const [a, setA] = useState(3)
  const [b, setB] = useState(5)
  const [k, setK] = useState(4)
  const W = 520
  const steps = 6
  const X = (i: number) => 30 + (i * (W - 60)) / steps
  return (
    <Panel math={`${a}:${b} = ${a * k}:${b * k}\\quad\\left(\\times ${k}\\right)`} note={<>A ratio stays the same when you multiply <b>both</b> parts by the same number. The unit rate is {a}/{b} = <b>{+(a / b).toFixed(3)}</b> per one — every column on the line has that same ratio.</>}>
      <svg viewBox={`0 0 ${W} 130`} width="100%">
        {[30, 95].map((y, row) => (
          <g key={row}>
            <line x1={20} x2={W - 20} y1={y} y2={y} stroke={INK} strokeWidth={2} />
            <text x={4} y={y - 12} fontSize={11} fill={row ? RED : BLUE}>{row ? 'B' : 'A'}</text>
            {Array.from({ length: steps + 1 }, (_, i) => (
              <g key={i}>
                <line x1={X(i)} x2={X(i)} y1={y - 6} y2={y + 6} stroke={INK} />
                <text x={X(i)} y={y + (row ? 22 : -12)} fontSize={13} textAnchor="middle" fill={i === k ? (row ? RED : BLUE) : 'var(--ink-2)'} fontWeight={i === k ? 700 : 400}>
                  {(row ? b : a) * i}
                </text>
              </g>
            ))}
          </g>
        ))}
        <line x1={X(k)} x2={X(k)} y1={30} y2={95} stroke={RED} strokeDasharray="4 4" />
      </svg>
      <div className="controls">
        <Slider label="A" value={a} min={1} max={9} onChange={setA} color={BLUE} />
        <Slider label="B" value={b} min={1} max={9} onChange={setB} color={RED} />
        <Slider label="× scale" value={k} min={0} max={6} onChange={setK} />
      </div>
    </Panel>
  )
}

// ── Balance scale equation solver ──────────────────────────────────────────
function newEq() {
  const a = 2 + Math.floor(Math.random() * 4)
  const x = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 7)
  return { a, b, c: a * x + b, x }
}
function BalanceEx() {
  const [eq, setEq] = useState(newEq)
  const [st, setSt] = useState({ a: eq.a, b: eq.b, c: eq.c, msg: '' })
  const [tilt, setTilt] = useState(0)
  const reset = () => {
    const e = newEq()
    setEq(e)
    setSt({ a: e.a, b: e.b, c: e.c, msg: '' })
  }
  const solved = st.a === 1 && st.b === 0
  const wobble = (msg: string) => {
    setTilt(8)
    setSt((s) => ({ ...s, msg }))
    setTimeout(() => setTilt(0), 600)
  }
  const subB = () => (st.b > 0 ? setSt({ ...st, b: 0, c: st.c - st.b, msg: `Took ${st.b} off both sides — still balanced.` }) : wobble('There are no loose units on the left to remove.'))
  const subOneLeft = () => (st.b > 0 ? wobble('Removing only from the left tips the scale! Whatever you do to one side, do to the other.') : null)
  const divA = () =>
    st.b > 0 ? wobble(`Not yet — the ${st.b} loose units would get split too. Clear them first.`) : st.a > 1 ? setSt({ ...st, a: 1, c: st.c / st.a, msg: `Split both sides into ${st.a} equal groups — one x balances ${st.c / st.a}.` }) : null
  const xs = Array.from({ length: st.a }, (_, i) => i)
  const units = (n: number) => Array.from({ length: Math.min(n, 30) }, (_, i) => i)
  return (
    <Panel math={`${st.a === 1 ? '' : st.a}x ${st.b ? `+ ${st.b}` : ''} = ${st.c}`} note={st.msg || 'Goal: get x alone on one side, keeping the scale level. Try the moves below.'}>
      <div className="balance" style={{ transform: `rotate(${tilt}deg)` }}>
        <div className="pan">
          {xs.map((i) => (
            <span key={'x' + i} className="xbox">x</span>
          ))}
          {units(st.b).map((i) => (
            <span key={'u' + i} className="unit" />
          ))}
        </div>
        <div className="beam" />
        <div className="pan">
          {units(st.c).map((i) => (
            <span key={i} className="unit r" />
          ))}
        </div>
      </div>
      <div className="fulcrum" />
      {solved && <div className="explorer-win">x = {st.c}. Check: {eq.a}·{st.c} + {eq.b} = {eq.c} ✓</div>}
      <div className="controls">
        <button className="btn sm" onClick={subB} disabled={solved}>− {st.b || 'units'} from both sides</button>
        <button className="btn sm ghost" onClick={subOneLeft} disabled={solved || st.b === 0}>− {st.b} from left only</button>
        <button className="btn sm" onClick={divA} disabled={solved}>÷ {st.a} on both sides</button>
        <button className="btn sm ghost" onClick={reset}>New equation</button>
      </div>
    </Panel>
  )
}

// ── Lines: y = mx + b ──────────────────────────────────────────────────────
function Plane({ children, R = 6, size = 300 }: { children: (X: (x: number) => number, Y: (y: number) => number) => React.ReactNode; R?: number; size?: number }) {
  const u = size / (2 * R)
  const X = (x: number) => size / 2 + x * u
  const Y = (y: number) => size / 2 - y * u
  const ks: number[] = []
  for (let k = -R; k <= R; k++) ks.push(k)
  return (
    <svg viewBox={`-4 -4 ${size + 8} ${size + 8}`} width="100%" style={{ maxWidth: 340 }}>
      <defs>
        <clipPath id="pl">
          <rect x={0} y={0} width={size} height={size} />
        </clipPath>
      </defs>
      {ks.map((k) => (
        <g key={k}>
          <line x1={X(k)} x2={X(k)} y1={0} y2={size} stroke="var(--gridline)" />
          <line y1={Y(k)} y2={Y(k)} x1={0} x2={size} stroke="var(--gridline)" />
        </g>
      ))}
      <line x1={0} x2={size} y1={Y(0)} y2={Y(0)} stroke={INK} strokeWidth={1.6} />
      <line y1={0} y2={size} x1={X(0)} x2={X(0)} stroke={INK} strokeWidth={1.6} />
      <g clipPath="url(#pl)">{children(X, Y)}</g>
    </svg>
  )
}

function LineEx() {
  const [m, setM] = useState(2)
  const [b, setB] = useState(1)
  const x0 = b + m > 5 || b + m < -5 ? -1 : 0
  return (
    <Panel
      math={`y = ${m === 0 ? '' : m === 1 ? 'x' : m === -1 ? '-x' : m + 'x'} ${b === 0 && m !== 0 ? '' : b < 0 ? `- ${-b}` : m === 0 ? b : `+ ${b}`}`}
      note={<><b style={{ color: RED }}>m = {m}</b> is the slope: go 1 right, go {m} {m >= 0 ? 'up' : 'down'}. <b style={{ color: BLUE }}>b = {b}</b> is where the line crosses the y-axis. {m === 0 && 'Slope 0 → a flat line.'}</>}
    >
      <Plane>
        {(X, Y) => (
          <>
            <line x1={X(-7)} y1={Y(-7 * m + b)} x2={X(7)} y2={Y(7 * m + b)} stroke={INK} strokeWidth={2.5} />
            <path d={`M${X(x0)},${Y(m * x0 + b)} H${X(x0 + 1)} V${Y(m * (x0 + 1) + b)}`} fill="none" stroke={RED} strokeWidth={3} />
            <text x={X(x0 + 0.5)} y={Y(m * x0 + b) + (m >= 0 ? 14 : -6)} fontSize={11} textAnchor="middle" fill={RED}>run 1</text>
            <text x={X(x0 + 1) + 5} y={Y(m * x0 + b + m / 2)} fontSize={11} fill={RED}>rise {m}</text>
            <circle cx={X(0)} cy={Y(b)} r={6} fill={BLUE} />
          </>
        )}
      </Plane>
      <div className="controls">
        <Slider label="slope m" value={m} min={-4} max={4} step={0.5} onChange={setM} color={RED} />
        <Slider label="intercept b" value={b} min={-5} max={5} onChange={setB} color={BLUE} />
      </div>
    </Panel>
  )
}

// ── Parabolas ──────────────────────────────────────────────────────────────
function ParabolaEx() {
  const [r1, setR1] = useState(-1)
  const [r2, setR2] = useState(3)
  const [a, setA] = useState(1)
  const B = -a * (r1 + r2)
  const C = a * r1 * r2
  const h = (r1 + r2) / 2
  const k = a * (h - r1) * (h - r2)
  const pts = useMemo(() => {
    const out: string[] = []
    for (let x = -7; x <= 7; x += 0.1) out.push(`${x},${a * (x - r1) * (x - r2)}`)
    return out
  }, [a, r1, r2])
  const fmtTerm = (n: number, v: string) => (n === 0 ? '' : `${n < 0 ? '-' : '+'} ${Math.abs(n) === 1 && v ? '' : Math.abs(n)}${v}`)
  return (
    <Panel
      math={`y = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${r1 < 0 ? '+' : '-'} ${Math.abs(r1)})(x ${r2 < 0 ? '+' : '-'} ${Math.abs(r2)}) = ${a === 1 ? '' : a === -1 ? '-' : a}x^2 ${fmtTerm(B, 'x')} ${fmtTerm(C, '')}`}
      note={<>The parabola crosses the x-axis at <b style={{ color: RED }}>x = {r1}</b> and <b style={{ color: RED }}>x = {r2}</b> — exactly the numbers that make a factor zero. The vertex sits halfway between, at x = {h}.</>}
    >
      <Plane R={7}>
        {(X, Y) => (
          <>
            <polyline points={pts.map((q) => q.split(',').map(Number)).map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill="none" stroke={INK} strokeWidth={2.5} />
            <circle cx={X(r1)} cy={Y(0)} r={6} fill={RED} />
            <circle cx={X(r2)} cy={Y(0)} r={6} fill={RED} />
            <circle cx={X(h)} cy={Y(k)} r={5} fill={BLUE} />
            <line x1={X(h)} x2={X(h)} y1={0} y2={400} stroke={BLUE} strokeDasharray="4 4" />
          </>
        )}
      </Plane>
      <div className="controls">
        <Slider label="root 1" value={r1} min={-6} max={6} onChange={setR1} color={RED} />
        <Slider label="root 2" value={r2} min={-6} max={6} onChange={setR2} color={RED} />
        <Slider label="a" value={a} min={-2} max={2} step={0.5} onChange={(v) => setA(v === 0 ? 0.5 : v)} />
      </div>
    </Panel>
  )
}

// ── Triangle angle sum (drag the corners) ──────────────────────────────────
function useDrag(init: [number, number][]) {
  const [pts, setPts] = useState(init)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<number | null>(null)
  const toLocal = (e: React.PointerEvent) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return [p.x, p.y] as [number, number]
  }
  const handlers = (i: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      dragging.current = i
      ;(e.target as Element).setPointerCapture(e.pointerId)
    },
  })
  const svgHandlers = {
    onPointerMove: (e: React.PointerEvent) => {
      if (dragging.current === null) return
      const [x, y] = toLocal(e)
      const i = dragging.current
      setPts((p) => p.map((q, j) => (j === i ? [Math.max(14, Math.min(386, x)), Math.max(14, Math.min(266, y))] : q)))
    },
    onPointerUp: () => (dragging.current = null),
  }
  return { pts, svgRef, handlers, svgHandlers }
}

const angleAt = (p: number[], q: number[], r: number[]) => {
  const a = Math.atan2(q[1] - p[1], q[0] - p[0])
  const b = Math.atan2(r[1] - p[1], r[0] - p[0])
  let d = Math.abs(a - b) * (180 / Math.PI)
  if (d > 180) d = 360 - d
  return d
}

function TriangleEx() {
  const { pts, svgRef, handlers, svgHandlers } = useDrag([
    [60, 230],
    [170, 50],
    [340, 230],
  ])
  const angs = pts.map((p, i) => angleAt(p, pts[(i + 1) % 3], pts[(i + 2) % 3]))
  const r = angs.map((a) => Math.round(a))
  // make the displayed integers sum to exactly 180
  const drift = 180 - r.reduce((s, x) => s + x, 0)
  r[r.indexOf(Math.max(...r))] += drift
  const colors = [RED, BLUE, 'var(--green)']
  const arc = (i: number) => {
    const p = pts[i]
    const q = pts[(i + 1) % 3]
    const s = pts[(i + 2) % 3]
    const a1 = Math.atan2(q[1] - p[1], q[0] - p[0])
    const a2 = Math.atan2(s[1] - p[1], s[0] - p[0])
    const R = 26
    let d = a2 - a1
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    const sweep = d > 0 ? 1 : 0
    return `M${p[0] + R * Math.cos(a1)},${p[1] + R * Math.sin(a1)} A${R},${R} 0 0 ${sweep} ${p[0] + R * Math.cos(a2)},${p[1] + R * Math.sin(a2)}`
  }
  return (
    <Panel math={`${r[0]}^\\circ + ${r[1]}^\\circ + ${r[2]}^\\circ = 180^\\circ`} note="Drag any corner. The angles change — but they always add to 180°. Tear the three corners off a paper triangle and they line up into a straight line.">
      <svg ref={svgRef} viewBox="0 0 400 280" width="100%" style={{ maxWidth: 440, touchAction: 'none' }} {...svgHandlers}>
        <polygon points={pts.map((q) => q.join(',')).join(' ')} fill={FILL} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        {pts.map((_, i) => (
          <path key={'a' + i} d={arc(i)} fill="none" stroke={colors[i]} strokeWidth={3} />
        ))}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={13} fill={colors[i]} fillOpacity={0.25} className="handle" {...handlers(i)} />
            <circle cx={p[0]} cy={p[1]} r={6} fill={colors[i]} pointerEvents="none" />
          </g>
        ))}
      </svg>
      <div className="angle-strip">
        {r.map((a, i) => (
          <div key={i} style={{ flex: a, background: colors[i] }}>
            {a}°
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Pythagorean theorem ────────────────────────────────────────────────────
function PythagEx() {
  const [a, setA] = useState(3)
  const [b, setB] = useState(4)
  const c = Math.hypot(a, b)
  const S = 14
  const ox = 30 + b * S
  const oy = 30 + c * S
  // right angle at (ox, oy); leg a goes up, leg b goes right
  const A: [number, number] = [ox, oy - a * S]
  const B: [number, number] = [ox + b * S, oy]
  const O: [number, number] = [ox, oy]
  const dx = B[0] - A[0]
  const dy = B[1] - A[1]
  const sqC = [A, B, [B[0] + dy, B[1] - dx], [A[0] + dy, A[1] - dx]]
  return (
    <Panel
      math={`${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${a * a + b * b} = c^2 \\Rightarrow c = ${Number.isInteger(c) ? c : `\\sqrt{${a * a + b * b}} \\approx ${c.toFixed(2)}`}`}
      note={<>The areas of the two squares on the legs add up <b>exactly</b> to the area of the square on the hypotenuse. Try 3 & 4, 6 & 8, or 5 & 12 for whole-number answers.</>}
    >
      <svg viewBox={`0 0 ${ox + b * S + c * S + 40} ${oy + b * S + 40}`} width="100%" style={{ maxWidth: 440, maxHeight: 340 }}>
        <rect x={ox - a * S} y={oy - a * S} width={a * S} height={a * S} fill={BLUE} fillOpacity={0.3} stroke={BLUE} strokeWidth={2} />
        <rect x={ox} y={oy} width={b * S} height={b * S} fill={RED} fillOpacity={0.3} stroke={RED} strokeWidth={2} />
        <polygon points={sqC.map((q) => q.join(',')).join(' ')} fill="var(--green)" fillOpacity={0.25} stroke="var(--green)" strokeWidth={2} />
        <polygon points={[O, A, B].map((q) => q.join(',')).join(' ')} fill={FILL} stroke={INK} strokeWidth={2.5} />
        <text x={ox - (a * S) / 2} y={oy - (a * S) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill={INK}>{a * a}</text>
        <text x={ox + (b * S) / 2} y={oy + (b * S) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill={INK}>{b * b}</text>
        <text x={(sqC[0][0] + sqC[2][0]) / 2} y={(sqC[0][1] + sqC[2][1]) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill={INK}>{+(c * c).toFixed(1)}</text>
      </svg>
      <div className="controls">
        <Slider label="leg a" value={a} min={1} max={9} onChange={setA} color={BLUE} />
        <Slider label="leg b" value={b} min={1} max={12} onChange={setB} color={RED} />
      </div>
    </Panel>
  )
}

// ── Circles ────────────────────────────────────────────────────────────────
function CircleEx() {
  const [r, setR] = useState(3)
  const C = 2 * Math.PI * r
  const S = 16
  return (
    <Panel
      math={`C = 2\\pi r = 2\\pi(${r}) \\approx ${C.toFixed(2)} \\qquad A = \\pi r^2 = \\pi(${r})^2 \\approx ${(Math.PI * r * r).toFixed(2)}`}
      note={<>Unroll the circle: its edge is always a bit more than <b>3 diameters</b> long — exactly π ≈ 3.14159 of them. That's what π <i>is</i>.</>}
    >
      <svg viewBox={`0 0 ${Math.max(2 * Math.PI * 6 * S, 200) + 40} ${6 * 2 * S + 70}`} width="100%">
        <circle cx={20 + r * S} cy={20 + 6 * S} r={r * S} fill={FILL} stroke={RED} strokeWidth={3} />
        <line x1={20} y1={20 + 6 * S} x2={20 + 2 * r * S} y2={20 + 6 * S} stroke={BLUE} strokeWidth={2.5} />
        <line x1={20} y1={40 + 12 * S} x2={20 + C * S} y2={40 + 12 * S} stroke={RED} strokeWidth={4} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={20 + i * 2 * r * S} y1={50 + 12 * S} x2={20 + Math.min(i + 1, Math.PI) * 2 * r * S} y2={50 + 12 * S} stroke={BLUE} strokeWidth={4} opacity={i === 3 ? 0.5 : 1} strokeDasharray={i === 3 ? '3 3' : undefined} />
        ))}
        {[1, 2, 3].map((i) => (
          <line key={'t' + i} x1={20 + i * 2 * r * S} x2={20 + i * 2 * r * S} y1={44 + 12 * S} y2={56 + 12 * S} stroke={INK} />
        ))}
      </svg>
      <div className="controls">
        <Slider label="radius r" value={r} min={1} max={6} onChange={setR} color={RED} />
      </div>
    </Panel>
  )
}

// ── Rectangle → parallelogram → triangle area ──────────────────────────────
function RectEx() {
  const [w, setW] = useState(6)
  const [h, setH] = useState(4)
  const [shape, setShape] = useState<'rect' | 'para' | 'tri'>('rect')
  const [shear, setShear] = useState(2)
  const S = 30
  const off = shape === 'rect' ? 0 : shear
  const area = shape === 'tri' ? (w * h) / 2 : w * h
  const per = shape === 'rect' ? 2 * (w + h) : null
  return (
    <Panel
      math={shape === 'rect' ? `A = ${w}\\times${h} = ${w * h}\\qquad P = 2(${w}+${h}) = ${per}` : shape === 'para' ? `A = b\\times h = ${w}\\times${h} = ${w * h}` : `A = \\tfrac12 b h = \\tfrac12(${w})(${h}) = ${area}`}
      note={
        shape === 'rect' ? (
          <>Area counts the <b>unit squares inside</b> ({w * h} of them). Perimeter is the <b>distance around</b> the edge.</>
        ) : shape === 'para' ? (
          <>Slide the top sideways: it's the same squares rearranged, so area is still <b>base × height</b> — the <i>straight-up</i> height, not the slanted side.</>
        ) : (
          <>A triangle is exactly <b>half</b> of a parallelogram with the same base and height — so A = ½·b·h.</>
        )
      }
    >
      <svg viewBox={`-10 -10 ${(12 + 4) * S + 20} ${8 * S + 20}`} width="100%" style={{ maxWidth: 520 }}>
        {shape === 'rect' &&
          Array.from({ length: w * h }, (_, i) => <rect key={i} x={(i % w) * S} y={Math.floor(i / w) * S} width={S} height={S} fill={FILL} stroke="var(--gridline-strong)" />)}
        {shape === 'tri' && <polygon points={`0,${h * S} ${off * S},0 ${(w + off) * S},0 ${w * S},${h * S}`} fill="none" stroke="var(--ink-3)" strokeDasharray="5 5" />}
        <polygon
          points={shape === 'tri' ? `0,${h * S} ${off * S},0 ${w * S},${h * S}` : `0,${h * S} ${off * S},0 ${(w + off) * S},0 ${w * S},${h * S}`}
          fill={shape === 'rect' ? 'none' : FILL}
          fillOpacity={0.8}
          stroke={INK}
          strokeWidth={3}
        />
        {shape !== 'rect' && <line x1={off * S} y1={0} x2={off * S} y2={h * S} stroke={RED} strokeWidth={2} strokeDasharray="5 4" />}
        <text x={(w * S) / 2} y={h * S + 18} textAnchor="middle" fontSize={14} fill={BLUE}>b = {w}</text>
        <text x={off * S + 6} y={(h * S) / 2} fontSize={14} fill={RED}>h = {h}</text>
      </svg>
      <div className="controls">
        <div className="seg">
          {(['rect', 'para', 'tri'] as const).map((s) => (
            <button key={s} className={shape === s ? 'on' : ''} onClick={() => setShape(s)}>
              {s === 'rect' ? 'rectangle' : s === 'para' ? 'parallelogram' : 'triangle'}
            </button>
          ))}
        </div>
        <Slider label="base" value={w} min={1} max={12} onChange={setW} color={BLUE} />
        <Slider label="height" value={h} min={1} max={7} onChange={setH} color={RED} />
        {shape !== 'rect' && <Slider label="slide top" value={shear} min={-3} max={4} onChange={setShear} />}
      </div>
    </Panel>
  )
}

// ── Angle pairs ────────────────────────────────────────────────────────────
function AnglesEx() {
  const [t, setT] = useState(55)
  const [mode, setMode] = useState<'supp' | 'vert'>('supp')
  const cx = 200
  const cy = 150
  const R = 130
  const rad = (t * Math.PI) / 180
  const tip = [cx + R * Math.cos(rad), cy - R * Math.sin(rad)]
  const arc = (from: number, to: number, r: number) => {
    const a = (from * Math.PI) / 180
    const b = (to * Math.PI) / 180
    return `M${cx + r * Math.cos(a)},${cy - r * Math.sin(a)} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 0 ${cx + r * Math.cos(b)},${cy - r * Math.sin(b)}`
  }
  return (
    <Panel
      math={mode === 'supp' ? `${t}^\\circ + ${180 - t}^\\circ = 180^\\circ` : `\\text{opposite angles: } ${t}^\\circ = ${t}^\\circ`}
      note={mode === 'supp' ? <>Two angles that make a straight line are <b>supplementary</b> — they always total 180°.</> : <>Where two lines cross, the angles <b>across from each other</b> (vertical angles) are always equal. Neighbours are supplementary.</>}
    >
      <svg viewBox="0 0 400 300" width="100%" style={{ maxWidth: 420 }}>
        <line x1={20} y1={cy} x2={380} y2={cy} stroke={INK} strokeWidth={2.5} />
        <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke={INK} strokeWidth={2.5} />
        {mode === 'vert' && <line x1={cx} y1={cy} x2={2 * cx - tip[0]} y2={2 * cy - tip[1]} stroke={INK} strokeWidth={2.5} />}
        <path d={arc(0, t, 40)} fill="none" stroke={RED} strokeWidth={3} />
        <path d={arc(t, 180, 52)} fill="none" stroke={BLUE} strokeWidth={3} />
        {mode === 'vert' && <path d={arc(180, 180 + t, 40)} fill="none" stroke={RED} strokeWidth={3} />}
        <text x={cx + 62 * Math.cos(rad / 2)} y={cy - 62 * Math.sin(rad / 2)} fontSize={15} fill={RED} textAnchor="middle">{t}°</text>
        <text x={cx + 78 * Math.cos((rad + Math.PI) / 2)} y={cy - 78 * Math.sin((rad + Math.PI) / 2)} fontSize={15} fill={BLUE} textAnchor="middle">{180 - t}°</text>
        {mode === 'vert' && <text x={cx - 62 * Math.cos(rad / 2)} y={cy + 62 * Math.sin(rad / 2)} fontSize={15} fill={RED} textAnchor="middle">{t}°</text>}
      </svg>
      <div className="controls">
        <div className="seg">
          <button className={mode === 'supp' ? 'on' : ''} onClick={() => setMode('supp')}>straight line</button>
          <button className={mode === 'vert' ? 'on' : ''} onClick={() => setMode('vert')}>crossing lines</button>
        </div>
        <Slider label="angle" value={t} min={5} max={175} onChange={setT} color={RED} />
      </div>
    </Panel>
  )
}
