import type { Rng } from './types'

/** Seeded PRNG (mulberry32) so problems are reproducible in tests. */
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (a: number, b: number) => a + Math.floor(next() * (b - a + 1))
  return {
    int,
    nz(a, b) {
      for (;;) {
        const v = int(a, b)
        if (v !== 0) return v
      }
    },
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle(arr) {
      const a = arr.slice()
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    },
  }
}

// ── small math helpers used by content ─────────────────────────────────────
export const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

/** Reduce n/d; returns [n, d] with d > 0. */
export const reduce = (n: number, d: number): [number, number] => {
  const g = gcd(n, d) || 1
  const s = d < 0 ? -1 : 1
  return [(s * n) / g, (s * d) / g]
}

/** TeX for a fraction value n/d (reduced), integers shown plainly. */
export const fracTex = (n: number, d: number) => {
  const [a, b] = reduce(n, d)
  if (b === 1) return `${a}`
  return a < 0 ? `-\\frac{${-a}}{${b}}` : `\\frac{${a}}{${b}}`
}

/** Plain-text fraction, e.g. "3/4" or "-2". */
export const fracStr = (n: number, d: number) => {
  const [a, b] = reduce(n, d)
  return b === 1 ? `${a}` : `${a}/${b}`
}

/** Round to avoid float noise: 0.1 + 0.2 → 0.3 */
export const clean = (x: number, places = 10) => Number(x.toFixed(places))

/** Signed term for building expressions: sgn(3) = "+ 3", sgn(-3) = "- 3" */
export const sgn = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`)

/** Coefficient display: coef(1,'x')='x', coef(-1,'x')='-x', coef(3,'x')='3x' */
export const coef = (n: number, v: string) => (n === 1 ? v : n === -1 ? `-${v}` : `${n}${v}`)

/** Signed coefficient term: sterm(-1,'x') = '- x', sterm(3,'x') = '+ 3x' */
export const sterm = (n: number, v: string) => (n < 0 ? `- ${coef(-n, v)}` : `+ ${coef(n, v)}`)

/** Parenthesise negatives: p(-3) = "(-3)" */
export const p = (n: number) => (n < 0 ? `(${n})` : `${n}`)

/** Build a linear expression string a·x + b in TeX-friendly form, dropping zero terms. */
export const lin = (a: number, b: number, v = 'x') => {
  if (a === 0) return `${b}`
  const head = coef(a, v)
  return b === 0 ? head : `${head} ${sgn(b)}`
}

/** Format a number with thousands separators for display. */
export const fmt = (n: number) => clean(n).toLocaleString('en-US', { maximumFractionDigits: 6 })

/** Distinct shuffled multiple-choice options with the correct answer's index. */
export function choices(rng: Rng, correct: string, wrongs: string[]): { options: string[]; correct: number } {
  const uniq = Array.from(new Set(wrongs.filter((w) => w !== correct))).slice(0, 3)
  const options = rng.shuffle([correct, ...uniq])
  return { options, correct: options.indexOf(correct) }
}
