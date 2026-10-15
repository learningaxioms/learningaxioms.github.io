import type { Visual as V } from '../engine/types'

// Static, hand-drawn-feeling diagrams attached to problems.
const INK = 'var(--ink)'
const RED = 'var(--red)'
const BLUE = 'var(--blue)'
const FILL = 'var(--fill)'

function L({ x, y, children, anchor = 'middle', color = INK, size = 15 }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end'; color?: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fill={color} fontSize={size} className="svg-label">
      {children}
    </text>
  )
}

export function Visual({ v }: { v: V }) {
  return <div className="visual">{draw(v)}</div>
}

function draw(v: V): React.ReactNode {
  switch (v.type) {
    case 'numberline': {
      const W = 520
      const pad = 26
      const span = v.max - v.min
      const X = (n: number) => pad + ((n - v.min) / span) * (W - 2 * pad)
      const step = span > 30 ? 5 : span > 14 ? 2 : 1
      const ticks: number[] = []
      for (let n = Math.ceil(v.min); n <= v.max; n++) ticks.push(n)
      return (
        <svg viewBox={`0 0 ${W} 110`} width="100%">
          <line x1={pad - 14} x2={W - pad + 14} y1={70} y2={70} stroke={INK} strokeWidth={2} markerEnd="url(#arr)" markerStart="url(#arr)" />
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={INK} />
            </marker>
            <marker id="arrR" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={RED} />
            </marker>
          </defs>
          {ticks.map((n) => (
            <g key={n}>
              <line x1={X(n)} x2={X(n)} y1={n % step === 0 ? 62 : 66} y2={n % step === 0 ? 78 : 74} stroke={INK} strokeWidth={n === 0 ? 2.5 : 1.3} />
              {n % step === 0 && <L x={X(n)} y={94} size={13}>{n}</L>}
            </g>
          ))}
          {(v.marks ?? []).map((n, i) => (
            <circle key={i} cx={X(n)} cy={70} r={5} fill={BLUE} />
          ))}
          {v.dot !== undefined && <circle cx={X(v.dot)} cy={70} r={6} fill={RED} />}
          {(v.jumps ?? []).map((j, i) => {
            const x1 = X(j.from)
            const x2 = X(j.to)
            const h = 18 + Math.min(34, Math.abs(x2 - x1) * 0.25)
            return (
              <g key={i}>
                <path d={`M${x1},62 Q${(x1 + x2) / 2},${62 - h * 2} ${x2},62`} fill="none" stroke={RED} strokeWidth={2} markerEnd="url(#arrR)" />
                {j.label && (
                  <L x={(x1 + x2) / 2} y={62 - h - 6} color={RED} size={14}>
                    {j.label}
                  </L>
                )}
              </g>
            )
          })}
        </svg>
      )
    }
    case 'fractionbars': {
      const W = 420
      return (
        <svg viewBox={`0 0 ${W + 70} ${v.bars.length * 46 + 6}`} width="100%" style={{ maxWidth: 520 }}>
          {v.bars.map((b, i) => (
            <g key={i} transform={`translate(0 ${i * 46 + 4})`}>
              {Array.from({ length: b.parts }, (_, k) => (
                <rect key={k} x={(k * W) / b.parts} y={0} width={W / b.parts} height={34} fill={k < b.shaded ? (i % 2 ? BLUE : RED) : 'transparent'} fillOpacity={0.75} stroke={INK} strokeWidth={1.5} />
              ))}
              {b.label && <L x={W + 36} y={17}>{b.label}</L>}
            </g>
          ))}
        </svg>
      )
    }
    case 'grid100':
      return (
        <svg viewBox="0 0 222 222" width={200}>
          {Array.from({ length: 100 }, (_, k) => (
            <rect key={k} x={2 + (k % 10) * 22} y={2 + Math.floor(k / 10) * 22} width={20} height={20} rx={2} fill={k < v.shaded ? RED : FILL} fillOpacity={k < v.shaded ? 0.8 : 1} />
          ))}
        </svg>
      )
    case 'array':
      return (
        <svg viewBox={`0 0 ${v.cols * 26 + 4} ${v.rows * 26 + 4}`} width={Math.min(360, v.cols * 26 + 4)}>
          {Array.from({ length: v.rows * v.cols }, (_, k) => (
            <circle key={k} cx={15 + (k % v.cols) * 26} cy={15 + Math.floor(k / v.cols) * 26} r={9} fill={BLUE} fillOpacity={0.8} />
          ))}
        </svg>
      )
    case 'tri': {
      const P = v.right ? [[60, 200], [60, 40], [300, 200]] : [[40, 200], [150, 40], [330, 200]]
      const [A, B, C] = P
      const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
      const cx = (A[0] + B[0] + C[0]) / 3
      const cy = (A[1] + B[1] + C[1]) / 3
      const toward = (p: number[], k: number) => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k]
      const off = (m: number[], k = 22) => {
        const dx = m[0] - cx
        const dy = m[1] - cy
        const d = Math.hypot(dx, dy)
        return [m[0] + (dx / d) * k, m[1] + (dy / d) * k]
      }
      // sides: [AB, BC, CA]
      const sides = [mid(A, B), mid(B, C), mid(C, A)].map((m) => off(m))
      return (
        <svg viewBox="0 0 370 240" width="100%" style={{ maxWidth: 400 }}>
          <polygon points={P.map((q) => q.join(',')).join(' ')} fill={FILL} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          {v.right && <path d={`M60,180 h20 v20`} fill="none" stroke={INK} strokeWidth={1.5} />}
          {v.height && !v.right && (
            <g>
              <line x1={B[0]} y1={B[1]} x2={B[0]} y2={200} stroke={RED} strokeWidth={1.8} strokeDasharray="6 5" />
              <path d={`M${B[0]},188 h12 v12`} fill="none" stroke={RED} strokeWidth={1.3} />
              <L x={B[0] + 8} y={130} anchor="start" color={RED}>{v.height}</L>
            </g>
          )}
          {v.ticks?.map((t, i) => {
            if (!t) return null
            const [p, q] = [P[i], P[(i + 1) % 3]]
            const m = mid(p, q)
            const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2
            const dx = Math.cos(ang) * 7
            const dy = Math.sin(ang) * 7
            return <line key={'k' + i} x1={m[0] - dx} y1={m[1] - dy} x2={m[0] + dx} y2={m[1] + dy} stroke={INK} strokeWidth={2.2} />
          })}
          {v.angles?.map((a, i) => a && <L key={i} x={toward(P[i], 0.28)[0]} y={toward(P[i], 0.28)[1]} color={RED}>{a}</L>)}
          {v.sides?.map((s, i) => s && <L key={i} x={sides[i][0]} y={sides[i][1]} color={BLUE}>{s}</L>)}
        </svg>
      )
    }
    case 'rect': {
      const shape = v.shape ?? 'rect'
      const pts =
        shape === 'rect' ? '60,40 300,40 300,170 60,170' : shape === 'para' ? '100,40 330,40 290,170 60,170' : '120,40 250,40 320,170 50,170'
      return (
        <svg viewBox="0 0 380 215" width="100%" style={{ maxWidth: 400 }}>
          <polygon points={pts} fill={FILL} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          {shape !== 'rect' && <line x1={shape === 'para' ? 100 : 120} y1={40} x2={shape === 'para' ? 100 : 120} y2={170} stroke={RED} strokeDasharray="5 5" strokeWidth={1.5} />}
          {shape !== 'rect' && <path d={`M${shape === 'para' ? 100 : 120},158 h12 v12`} fill="none" stroke={RED} strokeWidth={1.2} />}
          <L x={shape === 'trap' ? 185 : 180} y={192} color={BLUE}>{v.w}</L>
          {shape === 'rect' ? <L x={326} y={105} color={BLUE} anchor="start">{v.h}</L> : <L x={shape === 'para' ? 92 : 112} y={105} color={RED} anchor="end">{v.h}</L>}
          {v.top && <L x={185} y={24} color={BLUE}>{v.top}</L>}
          {v.slant && <L x={shape === 'para' ? 330 : 300} y={100} anchor="start" color={INK}>{v.slant}</L>}
        </svg>
      )
    }
    case 'circle':
      return (
        <svg viewBox="0 0 240 220" width={220}>
          <circle cx={120} cy={110} r={90} fill={FILL} stroke={INK} strokeWidth={2.5} />
          <circle cx={120} cy={110} r={3.5} fill={INK} />
          {v.r && (
            <>
              <line x1={120} y1={110} x2={210} y2={110} stroke={RED} strokeWidth={2} />
              <L x={165} y={96} color={RED}>{v.r}</L>
            </>
          )}
          {v.d && (
            <>
              <line x1={30} y1={110} x2={210} y2={110} stroke={BLUE} strokeWidth={2} />
              <L x={120} y={96} color={BLUE}>{v.d}</L>
            </>
          )}
        </svg>
      )
    case 'angles': {
      const [a, b] = v.labels
      if (v.kind === 'supp')
        return (
          <svg viewBox="0 0 360 160" width="100%" style={{ maxWidth: 380 }}>
            <line x1={20} y1={130} x2={340} y2={130} stroke={INK} strokeWidth={2.5} />
            <line x1={180} y1={130} x2={260} y2={20} stroke={INK} strokeWidth={2.5} />
            <path d="M 215 130 A 35 35 0 0 0 200 102" fill="none" stroke={RED} strokeWidth={2} />
            <path d="M 140 130 A 40 40 0 0 1 203 98" fill="none" stroke={BLUE} strokeWidth={2} />
            <L x={238} y={112} color={RED}>{a}</L>
            <L x={128} y={98} color={BLUE}>{b}</L>
          </svg>
        )
      if (v.kind === 'comp')
        return (
          <svg viewBox="0 0 260 200" width={240}>
            <line x1={40} y1={170} x2={240} y2={170} stroke={INK} strokeWidth={2.5} />
            <line x1={40} y1={170} x2={40} y2={20} stroke={INK} strokeWidth={2.5} />
            <line x1={40} y1={170} x2={200} y2={60} stroke={INK} strokeWidth={2.5} />
            <path d="M40,150 h20 v20" fill="none" stroke={INK} strokeWidth={1.3} />
            <path d="M 110 170 A 70 70 0 0 0 98 131" fill="none" stroke={RED} strokeWidth={2} />
            <path d="M 40 110 A 60 60 0 0 1 89 136" fill="none" stroke={BLUE} strokeWidth={2} />
            <L x={135} y={150} color={RED}>{a}</L>
            <L x={78} y={90} color={BLUE}>{b}</L>
          </svg>
        )
      return (
        <svg viewBox="0 0 320 200" width="100%" style={{ maxWidth: 340 }}>
          <line x1={30} y1={170} x2={290} y2={30} stroke={INK} strokeWidth={2.5} />
          <line x1={30} y1={30} x2={290} y2={170} stroke={INK} strokeWidth={2.5} />
          <L x={90} y={100} color={RED}>{a}</L>
          <L x={230} y={100} color={BLUE}>{b}</L>
        </svg>
      )
    }
    case 'plane': {
      const R = v.range ?? 6
      const S = 300
      const u = S / (2 * R)
      const X = (x: number) => S / 2 + x * u
      const Y = (y: number) => S / 2 - y * u
      const grid: number[] = []
      for (let k = -R; k <= R; k++) grid.push(k)
      const curve = (f: (x: number) => number) => {
        const pts: string[] = []
        for (let x = -R; x <= R; x += R / 60) {
          const y = f(x)
          if (Math.abs(y) <= R * 1.6) pts.push(`${X(x).toFixed(1)},${Y(y).toFixed(1)}`)
        }
        return pts.join(' ')
      }
      return (
        <svg viewBox={`-6 -6 ${S + 12} ${S + 12}`} width="100%" style={{ maxWidth: 320 }}>
          <defs>
            <clipPath id="pc">
              <rect x={0} y={0} width={S} height={S} />
            </clipPath>
          </defs>
          {grid.map((k) => (
            <g key={k}>
              <line x1={X(k)} x2={X(k)} y1={0} y2={S} stroke="var(--gridline)" strokeWidth={1} />
              <line y1={Y(k)} y2={Y(k)} x1={0} x2={S} stroke="var(--gridline)" strokeWidth={1} />
            </g>
          ))}
          <line x1={0} x2={S} y1={Y(0)} y2={Y(0)} stroke={INK} strokeWidth={1.8} />
          <line y1={0} y2={S} x1={X(0)} x2={X(0)} stroke={INK} strokeWidth={1.8} />
          {grid.filter((k) => k !== 0 && k % (R > 8 ? 2 : 1) === 0).map((k) => (
            <g key={'t' + k}>
              <text x={X(k)} y={Y(0) + 13} fontSize={9} textAnchor="middle" fill="var(--ink-2)">{k}</text>
              <text x={X(0) - 5} y={Y(k) + 3} fontSize={9} textAnchor="end" fill="var(--ink-2)">{k}</text>
            </g>
          ))}
          <g clipPath="url(#pc)">
            {(v.lines ?? []).map((l, i) => (
              <polyline key={i} points={curve((x) => l.m * x + l.b)} fill="none" stroke={i ? BLUE : RED} strokeWidth={2.5} />
            ))}
            {v.parabola && <polyline points={curve((x) => v.parabola!.a * x * x + v.parabola!.b * x + v.parabola!.c)} fill="none" stroke={RED} strokeWidth={2.5} />}
            {v.segment && <line x1={X(v.segment[0][0])} y1={Y(v.segment[0][1])} x2={X(v.segment[1][0])} y2={Y(v.segment[1][1])} stroke={BLUE} strokeWidth={2.5} />}
          </g>
          {(v.points ?? []).map((pt, i) => (
            <g key={i}>
              <circle cx={X(pt.x)} cy={Y(pt.y)} r={5} fill={RED} stroke="var(--paper)" strokeWidth={1.5} />
              {pt.label && (
                <text x={X(pt.x) + 8} y={Y(pt.y) - 8} fontSize={13} fill={INK} className="svg-label">
                  {pt.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      )
    }
    case 'box':
      return (
        <svg viewBox="0 0 340 220" width="100%" style={{ maxWidth: 360 }}>
          <polygon points="50,90 230,90 230,190 50,190" fill={FILL} stroke={INK} strokeWidth={2.2} />
          <polygon points="50,90 110,40 290,40 230,90" fill={FILL} stroke={INK} strokeWidth={2.2} />
          <polygon points="230,90 290,40 290,140 230,190" fill="var(--fill-2)" stroke={INK} strokeWidth={2.2} />
          <L x={140} y={208} color={BLUE}>{v.l}</L>
          <L x={276} y={176} color={BLUE} anchor="start">{v.w}</L>
          <L x={40} y={140} color={RED} anchor="end">{v.h}</L>
        </svg>
      )
    case 'cylinder':
      return (
        <svg viewBox="0 0 260 240" width={230}>
          <path d="M50,50 v140 a80,22 0 0 0 160,0 v-140" fill={FILL} stroke={INK} strokeWidth={2.2} />
          <ellipse cx={130} cy={50} rx={80} ry={22} fill="var(--fill-2)" stroke={INK} strokeWidth={2.2} />
          <line x1={130} y1={50} x2={210} y2={50} stroke={RED} strokeWidth={2} />
          <L x={170} y={38} color={RED}>{v.r}</L>
          <L x={222} y={122} color={BLUE} anchor="start">{v.h}</L>
        </svg>
      )
    case 'similar': {
      const tri = (s: number, ox: number, labels: [string, string, string], color: string) => {
        const A = [ox, 180]
        const B = [ox + 40 * s, 180 - 70 * s]
        const C = [ox + 110 * s, 180]
        return (
          <g>
            <polygon points={[A, B, C].map((q) => q.join(',')).join(' ')} fill={FILL} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
            <L x={(A[0] + B[0]) / 2 - 14} y={(A[1] + B[1]) / 2} anchor="end" color={color}>{labels[0]}</L>
            <L x={(B[0] + C[0]) / 2 + 12} y={(B[1] + C[1]) / 2} anchor="start" color={color}>{labels[1]}</L>
            <L x={(A[0] + C[0]) / 2} y={198} color={color}>{labels[2]}</L>
          </g>
        )
      }
      return (
        <svg viewBox="0 0 420 215" width="100%" style={{ maxWidth: 440 }}>
          {tri(1, 30, v.small, BLUE)}
          {tri(1.8, 190, v.big, RED)}
        </svg>
      )
    }
    case 'balance':
      return (
        <svg viewBox="0 0 400 170" width="100%" style={{ maxWidth: 420 }}>
          <polygon points="200,150 180,165 220,165" fill={INK} />
          <line x1={200} y1={150} x2={200} y2={70} stroke={INK} strokeWidth={3} />
          <line x1={40} y1={70} x2={360} y2={70} stroke={INK} strokeWidth={3} />
          <rect x={30} y={30} width={140} height={40} rx={6} fill={FILL} stroke={INK} strokeWidth={1.5} />
          <rect x={230} y={30} width={140} height={40} rx={6} fill={FILL} stroke={INK} strokeWidth={1.5} />
          <L x={100} y={50} size={17}>{v.left}</L>
          <L x={300} y={50} size={17}>{v.right}</L>
        </svg>
      )
    case 'tape': {
      const total = v.parts.reduce((s, q) => s + q.size, 0)
      let x = 10
      const W = 440
      return (
        <svg viewBox={`0 0 ${W + 20} ${v.total ? 92 : 60}`} width="100%" style={{ maxWidth: 480 }}>
          {v.parts.map((q, i) => {
            const w = (q.size / total) * W
            const el = (
              <g key={i}>
                <rect x={x} y={10} width={w} height={38} fill={i % 2 ? 'var(--fill-2)' : FILL} stroke={INK} strokeWidth={1.5} />
                <L x={x + w / 2} y={29} size={13}>{q.label}</L>
              </g>
            )
            x += w
            return el
          })}
          {v.total && (
            <>
              <path d={`M10,58 v8 H${W + 10} v-8`} fill="none" stroke={RED} strokeWidth={1.5} />
              <L x={W / 2 + 10} y={80} color={RED}>{v.total}</L>
            </>
          )}
        </svg>
      )
    }
  }
}
