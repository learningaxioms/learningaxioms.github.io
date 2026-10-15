import type { Answer, Problem } from './types'
import { normalize, parseExpr, parseNum, termCount, isFactored, hasParens, incompleteFactor } from './parse'
import { gcd } from './rng'

export type Verdict =
  /** right */
  | { status: 'correct' }
  /** wrong; `mistake` is a targeted diagnosis when we recognise the error */
  | { status: 'wrong'; mistake?: string }
  /** right value, wrong form (e.g. not simplified) — doesn't count against you */
  | { status: 'form'; message: string }
  /** couldn't read the input */
  | { status: 'invalid'; message: string }

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

function numbersIn(raw: string): number[] | null {
  const s = normalize(raw)
    .toLowerCase()
    .replace(/[a-z]\s*=\s*/g, '')
    .replace(/\b(and|or)\b/g, ',')
    .replace(/[{}]/g, '')
  const parts = s.split(/[,;]+/).map((p) => p.trim()).filter(Boolean)
  const out: number[] = []
  for (const p of parts) {
    const n = parseNum(p)
    if (!n) return null
    out.push(n.value)
  }
  return out
}

export function check(problem: Problem, raw: string): Verdict {
  const a = problem.answer
  const input = raw.trim()
  if (a.kind === 'choice') {
    const idx = Number(input)
    if (idx === a.correct) return { status: 'correct' }
    return { status: 'wrong', mistake: findMistake(problem, input, null) }
  }
  if (input === '') return { status: 'invalid', message: 'Type an answer first.' }
  switch (a.kind) {
    case 'num':
      return checkNum(problem, a, input)
    case 'expr':
      return checkExpr(problem, a, input)
    case 'pair': {
      const nums = numbersIn(input.replace(/[()]/g, ''))
      if (!nums || nums.length !== 2) return { status: 'invalid', message: 'Write it as an ordered pair, like (3, -2).' }
      if (close(nums[0], a.x) && close(nums[1], a.y)) return { status: 'correct' }
      // content-specific diagnoses win over the generic swap message
      const specific = findMistake(problem, input, null)
      if (specific) return { status: 'wrong', mistake: specific }
      if (close(nums[0], a.y) && close(nums[1], a.x) && a.x !== a.y)
        return { status: 'wrong', mistake: 'You have the right numbers but swapped. An ordered pair is always (x, y) — x first.' }
      return { status: 'wrong' }
    }
    case 'set': {
      const nums = numbersIn(input)
      if (!nums || nums.length === 0) return { status: 'invalid', message: 'List the values separated by commas, like 2, -3.' }
      const want = [...new Set(a.values.map((v) => +v.toFixed(9)))]
      const got = [...new Set(nums.map((v) => +v.toFixed(9)))]
      const allIn = got.every((g) => want.some((w) => close(g, w)))
      if (allIn && got.length === want.length) return { status: 'correct' }
      if (allIn && got.length < want.length)
        return { status: 'form', message: `That's ${got.length === 1 ? 'one' : 'some'} of them — there ${want.length - got.length === 1 ? 'is' : 'are'} ${want.length - got.length} more. Find every value.` }
      return { status: 'wrong', mistake: findMistake(problem, input, null) }
    }
    case 'ineq': {
      const s = normalize(input).replace(/\s+/g, '').toLowerCase()
      let m = s.match(/^([a-z])(<=|>=|<|>|=<|=>)(.+)$/)
      let op: string
      let rhs: string
      if (m) {
        op = m[2]
        rhs = m[3]
      } else {
        m = s.match(/^(.+?)(<=|>=|<|>|=<|=>)([a-z])$/)
        if (!m) return { status: 'invalid', message: 'Write it like x > 3 or x <= -2.' }
        const flip: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=<': '>=', '=>': '<=' }
        op = flip[m[2]]
        rhs = m[1]
      }
      op = op === '=<' ? '<=' : op === '=>' ? '>=' : op
      const n = parseNum(rhs)
      if (!n) return { status: 'invalid', message: 'Write it like x > 3 or x <= -2.' }
      const valueOk = close(n.value, a.value)
      if (valueOk && op === a.op) return { status: 'correct' }
      if (valueOk) {
        const flipped: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }
        if (flipped[op] === a.op)
          return { status: 'wrong', mistake: 'Right boundary, but the sign points the wrong way. Did you multiply or divide by a negative? That flips the inequality.' }
        return { status: 'wrong', mistake: 'Right boundary number — check whether the boundary itself is included (< vs ≤).' }
      }
      return { status: 'wrong', mistake: findMistake(problem, input, n.value) }
    }
  }
}

function checkNum(problem: Problem, a: Extract<Answer, { kind: 'num' }>, input: string): Verdict {
  const n = parseNum(input)
  if (!n) return { status: 'invalid', message: 'I couldn’t read that as a number. Try something like 12, -3.5 or 3/4.' }
  const tol = a.tol ?? 1e-6
  const ok = a.tol ? Math.abs(n.value - a.value) <= tol : close(n.value, a.value)
  if (ok) {
    if (a.simplest && n.fraction && gcd(n.fraction.n, n.fraction.d) !== 1)
      return { status: 'form', message: `Correct value! Now simplify ${n.fraction.n}/${n.fraction.d} — divide top and bottom by ${gcd(n.fraction.n, n.fraction.d)}.` }
    return { status: 'correct' }
  }
  return { status: 'wrong', mistake: findMistake(problem, input, n.value) }
}

function checkExpr(problem: Problem, a: Extract<Answer, { kind: 'expr' }>, input: string): Verdict {
  let s = normalize(input)
  if (a.prefix) s = s.replace(new RegExp('^\\s*' + a.prefix.replace(/[()]/g, '\\$&') + '\\s*=\\s*', 'i'), '')
  s = s.replace(/^\s*[a-z](\([a-z]\))?\s*=\s*/i, '')
  const user = parseExpr(s)
  const ref = parseExpr(a.expr)
  if (!ref) throw new Error('bad reference expression: ' + a.expr)
  if (!user) return { status: 'invalid', message: 'I couldn’t read that expression. Use ^ for powers, e.g. x^2 + 3x - 4.' }
  const vars = [...new Set([...ref.vars, ...user.vars])]
  const extra = [...user.vars].filter((v) => !ref.vars.has(v))
  if (extra.length) return { status: 'wrong', mistake: `Your answer uses ${extra.join(', ')}, which isn't in the problem.` }
  const pts = [-2.37, -0.61, 0.83, 1.71, 3.29, 4.13]
  let equal = true
  for (let k = 0; k < pts.length; k++) {
    const env: Record<string, number> = {}
    vars.forEach((v, j) => (env[v] = pts[(k + j * 2) % pts.length] + j * 0.37))
    const u = user.eval(env)
    const r = ref.eval(env)
    if (!isFinite(r)) continue
    if (!close(u, r, 1e-7)) {
      equal = false
      break
    }
  }
  if (!equal) return { status: 'wrong', mistake: findMistake(problem, s, null) }
  if (a.form === 'factored' && !isFactored(user))
    return { status: 'form', message: 'That’s equal, but it isn’t factored. Write it as a product, like (x + 2)(x - 5).' }
  if (a.form === 'factored') {
    const why = incompleteFactor(user)
    if (why) return { status: 'form', message: why }
  }
  if (a.form === 'expanded' && hasParens(s)) return { status: 'form', message: 'Equal, but not expanded yet — multiply out the parentheses.' }
  if (a.form === 'simplified' && hasParens(s)) return { status: 'form', message: 'That’s equal, but multiply out the parentheses first, then combine like terms.' }
  if (a.form === 'simplified' && termCount(user) > termCount(ref))
    return { status: 'form', message: 'That’s equal, but you can simplify further — combine like terms.' }
  return { status: 'correct' }
}

function findMistake(problem: Problem, raw: string, n: number | null): string | undefined {
  for (const m of problem.mistakes ?? []) {
    if (m.value !== undefined && n !== null && close(n, m.value)) return m.say
    if (m.when && m.when(raw, n)) return m.say
  }
  return undefined
}

/** Plain-text rendering of the correct answer for "the answer was …" messages. */
/** 0.333… → "1/3", 3.5 → "7/2" when a small denominator fits; otherwise a tidy decimal. */
export function niceNum(v: number): string {
  if (Number.isInteger(v)) return String(v)
  for (let d = 2; d <= 12; d++) {
    const n = v * d
    if (Math.abs(n - Math.round(n)) < 1e-9 && Math.abs(v) < 100 && String(+v.toFixed(6)).length > 4) return `${Math.round(n)}/${d}`
  }
  return String(+v.toFixed(6))
}

export function answerText(a: Answer): string {
  switch (a.kind) {
    case 'num':
      return `${niceNum(a.value)}${a.unit ? ' ' + a.unit : ''}`
    case 'choice':
      return a.options[a.correct]
    case 'expr':
      return (a.prefix ? a.prefix + ' = ' : '') + a.expr
    case 'pair':
      return `(${niceNum(a.x)}, ${niceNum(a.y)})`
    case 'set':
      return a.values.map(niceNum).join(', ')
    case 'ineq':
      return `x ${a.op.replace('<=', '≤').replace('>=', '≥')} ${a.value}`
  }
}
