// Forgiving input parsing: students type math many ways; we accept them all.

/** Normalise unicode math symbols and whitespace. */
export function normalize(raw: string): string {
  return raw
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/π/g, 'pi')
    .replace(/(\d)\s*[xX]\s*10\s*\^/g, '$1*10^') // 3.4 x 10^5
    .replace(/,(?=\d{3}(\D|$))/g, '') // thousands separators: 1,250 → 1250
    .trim()
}

export interface ParsedNum {
  value: number
  /** the input was written as a fraction a/b */
  fraction?: { n: number; d: number }
}

/** Parse a single number: -3, 2.5, .5, 3/4, -3/4, 1 1/2, 50%, $12, 12 cm. */
export function parseNum(raw: string): ParsedNum | null {
  let s = normalize(raw).toLowerCase()
  s = s.replace(/^[a-z]\s*=\s*/, '') // x = 5
  s = s.replace(/^\$|\$$/g, '').replace(/^\\\$/, '')
  s = s.replace(/\s*(%|degrees?|deg|°|units?|sq\.?\s*\w+|cm|m|km|in|ft|mi|mph|cubic \w+|square \w+|[a-z]+\^[23]|[a-z]+\/[a-z]+)$/i, (m) => (m.trim() === '%' ? '%' : ''))
  s = s.trim()
  let pct = false
  if (s.endsWith('%')) {
    pct = true
    s = s.slice(0, -1).trim()
  }
  if (s === '') return null
  // mixed number: 1 1/2 or -2 3/4
  let m = s.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/)
  if (m) {
    const sign = m[1] ? -1 : 1
    const whole = +m[2]
    const n = +m[3]
    const d = +m[4]
    if (d === 0) return null
    return { value: sign * (whole + n / d), fraction: { n: sign * (whole * d + n), d } }
  }
  m = s.match(/^(-?\d*\.?\d+)\s*\/\s*(-?\d*\.?\d+)$/)
  if (m) {
    const n = +m[1]
    const d = +m[2]
    if (d === 0 || !isFinite(n) || !isFinite(d)) return null
    return { value: n / d, fraction: Number.isInteger(n) && Number.isInteger(d) ? { n, d } : undefined }
  }
  if (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(s)) {
    const v = +s
    return { value: pct ? v : v }
  }
  // allow a tiny expression like 2^3 or 3*4 or 2pi
  const e = parseExpr(s)
  if (e && e.vars.size === 0) {
    const v = e.eval({})
    if (isFinite(v)) return { value: v }
  }
  return null
}

// ── Expression parser (recursive descent, implicit multiplication) ──────────
type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'fn'; name: string; a: Node }

export interface Expr {
  node: Node
  vars: Set<string>
  eval(env: Record<string, number>): number
}

const FNS = new Set(['sqrt', 'abs'])

function tokenize(s: string): string[] | null {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      out.push(s.slice(i, j))
      i = j
      continue
    }
    if (/[a-z]/i.test(c)) {
      const fn = [...FNS, 'pi'].find((f) => s.slice(i, i + f.length).toLowerCase() === f)
      if (fn) {
        out.push(fn)
        i += fn.length
        continue
      }
      out.push(c.toLowerCase())
      i++
      continue
    }
    if ('+-*/^()'.includes(c)) {
      out.push(c)
      i++
      continue
    }
    return null
  }
  return out
}

export function parseExpr(raw: string): Expr | null {
  const maybe = tokenize(normalize(raw))
  if (!maybe || maybe.length === 0) return null
  const toks: string[] = maybe
  let i = 0
  const peek = () => toks[i]
  const isAtomStart = (t: string | undefined) => t !== undefined && (t === '(' || /^[0-9.]/.test(t) || /^[a-z]+$/.test(t))

  function expr(): Node | null {
    let a = term()
    while (a && (peek() === '+' || peek() === '-')) {
      const op = toks[i++] as '+' | '-'
      const b = term()
      if (!b) return null
      a = { t: 'bin', op, a, b }
    }
    return a
  }
  function term(): Node | null {
    let a = unary()
    for (;;) {
      if (!a) return null
      if (peek() === '*' || peek() === '/') {
        const op = toks[i++] as '*' | '/'
        const b = unary()
        if (!b) return null
        a = { t: 'bin', op, a, b }
      } else if (isAtomStart(peek())) {
        // implicit multiplication: 2x, x(x+1), (x+1)(x-2)
        const b = power()
        if (!b) return null
        a = { t: 'bin', op: '*', a, b }
      } else return a
    }
  }
  function unary(): Node | null {
    if (peek() === '-') {
      i++
      const a = unary()
      return a ? { t: 'neg', a } : null
    }
    if (peek() === '+') {
      i++
      return unary()
    }
    return power()
  }
  function power(): Node | null {
    const a = atom()
    if (!a) return null
    if (peek() === '^') {
      i++
      const b = unary() // right-assoc, allows x^-1
      return b ? { t: 'bin', op: '^', a, b } : null
    }
    return a
  }
  function atom(): Node | null {
    const t = toks[i++]
    if (t === undefined) return null
    if (t === '(') {
      const e = expr()
      if (toks[i++] !== ')') return null
      return e
    }
    if (/^[0-9.]/.test(t)) {
      const v = Number(t)
      return isNaN(v) ? null : { t: 'num', v }
    }
    if (t === 'pi') return { t: 'num', v: Math.PI }
    if (FNS.has(t)) {
      const a = atom()
      return a ? { t: 'fn', name: t, a } : null
    }
    if (/^[a-z]$/.test(t)) return { t: 'var', name: t }
    return null
  }

  const node = expr()
  if (!node || i !== toks.length) return null
  const vars = new Set<string>()
  const walk = (n: Node) => {
    if (n.t === 'var') vars.add(n.name)
    else if (n.t === 'neg' || n.t === 'fn') walk(n.a)
    else if (n.t === 'bin') {
      walk(n.a)
      walk(n.b)
    }
  }
  walk(node)
  const ev = (n: Node, env: Record<string, number>): number => {
    switch (n.t) {
      case 'num':
        return n.v
      case 'var':
        return env[n.name] ?? NaN
      case 'neg':
        return -ev(n.a, env)
      case 'fn':
        return n.name === 'sqrt' ? Math.sqrt(ev(n.a, env)) : Math.abs(ev(n.a, env))
      case 'bin': {
        const a = ev(n.a, env)
        const b = ev(n.b, env)
        return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b)
      }
    }
  }
  return { node, vars, eval: (env) => ev(node, env) }
}

/** Number of top-level additive terms, e.g. 3x + 2 - x → 3. */
export function termCount(e: Expr): number {
  const count = (n: Node): number => (n.t === 'bin' && (n.op === '+' || n.op === '-') ? count(n.a) + count(n.b) : 1)
  return count(e.node)
}

/** True if the expression is a product of factors at the top level (e.g. (x+2)(x-3), 2(x+1)). */
export function isFactored(e: Expr): boolean {
  let n = e.node
  if (n.t === 'neg') n = n.a
  return n.t === 'bin' && (n.op === '*' || n.op === '^')
}

/** True if no parenthesised sum is multiplied out (i.e. it is expanded). */
export function hasParens(raw: string) {
  return /\(/.test(raw)
}

/**
 * For "factor completely": returns a reason if any factor can still be factored —
 * a quadratic factor with rational roots, or a linear factor with a common integer factor.
 */
export function incompleteFactor(e: Expr): string | null {
  const factors: Node[] = []
  const walk = (n: Node) => {
    if (n.t === 'neg') walk(n.a)
    else if (n.t === 'bin' && n.op === '*') {
      walk(n.a)
      walk(n.b)
    } else if (n.t === 'bin' && n.op === '^') walk(n.a)
    else factors.push(n)
  }
  walk(e.node)
  for (const f of factors) {
    const vars = new Set<string>()
    const vw = (n: Node) => {
      if (n.t === 'var') vars.add(n.name)
      else if (n.t === 'neg' || n.t === 'fn') vw(n.a)
      else if (n.t === 'bin') {
        vw(n.a)
        vw(n.b)
      }
    }
    vw(f)
    if (vars.size !== 1) continue
    const v = [...vars][0]
    const ev = (x: number) => evalNode(f, { [v]: x })
    // fit a quadratic through 3 points and confirm with a 4th
    const c = ev(0)
    const p1 = ev(1)
    const m1 = ev(-1)
    const a = (p1 + m1) / 2 - c
    const b = (p1 - m1) / 2
    if (Math.abs(a * 4 + b * 2 + c - ev(2)) > 1e-6) continue
    const isInt = (n: number) => Math.abs(n - Math.round(n)) < 1e-9
    if (![a, b, c].every(isInt)) continue
    const [A, B, C] = [a, b, c].map(Math.round)
    if (A !== 0) {
      const disc = B * B - 4 * A * C
      if (disc >= 0 && isInt(Math.sqrt(disc))) return 'Close — but one of your factors can still be factored. Factor completely.'
    } else if (B !== 0) {
      const g = gcdInt(B, C)
      if (g > 1) return `Close — ${g} still divides a factor. Pull out the common factor too.`
    }
  }
  return null
}
function gcdInt(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
function evalNode(n: Node, env: Record<string, number>): number {
  switch (n.t) {
    case 'num':
      return n.v
    case 'var':
      return env[n.name] ?? NaN
    case 'neg':
      return -evalNode(n.a, env)
    case 'fn':
      return n.name === 'sqrt' ? Math.sqrt(evalNode(n.a, env)) : Math.abs(evalNode(n.a, env))
    case 'bin': {
      const a = evalNode(n.a, env)
      const b = evalNode(n.b, env)
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b)
    }
  }
}
