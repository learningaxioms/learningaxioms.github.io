import type { Misconception, Problem, Rng, Skill, Step } from '../engine/types'
import { choices, coef, fracTex, gcd, lcm, lin, p as paren, reduce, sgn, sterm } from '../engine/rng'
import { normalize, parseExpr, parseNum } from '../engine/parse'

// ALGEBRA I — equations, inequalities, lines, functions, systems, exponents, polynomials, quadratics.
// Every generator builds its problems *backwards from a clean answer*, so the numbers stay friendly,
// and every problem carries a hint ladder, a worked solution and misconception checks.

// ── formatting helpers ──────────────────────────────────────────────────────

/** Polynomial from coefficients (highest power first). `tex` adds braces to exponents. */
function poly(cs: number[], v = 'x', tex = true): string {
  const deg = cs.length - 1
  const parts: string[] = []
  cs.forEach((c, i) => {
    if (c === 0) return
    const e = deg - i
    const vp = e === 0 ? '' : e === 1 ? v : tex ? `${v}^{${e}}` : `${v}^${e}`
    const mag = Math.abs(c)
    const body = vp === '' ? `${mag}` : mag === 1 ? vp : `${mag}${vp}`
    parts.push(parts.length === 0 ? (c < 0 ? `-${body}` : body) : c < 0 ? `- ${body}` : `+ ${body}`)
  })
  return parts.length ? parts.join(' ') : '0'
}
/** Plain-text polynomial (for answers the checker parses). */
const polyS = (cs: number[], v = 'x') => poly(cs, v, false)

/** Monomial c·v^e. */
function mono(c: number, e: number, v = 'x', tex = true): string {
  if (c === 0) return '0'
  if (e === 0) return `${c}`
  const pw = e === 1 ? v : tex ? `${v}^{${e}}` : `${v}^${e}`
  return coef(c, pw)
}

/** Linear factor (ax + b) in parentheses; bare "ax" if b = 0. */
const fac = (a: number, b: number) => (b === 0 ? coef(a, 'x') : `(${coef(a, 'x')} ${sgn(b)})`)

/** a·k shown as a substitution: 3·(−2), (−2), −(−2) */
const mulT = (a: number, k: number) => (a === 1 ? `(${k})` : a === -1 ? `-(${k})` : `${a}(${k})`)

/** Polynomial with x replaced by (k), e.g. 2(−3)^2 − 4(−3) + 1 */
function subPoly(cs: number[], k: number): string {
  const deg = cs.length - 1
  const parts: string[] = []
  cs.forEach((c, i) => {
    if (c === 0) return
    const e = deg - i
    const body = e === 0 ? '' : e === 1 ? `(${k})` : `(${k})^{${e}}`
    const mag = Math.abs(c)
    const t = body === '' ? `${mag}` : mag === 1 ? body : `${mag}${body}`
    parts.push(parts.length === 0 ? (c < 0 ? `-${t}` : t) : c < 0 ? `- ${t}` : `+ ${t}`)
  })
  return parts.length ? parts.join(' ') : '0'
}

/** A sum of numbers written cleanly: [12, -5, 0, 3] → "12 - 5 + 3" */
function sumTex(vals: number[]): string {
  const nz = vals.filter((v) => v !== 0)
  if (!nz.length) return '0'
  return nz.map((v, i) => (i === 0 ? `${v}` : sgn(v))).join(' ')
}

const evalPoly = (cs: number[], x: number) => cs.reduce((acc, c) => acc * x + c, 0)

function mulPoly(a: number[], b: number[]): number[] {
  const out: number[] = Array(a.length + b.length - 1).fill(0)
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)))
  return out
}

/** Equation ax + by = c in TeX. */
const eqTex = (a: number, b: number, c: number) => `${coef(a, 'x')} ${sterm(b, 'y')} = ${c}`

/** Linear expression m·x + b where m = n/d may be a fraction. */
function lineExpr(n: number, d: number, b: number, tex: boolean): string {
  const [a, q] = reduce(n, d)
  let head: string
  if (a === 0) return `${b}`
  if (q === 1) head = coef(a, 'x')
  else {
    const f = tex ? `\\frac{${Math.abs(a)}}{${q}}x` : `(${Math.abs(a)}/${q})x`
    head = a < 0 ? `-${f}` : f
  }
  return b === 0 ? head : `${head} ${sgn(b)}`
}

function pickNot(rng: Rng, lo: number, hi: number, bad: number[]): number {
  for (;;) {
    const v = rng.int(lo, hi)
    if (!bad.includes(v)) return v
  }
}

// ── answer matchers for misconceptions ──────────────────────────────────────
const PTS = [-2.37, -0.61, 0.83, 1.71, 3.29, 4.13]
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b))
const stripLhs = (raw: string) => normalize(raw).replace(/^\s*[a-z](\([a-z]\))?\s*=\s*/i, '')

/** Does the raw input equal `target` as an expression? */
function sameExpr(raw: string, target: string): boolean {
  const u = parseExpr(stripLhs(raw))
  const t = parseExpr(target)
  if (!u || !t) return false
  const vars = [...new Set([...t.vars, ...u.vars])].sort()
  for (let k = 0; k < PTS.length; k++) {
    const env: Record<string, number> = {}
    vars.forEach((v, j) => (env[v] = PTS[(k + j * 2) % PTS.length] + j * 0.37))
    const a = u.eval(env)
    const b = t.eval(env)
    if (!isFinite(b)) continue
    if (!isFinite(a) || Math.abs(a - b) > 1e-7 * Math.max(1, Math.abs(b))) return false
  }
  return true
}
const isExpr = (target: string) => (raw: string) => sameExpr(raw, target)

/** Read a list of numbers: "2, -3", "x = 2 or x = -3", "(4, 5)". */
function readNums(raw: string): number[] | null {
  const s = normalize(raw)
    .toLowerCase()
    .replace(/[a-z]\s*=\s*/g, '')
    .replace(/\b(and|or)\b/g, ',')
    .replace(/[{}()]/g, '')
  const parts = s.split(/[,;]+/).map((t) => t.trim()).filter(Boolean)
  const out: number[] = []
  for (const t of parts) {
    const n = parseNum(t)
    if (!n) return null
    out.push(n.value)
  }
  return out
}
const uniq = (xs: number[]) => xs.filter((v, i) => xs.findIndex((w) => near(v, w)) === i)

/** The input is exactly this set of numbers. */
const setIs = (vals: number[]) => (raw: string) => {
  const got = readNums(raw)
  if (!got || !got.length) return false
  const g = uniq(got)
  const w = uniq(vals)
  return g.length === w.length && g.every((x) => w.some((y) => near(x, y)))
}
/** For pair answers: is the x-coordinate right but y wrong (or vice versa)? */
const pairPart = (x: number, y: number, right: 'x' | 'y') => (raw: string) => {
  const got = readNums(raw)
  if (!got || got.length !== 2) return false
  return right === 'x' ? near(got[0], x) && !near(got[1], y) : near(got[1], y) && !near(got[0], x)
}
/** For choice answers: the student picked option i. */
const picked = (i: number) => (raw: string) => raw.trim() === String(i)

/**
 * Factoring diagnosis: the input is a quadratic with the right x² coefficient and
 * the right constant (so the two numbers multiply correctly) but the wrong middle term.
 */
const productRightSumWrong = (A: number, B: number, C: number) => (raw: string) => {
  const u = parseExpr(stripLhs(raw))
  if (!u || [...u.vars].some((v) => v !== 'x')) return false
  const f = (x: number) => u.eval({ x })
  const f0 = f(0)
  const f1 = f(1)
  const fm = f(-1)
  const a = (f1 + fm - 2 * f0) / 2
  const b = (f1 - fm) / 2
  if (![2, 3, -2].every((x) => near(f(x), a * x * x + b * x + f0))) return false
  return near(a, A) && near(f0, C) && !near(b, B)
}

// ── equation-solving steps shared by several skills ─────────────────────────
/** “Subtract 3x from” / “Add 3x to” both sides — never “subtract −3x”. */
const moveTerm = (c: number, v = 'x') => `${c < 0 ? 'Add' : 'Subtract'} $${coef(Math.abs(c), v)}$ ${c < 0 ? 'to' : 'from'} both sides`

/** Steps to solve Ax + B = C (A ≠ 0) the standard way: clear B, then divide by A. */
function solveSteps(A: number, B: number, C: number): Step[] {
  const steps: Step[] = []
  if (B !== 0)
    steps.push({
      text: `${B > 0 ? 'Subtract' : 'Add'} $${Math.abs(B)}$ ${B > 0 ? 'from' : 'to'} both sides to clear the constant.`,
      math: `${coef(A, 'x')} = ${C - B}`,
    })
  if (A !== 1)
    steps.push({
      text: A === -1 ? 'Multiply both sides by $-1$.' : `Divide both sides by $${A}$.`,
      math: `x = ${fracTex(C - B, A)}`,
    })
  return steps
}

// ════════════════════════════════════════════════════════════════════════════
// 1. TWO-STEP EQUATIONS
// ════════════════════════════════════════════════════════════════════════════

function twoStepWord(rng: Rng): Problem {
  const t = rng.int(0, 4)
  let A: number, B: number, x: number, unit: string, prompt: string, setup: string
  if (t === 0) {
    A = rng.int(2, 4)
    B = rng.int(3, 9)
    x = rng.int(3, 15)
    unit = 'miles'
    prompt = `A taxi charges a \\$${B} pickup fee plus \\$${A} per mile. Your ride costs \\$${A * x + B}. How many miles did you ride?`
    setup = 'fee + (rate × miles) = total'
  } else if (t === 1) {
    A = 500 * rng.int(1, 4)
    B = 1000 * rng.int(2, 9)
    x = rng.int(2, 12)
    unit = 'minutes'
    prompt = `A jet at ${B} ft climbs at ${A} ft per minute. After how many minutes will it reach ${A * x + B} ft?`
    setup = 'start + (climb rate × minutes) = target altitude'
  } else if (t === 2) {
    const a = rng.int(6, 15)
    x = rng.int(2, 8)
    const left = rng.int(10, 40)
    A = -a
    B = left + a * x
    unit = 'hours'
    prompt = `A plane takes off with ${B} gallons of fuel and burns ${a} gallons per hour. After how many hours will ${left} gallons remain?`
    setup = 'start − (burn rate × hours) = fuel left'
  } else if (t === 3) {
    A = rng.int(5, 25)
    B = rng.int(20, 90)
    x = rng.int(3, 12)
    unit = 'weeks'
    prompt = `You have \\$${B} saved for flight lessons and add \\$${A} every week. After how many weeks will you have \\$${A * x + B}?`
    setup = 'savings now + (weekly amount × weeks) = goal'
  } else {
    A = rng.int(12, 45)
    B = rng.pick([4, 5, 6, 8, 10])
    x = rng.int(2, 8)
    unit = 'tickets'
    prompt = `Air-show tickets cost \\$${A} each, plus a one-time \\$${B} order fee. Your total is \\$${A * x + B}. How many tickets did you buy?`
    setup = 'fee + (price × tickets) = total'
  }
  const C = A * x + B
  const eq = A < 0 ? `${B} - ${-A}x = ${C}` : `${A}x + ${B} = ${C}`
  return {
    prompt,
    answer: { kind: 'num', value: x, unit },
    hints: [
      `Let $x$ be the unknown. The pattern is: ${setup}.`,
      `The equation is $${eq}$.`,
      `${A < 0 ? `Subtract $${B}$ from both sides: $${coef(A, 'x')} = ${C - B}$. Then divide by $${A}$.` : `Subtract $${B}$ from both sides: $${A}x = ${C - B}$. Then divide by $${A}$.`}`,
    ],
    steps: [
      { text: `Let $x$ = number of ${unit}. Translate the story:`, math: eq },
      ...solveSteps(A, B, C),
      { text: `Answer: **${x} ${unit}**. Check: $${mulT(A, x)} ${sgn(B)} = ${C}$ ✓` },
    ],
    mistakes: [
      { value: (C + B) / A, say: `The fixed amount went the wrong way. Undo “${A < 0 ? 'starting with' : 'adding'} ${B}” by **subtracting** ${B} from both sides.` },
      { value: C / A, say: `You divided the total by the rate but ignored the fixed ${B}. Remove it first, then divide.` },
      { value: Math.abs(C - B), say: `That’s the change caused by the rate (${Math.abs(C - B)}). Divide it by ${Math.abs(A)} to find how many ${unit}.` },
    ],
  }
}

const twoStep: Skill = {
  id: 'two-step',
  unit: 'alg',
  title: 'Two-step equations',
  blurb: 'Undo the operations in reverse order: constants first, then the coefficient.',
  prereqs: ['one-step'],
  why: 'Any “flat fee plus a rate” situation — a taxi, a phone plan, a climb from a starting altitude — is a two-step equation waiting to be solved.',
  learn: [
    { kind: 'idea', title: 'Unwrap it like a package', body: 'In $3x + 5 = 20$, two things happened to $x$: it was **multiplied by 3**, then **5 was added**. To get $x$ back, undo those steps in **reverse order** — the way you take off your shoes before your socks.', math: '3x + 5 = 20 \\;\\Rightarrow\\; 3x = 15 \\;\\Rightarrow\\; x = 5' },
    { kind: 'explore', title: 'Keep the scale level', body: 'The left pan holds $x$-boxes and some loose units; the right pan balances them. Whatever you do to one pan, you must do to the other — or the scale tips.', widget: { w: 'balance' }, task: 'Try dividing before you remove the loose units. Why won’t the scale let you? Then solve it properly and read the check.' },
    { kind: 'idea', title: 'Why subtract before you divide', body: 'Dividing is legal at any time — but it must divide **every** term. $\\frac{3x + 5}{3} = x + \\frac{5}{3}$, which drags fractions in. Clearing the constant first keeps every number whole.' },
    { kind: 'trap', title: 'Dividing only part of a side', wrong: '$3x + 5 = 20 \\Rightarrow x + 5 = \\frac{20}{3}$', right: '$3x + 5 = 20 \\Rightarrow 3x = 15 \\Rightarrow x = 5$', why: 'Dividing by 3 must hit **every** term on both sides — including the 5. Subtracting the 5 first avoids the mess entirely.' },
    { kind: 'check', question: 'What is the best first move to solve $\\frac{x}{4} - 3 = 2$?', options: ['Add 3 to both sides', 'Subtract 3 from both sides', 'Divide both sides by 4', 'Multiply only the 2 by 4'], correct: 0, explain: 'Undo the **last** thing done to $x$ first: the −3. Adding 3 gives $\\frac{x}{4} = 5$, then multiplying by 4 gives $x = 20$.' },
    { kind: 'check', question: 'You solved $2x + 7 = 1$ and got $x = -3$. How can you be sure?', options: ['Substitute it: $2(-3) + 7 = 1$ ✓', 'Solve it again the same way', 'Negative answers are always wrong', 'Check that $-3 < 1$'], correct: 0, explain: 'Plugging the answer back into the **original** equation is the gold-standard check. If both sides match, you’re right.' },
  ],
  generate(rng, level) {
    if (level === 3 && rng.chance(0.45)) return twoStepWord(rng)
    if (level >= 2 && rng.chance(0.3)) {
      // x/a + b = c
      const a = level === 3 ? rng.pick([2, 3, 4, 5, 6, -2, -3, -4]) : rng.int(2, 6)
      const k = rng.nz(-8, 8)
      const x = a * k
      const b = rng.nz(-12, 12)
      const c = k + b
      const lhs = a > 0 ? `\\frac{x}{${a}}` : `-\\frac{x}{${-a}}`
      return {
        prompt: `Solve for $x$: $${lhs} ${sgn(b)} = ${c}$`,
        answer: { kind: 'num', value: x },
        hints: [
          `Two things happened to $x$: it was divided by $${a}$, then $${Math.abs(b)}$ was ${b > 0 ? 'added' : 'subtracted'}. Undo them in reverse order.`,
          `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ on both sides: $${lhs} = ${k}$.`,
          `Division is undone by multiplication: multiply both sides by $${a}$.`,
        ],
        steps: [
          { text: `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ ${b > 0 ? 'from' : 'to'} both sides.`, math: `${lhs} = ${k}` },
          { text: `Multiply both sides by $${a}$.`, math: `x = ${k}\\cdot ${paren(a)} = ${x}` },
          { text: 'Check:', math: `${x} \\div ${paren(a)} ${sgn(b)} = ${k} ${sgn(b)} = ${c}\\ \\checkmark` },
        ],
        mistakes: [
          { value: (c - b) / a, say: `$x$ is being **divided** by ${a}, so undo it by **multiplying** by ${a}, not dividing.` },
          { value: (c + b) * a, say: `The constant moved the wrong way. To undo $${sgn(b).replace(/ /g, '')}$, ${b > 0 ? 'subtract' : 'add'} ${Math.abs(b)}.` },
          { value: c * a - b, say: `Looks like you multiplied only the right side by ${a}. If you multiply first, **every** term gets multiplied — easier to clear the ${Math.abs(b)} first.` },
        ],
      }
    }
    const x = level === 1 ? rng.int(1, 12) : rng.nz(-10, 10)
    const a = level === 1 ? rng.int(2, 9) : pickNot(rng, -9, 9, [-1, 0, 1])
    const b = level === 1 ? (rng.chance(0.5) ? 1 : -1) * rng.int(1, 15) : rng.nz(-15, 15)
    const c = a * x + b
    const form = level === 1 ? 'std' : rng.pick(['std', 'std', 'constFirst', 'swap'])
    const eq = form === 'std' ? `${coef(a, 'x')} ${sgn(b)} = ${c}` : form === 'constFirst' ? `${b} ${sterm(a, 'x')} = ${c}` : `${c} = ${coef(a, 'x')} ${sgn(b)}`
    const mistakes: Misconception[] = [
      { value: (c + b) / a, say: `The constant went the wrong way. To undo $${sgn(b).replace(/ /g, '')}$ you ${b > 0 ? 'subtract' : 'add'} ${Math.abs(b)} on both sides.` },
      { value: c / a - b, say: `You divided before clearing the constant — and only divided part of the equation. Clear the ${Math.abs(b)} first, then divide.` },
      { value: c - b, say: `That’s the value of $${coef(a, 'x')}$, not $x$. One more step: divide by ${a}.` },
    ]
    if (a < 0) mistakes.push({ value: -x, say: `Sign slip: dividing by a negative ($${a}$) changes the sign of the result.` })
    return {
      prompt: `Solve for $x$: $${eq}$`,
      answer: { kind: 'num', value: x },
      hints: [
        `Two things happened to $x$: it was multiplied by $${a}$, then ${b > 0 ? `$${b}$ was added` : `$${-b}$ was subtracted`}. Undo them in reverse order.${form === 'swap' ? ' (It doesn’t matter that $x$ is on the right.)' : ''}`,
        `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ ${b > 0 ? 'from' : 'to'} both sides: $${coef(a, 'x')} = ${c - b}$.`,
        `Now divide both sides by $${a}$: $x = ${c - b} \\div ${paren(a)}$.`,
      ],
      steps: [
        ...(form !== 'std' ? [{ text: 'Rewrite with the $x$-term first on the left:', math: `${coef(a, 'x')} ${sgn(b)} = ${c}` }] : []),
        ...solveSteps(a, b, c),
        { text: 'Check in the original equation:', math: `${a}\\cdot ${paren(x)} ${sgn(b)} = ${a * x} ${sgn(b)} = ${c}\\ \\checkmark` },
      ],
      mistakes,
      visual: level === 1 ? { type: 'balance', left: `${coef(a, 'x')} ${sgn(b)}`, right: `${c}` } : undefined,
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 2. MULTI-STEP EQUATIONS
// ════════════════════════════════════════════════════════════════════════════

/** Steps for ax + b = dx + e (a ≠ d): move the smaller x-term so the coefficient stays positive. */
function bothSidesSteps(a: number, b: number, d: number, e: number): Step[] {
  if (a > d)
    return [{ text: `${moveTerm(d)} to gather the $x$-terms on the left.`, math: `${lin(a - d, b)} = ${e}` }, ...solveSteps(a - d, b, e)]
  return [
    { text: `${moveTerm(a)} — this keeps the $x$-coefficient positive.`, math: `${b} = ${lin(d - a, e)}` },
    { text: 'Read it the other way round:', math: `${lin(d - a, e)} = ${b}` },
    ...solveSteps(d - a, e, b),
  ]
}

const SPECIAL = ['Exactly one solution', 'No solution', 'Infinitely many solutions (every real number works)']

const multiStep: Skill = {
  id: 'multi-step',
  unit: 'alg',
  title: 'Multi-step equations',
  blurb: 'Distribute, combine like terms, gather the variables on one side — then it’s a two-step.',
  prereqs: ['two-step', 'like-terms'],
  why: 'Real comparisons — “when do two phone plans cost the same?” or “when does the faster plane catch up?” — put the unknown on both sides. This is how you untangle them.',
  learn: [
    { kind: 'idea', title: 'The game plan', body: 'Every linear equation, however messy, falls to the same routine:\n1. **Distribute** to clear parentheses.\n2. **Combine like terms** on each side.\n3. **Gather** the $x$-terms on one side (add/subtract).\n4. Finish it as a **two-step** equation.', math: '3(x + 2) = x + 14 \\Rightarrow 3x + 6 = x + 14 \\Rightarrow 2x = 8 \\Rightarrow x = 4' },
    { kind: 'trap', title: 'Distributing to only the first term', wrong: '$4(x - 3) = 4x - 3$', right: '$4(x - 3) = 4x - 12$', why: 'The 4 multiplies **everything** in the parentheses. Picture 4 copies of $(x - 3)$: that’s 4 x’s and 4 minus-threes.' },
    { kind: 'trap', title: 'A minus in front of parentheses', wrong: '$5 - 2(x - 1) = 5 - 2x - 2$', right: '$5 - 2(x - 1) = 5 - 2x + 2$', why: 'You’re multiplying by $-2$, and $(-2)(-1) = +2$. Treat the minus sign as part of the number you distribute.' },
    { kind: 'idea', title: 'Gather x where it stays positive', body: 'In $2x + 9 = 5x - 3$, subtract $2x$ (the **smaller** one) from both sides: $9 = 3x - 3$. You can do it the other way too — you’ll just divide by a negative. Same answer, fewer sign slips.' },
    { kind: 'check', question: 'You simplify an equation and get $7 = 7$. What does that mean?', options: ['Every value of $x$ works — infinitely many solutions', 'The solution is $x = 7$', 'There is no solution', 'You made a mistake'], correct: 0, explain: 'The $x$’s cancelled and what’s left is always true, so **any** $x$ makes the equation true. If you got something false like $7 = 3$, there would be **no** solution.' },
  ],
  generate(rng, level) {
    const kind =
      level === 1 ? rng.pick(['dist', 'combine']) : level === 2 ? rng.pick(['both', 'distBoth', 'dist']) : rng.pick(['twoDist', 'word', 'special', 'distBoth'])
    if (kind === 'dist') {
      const a = level === 1 ? rng.int(2, 6) : pickNot(rng, -6, 6, [-1, 0, 1])
      const b = rng.nz(-8, 8)
      const x = level === 1 ? rng.int(1, 10) : rng.nz(-9, 9)
      const c = a * (x + b)
      return {
        prompt: `Solve for $x$: $${a}(${lin(1, b)}) = ${c}$`,
        answer: { kind: 'num', value: x },
        hints: [
          `Clear the parentheses first: multiply $${a}$ by **both** terms inside.`,
          `$${a}(${lin(1, b)}) = ${coef(a, 'x')} ${sgn(a * b)}$`,
          `Now it’s a two-step equation: $${coef(a, 'x')} ${sgn(a * b)} = ${c}$. (Or divide both sides by $${a}$ first: $${lin(1, b)} = ${c / a}$.)`,
        ],
        steps: [{ text: 'Distribute:', math: `${coef(a, 'x')} ${sgn(a * b)} = ${c}` }, ...solveSteps(a, a * b, c), { text: 'Check:', math: `${a}(${x} ${sgn(b)}) = ${a}\\cdot ${paren(x + b)} = ${c}\\ \\checkmark` }],
        mistakes: [
          { value: (c - b) / a, say: `You distributed to the $x$ only. The ${a} multiplies the ${Math.abs(b)} too: $${a}(${lin(1, b)}) = ${coef(a, 'x')} ${sgn(a * b)}$.` },
          { value: (c + a * b) / a, say: 'The constant moved with the wrong sign. To undo adding a number, subtract it (and vice versa).' },
          { value: c / a + b, say: `After dividing by ${a} you get $${lin(1, b)} = ${c / a}$ — now ${b > 0 ? 'subtract' : 'add'} ${Math.abs(b)}, don’t ${b > 0 ? 'add' : 'subtract'} it.` },
        ],
      }
    }
    if (kind === 'combine') {
      const a = rng.int(2, 7)
      const d = rng.int(1, 6)
      const b = rng.nz(-12, 12)
      const x = rng.int(1, 10)
      const c = (a + d) * x + b
      return {
        prompt: `Solve for $x$: $${coef(a, 'x')} ${sgn(b)} ${sterm(d, 'x')} = ${c}$`,
        answer: { kind: 'num', value: x },
        hints: ['There are two $x$-terms on the left. Combine them first.', `$${coef(a, 'x')} ${sterm(d, 'x')} = ${coef(a + d, 'x')}$`, `Solve $${coef(a + d, 'x')} ${sgn(b)} = ${c}$ as a two-step equation.`],
        steps: [{ text: 'Combine like terms:', math: `${coef(a + d, 'x')} ${sgn(b)} = ${c}` }, ...solveSteps(a + d, b, c)],
        mistakes: [
          { value: (c - b) / (a * d), say: `Like terms **add**: $${coef(a, 'x')} + ${coef(d, 'x')} = ${coef(a + d, 'x')}$, not $${a * d}x$.` },
          { value: (c - b) / a, say: `You left out the $${coef(d, 'x')}$. All the $x$-terms have to be combined.` },
        ],
      }
    }
    if (kind === 'both' || kind === 'distBoth') {
      let a = pickNot(rng, -8, 9, [0])
      let d = pickNot(rng, -8, 9, [0, a])
      const x = rng.nz(-9, 9)
      const k = kind === 'distBoth' ? pickNot(rng, -5, 5, [-1, 0, 1]) : 1
      if (kind === 'distBoth') {
        a = k
        d = pickNot(rng, -6, 8, [0, k])
      }
      const inner = rng.nz(-7, 7)
      const b = kind === 'distBoth' ? k * inner : rng.nz(-12, 12)
      const e = a * x + b - d * x
      const left = kind === 'distBoth' ? `${k}(${lin(1, inner)})` : lin(a, b)
      const mistakes: Misconception[] = [{ value: (e + b) / (a - d), say: 'A constant changed sides without changing sign. Moving a term across means subtracting it from both sides.' }]
      if (a + d !== 0) mistakes.unshift({ value: (e - b) / (a + d), say: `When $${coef(d, 'x')}$ moves to the left it becomes $${coef(-d, 'x')}$ — subtract it from both sides; don’t just carry it over.` })
      if (kind === 'distBoth') mistakes.push({ value: (e - inner) / (a - d), say: `Distribute the ${k} to **both** terms: $${k}(${lin(1, inner)}) = ${lin(k, k * inner)}$.` })
      return {
        prompt: `Solve for $x$: $${left} = ${lin(d, e)}$`,
        answer: { kind: 'num', value: x },
        hints: [
          kind === 'distBoth' ? `Distribute first: $${left} = ${lin(a, b)}$.` : 'There are $x$-terms on both sides. Gather them on one side first.',
          `${moveTerm(Math.min(a, d))} (that clears the smaller $x$-term) so the coefficient stays positive.`,
          a > d ? `You should have $${lin(a - d, b)} = ${e}$. Finish as a two-step.` : `You should have $${b} = ${lin(d - a, e)}$. Finish as a two-step.`,
        ],
        steps: [...(kind === 'distBoth' ? [{ text: 'Distribute:', math: `${lin(a, b)} = ${lin(d, e)}` }] : []), ...bothSidesSteps(a, b, d, e), { text: 'Check both sides:', math: `\\text{left} = ${a * x + b},\\quad \\text{right} = ${d * x + e}\\ \\checkmark` }],
        mistakes,
      }
    }
    if (kind === 'twoDist') {
      const a = rng.int(2, 7)
      const d = pickNot(rng, 2, 6, [a])
      const b = rng.nz(-6, 6)
      const e = rng.nz(-6, 6)
      const x = rng.nz(-8, 8)
      const f = a * (x + b) - d * (x + e)
      const B = a * b - d * e
      return {
        prompt: `Solve for $x$: $${a}(${lin(1, b)}) - ${d}(${lin(1, e)}) = ${f}$`,
        answer: { kind: 'num', value: x },
        hints: [
          `Distribute both. The second one multiplies by $-${d}$ — the minus sign comes along.`,
          `$${a}(${lin(1, b)}) - ${d}(${lin(1, e)}) = ${coef(a, 'x')} ${sgn(a * b)} ${sterm(-d, 'x')} ${sgn(-d * e)}$`,
          `Combine like terms: $${lin(a - d, B)} = ${f}$.`,
        ],
        steps: [
          { text: `Distribute (multiply the second group by $-${d}$):`, math: `${coef(a, 'x')} ${sgn(a * b)} ${sterm(-d, 'x')} ${sgn(-d * e)} = ${f}` },
          { text: 'Combine like terms:', math: `${lin(a - d, B)} = ${f}` },
          ...solveSteps(a - d, B, f),
        ],
        mistakes: [
          { value: (f - (a * b + d * e)) / (a - d), say: `The minus in front of $${d}(${lin(1, e)})$ multiplies **both** terms inside: $-${d}\\cdot${paren(e)} = ${-d * e}$.` },
          { value: (f - (a * b - e)) / (a - d), say: `Distribute the ${d} to every term in its parentheses, not just the $x$.` },
        ],
      }
    }
    if (kind === 'word') {
      const t = rng.int(0, 2)
      const a2 = rng.int(2, 8)
      const a1 = a2 + rng.int(1, 6)
      const x = rng.int(3, 15)
      const b1 = 5 * rng.int(1, 8)
      const b2 = b1 + (a1 - a2) * x
      const [what, unit, prompt] =
        t === 0
          ? ['lessons', 'lessons', `Flight school A charges a \\$${b1} sign-up fee plus \\$${a1} per simulator lesson. School B charges \\$${b2} up front plus \\$${a2} per lesson. After how many lessons do they cost the same?`]
          : t === 1
            ? ['GB', 'GB', `Phone plan A costs \\$${b1} a month plus \\$${a1} per GB of data. Plan B costs \\$${b2} a month plus \\$${a2} per GB. For how many GB do the plans cost the same?`]
            : ['miles', 'miles', `Rental company A charges \\$${b1} plus \\$${a1} per mile. Company B charges \\$${b2} plus \\$${a2} per mile. At how many miles is the cost the same?`]
      return {
        prompt,
        answer: { kind: 'num', value: x, unit },
        hints: [`Write each cost as fee + rate·$x$, where $x$ = ${what}. Then set them equal.`, `$${b1} + ${a1}x = ${b2} + ${a2}x$`, `Subtract $${a2}x$ and $${b1}$ from both sides: $${coef(a1 - a2, 'x')} = ${b2 - b1}$.`],
        steps: [
          { text: 'Set the two costs equal:', math: `${a1}x + ${b1} = ${a2}x + ${b2}` },
          { text: `Subtract $${a2}x$ from both sides:`, math: `${coef(a1 - a2, 'x')} + ${b1} = ${b2}` },
          ...solveSteps(a1 - a2, b1, b2),
          { text: `At **${x} ${unit}** both cost \\$${a1 * x + b1}.` },
        ],
        mistakes: [
          { value: (b2 + b1) / (a1 - a2), say: `When you move $${b1}$ across it must be subtracted: $${b2} - ${b1} = ${b2 - b1}$.` },
          { value: (b2 - b1) / (a1 + a2), say: `Gathering the $x$-terms means **subtracting** $${a2}x$: $${a1}x - ${a2}x = ${coef(a1 - a2, 'x')}$.` },
          { value: a1 * x + b1, say: 'That’s the cost when they match. The question asks for the number of ' + what + '.' },
        ],
      }
    }
    // special: one / none / infinite
    const a = pickNot(rng, -5, 6, [-1, 0, 1])
    const b = rng.nz(-6, 6)
    const which = rng.int(0, 2)
    const k = which === 0 ? 0 : which === 1 ? rng.nz(-5, 5) : 0
    const d = which === 2 ? pickNot(rng, -6, 6, [a, 0]) : a
    const e = which === 2 ? rng.int(-9, 9) : a * b + k
    const correctText = which === 0 ? SPECIAL[2] : which === 1 ? SPECIAL[1] : SPECIAL[0]
    const c = choices(rng, correctText, SPECIAL.filter((s) => s !== correctText))
    const idx = (s: string) => c.options.indexOf(s)
    return {
      prompt: `How many solutions does $${a}(${lin(1, b)}) = ${lin(d, e)}$ have?`,
      answer: { kind: 'choice', options: c.options, correct: c.correct },
      hints: [
        'Simplify both sides, then try to gather the $x$-terms.',
        `Left side: $${lin(a, a * b)}$. Compare its $x$-coefficient with the right side’s.`,
        which === 2 ? 'The $x$-coefficients are different, so the $x$’s won’t cancel.' : `The $x$-terms cancel. Is what’s left (${a * b} vs ${e}) true or false?`,
      ],
      steps:
        which === 2
          ? [
              { text: 'Distribute:', math: `${lin(a, a * b)} = ${lin(d, e)}` },
              { text: `The $x$-coefficients differ (${a} vs ${d}), so we can solve for one value:`, math: `x = ${fracTex(e - a * b, a - d)}` },
              { text: `**Exactly one solution** (x = $${fracTex(e - a * b, a - d)}$).` },
            ]
          : [
              { text: 'Distribute:', math: `${lin(a, a * b)} = ${lin(d, e)}` },
              { text: `${moveTerm(a)}:`, math: `${a * b} = ${e}` },
              { text: which === 0 ? 'That’s **always true**, whatever $x$ is — infinitely many solutions.' : 'That’s **never true** — no value of $x$ can fix it. No solution.' },
            ],
      mistakes: [
        ...(which !== 2 ? [{ when: picked(idx(SPECIAL[0])), say: `Try to solve it: the $${coef(a, 'x')}$ appears on both sides and cancels. No $x$ is left to solve for — so it isn’t “exactly one”.` }] : []),
        ...(which === 0 ? [{ when: picked(idx(SPECIAL[1])), say: `After the $x$’s cancel you get $${a * b} = ${e}$ — that’s **true**, so every $x$ works.` }] : []),
        ...(which === 1 ? [{ when: picked(idx(SPECIAL[2])), say: `After the $x$’s cancel you get $${a * b} = ${e}$ — that’s **false**, so no $x$ works.` }] : []),
        ...(which === 2 ? [{ when: (raw: string) => raw.trim() !== String(c.correct), say: `The $x$-coefficients are different (${a} and ${d}), so the $x$’s don’t cancel — you can solve to $x = ${fracTex(e - a * b, a - d)}$.` }] : []),
      ],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 3. INEQUALITIES
// ════════════════════════════════════════════════════════════════════════════

type Op = '<' | '>' | '<=' | '>='
const OPS: Op[] = ['<', '>', '<=', '>=']
const opTex: Record<Op, string> = { '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge' }
const flip: Record<Op, Op> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }
const graphNote = (op: Op, k: number) => `${op.includes('=') ? 'closed' : 'open'} circle at $${k}$, shade to the ${op.startsWith('<') ? 'left' : 'right'}`

/** Steps for Ax + B (op) C → x (final) k */
function ineqSteps(A: number, B: number, C: number, op: Op): Step[] {
  const steps: Step[] = []
  const k = (C - B) / A
  const final = A < 0 ? flip[op] : op
  if (B !== 0) steps.push({ text: `${B > 0 ? 'Subtract' : 'Add'} $${Math.abs(B)}$ ${B > 0 ? 'from' : 'to'} both sides (adding/subtracting never flips the sign).`, math: `${coef(A, 'x')} ${opTex[op]} ${C - B}` })
  if (A !== 1)
    steps.push(
      A > 0
        ? { text: `Divide both sides by $${A}$ — positive, so the sign stays.`, math: `x ${opTex[op]} ${fracTex(C - B, A)}` }
        : { text: `Divide both sides by $${A}$. **Dividing by a negative flips the inequality.**`, math: `x ${opTex[final]} ${fracTex(C - B, A)}` },
    )
  steps.push({ text: `Graph: ${graphNote(final, k)}. Quick test: $x = ${final.startsWith('<') ? k - 1 : k + 1}$ should work in the original.` })
  return steps
}

function ineqWord(rng: Rng): Problem {
  const t = rng.int(0, 3)
  if (t === 2) {
    // descent: b - a x > c  → x < k
    const a = 100 * rng.int(1, 5)
    const k = rng.int(3, 15)
    const c = 100 * rng.int(2, 10)
    const b = c + a * k
    return {
      prompt: `A drone at ${b} ft descends ${a} ft per minute. It must stay **above** ${c} ft. Write an inequality for the number of minutes $x$ it can keep descending.`,
      answer: { kind: 'ineq', op: '<', value: k },
      placeholder: 'e.g. x < 12',
      hints: ['Altitude after $x$ minutes = start − rate·$x$. “Above” means $>$.', `$${b} - ${a}x > ${c}$`, `Subtract ${b}, then divide by $-${a}$ — and flip the sign.`],
      steps: [{ text: 'Translate:', math: `${b} - ${a}x > ${c}` }, ...ineqSteps(-a, b, c, '>')],
      mistakes: [
        { value: (c + b) / a, say: `Subtract the starting ${b} ft from both sides: $${c} - ${b} = ${c - b}$.` },
        { value: c / a, say: `You ignored the starting altitude. Altitude after $x$ minutes is $${b} - ${a}x$.` },
      ],
    }
  }
  const [rate, start, limit, op, prompt, eqText] = (() => {
    if (t === 0) {
      const w = rng.pick([20, 25, 40, 50])
      const k = rng.int(5, 30)
      const g = 100 * rng.int(2, 9)
      return [w, g, g + w * k, '<=' as Op, `A bush plane can carry **at most** ${g + w * k} lb of cargo. Survival gear already takes ${g} lb, and each supply crate weighs ${w} lb. Write an inequality for the number of crates $x$ that can be loaded.`, 'gear + crates ≤ max load']
    }
    if (t === 1) {
      const r = rng.int(8, 20)
      const k = rng.int(4, 25)
      const h = rng.int(10, 80)
      return [r, h, h + r * k, '>=' as Op, `You have \\$${h} and earn \\$${r} per hour. You need **at least** \\$${h + r * k} for a discovery flight. Write an inequality for the hours $x$ you must work.`, 'money now + earnings ≥ goal']
    }
    const s = rng.pick([2, 3, 4, 5])
    const k = rng.int(3, 15)
    const f = rng.int(8, 30)
    return [s, f, f + s * k, '<=' as Op, `You have \\$${f + s * k} for a day at the air show. Entry is \\$${f}, and snacks are \\$${s} each. You can spend **no more than** what you have. Write an inequality for the number of snacks $x$.`, 'entry + snacks ≤ budget']
  })()
  const k = (limit - start) / rate
  return {
    prompt,
    answer: { kind: 'ineq', op, value: k },
    placeholder: `e.g. x ${op} 10`,
    hints: [`Model it: ${eqText}. “At most” means $\\le$; “at least” means $\\ge$.`, `$${rate}x + ${start} ${opTex[op]} ${limit}$`, `Subtract ${start}, then divide by ${rate} (positive — no flip).`],
    steps: [{ text: 'Translate:', math: `${rate}x + ${start} ${opTex[op]} ${limit}` }, ...ineqSteps(rate, start, limit, op)],
    mistakes: [
      { value: limit / rate, say: `You forgot the fixed ${start}. Subtract it before dividing by ${rate}.` },
      { value: (limit + start) / rate, say: `The ${start} is already used up, so subtract it: $${limit} - ${start} = ${limit - start}$.` },
    ],
  }
}

const inequalities: Skill = {
  id: 'inequalities',
  unit: 'alg',
  title: 'Linear inequalities',
  blurb: 'Solve like an equation — but flip the sign when you multiply or divide by a negative.',
  prereqs: ['two-step'],
  why: 'Limits are everywhere: a maximum takeoff weight, a minimum grade, a budget you can’t exceed. Inequalities describe the whole range of safe answers, not just one.',
  learn: [
    { kind: 'idea', title: 'A range of answers', body: '$x + 3 > 5$ isn’t true for just one number — it’s true for **every** number bigger than 2. So the answer is $x > 2$, drawn on a number line as an **open** circle at 2 (2 itself fails) with an arrow to the right. For $\\le$ or $\\ge$, the circle is **closed**: the boundary counts.' },
    { kind: 'idea', title: 'Most moves are safe', body: 'Adding or subtracting the same number on both sides keeps an inequality true: if $2 < 5$, then $2 + 10 < 5 + 10$. Multiplying or dividing by a **positive** number is safe too: $2\\cdot 3 < 5\\cdot 3$.' },
    { kind: 'explore', title: 'Negatives are a mirror', body: 'On the number line, taking the negative of a number reflects it across 0. Notice how the order of two numbers reverses when you reflect them.', widget: { w: 'numberline', mode: 'integers' }, task: 'Put 2 and 5 on the line. Now look at −2 and −5. Which one is bigger now?' },
    { kind: 'trap', title: 'Forgetting to flip', wrong: '$-3x < 12 \\Rightarrow x < -4$', right: '$-3x < 12 \\Rightarrow x > -4$', why: '$2 < 5$, but multiply both by $-1$ and you get $-2 > -5$. Multiplying or dividing by a negative **reverses** the order, so the sign must flip. Test it: $x = 0$ makes $-3(0) < 12$ true, and $0 > -4$ ✓.' },
    { kind: 'check', question: 'Which step requires flipping the inequality sign?', options: ['Dividing both sides by $-2$', 'Subtracting 7 from both sides', 'Adding $-4$ to both sides', 'Dividing both sides by 2'], correct: 0, explain: 'Only multiplying or dividing by a **negative** flips the sign. Adding a negative number is just subtraction — no flip.' },
  ],
  generate(rng, level) {
    if (level === 3 && rng.chance(0.4)) return ineqWord(rng)
    const op = rng.pick(OPS)
    const k = rng.int(-9, 9)
    let A: number, B: number, C: number, shown: string, pre: Step[] = []
    const extra: Misconception[] = []
    if (level === 1) {
      const kind = rng.pick(['plus', 'mult', 'two'])
      A = kind === 'plus' ? 1 : rng.int(2, 9)
      B = kind === 'mult' ? 0 : rng.nz(-12, 12)
      C = A * k + B
      shown = `${lin(A, B)} ${opTex[op]} ${C}`
    } else if (level === 2) {
      const kind = rng.pick(['neg', 'negFirst', 'divNeg'])
      if (kind === 'divNeg') {
        const a = rng.int(2, 5)
        const j = rng.nz(-6, 6)
        const b = rng.nz(-9, 9)
        const kk = -a * j
        const final = flip[op]
        return {
          prompt: `Solve: $-\\frac{x}{${a}} ${sgn(b)} ${opTex[op]} ${j + b}$`,
          answer: { kind: 'ineq', op: final, value: kk },
          placeholder: 'e.g. x >= -6',
          hints: ['Clear the constant first, just like an equation.', `$-\\frac{x}{${a}} ${opTex[op]} ${j}$. Now multiply both sides by $-${a}$.`, 'Multiplying by a negative — flip the sign!'],
          steps: [
            { text: `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ on both sides:`, math: `-\\frac{x}{${a}} ${opTex[op]} ${j}` },
            { text: `Multiply both sides by $-${a}$. **Negative, so flip the sign.**`, math: `x ${opTex[final]} ${kk}` },
            { text: `Graph: ${graphNote(final, kk)}.` },
          ],
          mistakes: [
            { value: a * j, say: `Multiplying $-\\frac{x}{${a}}$ by $-${a}$ gives $x$, so the right side is $${j}\\cdot(-${a}) = ${kk}$ — check the sign of the number.` },
            { value: -a * (j + 2 * b), say: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} to clear the constant — the opposite operation.` },
          ],
        }
      }
      A = -rng.int(2, 8)
      B = rng.nz(-12, 12)
      C = A * k + B
      shown = kind === 'neg' ? `${lin(A, B)} ${opTex[op]} ${C}` : `${B} ${sterm(A, 'x')} ${opTex[op]} ${C}`
    } else {
      const kind = rng.pick(['both', 'dist'])
      if (kind === 'both') {
        const a = rng.nz(-6, 7)
        const d = pickNot(rng, -6, 7, [0, a])
        const b = rng.nz(-10, 10)
        const e = (a - d) * k + b
        A = a - d
        B = b
        C = e
        shown = `${lin(a, b)} ${opTex[op]} ${lin(d, e)}`
        pre = [{ text: `${moveTerm(d)} (allowed — no flip):`, math: `${lin(A, B)} ${opTex[op]} ${e}` }]
        if (a + d !== 0) extra.push({ value: (e - b) / (a + d), say: `Moving $${coef(d, 'x')}$ to the left makes it $${coef(-d, 'x')}$ — subtract it from both sides.` })
      } else {
        const a = pickNot(rng, -5, 5, [-1, 0, 1])
        const inner = rng.nz(-6, 6)
        A = a
        B = a * inner
        C = a * (k + inner)
        shown = `${a}(${lin(1, inner)}) ${opTex[op]} ${C}`
        pre = [{ text: 'Distribute:', math: `${lin(A, B)} ${opTex[op]} ${C}` }]
        extra.push({ value: (C - inner) / a, say: `Distribute the ${a} to both terms: $${a}(${lin(1, inner)}) = ${lin(A, B)}$.` })
      }
    }
    const final = A < 0 ? flip[op] : op
    const mistakes: Misconception[] = [...extra]
    if (B !== 0) mistakes.push({ value: (C + B) / A, say: `To clear the $${sgn(B).replace(/ /g, '')}$, ${B > 0 ? 'subtract' : 'add'} ${Math.abs(B)} on both sides — the opposite operation.` })
    if (k !== 0 && A !== 1) mistakes.push({ value: -k, say: 'Your boundary has the wrong sign. Flipping the inequality changes the **direction of the sign**, not the sign of the number.' })
    return {
      prompt: `Solve: $${shown}$`,
      answer: { kind: 'ineq', op: final, value: k },
      placeholder: `e.g. x ${rng.pick(OPS)} 3`,
      hints: [
        'Solve it exactly like an equation — but watch for multiplying or dividing by a negative.',
        `Get the $x$-term alone: $${coef(A, 'x')} ${opTex[op]} ${C - B}$.`,
        A < 0 ? `Divide by $${A}$. It’s negative — **flip** the sign.` : A === 1 ? `That already gives $x$ — no division needed.` : `Divide by $${A}$. It’s positive — the sign stays.`,
      ],
      steps: [...pre, ...ineqSteps(A, B, C, op)],
      mistakes,
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 4. SLOPE
// ════════════════════════════════════════════════════════════════════════════

function slopeMistakes(dy: number, dx: number): Misconception[] {
  const m = dy / dx
  const out: Misconception[] = []
  if (dy !== 0 && !near(dx / dy, m)) out.push({ value: dx / dy, say: 'That’s run over rise — upside down. Slope is **rise over run**: change in $y$ on top, change in $x$ on the bottom.' })
  if (m !== 0) out.push({ value: -m, say: 'Right size, wrong sign. Subtract in the **same order** on top and bottom (second point minus first point both times). A line that falls left-to-right has a negative slope.' })
  return out
}

const slope: Skill = {
  id: 'slope',
  unit: 'alg',
  title: 'Slope',
  blurb: 'Rise over run — how steep a line is, and which way it tilts.',
  prereqs: ['int-mult', 'frac-equiv'],
  why: 'A climb rate in feet per minute, a road’s grade, a price per gallon — slope is a **rate of change**, the single most useful idea in all of graphing.',
  learn: [
    { kind: 'idea', title: 'Rise over run', body: 'Slope measures steepness: **how far up (rise) for every step to the right (run)**. A climbing jet gaining 2,000 ft every minute has a slope of 2,000 ft/min.', math: 'm = \\frac{\\text{rise}}{\\text{run}} = \\frac{\\Delta y}{\\Delta x}' },
    { kind: 'explore', title: 'Steer the line', body: 'The red staircase shows one step: run 1 to the right, rise $m$. Drag the slope slider through positive, zero and negative values.', widget: { w: 'line' }, task: 'Make the line fall from left to right. What is true about $m$? Then make it perfectly flat.' },
    { kind: 'idea', title: 'From two points', body: 'Given $(x_1, y_1)$ and $(x_2, y_2)$, the rise is the change in $y$ and the run is the change in $x$:', math: 'm = \\frac{y_2 - y_1}{x_2 - x_1}\\qquad (1, 2),\\ (4, 8):\\ m = \\frac{8 - 2}{4 - 1} = \\frac{6}{3} = 2' },
    { kind: 'trap', title: 'Mismatched order', wrong: '$(1, 2), (4, 8)$: $m = \\frac{8 - 2}{1 - 4} = -2$', right: '$m = \\frac{8 - 2}{4 - 1} = 2$', why: 'Pick one point to be “second” and use it first on **both** top and bottom. Mixing the order flips the sign.' },
    { kind: 'trap', title: 'Run over rise', wrong: '$(1, 2), (4, 8)$: $m = \\frac{3}{6} = \\frac12$', right: '$m = \\frac{6}{3} = 2$', why: 'Slope is **rise over run** — $y$ changes go on top. Think: the line climbs 2 units for each 1 unit right.' },
    { kind: 'check', question: 'What is the slope of a horizontal line? Of a vertical line?', options: ['Horizontal: $0$. Vertical: Undefined', 'Horizontal: Undefined. Vertical: $0$', 'Both are $0$', 'Horizontal: $1$. Vertical: $0$'], correct: 0, explain: 'Horizontal: rise is 0, so $\\frac{0}{\\text{run}} = 0$. Vertical: run is 0, and you can’t divide by 0 — the slope is **not defined** (we say “Undefined”).' },
  ],
  generate(rng, level) {
    const kind = level === 1 ? rng.pick(['graph', 'graph', 'riserun']) : level === 2 ? rng.pick(['points', 'points', 'graph']) : rng.pick(['word', 'missing', 'special', 'points'])
    if (kind === 'graph') {
      const run = rng.int(1, level === 1 ? 3 : 4)
      const rise = level === 1 ? run * rng.nz(-3, 3) : rng.nz(-4, 4) * (rng.chance(0.5) ? 1 : run > 2 ? 1 : 2)
      const x1 = rng.int(-5, 5 - run)
      const lo = Math.max(-5, -5 - rise)
      const hi = Math.min(5, 5 - rise)
      const y1 = rng.int(lo, hi)
      let P = { x: x1, y: y1 }
      let Q = { x: x1 + run, y: y1 + rise }
      if (rng.chance(0.3)) [P, Q] = [Q, P]
      const dy = Q.y - P.y
      const dx = Q.x - P.x
      return {
        prompt: 'Find the slope of the line through points $A$ and $B$.',
        answer: { kind: 'num', value: dy / dx, simplest: true },
        placeholder: 'e.g. -3/2',
        visual: { type: 'plane', range: 6, points: [{ ...P, label: `A(${P.x}, ${P.y})` }, { ...Q, label: `B(${Q.x}, ${Q.y})` }], segment: [[P.x, P.y], [Q.x, Q.y]] },
        hints: [
          'Slope = rise ÷ run. Count how far you move up or down, and how far left or right, from $A$ to $B$.',
          `From $A$ to $B$: $y$ changes by $${Q.y} - ${paren(P.y)} = ${dy}$ and $x$ changes by $${Q.x} - ${paren(P.x)} = ${dx}$.`,
          `$m = \\frac{${dy}}{${dx}}$ — simplify.`,
        ],
        steps: [
          { text: 'Rise (change in $y$, from $A$ to $B$):', math: `${Q.y} - ${paren(P.y)} = ${dy}` },
          { text: 'Run (change in $x$, same direction):', math: `${Q.x} - ${paren(P.x)} = ${dx}` },
          { text: 'Divide:', math: `m = \\frac{${dy}}{${dx}} = ${fracTex(dy, dx)}` },
          { text: dy / dx > 0 ? 'Positive: the line rises left to right ✓' : 'Negative: the line falls left to right ✓' },
        ],
        mistakes: slopeMistakes(dy, dx),
      }
    }
    if (kind === 'riserun') {
      const t = rng.int(0, 2)
      const R = t === 0 ? rng.int(1, 9) : t === 1 ? rng.int(1, 3) : rng.int(1, 5)
      const U = t === 0 ? rng.int(1, 6) : t === 1 ? rng.pick([12, 15, 16, 20, 24]) : rng.pick([10, 20, 25, 30, 40])
      const down = t === 2 || (t === 0 && rng.chance(0.5))
      const dy = down ? -R : R
      const prompt =
        t === 0
          ? `A line goes ${down ? 'down' : 'up'} ${R} unit${R > 1 ? 's' : ''} for every ${U} unit${U > 1 ? 's' : ''} it moves to the right. What is its slope?`
          : t === 1
            ? `A wheelchair ramp rises ${R} in for every ${U} in of horizontal distance. What is its slope?`
            : `A glider drops ${R} ft for every ${U} ft it travels forward. What is the slope of its flight path?`
      return {
        prompt,
        answer: { kind: 'num', value: dy / U, simplest: true },
        placeholder: 'e.g. 1/12',
        hints: ['Slope = rise ÷ run.', `Rise = ${dy} (${down ? 'going down is negative' : 'going up is positive'}); run = ${U}.`, `$m = \\frac{${dy}}{${U}}$ — simplify if you can.`],
        steps: [{ text: `Rise: $${dy}$${down ? ' (down is negative)' : ''}. Run: $${U}$.` }, { text: 'Slope:', math: `m = \\frac{${dy}}{${U}} = ${fracTex(dy, U)}` }],
        mistakes: slopeMistakes(dy, U),
      }
    }
    if (kind === 'points') {
      const x1 = rng.int(-9, 9)
      const x2 = pickNot(rng, -9, 9, [x1])
      const y1 = rng.int(-9, 9)
      const y2 = level === 3 ? rng.int(-9, 9) : pickNot(rng, -9, 9, [y1])
      const dy = y2 - y1
      const dx = x2 - x1
      const inRange = [x1, x2, y1, y2].every((v) => Math.abs(v) <= 6)
      return {
        prompt: `Find the slope of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
        answer: { kind: 'num', value: dy / dx, simplest: true },
        placeholder: 'e.g. -3/2',
        visual: inRange ? { type: 'plane', range: 6, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], segment: [[x1, y1], [x2, y2]] } : undefined,
        hints: [
          'Use $m = \\frac{y_2 - y_1}{x_2 - x_1}$ — change in $y$ over change in $x$.',
          'Subtract in the **same order** on top and bottom: second point minus first point.',
          `$m = \\frac{${y2} - ${paren(y1)}}{${x2} - ${paren(x1)}} = \\frac{${dy}}{${dx}}$`,
        ],
        steps: [
          { text: 'Slope formula, second point minus first:', math: `m = \\frac{${y2} - ${paren(y1)}}{${x2} - ${paren(x1)}} = \\frac{${dy}}{${dx}}` },
          { text: 'Simplify:', math: `m = ${fracTex(dy, dx)}` },
          ...(dy === 0 ? [{ text: 'The $y$-values match, so the line is horizontal — slope $0$.' }] : []),
        ],
        mistakes: slopeMistakes(dy, dx),
      }
    }
    if (kind === 'word') {
      if (rng.chance(0.5)) {
        const t1 = rng.int(1, 4)
        const t2 = t1 + rng.int(2, 5)
        let r = 500 * rng.nz(-4, 6)
        let a1 = 1000 * rng.int(2, 10)
        if (a1 + r * (t2 - t1) < 500) r = -r
        if (a1 + r * (t2 - t1) < 500) a1 += 10000
        const a2 = a1 + r * (t2 - t1)
        return {
          prompt: `A plane is at ${a1} ft at minute ${t1} and at ${a2} ft at minute ${t2}. What is the slope of its altitude graph — its rate of ${r > 0 ? 'climb' : 'descent'} in feet per minute? (Use a negative number for a descent.)`,
          answer: { kind: 'num', value: r, unit: 'ft/min' },
          placeholder: 'e.g. 1500',
          hints: ['Slope = change in altitude ÷ change in time.', `Change in altitude: $${a2} - ${a1} = ${a2 - a1}$. Change in time: $${t2} - ${t1} = ${t2 - t1}$.`, `$\\frac{${a2 - a1}}{${t2 - t1}}$`],
          steps: [{ text: 'Rise over run, with time as $x$ and altitude as $y$:', math: `m = \\frac{${a2} - ${a1}}{${t2} - ${t1}} = \\frac{${a2 - a1}}{${t2 - t1}} = ${r}` }, { text: `The plane ${r > 0 ? 'climbs' : 'descends'} **${Math.abs(r)} ft every minute**.` }],
          mistakes: [
            { value: a2 - a1, say: `That’s the total change. Slope is change **per minute** — divide by the ${t2 - t1} minutes.` },
            { value: -r, say: r > 0 ? 'The plane gained altitude, so the slope is positive.' : 'The plane lost altitude, so the slope is negative.' },
            { value: (t2 - t1) / (a2 - a1), say: 'Upside down — altitude change goes on top, time on the bottom.' },
          ],
        }
      }
      const r = rng.int(2, 15)
      const g1 = rng.int(1, 5)
      const g2 = g1 + rng.int(2, 8)
      const base = rng.int(15, 40)
      const c1 = base + r * g1
      const c2 = base + r * g2
      return {
        prompt: `A phone bill is \\$${c1} when you use ${g1} GB and \\$${c2} when you use ${g2} GB. If the bill is linear, what is the slope — the cost per GB?`,
        answer: { kind: 'num', value: r, unit: 'dollars per GB' },
        hints: ['Treat each month as a point: (GB, cost).', `The points are $(${g1}, ${c1})$ and $(${g2}, ${c2})$.`, `$m = \\frac{${c2} - ${c1}}{${g2} - ${g1}}$`],
        steps: [{ text: 'Points: $(GB, cost)$.', math: `m = \\frac{${c2} - ${c1}}{${g2} - ${g1}} = \\frac{${c2 - c1}}{${g2 - g1}} = ${r}` }, { text: `Each extra GB costs **\\$${r}**.` }],
        mistakes: [
          { value: c2 - c1, say: `That’s the total change in cost. Divide by the ${g2 - g1} GB difference to get the cost **per** GB.` },
          { value: (g2 - g1) / (c2 - c1), say: 'Upside down — the cost change goes on top.' },
          { value: c2 / g2, say: 'Dividing one cost by its GB includes the fixed monthly charge. Use the **change** between the two points.' },
        ],
      }
    }
    if (kind === 'missing') {
      const m = rng.nz(-4, 4)
      const x1 = rng.int(-6, 6)
      const x2 = pickNot(rng, -6, 6, [x1])
      const y1 = rng.int(-8, 8)
      const k = y1 + m * (x2 - x1)
      return {
        prompt: `A line has slope $${m}$ and passes through $(${x1}, ${y1})$ and $(${x2}, k)$. Find $k$.`,
        answer: { kind: 'num', value: k },
        hints: [
          'Set up the slope formula with $k$ in it.',
          `$\\frac{k - ${paren(y1)}}{${x2} - ${paren(x1)}} = ${m}$`,
          `The run is $${x2 - x1}$, so the rise must be $${m}\\cdot${paren(x2 - x1)} = ${m * (x2 - x1)}$. Add that to $${y1}$.`,
        ],
        steps: [
          { text: 'Slope formula:', math: `\\frac{k - ${paren(y1)}}{${x2 - x1}} = ${m}` },
          { text: `Multiply both sides by $${x2 - x1}$:`, math: `k - ${paren(y1)} = ${m * (x2 - x1)}` },
          { text: 'Solve:', math: `k = ${k}` },
        ],
        mistakes: [
          { value: m * (x2 - x1), say: `That’s the rise. $k$ is the $y$-value — start at $${y1}$ and add the rise.` },
          { value: y1 - m * (x2 - x1), say: 'Sign slip: rise = slope × run, then **add** it to the first $y$-value.' },
        ],
      }
    }
    // special: horizontal or vertical
    const vertical = rng.chance(0.5)
    const a = rng.int(-6, 6)
    const u = rng.int(-6, 6)
    const v = pickNot(rng, -6, 6, [u])
    const P = vertical ? [a, u] : [u, a]
    const Q = vertical ? [a, v] : [v, a]
    const correct = vertical ? 'Undefined' : '$0$'
    const wrong = vertical ? ['$0$', `$${v - u}$`, '$1$'] : ['Undefined', `$${v - u}$`, '$1$']
    const c = choices(rng, correct, wrong)
    return {
      prompt: `What is the slope of the line through $(${P[0]}, ${P[1]})$ and $(${Q[0]}, ${Q[1]})$?`,
      answer: { kind: 'choice', options: c.options, correct: c.correct },
      visual: { type: 'plane', range: 6, points: [{ x: P[0], y: P[1] }, { x: Q[0], y: Q[1] }], segment: [[P[0], P[1]], [Q[0], Q[1]]] },
      hints: ['Look at which coordinate stays the same.', vertical ? 'The $x$-values match — the run is 0.' : 'The $y$-values match — the rise is 0.', vertical ? 'What happens when you divide by 0?' : 'What is 0 divided by any nonzero number?'],
      steps: [
        { text: 'Slope formula:', math: `m = \\frac{${Q[1]} - ${paren(P[1])}}{${Q[0]} - ${paren(P[0])}} = \\frac{${Q[1] - P[1]}}{${Q[0] - P[0]}}` },
        { text: vertical ? 'Division by zero is impossible: a **vertical** line’s slope is **not defined** — “Undefined”.' : 'Zero divided by a nonzero number is 0: a **horizontal** line has slope **0**.' },
      ],
      mistakes: [{ when: (raw) => raw.trim() !== String(c.correct), say: vertical ? 'A vertical line has run 0, and you can’t divide by 0 — so its slope is not defined (Undefined), rather than 0.' : 'A horizontal line has rise 0, and $\\frac{0}{\\text{run}} = 0$. “Undefined” is for vertical lines.' }],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 5. SLOPE-INTERCEPT FORM
// ════════════════════════════════════════════════════════════════════════════

const slopeInt: Skill = {
  id: 'slope-int',
  unit: 'alg',
  title: 'Slope-intercept form',
  blurb: 'y = mx + b: read the slope and the starting value straight off the equation.',
  prereqs: ['slope', 'evaluate'],
  why: 'Total cost = (price per item)·(items) + (fixed fee). Altitude = (climb rate)·(time) + (starting altitude). Every “start + steady rate” story is a line $y = mx + b$.',
  learn: [
    { kind: 'idea', title: 'Two numbers tell you everything', body: 'In $y = mx + b$, **$m$ is the slope** (rise per step right) and **$b$ is the $y$-intercept** — where the line crosses the $y$-axis, because that’s where $x = 0$ and $y = m\\cdot 0 + b = b$.', math: 'y = \\underbrace{2}_{m}x \\underbrace{- 3}_{b}' },
    { kind: 'explore', title: 'Build a line', body: 'The blue dot is $b$, the starting point on the $y$-axis. The red staircase is the slope $m$.', widget: { w: 'line' }, task: 'Make $y = -x + 4$. Then change only $b$ — what happens to the line? Change only $m$ — what stays fixed?' },
    { kind: 'trap', title: 'The sign belongs to the number', wrong: '$y = 2x - 5$ has $b = 5$', right: '$y = 2x - 5$ means $y = 2x + (-5)$, so $b = -5$', why: 'Read the sign in front of each term as part of the number. The line crosses the $y$-axis at $-5$, below the origin.' },
    { kind: 'trap', title: 'The slope is whatever multiplies x', wrong: '$y = 4 - 3x$ has slope $4$', right: '$y = 4 - 3x = -3x + 4$, so $m = -3$ and $b = 4$', why: 'Order doesn’t matter — $m$ is always the coefficient of $x$, sign included.' },
    { kind: 'idea', title: 'Writing the equation from a point', body: 'Know the slope and one point? Plug the point in and solve for $b$. Slope 3 through $(2, 1)$:', math: '1 = 3(2) + b \\Rightarrow b = -5 \\Rightarrow y = 3x - 5' },
    { kind: 'check', question: 'A rental costs \\$40 up front plus \\$15 per hour. Which equation gives the cost $y$ after $x$ hours?', options: ['$y = 15x + 40$', '$y = 40x + 15$', '$y = 55x$', '$y = 15x - 40$'], correct: 0, explain: 'The rate (\\$15 per hour) multiplies $x$ — that’s the slope. The one-time \\$40 is the starting value $b$.' },
  ],
  generate(rng, level) {
    const kind =
      level === 1 ? rng.pick(['readM', 'readB', 'build', 'evalY']) : level === 2 ? rng.pick(['graph', 'slopePoint', 'slopePoint', 'graph']) : rng.pick(['twoPoints', 'standard', 'word', 'parallel'])
    if (kind === 'readM' || kind === 'readB') {
      const m = rng.nz(-6, 6)
      const b = rng.nz(-9, 9)
      const flipped = rng.chance(0.4)
      const eq = flipped ? `y = ${b} ${sterm(m, 'x')}` : `y = ${lin(m, b)}`
      const askM = kind === 'readM'
      return {
        prompt: `What is the ${askM ? '**slope**' : '**$y$-intercept**'} of $${eq}$?`,
        answer: { kind: 'num', value: askM ? m : b },
        hints: [
          'Match it to $y = mx + b$.',
          askM ? 'The slope is the number multiplying $x$ — including its sign.' : 'The $y$-intercept is the constant term — including its sign.',
          flipped ? `Reorder it: $y = ${lin(m, b)}$.` : askM ? `The $x$-term is $${coef(m, 'x')}$.` : `The constant term is $${sgn(b).replace(' ', '')}$.`,
        ],
        steps: [{ text: 'Write it in $y = mx + b$ order:', math: `y = ${lin(m, b)}` }, { text: askM ? `Slope $m = ${m}$.` : `$y$-intercept $b = ${b}$ — the line crosses the $y$-axis at $(0, ${b})$.` }],
        mistakes: askM
          ? [{ value: b, say: 'That’s the $y$-intercept (the constant). The slope multiplies $x$.' }, { value: -m, say: 'Check the sign: the slope includes the sign in front of the $x$-term.' }]
          : [{ value: m, say: 'That’s the slope (it multiplies $x$). The intercept is the constant term.' }, { value: -b, say: `The sign belongs to the number: $${sgn(b).replace(' ', '')}$ means $b = ${b}$.` }],
      }
    }
    if (kind === 'build') {
      const m = rng.nz(-6, 6)
      const b = pickNot(rng, -9, 9, [0, m])
      return {
        prompt: `Write the equation of the line with slope $${m}$ and $y$-intercept $${b}$.`,
        answer: { kind: 'expr', expr: lin(m, b), prefix: 'y' },
        placeholder: 'y = ...',
        hints: ['Use $y = mx + b$.', `$m = ${m}$ goes in front of $x$.`, `$b = ${b}$ is the constant: $y = ${coef(m, 'x')} + (${b})$.`],
        steps: [{ text: 'Substitute $m$ and $b$ into $y = mx + b$:', math: `y = ${lin(m, b)}` }],
        mistakes: [
          { when: isExpr(lin(b, m)), say: 'Swapped: the slope multiplies $x$, and the intercept is the number on its own.' },
          { when: isExpr(lin(m, -b)), say: `Watch the sign of the intercept — it’s $${b}$.` },
        ],
      }
    }
    if (kind === 'evalY') {
      const m = rng.nz(-5, 5)
      const b = rng.nz(-9, 9)
      const x = rng.nz(-5, 6)
      const y = m * x + b
      return {
        prompt: `On the line $y = ${lin(m, b)}$, what is $y$ when $x = ${x}$?`,
        answer: { kind: 'num', value: y },
        hints: ['Replace $x$ with the number — in parentheses.', `$y = ${mulT(m, x)} ${sgn(b)}$`, `$${mulT(m, x)} = ${m * x}$, then ${b > 0 ? 'add' : 'subtract'} $${Math.abs(b)}$.`],
        steps: [{ text: 'Substitute:', math: `y = ${mulT(m, x)} ${sgn(b)} = ${m * x} ${sgn(b)} = ${y}` }, { text: `So the point $(${x}, ${y})$ is on the line.` }],
        mistakes: [
          { value: m * x, say: `Don’t forget $b$: after $${mulT(m, x)}$, ${b > 0 ? 'add' : 'subtract'} ${Math.abs(b)}.` },
          { value: m * x - b, say: 'Sign of $b$: keep the constant exactly as written.' },
          { value: (x - b) / m, say: `That solves for $x$ when $y = ${x}$. Here $x = ${x}$ is given — just plug it in.` },
        ],
      }
    }
    if (kind === 'graph') {
      const m = rng.nz(-3, 3)
      const b = rng.int(-4, 4)
      let x2 = rng.pick([1, 2, -1, -2])
      if (Math.abs(m * x2 + b) > 5) x2 = -x2
      if (Math.abs(m * x2 + b) > 5) x2 = x2 > 0 ? 1 : -1
      const y2 = m * x2 + b
      return {
        prompt: 'Write the equation of the line shown, in slope-intercept form.',
        answer: { kind: 'expr', expr: lin(m, b), prefix: 'y' },
        placeholder: 'y = ...',
        visual: { type: 'plane', range: 6, lines: [{ m, b }], points: [{ x: 0, y: b, label: `(0, ${b})` }, { x: x2, y: y2, label: `(${x2}, ${y2})` }] },
        hints: ['Find $b$ first: where does the line cross the $y$-axis?', `It crosses at $(0, ${b})$, so $b = ${b}$. Now find the slope between the two marked points.`, `From $(0, ${b})$ to $(${x2}, ${y2})$: rise $${y2 - b}$, run $${x2}$, so $m = ${m}$.`],
        steps: [
          { text: `$y$-intercept: the line crosses at $(0, ${b})$, so $b = ${b}$.` },
          { text: 'Slope from the two marked points:', math: `m = \\frac{${y2} - ${paren(b)}}{${x2} - 0} = ${m}` },
          { text: 'Put them together:', math: `y = ${lin(m, b)}` },
        ],
        mistakes: [
          ...(b !== 0 && b !== m ? [{ when: isExpr(lin(b, m)), say: 'You swapped $m$ and $b$. The slope multiplies $x$; the intercept stands alone.' }] : []),
          { when: isExpr(lin(-m, b)), say: m > 0 ? 'The line rises left to right, so the slope is positive.' : 'The line falls left to right, so the slope is negative.' },
          ...(b !== 0 ? [{ when: isExpr(lin(m, -b)), say: `The line crosses the $y$-axis ${b > 0 ? 'above' : 'below'} the origin, so $b = ${b}$.` }] : []),
        ],
      }
    }
    if (kind === 'slopePoint') {
      const m = rng.nz(-5, 5)
      const x1 = rng.nz(-6, 6)
      const b = rng.int(-9, 9)
      const y1 = m * x1 + b
      return {
        prompt: `Write the equation of the line with slope $${m}$ that passes through $(${x1}, ${y1})$.`,
        answer: { kind: 'expr', expr: lin(m, b), prefix: 'y' },
        placeholder: 'y = ...',
        hints: [`Start with $y = ${coef(m, 'x')} + b$. You need $b$.`, `The point must satisfy the equation: plug in $x = ${x1}$ and $y = ${y1}$.`, `$${y1} = ${mulT(m, x1)} + b$, so $${y1} = ${m * x1} + b$.`],
        steps: [
          { text: 'Plug the point into $y = mx + b$:', math: `${y1} = ${mulT(m, x1)} + b` },
          { text: 'Simplify and solve for $b$:', math: `${y1} = ${m * x1} + b \\Rightarrow b = ${y1} - ${paren(m * x1)} = ${b}` },
          { text: 'Write the equation:', math: `y = ${lin(m, b)}` },
        ],
        mistakes: [
          { when: isExpr(lin(m, y1)), say: `$b$ isn’t the $y$ of the given point — that point isn’t on the $y$-axis (its $x$ is ${x1}). Plug it in and solve for $b$.` },
          { when: isExpr(lin(m, y1 + m * x1)), say: `Sign slip solving for $b$: $b = ${y1} - (${m * x1})$.` },
          ...(m !== b && b !== 0 ? [{ when: isExpr(lin(b, m)), say: 'You swapped slope and intercept.' }] : []),
        ],
      }
    }
    if (kind === 'twoPoints') {
      const d = rng.pick([1, 1, 2, 3])
      let n = rng.nz(-6, 6)
      if (d > 1 && n % d === 0) n += n > 0 ? 1 : -1
      const b = rng.int(-6, 6)
      const j1 = rng.int(-3, 3)
      const j2 = pickNot(rng, -3, 3, [j1])
      const x1 = d * j1
      const x2 = d * j2
      const y1 = n * j1 + b
      const y2 = n * j2 + b
      const mT = fracTex(n, d)
      return {
        prompt: `Write the equation of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$ in slope-intercept form.`,
        answer: { kind: 'expr', expr: lineExpr(n, d, b, false), prefix: 'y' },
        placeholder: 'y = ...',
        hints: ['Two jobs: find the slope, then find $b$.', `$m = \\frac{${y2} - ${paren(y1)}}{${x2} - ${paren(x1)}} = ${mT}$`, `Plug $(${x1}, ${y1})$ into $y = ${lineExpr(n, d, 0, true)} + b$ and solve for $b$.`],
        steps: [
          { text: 'Slope:', math: `m = \\frac{${y2 - y1}}{${x2 - x1}} = ${mT}` },
          { text: 'Plug in a point to find $b$:', math: `${y1} = ${mT}\\cdot ${paren(x1)} + b \\Rightarrow ${y1} = ${(n * x1) / d} + b \\Rightarrow b = ${b}` },
          { text: 'Equation:', math: `y = ${lineExpr(n, d, b, true)}` },
        ],
        mistakes: [
          { when: isExpr(`(${d}/${n})*(x - (${x1})) + (${y1})`), say: 'Your slope is upside down. Slope = change in $y$ ÷ change in $x$.' },
          { when: isExpr(`(${-n}/${d})*(x - (${x1})) + (${y1})`), say: 'Your slope has the wrong sign — subtract the points in the same order on top and bottom.' },
          { when: isExpr(`(${n}/${d})*x + (${y1})`), say: `$b$ is where the line crosses the $y$-axis (at $x = 0$), not the $y$ of a given point. Plug the point in and solve for $b$.` },
        ],
      }
    }
    if (kind === 'standard') {
      const B = rng.pick([1, 2, 3, 4, -1, -2, -3])
      const m = rng.nz(-4, 4)
      const b = rng.nz(-5, 5)
      const A = -m * B
      const C = b * B
      const eq = `${coef(A, 'x')} ${sterm(B, 'y')} = ${C}`
      const steps: Step[] = [
        { text: `Move the $x$-term: ${A > 0 ? 'subtract' : 'add'} $${coef(Math.abs(A), 'x')}$ on both sides.`, math: `${coef(B, 'y')} = ${lin(-A, C)}` },
        ...(B !== 1 ? [{ text: `Divide **every** term by $${B}$:`, math: `y = ${lin(m, b)}` }] : []),
      ]
      if (rng.chance(0.5))
        return {
          prompt: `What is the slope of the line $${eq}$?`,
          answer: { kind: 'num', value: m },
          hints: ['Solve for $y$ to get it into $y = mx + b$ form.', `First: $${coef(B, 'y')} = ${lin(-A, C)}$.`, B !== 1 ? `Then divide everything by $${B}$.` : 'Now read off the coefficient of $x$.'],
          steps: [...steps, { text: `The slope is $m = ${m}$.` }],
          mistakes: [
            { value: A / B, say: `Moving $${coef(A, 'x')}$ to the other side changes its sign. The slope is $-\\frac{${A}}{${B}}$.` },
            ...(B !== 1 && -A !== m ? [{ value: -A, say: `Divide the $x$-term by $${B}$ too — every term gets divided.` }] : []),
            ...(A !== m && -A / B !== A ? [{ value: A, say: 'The $x$-coefficient in standard form isn’t the slope — solve for $y$ first.' }] : []),
          ],
        }
      return {
        prompt: `Rewrite $${eq}$ in slope-intercept form.`,
        answer: { kind: 'expr', expr: lin(m, b), prefix: 'y' },
        placeholder: 'y = ...',
        hints: ['Get $y$ alone: move the $x$-term to the right, then divide.', `$${coef(B, 'y')} = ${lin(-A, C)}$`, B !== 1 ? `Divide every term by $${B}$.` : 'That’s already $y$ alone!'],
        steps,
        mistakes: [
          { when: isExpr(lin(-m, b)), say: 'The $x$-term changes sign when it moves to the other side.' },
          ...(B !== 1 ? [{ when: isExpr(lin(-A, C)), say: `That’s $${coef(B, 'y')}$, not $y$. Divide every term by $${B}$.` }, { when: isExpr(lin(m, C)), say: `Divide **every** term by $${B}$ — the constant too.` }] : []),
        ],
      }
    }
    if (kind === 'word') {
      if (rng.chance(0.5)) {
        const r = rng.int(8, 45)
        const f = 5 * rng.int(2, 20)
        const what = rng.pick(['kayak rental', 'simulator session', 'bike rental', 'hangar parking spot'])
        return {
          prompt: `A ${what} costs a \\$${f} flat fee plus \\$${r} per hour. Write an equation for the total cost $y$ after $x$ hours.`,
          answer: { kind: 'expr', expr: lin(r, f), prefix: 'y' },
          placeholder: 'y = ...',
          hints: ['Which number is a rate (changes with $x$) and which is charged once?', `The rate \\$${r}/hour is the slope $m$.`, `The one-time \\$${f} is the starting value $b$.`],
          steps: [{ text: `Slope (per hour): $m = ${r}$. Starting value: $b = ${f}$.` }, { text: 'Equation:', math: `y = ${lin(r, f)}` }],
          mistakes: [{ when: isExpr(lin(f, r)), say: `The \\$${r} per hour gets multiplied by the number of hours, so it’s the slope. The \\$${f} fee is paid once — that’s $b$.` }, { when: isExpr(`${r + f}x`), say: 'The fee is only paid once, so it shouldn’t be multiplied by $x$.' }],
        }
      }
      const rate = 100 * rng.int(3, 15)
      const alt = 1000 * rng.int(6, 30)
      return {
        prompt: `A plane at ${alt} ft starts descending at ${rate} ft per minute. Write an equation for its altitude $y$ after $x$ minutes.`,
        answer: { kind: 'expr', expr: lin(-rate, alt), prefix: 'y' },
        placeholder: 'y = ...',
        hints: ['Altitude starts at a value and then changes at a steady rate.', `Starting value $b = ${alt}$.`, `It **loses** ${rate} ft each minute, so the slope is negative: $m = -${rate}$.`],
        steps: [{ text: `Start: $b = ${alt}$. Descending ${rate} ft/min means $m = -${rate}$.` }, { text: 'Equation:', math: `y = ${lin(-rate, alt)}` }],
        mistakes: [{ when: isExpr(lin(rate, alt)), say: 'The plane is **descending** — its altitude goes down over time, so the slope is negative.' }, { when: isExpr(lin(alt, -rate)), say: 'Swapped: the rate multiplies $x$; the starting altitude stands alone.' }],
      }
    }
    // parallel
    const m = rng.nz(-4, 4)
    const b0 = rng.int(-6, 6)
    const x1 = rng.nz(-5, 5)
    let b = rng.int(-8, 8)
    if (b === b0) b += 3
    const y1 = m * x1 + b
    return {
      prompt: `Write the equation of the line **parallel** to $y = ${lin(m, b0)}$ that passes through $(${x1}, ${y1})$.`,
      answer: { kind: 'expr', expr: lin(m, b), prefix: 'y' },
      placeholder: 'y = ...',
      hints: ['Parallel lines never meet, so they have the **same slope**.', `So the new line is $y = ${coef(m, 'x')} + b$. Find $b$ using the point.`, `$${y1} = ${mulT(m, x1)} + b$`],
      steps: [
        { text: `Same slope: $m = ${m}$.` },
        { text: 'Plug in the point:', math: `${y1} = ${m * x1} + b \\Rightarrow b = ${b}` },
        { text: 'Equation:', math: `y = ${lin(m, b)}` },
      ],
      mistakes: [
        { when: isExpr(lin(m, b0)), say: 'That’s the original line. A parallel line has the same slope but must go through the new point, so $b$ changes.' },
        { when: isExpr(lin(m, y1)), say: `$b$ isn’t the point’s $y$-value (the point isn’t on the $y$-axis). Solve $${y1} = ${mulT(m, x1)} + b$.` },
        { when: isExpr(lineExpr(-1, m, b, false)), say: 'Negative reciprocal slopes are for **perpendicular** lines. Parallel lines share the same slope.' },
      ],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 6. FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/** Horizontal input/output table */
const tableTex = (f: string, xs: number[], ys: number[]) => `\\begin{array}{c|${'c'.repeat(xs.length)}} x & ${xs.join(' & ')} \\\\ \\hline ${f}(x) & ${ys.join(' & ')} \\end{array}`

const relTex = (pts: [number, number][]) => `\\{${pts.map(([a, b]) => `(${a}, ${b})`).join(',\\ ')}\\}`

const functions: Skill = {
  id: 'functions',
  unit: 'alg',
  title: 'Functions & notation',
  blurb: 'f(x) is a machine: one input in, exactly one output out.',
  prereqs: ['evaluate'],
  why: 'Spreadsheets, code and physics all run on functions: altitude as a function of time, cost as a function of hours. $f(x)$ notation is how you say “plug this in” clearly.',
  learn: [
    { kind: 'idea', title: 'A function is a machine', body: 'Drop an input in, get **exactly one** output. $f(x) = 2x + 1$ is the rule “double it, add 1.” Feed it 3 and out comes 7.', math: 'f(3) = 2(3) + 1 = 7' },
    { kind: 'trap', title: 'f(3) is not f times 3', wrong: '$f(3)$ means $f \\times 3$', right: '$f(3)$ means “the output when the input is 3”', why: 'The parentheses here hold the **input**. $f$ is the name of the machine, not a number.' },
    { kind: 'trap', title: 'Negative inputs need parentheses', wrong: '$f(x) = x^2$, so $f(-3) = -3^2 = -9$', right: '$f(-3) = (-3)^2 = 9$', why: 'Replace $x$ with the **whole** input, wrapped in parentheses. $-3^2$ squares only the 3; $(-3)^2$ squares $-3$.' },
    { kind: 'idea', title: 'Reading a table', body: 'A table lists inputs and outputs. If each step right adds the same amount to $f(x)$, the rule is linear: that step size is the slope.', math: '\\begin{array}{c|cccc} x & 0 & 1 & 2 & 3 \\\\ \\hline f(x) & 4 & 7 & 10 & 13 \\end{array}\\quad\\Rightarrow\\quad f(x) = 3x + 4' },
    { kind: 'check', question: 'Which of these is **not** a function?', options: ['$\\{(1, 5), (2, 5), (1, 7)\\}$', '$\\{(1, 5), (2, 5), (3, 5)\\}$', '$\\{(0, 0), (1, 1), (2, 4)\\}$', '$\\{(-1, 2), (1, 2), (3, 4)\\}$'], correct: 0, explain: 'The input 1 goes to two different outputs (5 and 7) — a function can’t do that. Repeated **outputs** are fine; repeated **inputs** with different outputs are not.' },
  ],
  generate(rng, level) {
    const f = rng.pick(['f', 'g', 'h'])
    const kind =
      level === 1 ? rng.pick(['evalLin', 'table', 'tableInv']) : level === 2 ? rng.pick(['evalQuad', 'solveLin', 'combo', 'evalLin']) : rng.pick(['word', 'isFunc', 'rule', 'evalQuad'])
    if (kind === 'evalLin') {
      const a = rng.nz(-6, 6)
      const b = rng.nz(-9, 9)
      const k = level === 1 ? rng.int(-3, 9) : rng.int(-6, -1)
      const v = a * k + b
      return {
        prompt: `If $${f}(x) = ${lin(a, b)}$, find $${f}(${k})$.`,
        answer: { kind: 'num', value: v },
        hints: [`$${f}(${k})$ means: replace every $x$ with $${k}$.`, `$${f}(${k}) = ${mulT(a, k)} ${sgn(b)}$`, `$${mulT(a, k)} = ${a * k}$. Now ${b > 0 ? 'add' : 'subtract'} $${Math.abs(b)}$.`],
        steps: [{ text: `Substitute $x = ${k}$:`, math: `${f}(${k}) = ${mulT(a, k)} ${sgn(b)} = ${a * k} ${sgn(b)} = ${v}` }],
        mistakes: [
          { value: a * k, say: `You forgot the $${sgn(b).replace(/ /g, '')}$ at the end of the rule.` },
          ...(k !== 0 ? [{ value: (k - b) / a, say: `That solves $${f}(x) = ${k}$. But $${f}(${k})$ means the **input** is ${k} — plug it in.` }] : []),
          ...(k < 0 ? [{ value: -a * k + b, say: 'Careful with the negative input — keep it in parentheses so its sign multiplies through.' }] : []),
        ],
      }
    }
    if (kind === 'table' || kind === 'tableInv') {
      const a = rng.nz(-4, 5)
      const b = rng.int(-6, 9)
      const s = rng.int(-3, 2)
      const xs = [0, 1, 2, 3, 4].map((i) => s + i)
      const ys = xs.map((x) => a * x + b)
      const i = rng.int(0, 4)
      if (kind === 'table')
        return {
          prompt: `Use the table to find $${f}(${xs[i]})$.\n$$${tableTex(f, xs, ys)}$$`,
          answer: { kind: 'num', value: ys[i] },
          hints: [`$${f}(${xs[i]})$ is the output when the input $x$ is $${xs[i]}$.`, `Find $${xs[i]}$ in the $x$ row.`, 'Read the number directly below it.'],
          steps: [{ text: `In the column where $x = ${xs[i]}$, the output is $${ys[i]}$.`, math: `${f}(${xs[i]}) = ${ys[i]}` }],
          mistakes: [
            { value: ys[i < 4 ? i + 1 : i - 1], say: 'You read the column next door. Find the exact input first, then go straight down.' },
            ...(ys.includes(xs[i]) && ys[i] !== xs[i] ? [{ value: xs[ys.indexOf(xs[i])], say: `You found $${xs[i]}$ in the **output** row. $${f}(${xs[i]})$ means the **input** is $${xs[i]}$ — find it in the $x$ row.` }] : []),
          ],
        }
      const ys2 = ys.slice()
      const target = ys2[i]
      const xi = xs[i]
      return {
        prompt: `Use the table: for which input $x$ is $${f}(x) = ${target}$?\n$$${tableTex(f, xs, ys)}$$`,
        answer: { kind: 'num', value: xi },
        hints: [`This time you know the **output** (${target}). Look for it in the $${f}(x)$ row.`, `Find $${target}$ in the bottom row.`, 'The input is directly above it.'],
        steps: [{ text: `$${target}$ appears in the $${f}(x)$ row under $x = ${xi}$.`, math: `${f}(${xi}) = ${target}` }],
        mistakes: [
          ...(target !== xi ? [{ value: target, say: `${target} is the output. The question asks which **input** gives it.` }] : []),
          ...(xs.includes(target) && a * target + b !== xi ? [{ value: a * target + b, say: `That’s $${f}(${target})$ — you used ${target} as an input. Here it’s the output.` }] : []),
        ],
      }
    }
    if (kind === 'evalQuad') {
      const a = rng.nz(-3, 3)
      const b = rng.int(-6, 6)
      const c = rng.int(-9, 9)
      const k = rng.chance(0.75) ? rng.int(-4, -1) : rng.int(2, 4)
      const cs = [a, b, c]
      const v = evalPoly(cs, k)
      const wrongSq = a * -(k * k) + b * k + c
      return {
        prompt: `If $${f}(x) = ${poly(cs)}$, find $${f}(${k})$.`,
        answer: { kind: 'num', value: v },
        hints: [`Replace **every** $x$ with $(${k})$ — keep the parentheses.`, `$${f}(${k}) = ${subPoly(cs, k)}$`, `$(${k})^2 = ${k * k}$. Do the powers first, then multiply, then add.`],
        steps: [
          { text: 'Substitute with parentheses:', math: `${f}(${k}) = ${subPoly(cs, k)}` },
          { text: 'Powers first:', math: `= ${sumTex([a * k * k, b * k, c])}` },
          { text: 'Add:', math: `= ${v}` },
        ],
        mistakes: [
          ...(wrongSq !== v ? [{ value: wrongSq, say: `$(${k})^2 = ${k * k}$, not $${-k * k}$. A negative number squared is positive — that’s why the parentheses matter.` }] : []),
          { value: a * 2 * k + b * k + c, say: `Squaring means multiplying by itself: $(${k})^2 = ${k}\\cdot${paren(k)}$, not $2\\cdot${paren(k)}$.` },
          ...(a !== 1 ? [{ value: (a * k) ** 2 + b * k + c, say: `Only the $x$ is squared, not the ${a}: compute $(${k})^2 = ${k * k}$ first, then multiply by ${a}.` }] : []),
        ],
      }
    }
    if (kind === 'solveLin') {
      const a = pickNot(rng, -6, 6, [-1, 0, 1])
      const b = rng.nz(-9, 9)
      const x = rng.nz(-8, 8)
      const t = a * x + b
      return {
        prompt: `If $${f}(x) = ${lin(a, b)}$, find the input $x$ for which $${f}(x) = ${t}$.`,
        answer: { kind: 'num', value: x },
        hints: ['Here the **output** is known. Set the rule equal to it.', `$${lin(a, b)} = ${t}$`, `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$, then divide by $${a}$.`],
        steps: [{ text: 'Set the rule equal to the output:', math: `${lin(a, b)} = ${t}` }, ...solveSteps(a, b, t), { text: 'Check:', math: `${f}(${x}) = ${mulT(a, x)} ${sgn(b)} = ${t}\\ \\checkmark` }],
        mistakes: [
          { value: a * t + b, say: `That’s $${f}(${t})$ — you plugged ${t} in as an input. ${t} is the **output**; solve for the input.` },
          { value: (t + b) / a, say: `To undo $${sgn(b).replace(/ /g, '')}$, ${b > 0 ? 'subtract' : 'add'} ${Math.abs(b)}.` },
        ],
      }
    }
    if (kind === 'combo') {
      const a = rng.nz(-5, 5)
      const b = rng.int(-6, 6)
      const c = rng.nz(-3, 3)
      const d = rng.int(-6, 6)
      const k1 = rng.int(-3, 4)
      const k2 = rng.int(-3, 4)
      const fv = a * k1 + b
      const gv = c * k2 * k2 + d
      const minus = rng.chance(0.4)
      const val = minus ? fv - gv : fv + gv
      const gRule = poly([c, 0, d])
      return {
        prompt: `Let $f(x) = ${lin(a, b)}$ and $g(x) = ${gRule}$. Find $f(${k1}) ${minus ? '-' : '+'} g(${k2})$.`,
        answer: { kind: 'num', value: val },
        hints: ['Evaluate each function separately, then combine.', `$f(${k1}) = ${mulT(a, k1)} ${b ? sgn(b) : ''} = ${fv}$`, `$g(${k2}) = ${subPoly([c, 0, d], k2)} = ${gv}$. Now ${minus ? 'subtract' : 'add'}.`],
        steps: [
          { text: `Evaluate $f(${k1})$:`, math: `f(${k1}) = ${fv}` },
          { text: `Evaluate $g(${k2})$:`, math: `g(${k2}) = ${subPoly([c, 0, d], k2)} = ${gv}` },
          { text: 'Combine:', math: `${fv} ${minus ? '-' : '+'} ${paren(gv)} = ${val}` },
        ],
        mistakes: [
          ...(gv !== 0 ? [{ value: fv, say: `That’s just $f(${k1})$. You still need to ${minus ? 'subtract' : 'add'} $g(${k2})$.` }] : []),
          ...(minus ? [{ value: fv + gv, say: `It’s $f(${k1})$ **minus** $g(${k2})$ — subtracting a negative adds, but watch the sign carefully.` }] : []),
          ...(c * k2 * k2 !== -c * k2 * k2 ? [{ value: minus ? fv - (-c * k2 * k2 + d) : fv + (-c * k2 * k2 + d), say: `$(${k2})^2 = ${k2 * k2}$ — squares are never negative.` }] : []),
        ],
      }
    }
    if (kind === 'word') {
      if (rng.chance(0.5)) {
        const r = 5 * rng.int(5, 15)
        const fee = 5 * rng.int(4, 20)
        const h = rng.int(2, 8)
        const askCost = rng.chance(0.5)
        const C = r * h + fee
        return {
          prompt: askCost
            ? `A flight-sim center charges $C(h) = ${r}h + ${fee}$ dollars for $h$ hours. Find $C(${h})$, the cost of ${h} hours.`
            : `A flight-sim center charges $C(h) = ${r}h + ${fee}$ dollars for $h$ hours. Your bill is \\$${C}. Solve $C(h) = ${C}$ for the number of hours.`,
          answer: { kind: 'num', value: askCost ? C : h },
          hints: askCost
            ? [`$C(${h})$ means $h = ${h}$.`, `$C(${h}) = ${r}(${h}) + ${fee}$`, `$${r * h} + ${fee}$`]
            : ['Set the rule equal to the bill.', `$${r}h + ${fee} = ${C}$`, `Subtract ${fee}, then divide by ${r}.`],
          steps: askCost
            ? [{ text: 'Substitute $h = ' + h + '$:', math: `C(${h}) = ${r}(${h}) + ${fee} = ${r * h} + ${fee} = ${C}` }, { text: `${h} hours cost **\\$${C}**.` }]
            : [{ text: 'Set up:', math: `${r}h + ${fee} = ${C}` }, { text: `Subtract ${fee}:`, math: `${r}h = ${C - fee}` }, { text: `Divide by ${r}:`, math: `h = ${h}` }],
          mistakes: askCost
            ? [{ value: r * h, say: `Don’t forget the \\$${fee} fee.` }, { value: r + h + fee, say: `$${r}h$ means ${r} **times** $h$.` }]
            : [{ value: r * C + fee, say: `That treats ${C} as the number of hours. ${C} is the **cost** — solve for $h$.` }, { value: C / r, say: `Subtract the \\$${fee} fee before dividing.` }],
        }
      }
      const alt = 1000 * rng.int(8, 30)
      const rate = 100 * rng.int(4, 15)
      const t = rng.int(2, Math.min(10, Math.floor((alt - 500) / rate)))
      const A = alt - rate * t
      const askAlt = rng.chance(0.5)
      return {
        prompt: askAlt
          ? `A descending plane’s altitude is $A(t) = ${alt} - ${rate}t$ feet after $t$ minutes. Find $A(${t})$.`
          : `A descending plane’s altitude is $A(t) = ${alt} - ${rate}t$ feet after $t$ minutes. After how many minutes is it at ${A} ft?`,
        answer: { kind: 'num', value: askAlt ? A : t, unit: askAlt ? 'ft' : 'minutes' },
        hints: askAlt
          ? [`Replace $t$ with ${t}.`, `$A(${t}) = ${alt} - ${rate}(${t})$`, `$${rate}\\cdot${t} = ${rate * t}$`]
          : [`Set $A(t) = ${A}$.`, `$${alt} - ${rate}t = ${A}$`, `Subtract ${alt}, then divide by $-${rate}$.`],
        steps: askAlt
          ? [{ text: 'Substitute:', math: `A(${t}) = ${alt} - ${rate}(${t}) = ${alt} - ${rate * t} = ${A}` }]
          : [{ text: 'Set up:', math: `${alt} - ${rate}t = ${A}` }, { text: `Subtract ${alt}:`, math: `-${rate}t = ${A - alt}` }, { text: `Divide by $-${rate}$:`, math: `t = ${t}` }],
        mistakes: askAlt
          ? [{ value: alt + rate * t, say: 'The plane is descending, so its altitude goes **down**: subtract.' }, { value: rate * t, say: `That’s how much altitude it lost. Subtract it from ${alt}.` }]
          : [{ value: A / rate, say: `Start from ${alt} ft: the plane has lost $${alt} - ${A} = ${alt - A}$ ft. Divide that by ${rate}.` }, { value: -t, say: 'Dividing a negative by a negative gives a positive.' }],
      }
    }
    if (kind === 'isFunc') {
      const mk = (bad: boolean, repeatY: boolean): [number, number][] => {
        const xs = rng.shuffle([-2, -1, 0, 1, 2, 3, 4, 5]).slice(0, 3)
        const pts: [number, number][] = xs.map((x) => [x, rng.int(-5, 9)])
        if (repeatY) pts[2][1] = pts[0][1]
        if (bad) {
          const y = pickNot(rng, -5, 9, [pts[0][1]])
          pts.push([pts[0][0], y])
          return rng.shuffle(pts)
        }
        return pts
      }
      const badRel = mk(true, false)
      const trick = mk(false, true)
      const others = [mk(false, false), mk(false, rng.chance(0.3))]
      const correct = `$${relTex(badRel)}$`
      const trickT = `$${relTex(trick)}$`
      const c = choices(rng, correct, [trickT, ...others.map((o) => `$${relTex(o)}$`)])
      const dupX = badRel.find((pt, i) => badRel.findIndex((q) => q[0] === pt[0]) !== i)![0]
      const ysAt = badRel.filter((q) => q[0] === dupX).map((q) => q[1])
      return {
        prompt: 'Which relation is **not** a function?',
        answer: { kind: 'choice', options: c.options, correct: c.correct },
        hints: ['A function gives each input **exactly one** output.', 'Look for an $x$-value (first number) that appears twice.', 'If the same $x$ shows up twice with **different** $y$-values, it’s not a function. Repeated $y$-values are fine.'],
        steps: [{ text: `In ${correct}, the input $${dupX}$ appears with outputs $${ysAt[0]}$ and $${ysAt[1]}$.` }, { text: 'One input with two outputs breaks the rule — **not a function**. In every other relation each input appears once.' }],
        mistakes: [
          { when: picked(c.options.indexOf(trickT)), say: 'That one repeats an **output**, which is allowed — two inputs can share an output. Look for a repeated **input**.' },
          { when: (raw) => raw.trim() !== String(c.correct), say: 'Every input in that relation appears only once, so it is a function. Hunt for an $x$ that appears twice with different $y$’s.' },
        ],
      }
    }
    // rule from table
    const a = rng.nz(-4, 6)
    const b = rng.nz(-8, 9)
    const start = rng.pick([0, 1])
    const xs = [0, 1, 2, 3].map((i) => start + i)
    const ys = xs.map((x) => a * x + b)
    return {
      prompt: `Write a rule for the linear function in the table.\n$$${tableTex(f, xs, ys)}$$`,
      answer: { kind: 'expr', expr: lin(a, b), prefix: `${f}(x)` },
      placeholder: `${f}(x) = ...`,
      hints: [
        `How much does $${f}(x)$ change each time $x$ goes up by 1? That’s the multiplier of $x$.`,
        `Each step changes $${f}(x)$ by $${a}$, so $${f}(x) = ${coef(a, 'x')} + b$.`,
        start === 0 ? `When $x = 0$, $${f}(x) = ${b}$ — that’s $b$.` : `Step back from $x = 1$ to $x = 0$: $${ys[0]} - ${paren(a)} = ${b}$.`,
      ],
      steps: [
        { text: `Each time $x$ increases by 1, $${f}(x)$ changes by $${a}$ — that’s the slope.`, math: `${ys[1]} - ${paren(ys[0])} = ${a}` },
        { text: start === 0 ? `At $x = 0$ the output is $${b}$ — the starting value.` : `Working back to $x = 0$: $${ys[0]} - ${paren(a)} = ${b}$.` },
        { text: 'Rule:', math: `${f}(x) = ${lin(a, b)}` },
      ],
      mistakes: [
        { when: isExpr(lin(a, 0)), say: `Check it: at $x = ${xs[0]}$ your rule gives $${a * xs[0]}$, but the table says $${ys[0]}$. You need a constant term too.` },
        ...(a !== b ? [{ when: isExpr(lin(b, a)), say: 'Swapped: the step size multiplies $x$; the value at $x = 0$ is the constant.' }] : []),
        ...(start === 1 ? [{ when: isExpr(lin(a, ys[0])), say: `$${ys[0]}$ is the output at $x = 1$, not $x = 0$. Step back once more to find $b$.` }] : []),
      ],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 7. SYSTEMS OF EQUATIONS
// ════════════════════════════════════════════════════════════════════════════

const casesTex = (a: string, b: string) => `\\begin{cases} ${a} \\\\ ${b} \\end{cases}`

/** Elimination steps for a1x + b1y = c1, a2x + b2y = c2 (eliminates y). */
function elimSteps(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number, x0: number, y0: number): Step[] {
  const L = lcm(Math.abs(b1), Math.abs(b2))
  const k1 = L / Math.abs(b1)
  const k2 = L / Math.abs(b2)
  const steps: Step[] = []
  if (k1 > 1) steps.push({ text: `Multiply the first equation by $${k1}$ so the $y$-terms match in size:`, math: eqTex(k1 * a1, k1 * b1, k1 * c1) })
  if (k2 > 1) steps.push({ text: `Multiply the second equation by $${k2}$:`, math: eqTex(k2 * a2, k2 * b2, k2 * c2) })
  const opposite = Math.sign(b1) !== Math.sign(b2)
  const A = opposite ? k1 * a1 + k2 * a2 : k1 * a1 - k2 * a2
  const C = opposite ? k1 * c1 + k2 * c2 : k1 * c1 - k2 * c2
  steps.push({ text: opposite ? 'The $y$-terms are opposites — **add** the equations and $y$ disappears:' : 'The $y$-terms are equal — **subtract** the equations and $y$ disappears:', math: `${coef(A, 'x')} = ${C}` })
  if (A !== 1) steps.push({ text: `Divide by $${A}$:`, math: `x = ${x0}` })
  steps.push({ text: `Substitute $x = ${x0}$ into the first equation:`, math: `${mulT(a1, x0)} ${sterm(b1, 'y')} = ${c1} \\Rightarrow ${coef(b1, 'y')} = ${c1 - a1 * x0} \\Rightarrow y = ${y0}` })
  steps.push({ text: `Solution: $(${x0}, ${y0})$. Check it in the second equation: $${mulT(a2, x0)} ${b2 < 0 ? '-' : '+'} ${Math.abs(b2) === 1 ? '' : Math.abs(b2)}(${y0}) = ${c2}$ ✓` })
  return steps
}

const lineOf = (a: number, b: number, c: number) => ({ m: -a / b, b: c / b })

function pairMistakes(x0: number, y0: number): Misconception[] {
  return [
    { when: pairPart(x0, y0, 'x'), say: 'Your $x$ is right — recheck the substitution step where you found $y$.' },
    { when: pairPart(x0, y0, 'y'), say: 'Your $y$ is right — recheck the step where you solved for $x$.' },
  ]
}

const SYS_COUNT = ['Exactly one solution', 'No solution', 'Infinitely many solutions']

const systems: Skill = {
  id: 'systems',
  unit: 'alg',
  title: 'Systems of equations',
  blurb: 'Two equations, two unknowns — find the point that satisfies both.',
  prereqs: ['slope-int', 'multi-step'],
  why: 'Two unknowns need two facts. Ticket sales, mixtures, and finding a plane’s true airspeed versus the wind are all systems — and the answer is where two lines cross.',
  learn: [
    { kind: 'idea', title: 'One point, two equations', body: 'Each equation is a line — every point on it makes that equation true. The **solution of the system** is the point on **both** lines: where they cross.', math: '\\begin{cases} y = x + 1 \\\\ y = -x + 5 \\end{cases}\\quad\\Rightarrow\\quad (2, 3)' },
    { kind: 'idea', title: 'Substitution', body: 'If one equation already says $y = \\ldots$, plug that expression in for $y$ in the other. Now you have one equation in $x$ alone.', math: 'y = 2x - 1,\\ \\ x + y = 8 \\Rightarrow x + (2x - 1) = 8 \\Rightarrow x = 3,\\ y = 5' },
    { kind: 'idea', title: 'Elimination', body: 'Line the equations up and **add or subtract** them so one variable cancels. If nothing cancels yet, multiply an equation by a number first — that doesn’t change its line.', math: '\\begin{array}{r} 3x + 2y = 16 \\\\ +\\;\\; x - 2y = 0 \\\\ \\hline 4x = 16 \\end{array}' },
    { kind: 'trap', title: 'Stopping halfway', wrong: '$x = 3$ (done!)', right: '$x = 3$, then substitute back: $y = 5$. Answer: $(3, 5)$', why: 'The solution is a **point** — it needs both coordinates. Always substitute back, then check the pair in **both** original equations.' },
    { kind: 'check', question: 'Two lines have the same slope but different $y$-intercepts. How many solutions does the system have?', options: ['None — the lines are parallel', 'Exactly one', 'Infinitely many', 'Two'], correct: 0, explain: 'Same slope, different starting points: the lines run side by side forever and never cross. Same slope **and** same intercept would be one line — infinitely many solutions.' },
  ],
  generate(rng, level) {
    const kind = level === 1 ? rng.pick(['sub', 'equal']) : level === 2 ? rng.pick(['add', 'mult1', 'sub']) : rng.pick(['mult2', 'word', 'count', 'mult1'])
    const x0 = rng.int(-5, 5)
    const y0 = rng.int(-5, 5)
    if (kind === 'sub') {
      const m = rng.nz(-3, 3)
      const b = y0 - m * x0
      const a2 = rng.nz(-4, 4)
      let b2 = rng.nz(-3, 3)
      if (a2 + b2 * m === 0) b2 = b2 > 0 ? b2 + 1 : b2 - 1
      const c2 = a2 * x0 + b2 * y0
      const A = a2 + b2 * m
      const B = b2 * b
      const bT = `${b2 < 0 ? '-' : '+'} ${Math.abs(b2) === 1 ? '' : Math.abs(b2)}(${lin(m, b)})`
      return {
        prompt: `Solve the system. Answer as $(x, y)$.\n$$${casesTex(`y = ${lin(m, b)}`, eqTex(a2, b2, c2))}$$`,
        answer: { kind: 'pair', x: x0, y: y0 },
        placeholder: '(x, y)',
        visual: level === 1 ? { type: 'plane', range: 6, lines: [{ m, b }, lineOf(a2, b2, c2)] } : undefined,
        hints: ['The first equation tells you exactly what $y$ is. Substitute it into the second.', `$${coef(a2, 'x')} ${bT} = ${c2}$`, `Simplify: $${lin(A, B)} = ${c2}$. Solve for $x$, then find $y$.`],
        steps: [
          { text: 'Substitute the first equation into the second:', math: `${coef(a2, 'x')} ${bT} = ${c2}` },
          { text: 'Distribute and combine:', math: `${lin(A, B)} = ${c2}` },
          ...solveSteps(A, B, c2),
          { text: 'Find $y$ using the first equation:', math: `y = ${mulT(m, x0)}${b ? ' ' + sgn(b) : ''} = ${y0}` },
          { text: `Solution: $(${x0}, ${y0})$ — where the two lines cross.` },
        ],
        mistakes: pairMistakes(x0, y0),
      }
    }
    if (kind === 'equal') {
      const m1 = rng.nz(-3, 3)
      const m2 = pickNot(rng, -3, 3, [0, m1])
      const b1 = y0 - m1 * x0
      const b2 = y0 - m2 * x0
      return {
        prompt: `Solve the system. Answer as $(x, y)$.\n$$${casesTex(`y = ${lin(m1, b1)}`, `y = ${lin(m2, b2)}`)}$$`,
        answer: { kind: 'pair', x: x0, y: y0 },
        placeholder: '(x, y)',
        visual: { type: 'plane', range: 6, lines: [{ m: m1, b: b1 }, { m: m2, b: b2 }] },
        hints: ['Both equations equal $y$, so they equal each other.', `$${lin(m1, b1)} = ${lin(m2, b2)}$`, 'Gather the $x$-terms on one side and solve. Then plug $x$ into either equation for $y$.'],
        steps: [
          { text: 'Set the right sides equal:', math: `${lin(m1, b1)} = ${lin(m2, b2)}` },
          ...bothSidesSteps(m1, b1, m2, b2),
          { text: 'Find $y$:', math: `y = ${mulT(m1, x0)}${b1 ? ' ' + sgn(b1) : ''} = ${y0}` },
          { text: `Solution: $(${x0}, ${y0})$ — the crossing point on the graph.` },
        ],
        mistakes: pairMistakes(x0, y0),
      }
    }
    if (kind === 'add' || kind === 'mult1' || kind === 'mult2') {
      let a1: number, b1: number, a2: number, b2: number
      do {
        a1 = rng.nz(-5, 5)
        a2 = rng.nz(-5, 5)
        if (kind === 'add') {
          b1 = rng.nz(-4, 4)
          b2 = -b1
        } else if (kind === 'mult1') {
          b1 = rng.nz(-3, 3)
          b2 = b1 * rng.pick([2, 3, -2, -3])
          if (rng.chance(0.5)) [b1, b2] = [b2, b1]
        } else {
          b1 = rng.pick([2, 3, 4, 5]) * (rng.chance(0.5) ? 1 : -1)
          b2 = rng.pick([2, 3, 4, 5]) * (rng.chance(0.5) ? 1 : -1)
          if (gcd(b1, b2) !== 1) b2 = b2 > 0 ? b2 + 1 : b2 - 1
        }
      } while (a1 * b2 - a2 * b1 === 0)
      const c1 = a1 * x0 + b1 * y0
      const c2 = a2 * x0 + b2 * y0
      return {
        prompt: `Solve by elimination. Answer as $(x, y)$.\n$$${casesTex(eqTex(a1, b1, c1), eqTex(a2, b2, c2))}$$`,
        answer: { kind: 'pair', x: x0, y: y0 },
        placeholder: '(x, y)',
        visual: level === 2 ? { type: 'plane', range: 6, lines: [lineOf(a1, b1, c1), lineOf(a2, b2, c2)] } : undefined,
        hints: [
          'Look at the $y$-coefficients. Can you make them equal or opposite?',
          kind === 'add' ? 'They’re already opposites — add the equations.' : `Multiply so both $y$-terms become $${lcm(Math.abs(b1), Math.abs(b2))}y$ in size.`,
          'Once $y$ cancels, solve for $x$ and substitute back to find $y$.',
        ],
        steps: elimSteps(a1, b1, c1, a2, b2, c2, x0, y0),
        mistakes: [
          ...pairMistakes(x0, y0),
          { when: (raw) => { const g = readNums(raw); return !!g && g.length === 1 }, say: 'A system’s solution is a point — give both coordinates as $(x, y)$.' },
        ],
      }
    }
    if (kind === 'word') {
      const t = rng.int(0, 2)
      if (t === 0) {
        const pa = rng.int(9, 16)
        const pc = rng.int(4, pa - 2)
        const A = rng.int(5, 40)
        const C = rng.int(5, 40)
        const N = A + C
        const R = pa * A + pc * C
        return {
          prompt: `A museum sold ${N} tickets for \\$${R}. Adult tickets cost \\$${pa} and child tickets cost \\$${pc}. Let $x$ = adult tickets and $y$ = child tickets. Find $(x, y)$.`,
          answer: { kind: 'pair', x: A, y: C },
          placeholder: '(x, y)',
          hints: ['Write one equation for the **number** of tickets and one for the **money**.', `$x + y = ${N}$ and $${pa}x + ${pc}y = ${R}$.`, `Multiply the first by ${pc} and subtract: $${pa - pc}x = ${R - pc * N}$.`],
          steps: [{ text: 'Set up the system:', math: casesTex(`x + y = ${N}`, `${pa}x + ${pc}y = ${R}`) }, ...elimSteps(1, 1, N, pa, pc, R, A, C), { text: `**${A} adult** and **${C} child** tickets.` }],
          mistakes: [...pairMistakes(A, C), { when: (raw) => { const g = readNums(raw); return !!g && g.length === 2 && near(g[0], C) && near(g[1], A) }, say: 'Swapped: $x$ is the number of **adult** tickets.' }],
        }
      }
      if (t === 1) {
        const pSpd = 10 * rng.int(12, 30)
        const w = 5 * rng.int(2, 12)
        const t1 = rng.int(2, 4)
        const t2 = rng.int(2, 5)
        const d1 = (pSpd + w) * t1
        const d2 = (pSpd - w) * t2
        return {
          prompt: `With a tailwind, a plane flies ${d1} miles in ${t1} hours. Flying back against the same wind, it covers ${d2} miles in ${t2} hours. Find the plane’s airspeed $x$ and the wind speed $y$ in mph, as $(x, y)$.`,
          answer: { kind: 'pair', x: pSpd, y: w },
          placeholder: '(x, y)',
          hints: ['With the wind, ground speed = $x + y$. Against it, ground speed = $x - y$.', `Speed = distance ÷ time: $x + y = ${d1 / t1}$ and $x - y = ${d2 / t2}$.`, 'Add the two equations — $y$ cancels.'],
          steps: [
            { text: 'Ground speeds from distance ÷ time:', math: casesTex(`x + y = ${d1}\\div${t1} = ${d1 / t1}`, `x - y = ${d2}\\div${t2} = ${d2 / t2}`) },
            { text: 'Add the equations:', math: `2x = ${d1 / t1 + d2 / t2} \\Rightarrow x = ${pSpd}` },
            { text: 'Substitute back:', math: `${pSpd} + y = ${d1 / t1} \\Rightarrow y = ${w}` },
            { text: `Airspeed **${pSpd} mph**, wind **${w} mph**.` },
          ],
          mistakes: [...pairMistakes(pSpd, w), { when: (raw) => { const g = readNums(raw); return !!g && g.length === 2 && near(g[0], d1 / t1) }, say: `${d1 / t1} mph is the ground speed **with** the wind ($x + y$), not the airspeed.` }],
        }
      }
      const a1 = rng.int(1, 4)
      const b1 = rng.int(1, 4)
      let a2 = rng.int(1, 4)
      const b2 = rng.int(1, 5)
      if (a1 * b2 === a2 * b1) a2 = a2 === 4 ? 1 : a2 + 1
      const sx = rng.int(4, 9)
      const sy = rng.int(1, 4)
      const c1 = a1 * sx + b1 * sy
      const c2 = a2 * sx + b2 * sy
      return {
        prompt: `At the airport café, ${a1} sandwich${a1 > 1 ? 'es' : ''} and ${b1} drink${b1 > 1 ? 's' : ''} cost \\$${c1}. ${a2} sandwich${a2 > 1 ? 'es' : ''} and ${b2} drink${b2 > 1 ? 's' : ''} cost \\$${c2}. Let $x$ = price of a sandwich and $y$ = price of a drink. Find $(x, y)$.`,
        answer: { kind: 'pair', x: sx, y: sy },
        placeholder: '(x, y)',
        hints: ['Each order gives one equation.', `$${eqTex(a1, b1, c1)}$ and $${eqTex(a2, b2, c2)}$`, 'Make the $y$-terms match by multiplying, then subtract.'],
        steps: [{ text: 'Set up:', math: casesTex(eqTex(a1, b1, c1), eqTex(a2, b2, c2)) }, ...elimSteps(a1, b1, c1, a2, b2, c2, sx, sy), { text: `Sandwich **\\$${sx}**, drink **\\$${sy}**.` }],
        mistakes: pairMistakes(sx, sy),
      }
    }
    // count solutions
    const m = rng.nz(-4, 4)
    const b1 = rng.int(-6, 6)
    const which = rng.int(0, 2)
    const k = rng.pick([2, 3, -2])
    const m2 = which === 0 ? pickNot(rng, -4, 4, [m]) : m
    const b2 = which === 1 ? pickNot(rng, -6, 6, [b1]) : which === 2 ? b1 : rng.int(-6, 6)
    const second = `${coef(-k * m2, 'x')} ${sterm(k, 'y')} = ${k * b2}`
    const correctText = SYS_COUNT[which === 0 ? 0 : which === 1 ? 1 : 2]
    const c = choices(rng, correctText, SYS_COUNT.filter((s) => s !== correctText))
    return {
      prompt: `How many solutions does this system have?\n$$${casesTex(`y = ${lin(m, b1)}`, m2 === 0 ? `${k}y = ${k * b2}` : second)}$$`,
      answer: { kind: 'choice', options: c.options, correct: c.correct },
      hints: ['Put both equations in $y = mx + b$ form.', `Solve the second for $y$: divide by $${k}$ after moving the $x$-term.`, 'Compare slopes first. Same slope? Then compare intercepts.'],
      steps: [
        { text: 'Second equation in slope-intercept form:', math: `y = ${lin(m2, b2)}` },
        {
          text:
            which === 0
              ? `Slopes $${m}$ and $${m2}$ are different, so the lines cross exactly once — **one solution**.`
              : which === 1
                ? `Same slope ($${m}$), different intercepts ($${b1}$ vs $${b2}$): parallel lines never meet — **no solution**.`
                : 'Same slope **and** same intercept: it’s the same line twice — **infinitely many solutions**.',
        },
      ],
      mistakes: [
        { when: (raw) => raw.trim() !== String(c.correct), say: which === 0 ? 'The slopes are different, so the lines must cross — exactly once.' : which === 1 ? 'Same slope but different intercepts means parallel lines — they never cross.' : 'After simplifying, the two equations are identical — every point on the line works.' },
      ],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 8. EXPONENT RULES
// ════════════════════════════════════════════════════════════════════════════

const expRules: Skill = {
  id: 'exp-rules',
  unit: 'alg',
  title: 'Exponent rules',
  blurb: 'Product, quotient and power rules — and what zero and negative exponents mean.',
  prereqs: ['exponents'],
  why: 'Scientific notation, compound interest, computer memory (2¹⁰ = 1024) and every polynomial you’ll ever simplify run on these rules.',
  learn: [
    { kind: 'idea', title: 'Just count the factors', body: 'Every rule comes from writing the factors out. $x^3\\cdot x^4$ is three $x$’s times four $x$’s — **seven** $x$’s in a row:', math: 'x^3\\cdot x^4 = (x\\,x\\,x)(x\\,x\\,x\\,x) = x^{7}\\qquad x^a\\cdot x^b = x^{a+b}' },
    { kind: 'idea', title: 'Quotient and power rules', body: 'Dividing cancels matching factors, so exponents **subtract**. Raising a power to a power repeats it, so exponents **multiply**:', math: '\\frac{x^7}{x^3} = x^{4}\\qquad (x^3)^2 = x^3\\cdot x^3 = x^{6}' },
    { kind: 'explore', title: 'Walk the staircase down', body: 'Each bar is one more factor of the base. Moving one bar **left** divides by the base.', widget: { w: 'exponent' }, task: 'Set base 2, exponent 3, then step the exponent down to 0. Keep dividing by 2 in your head: what would $2^{-1}$ and $2^{-2}$ be?' },
    { kind: 'idea', title: 'Zero and negative exponents', body: 'Following that pattern: $2^0 = 1$ and $2^{-1} = \\frac12$. A negative exponent means **reciprocal**, not a negative number.', math: 'x^0 = 1\\qquad x^{-n} = \\frac{1}{x^n}\\qquad 2^{-3} = \\frac18' },
    { kind: 'trap', title: 'Multiplying when you should add', wrong: '$x^3\\cdot x^4 = x^{12}$', right: '$x^3\\cdot x^4 = x^{7}$', why: 'Count them: 3 factors and 4 more factors make 7 factors. You only multiply exponents for a **power of a power**.' },
    { kind: 'trap', title: 'Adding when you should multiply', wrong: '$(x^3)^2 = x^{5}$', right: '$(x^3)^2 = x^3\\cdot x^3 = x^{6}$', why: 'The outer 2 means “two copies of $x^3$” — that’s 3 + 3 = 6 factors. And with a coefficient, it’s raised too: $(2x^3)^2 = 4x^6$.' },
    { kind: 'check', question: 'What is $5^{-2}$?', options: ['$\\frac{1}{25}$', '$-25$', '$-10$', '$\\frac{1}{10}$'], correct: 0, explain: 'Negative exponent → reciprocal: $5^{-2} = \\frac{1}{5^2} = \\frac{1}{25}$. It is positive — the minus sign is in the exponent, not on the number.' },
  ],
  generate(rng, level) {
    const v = rng.pick(['x', 'y', 'a', 'n', 'm', 't'])
    if (level === 1) {
      const kind = rng.pick(['prod', 'quot', 'pow', 'zero'])
      const base = rng.chance(0.25) ? String(rng.pick([2, 3, 5, 10])) : v
      if (kind === 'zero') {
        const c = rng.int(2, 15)
        const forms = [`${c}^0`, `(-${c})^0`, `(${c}${v}^{${rng.int(2, 6)}})^0`, `${v}^0 \\; (${v} \\ne 0)`]
        const form = rng.pick(forms)
        return {
          prompt: `Evaluate: $${form}$`,
          answer: { kind: 'num', value: 1 },
          hints: ['What happens when you keep dividing by the base as the exponent drops: $2^2 = 4$, $2^1 = 2$, $2^0 = \\,?$', 'Anything (except 0) to the zero power has the same value.', 'Zero factors leaves just the starting value of a product: 1.'],
          steps: [{ text: 'Any nonzero base raised to the power 0 equals 1 — it’s the result of dividing a power by itself:', math: `\\frac{${c}^3}{${c}^3} = ${c}^{3-3} = ${c}^0 = 1` }],
          mistakes: [
            { value: 0, say: 'Zero exponent doesn’t mean zero. $\\frac{x^3}{x^3} = 1$ and also $= x^0$, so $x^0 = 1$.' },
            { value: c, say: 'The exponent 0 means **no** factors of the base — the answer is 1, not the base itself.' },
            { value: -1, say: 'The parentheses include the whole base, so this is a nonzero number to the power 0: exactly 1.' },
          ],
        }
      }
      const a = kind === 'quot' ? rng.int(5, 12) : rng.int(2, 9)
      const b = kind === 'quot' ? rng.int(2, a - 1) : kind === 'pow' ? rng.int(2, 5) : rng.int(2, 9)
      const ans = kind === 'prod' ? a + b : kind === 'quot' ? a - b : a * b
      const expr = kind === 'prod' ? `${base}^{${a}}\\cdot ${base}^{${b}}` : kind === 'quot' ? `\\frac{${base}^{${a}}}{${base}^{${b}}}` : `(${base}^{${a}})^{${b}}`
      const rule = kind === 'prod' ? 'Same base multiplied: **add** the exponents.' : kind === 'quot' ? 'Same base divided: **subtract** the exponents.' : 'Power of a power: **multiply** the exponents.'
      const mistakes: Misconception[] =
        kind === 'prod'
          ? [{ value: a * b, say: `You multiplied the exponents. Count the factors: ${a} of them times ${b} more is $${a} + ${b}$ factors.` }]
          : kind === 'quot'
            ? [{ value: a + b, say: 'Dividing cancels factors, so exponents **subtract**.' }, ...(a % b === 0 ? [{ value: a / b, say: 'You divided the exponents. Dividing powers cancels factors: subtract the exponents.' }] : [])]
            : [{ value: a + b, say: `$(${base}^{${a}})^{${b}}$ is ${b} copies of $${base}^{${a}}$ — that’s $${a}\\times${b}$ factors, not $${a} + ${b}$.` }, { value: a ** b, say: 'Close, but the exponents multiply: the new exponent is $' + a + '\\times' + b + '$.' }]
      return {
        prompt: `$${expr} = ${base}^{\\square}$. What exponent goes in the box?`,
        answer: { kind: 'num', value: ans },
        hints: [
          'Write out what the exponents mean — count the factors.',
          rule,
          kind === 'prod' ? `$${a} + ${b} = \\,?$` : kind === 'quot' ? `$${a} - ${b} = \\,?$` : `$${a}\\times${b} = \\,?$`,
        ],
        steps: [{ text: rule }, { text: 'So:', math: `${expr} = ${base}^{${ans}}${ans === 1 ? ` = ${base}` : ''}` }],
        mistakes,
      }
    }
    if (level === 2) {
      const kind = rng.pick(['coefProd', 'coefPow', 'coefQuot', 'negNum'])
      if (kind === 'negNum') {
        const base = rng.int(2, 5)
        const n = base === 2 ? rng.int(1, 5) : base === 3 ? rng.int(1, 3) : rng.int(1, 2)
        const pw = base ** n
        return {
          prompt: `Evaluate $${base}^{-${n}}$. (A fraction is fine.)`,
          answer: { kind: 'num', value: 1 / pw },
          placeholder: 'e.g. 1/8',
          hints: ['A negative exponent means **reciprocal** — flip it under 1.', `$${base}^{-${n}} = \\frac{1}{${base}^{${n}}}$`, `$${base}^{${n}} = ${pw}$`],
          steps: [{ text: 'Negative exponent → reciprocal:', math: `${base}^{-${n}} = \\frac{1}{${base}^{${n}}} = \\frac{1}{${pw}}` }],
          mistakes: [
            { value: -pw, say: 'A negative exponent doesn’t make the number negative — it makes a **reciprocal**: $\\frac{1}{' + pw + '}$.' },
            ...(base * n !== pw ? [{ value: -base * n, say: `Exponents aren’t multiplication, and the minus sign means reciprocal: $\\frac{1}{${base}^{${n}}}$.` }] : []),
            ...(n > 1 ? [{ value: 1 / (base * n), say: `$${base}^{${n}}$ means ${n} factors of ${base}: $${Array(n).fill(base).join('\\cdot')} = ${pw}$, not $${base * n}$.` }] : []),
          ],
        }
      }
      if (kind === 'coefProd') {
        const c1 = rng.int(2, 6)
        const c2 = rng.nz(-6, 6)
        const a = rng.int(1, 6)
        const b = rng.int(2, 6)
        const ans = mono(c1 * c2, a + b, v, false)
        return {
          prompt: `Simplify: $(${mono(c1, a, v)})(${mono(c2, b, v)})$`,
          answer: { kind: 'expr', expr: ans, form: 'simplified' },
          hints: ['Group the numbers together and the powers together.', `Numbers: $${c1}\\cdot${paren(c2)} = ${c1 * c2}$.`, `Powers: $${mono(1, a, v)}\\cdot ${mono(1, b, v)} = ${v}^{${a} + ${b}}$.`],
          steps: [
            { text: 'Rearrange (multiplication can be done in any order):', math: `(${c1}\\cdot ${paren(c2)})(${mono(1, a, v)}\\cdot ${mono(1, b, v)})` },
            { text: 'Multiply the coefficients and add the exponents:', math: mono(c1 * c2, a + b, v) },
          ],
          mistakes: [
            ...(a * b !== a + b ? [{ when: isExpr(mono(c1 * c2, a * b, v, false)), say: 'Exponents **add** when you multiply powers with the same base — you multiplied them.' }] : []),
            { when: isExpr(mono(c1 + c2, a + b, v, false)), say: 'The coefficients **multiply** — they’re factors, not terms being added.' },
          ],
        }
      }
      if (kind === 'coefPow') {
        const c = rng.int(2, 4)
        const a = rng.int(1, 5)
        const n = rng.int(2, 3)
        const ans = mono(c ** n, a * n, v, false)
        return {
          prompt: `Simplify: $(${mono(c, a, v)})^{${n}}$`,
          answer: { kind: 'expr', expr: ans, form: 'simplified' },
          hints: [`The power $${n}$ applies to **everything** inside: the ${c} and the $${mono(1, a, v)}$.`, `Number: $${c}^{${n}} = ${c ** n}$.`, `Power: $(${mono(1, a, v)})^{${n}} = ${v}^{${a}\\cdot${n}}$.`],
          steps: [{ text: 'Raise each factor to the power:', math: `${c}^{${n}}\\cdot (${mono(1, a, v)})^{${n}}` }, { text: 'Evaluate and multiply exponents:', math: mono(c ** n, a * n, v) }],
          mistakes: [
            { when: isExpr(mono(c, a * n, v, false)), say: `The coefficient gets raised to the power too: $${c}^{${n}} = ${c ** n}$.` },
            ...(c * n !== c ** n ? [{ when: isExpr(mono(c * n, a * n, v, false)), say: `$${c}^{${n}}$ means ${n} factors of ${c}, which is ${c ** n} — not $${c}\\times${n}$.` }] : []),
            ...(a + n !== a * n ? [{ when: isExpr(mono(c ** n, a + n, v, false)), say: 'Power of a power: **multiply** the exponents, don’t add.' }] : []),
          ],
        }
      }
      const c2 = rng.int(2, 6)
      const q = rng.nz(-5, 6)
      const c1 = c2 * q
      const b = rng.int(1, 5)
      const a = b + rng.int(1, 6)
      const ans = mono(q, a - b, v, false)
      return {
        prompt: `Simplify: $\\frac{${mono(c1, a, v)}}{${mono(c2, b, v)}}$`,
        answer: { kind: 'expr', expr: ans, form: 'simplified' },
        hints: ['Divide the numbers and the powers separately.', `$${c1}\\div${c2} = ${q}$`, `$\\frac{${mono(1, a, v)}}{${mono(1, b, v)}} = ${v}^{${a} - ${b}}$`],
        steps: [{ text: 'Split it up:', math: `\\frac{${c1}}{${c2}}\\cdot\\frac{${mono(1, a, v)}}{${mono(1, b, v)}}` }, { text: 'Divide coefficients, subtract exponents:', math: mono(q, a - b, v) }],
        mistakes: [
          { when: isExpr(mono(q, a + b, v, false)), say: 'Dividing powers **subtracts** exponents.' },
          ...(a % b === 0 && a / b !== a - b ? [{ when: isExpr(mono(q, a / b, v, false)), say: 'Don’t divide the exponents — subtract them.' }] : []),
          ...(c1 - c2 !== q ? [{ when: isExpr(mono(c1 - c2, a - b, v, false)), say: 'The coefficients divide, they don’t subtract.' }] : []),
        ],
      }
    }
    const kind = rng.pick(['negResult', 'twoVar', 'chain', 'solveN', 'negBase0'])
    if (kind === 'negResult') {
      const a = rng.int(1, 6)
      const b = a + rng.int(2, 6)
      return {
        prompt: `Simplify $\\frac{${mono(1, a, v)}}{${v}^{${b}}}$ and write the answer with a **positive** exponent.`,
        answer: { kind: 'expr', expr: `1/${v}^${b - a}`, form: 'simplified' },
        placeholder: `e.g. 1/${v}^3`,
        hints: ['Subtract the exponents: top minus bottom.', `$${v}^{${a} - ${b}} = ${v}^{-${b - a}}$`, 'A negative exponent means reciprocal: move it to the denominator.'],
        steps: [{ text: 'Quotient rule:', math: `\\frac{${mono(1, a, v)}}{${v}^{${b}}} = ${v}^{${a}-${b}} = ${v}^{-${b - a}}` }, { text: 'Rewrite with a positive exponent:', math: `${v}^{-${b - a}} = \\frac{1}{${v}^{${b - a}}}` }, { text: `Makes sense: there are more $${v}$’s on the bottom, so ${b - a} of them are left down there.` }],
        mistakes: [
          { when: isExpr(`${v}^${b - a}`), say: 'Upside down: there are more factors in the **denominator**, so the leftover factors stay on the bottom.' },
          { when: isExpr(`-${v}^${b - a}`), say: 'A negative exponent means reciprocal, not a negative number.' },
        ],
      }
    }
    if (kind === 'twoVar') {
      const c = rng.int(1, 3)
      const a = rng.int(1, 4)
      const b = rng.int(2, 4)
      const n = rng.int(2, 3)
      const inside = `${c === 1 ? '' : c}x${a === 1 ? '' : `^{${a}}`}y^{${b}}`
      const ansS = `${c ** n === 1 ? '' : c ** n}x^${a * n}y^${b * n}`
      return {
        prompt: `Simplify: $(${inside})^{${n}}$`,
        answer: { kind: 'expr', expr: ansS, form: 'simplified' },
        hints: ['Raise **every** factor inside the parentheses to the power.', `Each exponent gets multiplied by ${n}.`, c > 1 ? `Don’t forget the coefficient: $${c}^{${n}} = ${c ** n}$.` : `$x^{${a}\\cdot${n}}y^{${b}\\cdot${n}}$`],
        steps: [{ text: 'Apply the power to each factor:', math: `${c > 1 ? `${c}^{${n}}` : ''}x^{${a}\\cdot${n}}y^{${b}\\cdot${n}}` }, { text: 'Simplify:', math: `${c ** n === 1 ? '' : c ** n}x^{${a * n}}y^{${b * n}}` }],
        mistakes: [
          ...(c > 1 ? [{ when: isExpr(`${c}x^${a * n}y^${b * n}`), say: `The coefficient is raised too: $${c}^{${n}} = ${c ** n}$.` }] : []),
          { when: isExpr(`${c ** n === 1 ? '' : c ** n}x^${a + n}y^${b + n}`), say: 'Power of a power: **multiply** exponents, don’t add.' },
        ],
      }
    }
    if (kind === 'chain') {
      const a = rng.int(2, 4)
      const b = rng.int(2, 3)
      const c = rng.int(-2, 5)
      const d = rng.int(1, a * b + c - 1)
      const e = a * b + c - d
      const cT = c < 0 ? `${v}^{${c}}` : mono(1, c, v)
      const top = c === 0 ? `(${v}^{${a}})^{${b}}` : `(${v}^{${a}})^{${b}}\\cdot ${cT}`
      return {
        prompt: `Simplify: $\\frac{${top}}{${mono(1, d, v)}}$`,
        answer: { kind: 'expr', expr: mono(1, e, v, false), form: 'simplified' },
        hints: ['Work one rule at a time: power of a power first.', `$(${v}^{${a}})^{${b}} = ${v}^{${a * b}}$. Then the product rule on top.`, `Top: $${v}^{${a * b + c}}$. Now subtract the bottom exponent ${d}.`],
        steps: [
          { text: 'Power rule:', math: `(${v}^{${a}})^{${b}} = ${v}^{${a * b}}` },
          ...(c !== 0 ? [{ text: 'Product rule on top:', math: `${v}^{${a * b}}\\cdot ${cT} = ${v}^{${a * b + c}}` }] : []),
          { text: 'Quotient rule:', math: `\\frac{${v}^{${a * b + c}}}{${mono(1, d, v)}} = ${mono(1, e, v)}` },
        ],
        mistakes: [
          ...(a + b !== a * b ? [{ when: isExpr(mono(1, a + b + c - d, v, false)), say: `$(${v}^{${a}})^{${b}}$ is ${b} copies of $${v}^{${a}}$: multiply to get exponent ${a * b}.` }] : []),
          { when: isExpr(mono(1, a * b + c + d, v, false)), say: 'Dividing subtracts the bottom exponent.' },
        ],
      }
    }
    if (kind === 'solveN') {
      const B = rng.pick([2, 3, 5, 7, 10])
      const t = rng.int(0, 2)
      if (t === 0) {
        const a = rng.int(2, 6)
        const n = rng.int(2, 9)
        return {
          prompt: `Find $n$: $${B}^{n}\\cdot ${B}^{${a}} = ${B}^{${n + a}}$`,
          answer: { kind: 'num', value: n },
          hints: ['Same base multiplied — what happens to the exponents?', `They add: $n + ${a} = ${n + a}$.`, `Solve for $n$.`],
          steps: [{ text: 'Product rule:', math: `n + ${a} = ${n + a}` }, { text: 'Solve:', math: `n = ${n}` }],
          mistakes: [{ value: n + 2 * a, say: 'The exponents add, so subtract to find $n$.' }, ...((n + a) % a === 0 ? [{ value: (n + a) / a, say: 'Multiplying powers adds the exponents — so $n + ' + a + ' = ' + (n + a) + '$.' }] : [])],
        }
      }
      if (t === 1) {
        const n = rng.int(2, 6)
        const r = rng.int(1, 6)
        return {
          prompt: `Find $n$: $\\frac{${B}^{${n + r}}}{${B}^{n}} = ${B}^{${r}}$`,
          answer: { kind: 'num', value: n },
          hints: ['Same base divided — the exponents subtract.', `$${n + r} - n = ${r}$`, 'Solve for $n$.'],
          steps: [{ text: 'Quotient rule:', math: `${n + r} - n = ${r}` }, { text: 'Solve:', math: `n = ${n}` }],
          mistakes: [{ value: n + 2 * r, say: 'Dividing subtracts exponents: $' + (n + r) + ' - n = ' + r + '$.' }],
        }
      }
      const a = rng.int(2, 4)
      const n = rng.int(2, 5)
      return {
        prompt: `Find $n$: $(${B}^{n})^{${a}} = ${B}^{${n * a}}$`,
        answer: { kind: 'num', value: n },
        hints: ['Power of a power — exponents multiply.', `$${a}n = ${n * a}$`, `Divide by ${a}.`],
        steps: [{ text: 'Power rule:', math: `${a}n = ${n * a}` }, { text: 'Solve:', math: `n = ${n}` }],
        mistakes: [{ value: n * a - a, say: 'Power of a power multiplies the exponents, so solve $' + a + 'n = ' + n * a + '$.' }],
      }
    }
    // negBase0: −b^0 vs (−b)^0
    const b = rng.int(2, 12)
    const withParens = rng.chance(0.5)
    const val = withParens ? 1 : -1
    return {
      prompt: `Evaluate: $${withParens ? `(-${b})^0` : `-${b}^0`}$`,
      answer: { kind: 'num', value: val },
      hints: ['What exactly is the base? The exponent only applies to what it touches.', withParens ? `The parentheses make the base $-${b}$.` : `Without parentheses, the base is just ${b}: this is $-(${b}^0)$.`, `Anything nonzero to the 0 power is 1.`],
      steps: withParens ? [{ text: `The base is $(-${b})$, and any nonzero base to the 0 is 1:`, math: `(-${b})^0 = 1` }] : [{ text: `The exponent touches only the ${b}. The minus sign is applied afterwards:`, math: `-${b}^0 = -(${b}^0) = -(1) = -1` }],
      mistakes: withParens
        ? [{ value: -1, say: `The parentheses put the negative **inside** the base, so it’s a nonzero number to the 0: exactly 1.` }, { value: 0, say: 'A zero exponent gives 1, not 0.' }]
        : [{ value: 1, say: `Without parentheses the exponent only applies to ${b}: $-${b}^0 = -(${b}^0) = -1$.` }, { value: 0, say: 'A zero exponent gives 1 (then the minus makes it −1), not 0.' }],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 9. POLYNOMIALS
// ════════════════════════════════════════════════════════════════════════════

const polynomials: Skill = {
  id: 'polynomials',
  unit: 'alg',
  title: 'Adding & multiplying polynomials',
  blurb: 'Combine like terms; multiply every term by every term.',
  prereqs: ['like-terms', 'exp-rules'],
  why: 'Polynomials model areas, projectile paths and profit curves. Multiplying them out is the step before solving and factoring — it shows up in everything that follows.',
  learn: [
    { kind: 'idea', title: 'Adding: only like terms combine', body: 'Like terms have the **same variable and the same exponent**. $x^2$ terms combine with $x^2$ terms, $x$ terms with $x$ terms. The exponent never changes when you add.', math: '(3x^2 + 2x - 5) + (x^2 - 6x + 1) = 4x^2 - 4x - 4' },
    { kind: 'trap', title: 'Subtracting a whole polynomial', wrong: '$(5x^2 + 3x) - (2x^2 + x) = 3x^2 + 4x$', right: '$(5x^2 + 3x) - (2x^2 + x) = 5x^2 + 3x - 2x^2 - x = 3x^2 + 2x$', why: 'The minus sign applies to **every** term in the second polynomial. Distribute it as $-1$ before combining.' },
    { kind: 'explore', title: 'Multiplying is area', body: '$23\\times14$ splits into four rectangles: $(20 + 3)(10 + 4)$. Replace the 20 and 10 with $x$ and it’s exactly how $(x + 3)(x + 4)$ works — four pieces: $x^2$, $4x$, $3x$, $12$.', widget: { w: 'area' }, task: 'Find the four partial products of 23 × 14. Then predict the four pieces of $(x + 3)(x + 4)$ and add them up.' },
    { kind: 'idea', title: 'Every term times every term', body: 'For two binomials that’s four products — often remembered as **FOIL**: First, Outer, Inner, Last. Then combine like terms.', math: '(x + 3)(x + 4) = x^2 + 4x + 3x + 12 = x^2 + 7x + 12' },
    { kind: 'trap', title: 'Squaring a sum', wrong: '$(x + 3)^2 = x^2 + 9$', right: '$(x + 3)^2 = (x + 3)(x + 3) = x^2 + 6x + 9$', why: 'Draw the square: an $x$-by-$x$ piece, a 3-by-3 piece, **and two $3x$ strips**. Try $x = 1$: $(1 + 3)^2 = 16$, but $1 + 9 = 10$.' },
    { kind: 'check', question: 'How many products do you compute for $(x + 2)(x^2 + 3x - 1)$ before combining?', options: ['6', '4', '2', '5'], correct: 0, explain: 'Each of the 2 terms in the first factor multiplies each of the 3 terms in the second: $2\\times3 = 6$ products.' },
  ],
  generate(rng, level) {
    const kind = level === 1 ? rng.pick(['add', 'sub', 'mono']) : level === 2 ? rng.pick(['binom', 'binom', 'binom2']) : rng.pick(['square', 'conj', 'tri', 'area'])
    if (kind === 'add' || kind === 'sub') {
      const p1 = [rng.nz(-6, 7), rng.nz(-9, 9), rng.nz(-9, 9)]
      const p2 = [pickNot(rng, -6, 7, [0, kind === 'add' ? -p1[0] : p1[0]]), rng.nz(-9, 9), rng.nz(-9, 9)]
      const s = kind === 'add' ? 1 : -1
      const res = p1.map((c, i) => c + s * p2[i])
      const op = kind === 'add' ? '+' : '-'
      return {
        prompt: `Simplify: $(${poly(p1)}) ${op} (${poly(p2)})$`,
        answer: { kind: 'expr', expr: polyS(res), form: 'expanded' },
        hints: [
          kind === 'sub' ? 'First distribute the minus sign: it changes the sign of **every** term in the second polynomial.' : 'Remove the parentheses — adding doesn’t change any signs.',
          'Group like terms: $x^2$ with $x^2$, $x$ with $x$, numbers with numbers.',
          `$x^2$: $${p1[0]} ${sgn(s * p2[0])} = ${res[0]}$. Do the same for the other two.`,
        ],
        steps: [
          ...(kind === 'sub' ? [{ text: 'Distribute the minus sign:', math: `${poly(p1)} ${sgn(-p2[0]).replace(/ \d+$/, '')} ${poly([-p2[0], -p2[1], -p2[2]]).replace(/^-/, '')}` }] : []),
          { text: 'Combine like terms:', math: `(${p1[0]} ${sgn(s * p2[0])})x^2 + (${p1[1]} ${sgn(s * p2[1])})x + (${p1[2]} ${sgn(s * p2[2])})` },
          { text: 'Result:', math: poly(res) },
        ],
        mistakes:
          kind === 'sub'
            ? [
                { when: isExpr(polyS([p1[0] - p2[0], p1[1] + p2[1], p1[2] + p2[2]])), say: 'You only subtracted the first term. The minus sign applies to **every** term of the second polynomial.' },
                { when: isExpr(polyS(p1.map((c, i) => c + p2[i]))), say: 'That’s the sum. Subtracting flips the sign of every term in the second polynomial.' },
              ]
            : [{ when: isExpr(polyS([res[0], 0, res[1], 0, res[2]])), say: 'When you combine like terms the exponent stays the same: $2x^2 + 3x^2 = 5x^2$, not $5x^4$. You’re counting how many $x^2$’s you have.' }],
      }
    }
    if (kind === 'mono') {
      const k = pickNot(rng, -5, 6, [0, 1])
      const e = rng.int(1, 2)
      const a = rng.nz(-4, 5)
      const b = rng.nz(-9, 9)
      const res = e === 1 ? [k * a, k * b, 0] : [k * a, k * b, 0, 0]
      const m = mono(k, e)
      const mP = k < 0 ? `(${m})` : m
      const aT = a < 0 ? `(${coef(a, 'x')})` : coef(a, 'x')
      return {
        prompt: `Expand: $${m}(${lin(a, b)})$`,
        answer: { kind: 'expr', expr: polyS(res), form: 'expanded' },
        hints: [`Multiply $${m}$ by **each** term inside the parentheses.`, `$${mP}\\cdot ${aT} = ${mono(k * a, e + 1)}$ (add the exponents of $x$).`, `$${mP}\\cdot ${paren(b)} = ${mono(k * b, e)}$`],
        steps: [{ text: 'Distribute to both terms:', math: `${mP}\\cdot ${aT} + ${mP}\\cdot ${paren(b)}` }, { text: 'Multiply each:', math: poly(res) }],
        mistakes: [
          { when: isExpr(polyS(e === 1 ? [k * a, b] : [k * a, 0, b])), say: `The $${m}$ multiplies the ${b} too — distribute to **every** term.` },
          { when: isExpr(polyS(e === 1 ? [k * a, k * b] : [k * a, k * b, 0])), say: 'Check the exponents: $x\\cdot x = x^2$ — multiplying powers adds exponents.' },
        ],
      }
    }
    if (kind === 'binom' || kind === 'binom2' || kind === 'area') {
      const a = kind === 'binom2' ? rng.int(1, 4) : 1
      const c = kind === 'binom2' ? (a === 1 ? rng.int(2, 4) : rng.int(1, 3)) : 1
      const pp = kind === 'area' ? rng.int(2, 12) : rng.nz(-9, 9)
      const q = kind === 'area' ? rng.int(1, 12) : rng.nz(-9, 9)
      const res = mulPoly([a, pp], [c, q])
      const F = mono(a * c, 2)
      const O = mono(a * q, 1)
      const I = mono(pp * c, 1)
      const L = pp * q
      const prompt =
        kind === 'area'
          ? `A rectangular hangar floor measures $(x + ${pp})$ m by $(x + ${q})$ m. Write its area as an expanded polynomial.`
          : `Expand and simplify: $${fac(a, pp)}${fac(c, q)}$`
      return {
        prompt,
        answer: { kind: 'expr', expr: polyS(res), form: 'expanded' },
        hints: [
          kind === 'area' ? 'Area = length × width: multiply the two binomials.' : 'Multiply every term in the first by every term in the second (FOIL).',
          `First: $${F}$. Outer: $${O}$. Inner: $${I}$. Last: $${L}$.`,
          `Combine the two middle terms: $${O} ${sterm(pp * c, 'x')} = ${mono(a * q + pp * c, 1)}$.`,
        ],
        steps: [
          { text: 'FOIL — four products:', math: `${F} ${sterm(a * q, 'x')} ${sterm(pp * c, 'x')} ${sgn(L)}` },
          { text: 'Combine like terms (the outer and inner):', math: poly(res) },
        ],
        mistakes: [
          { when: isExpr(polyS([a * c, 0, L])), say: 'You multiplied First and Last but skipped the **Outer** and **Inner** products. There are four products, not two.' },
          ...(L !== 0 ? [{ when: isExpr(polyS([a * c, a * q + pp * c, -L])), say: `Check the sign of the last term: $${paren(pp)}\\cdot${paren(q)} = ${L}$.` }] : []),
          ...(a * q + pp * c !== 0 ? [{ when: isExpr(polyS([a * c, -(a * q + pp * c), L])), say: 'Check the signs of the outer and inner products.' }] : []),
        ],
      }
    }
    if (kind === 'square') {
      const a = rng.int(1, 3)
      const pp = rng.nz(-9, 9)
      const res = [a * a, 2 * a * pp, pp * pp]
      const photo = rng.chance(0.3) && a === 1 && pp > 0
      return {
        prompt: photo ? `A square solar panel has side length $(x + ${pp})$ ft. Write its area as an expanded polynomial.` : `Expand: $${fac(a, pp)}^2$`,
        answer: { kind: 'expr', expr: polyS(res), form: 'expanded' },
        hints: ['Squaring means multiplying by itself: write it as two copies.', `$${fac(a, pp)}${fac(a, pp)}$ — FOIL it.`, `The outer and inner products are both $${mono(a * pp, 1)}$, so the middle term is $${mono(2 * a * pp, 1)}$.`],
        steps: [
          { text: 'Write the square as a product:', math: `${fac(a, pp)}^2 = ${fac(a, pp)}${fac(a, pp)}` },
          { text: 'FOIL:', math: `${mono(a * a, 2)} ${sterm(a * pp, 'x')} ${sterm(a * pp, 'x')} ${sgn(pp * pp)}` },
          { text: 'Combine:', math: poly(res) },
        ],
        mistakes: [
          { when: isExpr(polyS([a * a, 0, pp * pp])), say: `You squared each term separately, but $(a + b)^2 \\ne a^2 + b^2$. Write it as $${fac(a, pp)}${fac(a, pp)}$ and FOIL — you get a middle term $${mono(2 * a * pp, 1)}$.` },
          { when: isExpr(polyS([a * a, a * pp, pp * pp])), say: 'Close — but the outer **and** inner products both give $' + mono(a * pp, 1) + '$, so the middle term is doubled.' },
          { when: isExpr(polyS([a * a, 2 * a * pp, -pp * pp])), say: `The last term is $${paren(pp)}^2 = ${pp * pp}$ — a square is never negative.` },
        ],
      }
    }
    if (kind === 'conj') {
      const a = rng.int(1, 3)
      const pp = rng.int(1, 9)
      return {
        prompt: `Expand: $${fac(a, pp)}${fac(a, -pp)}$`,
        answer: { kind: 'expr', expr: polyS([a * a, 0, -pp * pp]), form: 'expanded' },
        hints: ['FOIL as usual.', `Outer: $${mono(-a * pp, 1)}$. Inner: $${mono(a * pp, 1)}$. What happens when you add them?`, `The middle terms cancel, leaving $${mono(a * a, 2)} - ${pp * pp}$.`],
        steps: [
          { text: 'FOIL:', math: `${mono(a * a, 2)} ${sterm(-a * pp, 'x')} ${sterm(a * pp, 'x')} - ${pp * pp}` },
          { text: 'The middle terms cancel — a **difference of squares**:', math: poly([a * a, 0, -pp * pp]) },
        ],
        mistakes: [
          { when: isExpr(polyS([a * a, 0, pp * pp])), say: `Last × Last is $${pp}\\cdot(-${pp}) = -${pp * pp}$ — positive times negative is negative.` },
          { when: isExpr(polyS([a * a, -2 * a * pp, -pp * pp])), say: 'The outer and inner products are opposites, so they cancel to 0.' },
        ],
      }
    }
    // tri: (x + p)(x^2 + qx + r)
    const pp = rng.nz(-6, 6)
    const q = rng.nz(-5, 5)
    const r = rng.nz(-7, 7)
    const res = mulPoly([1, pp], [1, q, r])
    return {
      prompt: `Expand and simplify: $${fac(1, pp)}(${poly([1, q, r])})$`,
      answer: { kind: 'expr', expr: polyS(res), form: 'expanded' },
      hints: ['Multiply $x$ by each of the three terms, then multiply ' + `$${pp}$` + ' by each of the three terms. That’s 6 products.', `$x(${poly([1, q, r])}) = ${poly([1, q, r, 0])}$`, `$${pp}(${poly([1, q, r])}) = ${poly([pp, pp * q, pp * r])}$. Now combine like terms.`],
      steps: [
        { text: 'Distribute $x$:', math: poly([1, q, r, 0]) },
        { text: `Distribute $${pp}$:`, math: poly([pp, pp * q, pp * r]) },
        { text: 'Add and combine like terms:', math: poly(res) },
      ],
      mistakes: [
        { when: isExpr(polyS([1, q, r, pp])), say: `You multiplied by $x$ but then just tacked on the ${pp}. It multiplies **all three** terms too.` },
        { when: isExpr(polyS([1, q + pp, r, pp * r])), say: 'Some of the six products are missing — each term of the first factor hits each term of the second.' },
      ],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 10. FACTORING
// ════════════════════════════════════════════════════════════════════════════

/** Factor-pair table for x² + bx + c: pairs (u, v) with u·v = c, showing their sums. */
function pairTable(b: number, c: number): string {
  const rows: string[] = []
  for (let u = -Math.abs(c); u <= Math.abs(c); u++) {
    if (u === 0 || c % u !== 0) continue
    const v = c / u
    if (u > v) continue
    if (c > 0 && Math.sign(u) !== Math.sign(b || 1)) continue
    rows.push(`${u}\\cdot ${paren(v)} & ${u + v}${u + v === b ? ' \\;\\checkmark' : ''}`)
  }
  const shown = rows.length > 7 ? rows.filter((r) => r.includes('checkmark')).concat(rows.filter((r) => !r.includes('checkmark')).slice(0, 5)) : rows
  return `\\begin{array}{c|c} \\text{product } ${c} & \\text{sum} \\\\ \\hline ${shown.join(' \\\\ ')} \\end{array}`
}

function signHint(b: number, c: number): string {
  if (c > 0) return `Since $${c}$ is positive, both numbers have the **same sign** — the sign of the middle term (${b > 0 ? 'both positive' : 'both negative'}).`
  return `Since $${c}$ is negative, the numbers have **opposite signs**; the one with the larger size takes the sign of ${b === 0 ? 'the middle term' : b > 0 ? 'the positive middle term' : 'the negative middle term'}.`
}

const factorStr = (k: number, pp: number, q: number) => `${k === 1 ? '' : k === -1 ? '-' : k}${pp === q ? `${fac(1, pp)}^2` : `${fac(1, pp)}${fac(1, q)}`}`

const factoring: Skill = {
  id: 'factoring',
  unit: 'alg',
  title: 'Factoring trinomials',
  blurb: 'Run FOIL backwards: find two numbers that multiply to c and add to b.',
  prereqs: ['polynomials'],
  why: 'Factoring turns a sum into a product — and products are what let you solve quadratic equations, simplify fractions of polynomials and find where a parabola hits zero.',
  learn: [
    { kind: 'idea', title: 'FOIL in reverse', body: 'When you multiply $(x + 2)(x + 5)$, the **last** numbers multiply to 10 and **add** to make the middle 7. So to factor $x^2 + 7x + 10$, hunt for two numbers with **product 10** and **sum 7**.', math: 'x^2 + 7x + 10 = (x + 2)(x + 5)' },
    { kind: 'explore', title: 'Find the rectangle', body: 'Multiplying builds a rectangle from its sides. Factoring is the reverse: given the total area split into pieces, find the side lengths.', widget: { w: 'area' }, task: 'Set 12 × 15 and read its four pieces. In algebra, $x^2 + 7x + 10$ is the area — you’re looking for the two side lengths $(x + ?)(x + ?)$.' },
    { kind: 'idea', title: 'Let the signs guide you', body: '**c positive** → both numbers share a sign, the sign of $b$.\n**c negative** → opposite signs; the bigger one takes the sign of $b$.', math: 'x^2 - 7x + 12 = (x - 3)(x - 4)\\qquad x^2 + x - 12 = (x + 4)(x - 3)' },
    { kind: 'trap', title: 'Swapped signs', wrong: '$x^2 + 5x + 6 = (x - 2)(x - 3)$', right: '$x^2 + 5x + 6 = (x + 2)(x + 3)$', why: '$(x - 2)(x - 3)$ has product $+6$ but sum $-5$. Always FOIL your answer back to check the **middle** term, not just the last one.' },
    { kind: 'idea', title: 'GCF first', body: 'If every term shares a factor, pull it out first — the leftover trinomial is much easier.', math: '3x^2 + 15x + 18 = 3(x^2 + 5x + 6) = 3(x + 2)(x + 3)' },
    { kind: 'check', question: 'To factor $x^2 - 2x - 15$, which pair of numbers do you need?', options: ['$-5$ and $3$', '$5$ and $-3$', '$-5$ and $-3$', '$15$ and $-1$'], correct: 0, explain: 'Product $-15$, sum $-2$: $(-5)(3) = -15$ and $-5 + 3 = -2$. So $x^2 - 2x - 15 = (x - 5)(x + 3)$.' },
  ],
  generate(rng, level) {
    const kind = level === 3 ? rng.pick(['gcf', 'gcf', 'dos', 'lead', 'square']) : 'basic'
    if (kind === 'lead') {
      const a = rng.pick([2, 3])
      let pp = rng.nz(-7, 7)
      if (gcd(a, pp) !== 1) pp += pp > 0 ? 1 : -1
      const q = rng.nz(-6, 6)
      const cs = mulPoly([a, pp], [1, q])
      const ans = `${fac(a, pp)}${fac(1, q)}`
      return {
        prompt: `Factor completely: $${poly(cs)}$`,
        answer: { kind: 'expr', expr: ans, form: 'factored' },
        placeholder: 'e.g. (2x + 1)(x - 3)',
        hints: [`The first terms must multiply to $${a}x^2$, so start with $(${a}x\\;\\;\\;)(x\\;\\;\\;)$.`, `The last numbers must multiply to $${cs[2]}$. Try pairs and check the **middle** term each time.`, `Try $(${a}x ${sgn(pp)})(x ${sgn(q)})$: outer $${mono(a * q, 1)}$ + inner $${mono(pp, 1)}$ = $${mono(cs[1], 1)}$ ✓`],
        steps: [
          { text: `Set up: $(${a}x \\;\\square)(x\\;\\square)$ — the boxes multiply to $${cs[2]}$.` },
          { text: 'Test placements until outer + inner gives the middle term:', math: `${mono(a * q, 1)} ${sterm(pp, 'x')} = ${mono(cs[1], 1)}` },
          { text: 'Factored:', math: `${poly(cs)} = ${ans}` },
        ],
        mistakes: [
          { when: isExpr(`${fac(a, -pp)}${fac(1, -q)}`), say: 'The signs are swapped — FOIL your answer and check the middle term’s sign.' },
          ...(pp !== q ? [{ when: isExpr(`${fac(a, q)}${fac(1, pp)}`), say: 'Right numbers, wrong spots: with a leading coefficient, swapping the numbers changes the outer product. Try the other placement.' }] : []),
          { when: productRightSumWrong(a, cs[1], cs[2]), say: 'Your factors give the right first and last terms, but the middle term is off. Check outer + inner.' },
        ],
      }
    }
    if (kind === 'dos') {
      const a = rng.pick([1, 1, 2, 3])
      let n = rng.int(1, 9)
      // (ax)^2 - n^2 with a common factor in a and n isn't "completely" factored as (ax+n)(ax-n)
      while (gcdN(a, n) > 1) n = rng.int(1, 9)
      const k = a === 1 && rng.chance(0.3) ? rng.int(2, 4) : 1
      const cs = [k * a * a, 0, -k * n * n]
      const ans = `${k === 1 ? '' : k}${fac(a, n)}${fac(a, -n)}`
      return {
        prompt: `Factor completely: $${poly(cs)}$`,
        answer: { kind: 'expr', expr: ans, form: 'factored' },
        placeholder: 'e.g. (x + 3)(x - 3)',
        hints: [
          k > 1 ? `First take out the common factor ${k}.` : 'There’s no middle term. Both terms are perfect squares, and they’re subtracted.',
          `Difference of squares: $A^2 - B^2 = (A + B)(A - B)$.`,
          `$${mono(a * a, 2)} = (${coef(a, 'x')})^2$ and $${n * n} = ${n}^2$.`,
        ],
        steps: [
          ...(k > 1 ? [{ text: `Factor out ${k}:`, math: `${k}(${poly([a * a, 0, -n * n])})` }] : []),
          { text: 'Recognise a difference of squares:', math: `${poly([a * a, 0, -n * n])} = (${coef(a, 'x')})^2 - ${n}^2` },
          { text: 'Factor:', math: ans },
          { text: `Check: the outer and inner terms $${mono(-a * n, 1)}$ and $${mono(a * n, 1)}$ cancel ✓` },
        ],
        mistakes: [
          { when: isExpr(`${k === 1 ? '' : k}${fac(a, -n)}^2`), say: `$${fac(a, -n)}^2$ has a middle term $${mono(-2 * a * n * k, 1)}$. A difference of squares needs one plus and one minus: $(A + B)(A - B)$.` },
          { when: isExpr(`${k === 1 ? '' : k}${fac(a, n)}^2`), say: '$(A + B)^2$ gives a $+$ last term and a middle term. You need one $+$ factor and one $-$ factor.' },
          ...(k > 1 ? [{ when: isExpr(`${fac(a, n)}${fac(a, -n)}`), say: `You dropped the common factor ${k}. Multiply your answer back out — it should match the original.` }] : []),
        ],
      }
    }
    if (kind === 'square') {
      const pp = rng.nz(-9, 9)
      const cs = [1, 2 * pp, pp * pp]
      const ans = `${fac(1, pp)}^2`
      return {
        prompt: `Factor completely: $${poly(cs)}$`,
        answer: { kind: 'expr', expr: ans, form: 'factored' },
        placeholder: 'e.g. (x - 4)^2',
        hints: [`Find two numbers that multiply to $${pp * pp}$ and add to $${2 * pp}$.`, signHint(2 * pp, pp * pp), `Both numbers are $${pp}$ — it’s a perfect square.`],
        steps: [{ text: `Product $${pp * pp}$, sum $${2 * pp}$: the numbers are $${pp}$ and $${pp}$.` }, { text: 'Both factors are the same, so write it as a square:', math: `${poly(cs)} = ${fac(1, pp)}${fac(1, pp)} = ${ans}` }],
        mistakes: [
          { when: isExpr(`${fac(1, -pp)}^2`), say: `Sign check: $${fac(1, -pp)}^2$ has middle term $${mono(-2 * pp, 1)}$, but you need $${mono(2 * pp, 1)}$.` },
          { when: isExpr(`${fac(1, pp)}${fac(1, -pp)}`), say: 'That’s a difference of squares — its middle terms cancel. This trinomial has a middle term, so both signs match.' },
          { when: productRightSumWrong(1, 2 * pp, pp * pp), say: `Your numbers multiply to $${pp * pp}$ but don’t add to $${2 * pp}$.` },
        ],
      }
    }
    // basic or gcf
    let pp: number, q: number
    if (level === 1) {
      pp = rng.int(1, 9)
      q = rng.int(1, 9)
    } else {
      pp = rng.nz(-9, 9)
      q = rng.nz(-9, 9)
      if (level === 3 && pp === -q) q = q > 0 ? q - 10 : q + 10
    }
    const k = kind === 'gcf' ? rng.pick([2, 3, 4, 5, -2]) : 1
    const b = pp + q
    const c = pp * q
    const cs = [k, k * b, k * c]
    const ans = factorStr(k, pp, q)
    const mistakes: Misconception[] = []
    if (b !== 0) mistakes.push({ when: isExpr(factorStr(k, -pp, -q)), say: `Signs swapped: your factors multiply to $${c}$ but add to $${-b}$. You need a sum of $${b}$ — flip both signs.` })
    if (k !== 1) mistakes.push({ when: isExpr(factorStr(1, pp, q)), say: `You factored the trinomial but dropped the GCF ${k}. FOIL your answer — it must equal the original, including the ${k}.` })
    mistakes.push({ when: productRightSumWrong(k, k * b, k * c), say: `Your two numbers multiply to $${c}$ correctly, but they don’t add to $${b}$. List the factor pairs of $${c}$ and pick the one that sums to $${b}$.` })
    return {
      prompt: `Factor completely: $${poly(cs)}$`,
      answer: { kind: 'expr', expr: ans, form: 'factored' },
      placeholder: 'e.g. (x + 2)(x - 5)',
      hints: [
        k !== 1 ? `Every term is divisible by $${k}$. Factor that out first: $${k}(${poly([1, b, c])})$.` : `Find two numbers that multiply to $${c}$ and add to $${b}$.`,
        k !== 1 ? `Now factor $${poly([1, b, c])}$: two numbers with product $${c}$ and sum $${b}$.` : signHint(b, c),
        `The numbers are $${pp}$ and $${q}$: $${pp}\\cdot ${paren(q)} = ${c}$ and $${pp} + ${paren(q)} = ${b}$.`,
      ],
      steps: [
        ...(k !== 1 ? [{ text: `Take out the GCF $${k}$:`, math: `${poly(cs)} = ${k}(${poly([1, b, c])})` }] : []),
        { text: `List factor pairs of $${c}$ and their sums — we need a sum of $${b}$:`, math: pairTable(b, c) },
        { text: 'Write the factors:', math: `${poly(cs)} = ${ans}` },
        { text: 'Check by FOIL:', math: `${k !== 1 ? `${k}(` : ''}x^2 ${sterm(q, 'x')} ${sterm(pp, 'x')} ${sgn(c)}${k !== 1 ? ')' : ''} = ${poly(cs)}\\ \\checkmark` },
      ],
      mistakes,
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 11. QUADRATIC EQUATIONS
// ════════════════════════════════════════════════════════════════════════════

const rootsText = (rs: number[]) => uniq(rs).map((r) => `x = ${fracTexOf(r)}`).join(' \\text{ or } ')
function fracTexOf(r: number): string {
  if (Number.isInteger(r)) return `${r}`
  for (const d of [2, 3, 4, 5, 6]) if (Number.isInteger(+(r * d).toFixed(9))) return fracTex(Math.round(r * d), d)
  return `${r}`
}

const quadratics: Skill = {
  id: 'quadratics',
  unit: 'alg',
  title: 'Solving quadratic equations',
  blurb: 'Set it equal to zero, factor, and use the zero-product property — or the quadratic formula.',
  prereqs: ['factoring', 'roots'],
  why: 'When will a launched rocket land? What width gives a hangar door the area you need? Anything with a square in it — areas, falling objects, profit curves — leads to a quadratic.',
  learn: [
    { kind: 'idea', title: 'The zero-product property', body: 'If two numbers multiply to **zero**, at least one of them **is** zero. So if $(x - 3)(x + 2) = 0$, either $x - 3 = 0$ or $x + 2 = 0$.', math: '(x - 3)(x + 2) = 0 \\Rightarrow x = 3 \\text{ or } x = -2' },
    { kind: 'explore', title: 'Roots are x-intercepts', body: 'The red dots are where the parabola crosses the $x$-axis — where $y = 0$. Watch the factored form as you move them.', widget: { w: 'parabola' }, task: 'Put the roots at 2 and −5. What are the factors? Why does a root of −5 give a factor of $(x + 5)$?' },
    { kind: 'trap', title: 'Root signs are opposite the factor signs', wrong: '$(x - 3)(x + 2) = 0 \\Rightarrow x = -3,\\ 2$', right: '$x - 3 = 0 \\Rightarrow x = 3$ and $x + 2 = 0 \\Rightarrow x = -2$', why: 'Solve each factor = 0. The number in the factor is what gets **undone**, so the root has the opposite sign. Check: plug $x = 3$ in and the first factor is $0$ ✓.' },
    { kind: 'trap', title: 'It only works with zero', wrong: '$(x - 1)(x - 2) = 6 \\Rightarrow x - 1 = 6$ or $x - 2 = 6$', right: 'Expand and move the 6: $x^2 - 3x - 4 = 0 \\Rightarrow (x - 4)(x + 1) = 0$', why: 'Lots of pairs multiply to 6 ($2\\cdot3$, $1\\cdot6$, …), so you learn nothing. Only zero forces one factor to be zero. Always get **= 0** first.' },
    { kind: 'idea', title: 'The quadratic formula', body: 'For any $ax^2 + bx + c = 0$ — even ones that won’t factor nicely:', math: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { kind: 'check', question: 'How many solutions does $x^2 = 25$ have?', options: ['Two: $5$ and $-5$', 'One: $5$', 'One: $12.5$', 'None'], correct: 0, explain: 'Both $5^2$ and $(-5)^2$ equal 25. Factoring shows it: $x^2 - 25 = (x - 5)(x + 5) = 0$.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const r1 = rng.nz(-9, 9)
      let r2 = pickNot(rng, -9, 9, [r1])
      const xForm = rng.chance(0.2)
      if (xForm) r2 = 0
      const eq = r2 === 0 ? `x${fac(1, -r1)} = 0` : `${fac(1, -r1)}${fac(1, -r2)} = 0`
      const inRange = Math.abs(r1) <= 6 && Math.abs(r2) <= 6
      return {
        prompt: `Solve: $${eq}$. Give all solutions, separated by a comma.`,
        answer: { kind: 'set', values: [r1, r2] },
        placeholder: 'e.g. 3, -2',
        visual: inRange ? { type: 'plane', range: 7, parabola: { a: 1, b: -(r1 + r2), c: r1 * r2 } } : undefined,
        hints: ['A product is zero only if one of its factors is zero.', 'Set each factor equal to zero separately.', `$${r2 === 0 ? 'x' : `x ${sgn(-r2)}`} = 0$ and $x ${sgn(-r1)} = 0$. Solve each one.`],
        steps: [
          { text: 'Zero-product property: one factor must be 0.', math: `${r2 === 0 ? 'x' : `x ${sgn(-r2)}`} = 0 \\quad\\text{or}\\quad x ${sgn(-r1)} = 0` },
          { text: 'Solve each:', math: rootsText([r2, r1]) },
          { text: 'These are where the parabola crosses the $x$-axis.' },
        ],
        mistakes: [{ when: setIs([-r1, -r2]), say: `Opposite signs! Solve each factor: $x ${sgn(-r1)} = 0$ gives $x = ${r1}$. The root is the number that makes the factor **zero**.` }],
      }
    }
    if (level === 2) {
      const kind = rng.pick(['fac', 'fac', 'rearr', 'sq', 'gcf0'])
      if (kind === 'sq') {
        const n = rng.int(2, 12)
        const form = rng.chance(0.5) ? `x^2 = ${n * n}` : `x^2 - ${n * n} = 0`
        return {
          prompt: `Solve: $${form}$`,
          answer: { kind: 'set', values: [n, -n] },
          placeholder: 'e.g. 4, -4',
          hints: ['What number squared gives ' + n * n + '? There are two.', 'A negative number squared is positive too.', `$x^2 - ${n * n} = (x - ${n})(x + ${n})$`],
          steps: [{ text: 'Write it as a difference of squares and factor:', math: `x^2 - ${n * n} = (x - ${n})(x + ${n}) = 0` }, { text: 'Both factors give a solution:', math: `x = ${n} \\text{ or } x = -${n}` }],
          mistakes: [{ when: setIs([(n * n) / 2]), say: 'Squaring isn’t doubling. Which number times **itself** gives ' + n * n + '?' }, { when: setIs([n * n]), say: `You need the number whose square is ${n * n} — take the square root.` }],
        }
      }
      if (kind === 'gcf0') {
        const r = rng.nz(-9, 9)
        return {
          prompt: `Solve: $${poly([1, -r, 0])} = 0$`,
          answer: { kind: 'set', values: [0, r] },
          placeholder: 'e.g. 0, 5',
          hints: ['Both terms share a factor of $x$. Pull it out.', `$x(${lin(1, -r)}) = 0$`, 'Each factor can be zero — including the lone $x$.'],
          steps: [{ text: 'Factor out $x$:', math: `x(${lin(1, -r)}) = 0` }, { text: 'Zero-product property:', math: `x = 0 \\text{ or } x = ${r}` }, { text: 'Don’t divide both sides by $x$ — that would throw away the solution $x = 0$.' }],
          mistakes: [{ when: setIs([0, -r]), say: `Sign check: $${lin(1, -r)} = 0$ gives $x = ${r}$.` }, { when: setIs([-r]), say: `Sign check: $${lin(1, -r)} = 0$ gives $x = ${r}$. And don’t forget $x = 0$.` }],
        }
      }
      const r1 = rng.nz(-9, 9)
      const r2 = pickNot(rng, -9, 9, [r1, 0, -r1])
      const b = -(r1 + r2)
      const c = r1 * r2
      if (kind === 'rearr') {
        return {
          prompt: `Solve: $${poly([1, b, 0])} = ${-c}$`,
          answer: { kind: 'set', values: [r1, r2] },
          placeholder: 'e.g. 3, -2',
          hints: [`Get zero on one side first: ${-c > 0 ? 'subtract' : 'add'} $${Math.abs(c)}$ on both sides.`, `$${poly([1, b, c])} = 0$. Now factor: product $${c}$, sum $${b}$.`, `$${fac(1, -r1)}${fac(1, -r2)} = 0$`],
          steps: [
            { text: 'Move everything to one side:', math: `${poly([1, b, c])} = 0` },
            { text: 'Factor:', math: `${fac(1, -r1)}${fac(1, -r2)} = 0` },
            { text: 'Set each factor to zero:', math: rootsText([r1, r2]) },
          ],
          mistakes: [
            { when: setIs([-c, -c - b]), say: `The zero-product property only works when one side is **0**. Move the ${-c} over first, then factor.` },
            { when: setIs([-r1, -r2]), say: 'Opposite signs! Each factor $(x - r)$ gives the root $x = r$.' },
          ],
        }
      }
      return {
        prompt: `Solve: $${poly([1, b, c])} = 0$`,
        answer: { kind: 'set', values: [r1, r2] },
        placeholder: 'e.g. 3, -2',
        hints: [`Factor the left side: two numbers with product $${c}$ and sum $${b}$.`, `$${fac(1, -r1)}${fac(1, -r2)} = 0$`, 'Set each factor equal to zero.'],
        steps: [{ text: 'Factor:', math: `${fac(1, -r1)}${fac(1, -r2)} = 0` }, { text: 'Zero-product property:', math: rootsText([r1, r2]) }, { text: 'Check one:', math: `(${r1})^2 ${sgn(b)}(${r1}) ${sgn(c)} = 0\\ \\checkmark` }],
        mistakes: [
          { when: setIs([-r1, -r2]), say: `Those are the numbers **in** the factors. The roots have opposite signs: $${fac(1, -r1)} = 0 \\Rightarrow x = ${r1}$.` },
          { when: setIs([c]), say: 'Factor first, then set each factor to zero.' },
        ],
      }
    }
    const kind = rng.pick(['formula', 'formula', 'area', 'rocket', 'dbl'])
    if (kind === 'formula') {
      let p1: number, p2: number, q1: number, q2: number
      do {
        p1 = rng.pick([1, 2])
        p2 = rng.pick([1, 2])
        if (p1 === 1 && p2 === 1) p1 = 2
        q1 = rng.nz(-7, 7)
        q2 = rng.nz(-7, 7)
        if (p1 === 2 && q1 % 2 === 0) q1 += q1 > 0 ? -1 : 1
        if (p2 === 2 && q2 % 2 === 0) q2 += q2 > 0 ? -1 : 1
      } while (q1 === 0 || q2 === 0 || q1 * p2 === q2 * p1)
      let cs = mulPoly([p1, -q1], [p2, -q2])
      const g = gcd(gcd(cs[0], cs[1]), cs[2])
      cs = cs.map((x) => x / g)
      const [a, b, c] = cs
      const D = b * b - 4 * a * c
      const s = Math.round(Math.sqrt(D))
      const x1 = (-b + s) / (2 * a)
      const x2 = (-b - s) / (2 * a)
      return {
        prompt: `Use the quadratic formula to solve $${poly(cs)} = 0$.`,
        answer: { kind: 'set', values: [x1, x2] },
        placeholder: 'e.g. 3/2, -4',
        hints: [`Identify $a = ${a}$, $b = ${b}$, $c = ${c}$.`, `Discriminant: $b^2 - 4ac = ${paren(b)}^2 - 4(${a})(${c}) = ${D}$, and $\\sqrt{${D}} = ${s}$.`, `$x = \\frac{${-b} \\pm ${s}}{${2 * a}}$ — work out the $+$ and $-$ versions separately.`],
        steps: [
          { text: `Here $a = ${a}$, $b = ${b}$, $c = ${c}$.` },
          { text: 'Discriminant:', math: `b^2 - 4ac = ${b * b} ${sgn(-4 * a * c)} = ${D},\\quad \\sqrt{${D}} = ${s}` },
          { text: 'Formula:', math: `x = \\frac{-${paren(b)} \\pm ${s}}{2(${a})} = \\frac{${-b} \\pm ${s}}{${2 * a}}` },
          { text: 'The two solutions:', math: `x = \\frac{${-b + s}}{${2 * a}} = ${fracTex(-b + s, 2 * a)} \\quad\\text{or}\\quad x = \\frac{${-b - s}}{${2 * a}} = ${fracTex(-b - s, 2 * a)}` },
        ],
        mistakes: [
          { when: setIs([-x1, -x2]), say: 'Both signs are flipped — the formula starts with $-b$. Since $b = ' + b + '$, $-b = ' + -b + '$.' },
          { when: setIs([-b + s, -b - s]), say: `You forgot to divide by $2a = ${2 * a}$. The whole numerator $-b \\pm \\sqrt{D}$ goes over $2a$.` },
          { when: setIs([(-b + s) / a, (-b - s) / a]), say: `The denominator is $2a = ${2 * a}$, not $a$.` },
        ],
      }
    }
    if (kind === 'dbl') {
      const r = rng.nz(-8, 8)
      return {
        prompt: `Solve: $${poly([1, -2 * r, r * r])} = 0$`,
        answer: { kind: 'set', values: [r] },
        placeholder: 'e.g. 4',
        hints: [`Factor: product $${r * r}$, sum $${-2 * r}$.`, `Both numbers are $${-r}$ — it’s a perfect square: $${fac(1, -r)}^2 = 0$.`, 'Both factors give the same solution.'],
        steps: [{ text: 'Factor as a perfect square:', math: `${fac(1, -r)}^2 = 0` }, { text: 'One repeated solution:', math: `x = ${r}` }, { text: 'The parabola just touches the $x$-axis at one point.' }],
        mistakes: [{ when: setIs([-r]), say: `Sign check: $${lin(1, -r)} = 0$ means $x = ${r}$.` }, { when: setIs([r, -r]), say: `Both factors are $${fac(1, -r)}$, so both give $x = ${r}$. There’s only one solution.` }],
      }
    }
    if (kind === 'area') {
      const w = rng.int(3, 12)
      const d = rng.int(1, 8)
      const A = w * (w + d)
      return {
        prompt: `A rectangular hangar door is ${d} m longer than it is wide, and its area is ${A} m². What is its width?`,
        answer: { kind: 'num', value: w, unit: 'm' },
        hints: [`Let $w$ = width. Then length = $w + ${d}$ and area = $w(w + ${d})$.`, `$w^2 + ${d}w = ${A}$ → $w^2 + ${d}w - ${A} = 0$.`, `Factor: $(w - ${w})(w + ${w + d}) = 0$. Which answer makes sense for a width?`],
        steps: [
          { text: 'Set up:', math: `w(w + ${d}) = ${A} \\Rightarrow w^2 + ${d}w - ${A} = 0` },
          { text: 'Factor:', math: `(w - ${w})(w + ${w + d}) = 0` },
          { text: `Solutions: $w = ${w}$ or $w = -${w + d}$. A width can’t be negative, so **${w} m**.` },
        ],
        mistakes: [{ value: -(w + d), say: 'That’s a solution of the equation, but a width can’t be negative. Use the other root.' }, { value: w + d, say: `That’s the **length**. The width is ${d} m less.` }],
      }
    }
    // rocket
    const T = rng.int(2, 8)
    const v0 = 16 * T
    return {
      prompt: `A model rocket is launched from the ground. Its height is $h = -16t^2 + ${v0}t$ feet after $t$ seconds. After how many seconds does it land?`,
      answer: { kind: 'num', value: T, unit: 's' },
      hints: ['Landing means height $h = 0$.', `$-16t^2 + ${v0}t = 0$. Factor out $-16t$.`, `$-16t(t - ${T}) = 0$. One root is the launch.`],
      steps: [
        { text: 'Set $h = 0$:', math: `-16t^2 + ${v0}t = 0` },
        { text: 'Factor:', math: `-16t(t - ${T}) = 0` },
        { text: `$t = 0$ (launch) or $t = ${T}$. It lands after **${T} seconds**.` },
      ],
      mistakes: [{ value: 0, say: '$t = 0$ is the moment of launch — the rocket is on the ground then too. Use the other root.' }, { value: -T, say: 'Time after launch is positive: $t - ' + T + ' = 0$ gives $t = ' + T + '$.' }, { value: T / 2, say: 'That’s when it reaches its highest point (halfway). It lands when $h$ returns to 0.' }],
    }
  },
}

export const ALG: Skill[] = [twoStep, multiStep, inequalities, slope, slopeInt, functions, systems, expRules, polynomials, factoring, quadratics]

function gcdN(a: number, b: number): number {
  return b ? gcdN(b, a % b) : Math.abs(a)
}
