// Core content model. Every skill is a *generator*, so practice never runs out
// and every problem carries its own hints, worked solution and misconception checks.

export interface Rng {
  /** integer in [a, b] inclusive */
  int(a: number, b: number): number
  /** integer in [a, b] excluding 0 */
  nz(a: number, b: number): number
  pick<T>(arr: readonly T[]): T
  chance(p: number): boolean
  shuffle<T>(arr: readonly T[]): T[]
}

export type Level = 1 | 2 | 3

export type Answer =
  /** A number. Accepts 3, -2.5, 3/4, 1 1/2. `simplest` requires a fraction in lowest terms. */
  | { kind: 'num'; value: number; tol?: number; simplest?: boolean; unit?: string }
  /** Multiple choice; options are rich text. */
  | { kind: 'choice'; options: string[]; correct: number }
  /** An algebraic expression, checked by evaluating at random points. */
  | { kind: 'expr'; expr: string; form?: 'factored' | 'expanded' | 'simplified'; prefix?: string }
  /** An ordered pair (x, y). */
  | { kind: 'pair'; x: number; y: number }
  /** A set of numbers in any order, e.g. both solutions of a quadratic. */
  | { kind: 'set'; values: number[] }
  /** An inequality in x, e.g. x > 3. */
  | { kind: 'ineq'; op: '<' | '>' | '<=' | '>='; value: number }

/** A wrong answer we can recognise, with a targeted explanation of the likely mistake. */
export interface Misconception {
  /** numeric value of the wrong answer (for num answers) … */
  value?: number
  /** … or a custom matcher over the raw input + parsed number */
  when?: (raw: string, n: number | null) => boolean
  say: string
}

export interface Step {
  /** rich text (supports $tex$, **bold**) */
  text: string
  /** optional display math shown under the text */
  math?: string
}

export interface Problem {
  prompt: string
  answer: Answer
  /** hint ladder: nudge → strategy → almost the answer */
  hints: string[]
  /** full worked solution */
  steps: Step[]
  mistakes?: Misconception[]
  visual?: Visual
  /** short placeholder in the answer box, e.g. "e.g. 3/4" */
  placeholder?: string
}

// ── Static diagrams that problems can attach ────────────────────────────────
export type Visual =
  | { type: 'numberline'; min: number; max: number; marks?: number[]; jumps?: { from: number; to: number; label?: string }[]; dot?: number }
  | { type: 'fractionbars'; bars: { parts: number; shaded: number; label?: string }[] }
  | { type: 'grid100'; shaded: number }
  | { type: 'array'; rows: number; cols: number }
  /** angles at vertices [A, B, C]; sides [AB, BC, CA] (A bottom-left, B apex, C bottom-right).
   *  `height` draws a dashed altitude from B to the base CA with that label; `ticks` marks equal sides. */
  | { type: 'tri'; angles?: [string, string, string]; sides?: [string, string, string]; right?: boolean; height?: string; ticks?: [boolean, boolean, boolean] }
  | { type: 'rect'; w: string; h: string; shape?: 'rect' | 'para' | 'trap'; top?: string; slant?: string }
  | { type: 'circle'; r?: string; d?: string }
  | { type: 'angles'; kind: 'supp' | 'comp' | 'vert'; labels: [string, string] }
  | { type: 'plane'; range?: number; points?: { x: number; y: number; label?: string }[]; lines?: { m: number; b: number }[]; segment?: [[number, number], [number, number]]; parabola?: { a: number; b: number; c: number } }
  | { type: 'box'; l: string; w: string; h: string }
  | { type: 'cylinder'; r: string; h: string }
  | { type: 'similar'; small: [string, string, string]; big: [string, string, string] }
  | { type: 'balance'; left: string; right: string }
  | { type: 'tape'; parts: { label: string; size: number }[]; total?: string }

// ── Interactive explorers used on Learn cards ───────────────────────────────
export type Explorer =
  | { w: 'numberline'; mode: 'add' | 'subtract' | 'integers' }
  | { w: 'placevalue' }
  | { w: 'area' }
  | { w: 'groups' }
  | { w: 'array' }
  | { w: 'fraction' }
  | { w: 'fractionadd' }
  | { w: 'percent' }
  | { w: 'exponent' }
  | { w: 'ratio' }
  | { w: 'balance' }
  | { w: 'line' }
  | { w: 'parabola' }
  | { w: 'triangle' }
  | { w: 'pythag' }
  | { w: 'circle' }
  | { w: 'rect' }
  | { w: 'angles' }

export type Card =
  /** A key idea. `math` is display TeX. */
  | { kind: 'idea'; title: string; body: string; math?: string }
  /** Play with an interactive model, guided by a prompt. */
  | { kind: 'explore'; title: string; body: string; widget: Explorer; task?: string }
  /** A quick conceptual check (not computation). */
  | { kind: 'check'; question: string; options: string[]; correct: number; explain: string }
  /** A common trap, shown as wrong vs. right. */
  | { kind: 'trap'; title: string; wrong: string; right: string; why: string }

export type UnitId = 'arith' | 'pre' | 'alg' | 'geo'

export interface Skill {
  id: string
  unit: UnitId
  title: string
  /** one-line summary shown on the map */
  blurb: string
  /** skill ids that should come first */
  prereqs: string[]
  /** real-world reason this matters (one or two sentences) */
  why: string
  learn: Card[]
  generate(rng: Rng, level: Level): Problem
}

export interface Unit {
  id: UnitId
  title: string
  tagline: string
  color: string
  skills: Skill[]
}
