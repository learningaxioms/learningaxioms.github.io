import type { Misconception, Problem, Rng, Skill, Visual } from '../engine/types'
import { choices, clean, coef, gcd, lin, p as par, reduce, sgn, sterm } from '../engine/rng'
import { parseExpr } from '../engine/parse'

// PRE-ALGEBRA — negatives, powers, ratios and the first real equations.
// Same recipe as Arithmetic: concept cards (idea → explore → trap → check), then
// an infinite generator with hint ladders, worked steps and misconception detection.

const abs = Math.abs

/** TeX for a number with thousands separators, e.g. 12{,}500 */
const T = (n: number) => clean(n).toLocaleString('en-US', { maximumFractionDigits: 8 }).replace(/,/g, '{,}')
/** Money text (outside TeX): 48 → "48", 48.6 → "48.60" */
const money = (n: number) => (Number.isInteger(clean(n)) ? `${clean(n)}` : clean(n).toFixed(2))
/** Plain-text minus for diagram labels */
const um = (s: string) => s.replace(/-/g, '−')
const sign = (n: number) => (n < 0 ? 'negative' : 'positive')

/** Matcher: does the raw expression equal `target` (checked at a few points)? */
function sameAs(target: string): (raw: string) => boolean {
  const t = parseExpr(target)
  return (raw: string) => {
    const u = parseExpr(raw)
    if (!u || !t) return false
    for (const v of [-1.37, 0.61, 2.83]) {
      const env: Record<string, number> = {}
      for (let i = 0; i < 26; i++) env[String.fromCharCode(97 + i)] = v + i * 0.113
      const a = u.eval(env)
      const b = t.eval(env)
      if (!isFinite(a) || !isFinite(b) || abs(a - b) > 1e-7 * Math.max(1, abs(b))) return false
    }
    return true
  }
}

/** Matcher for a numeric value using a relative tolerance (safe for tiny numbers). */
const near = (target: number) => (_: string, n: number | null) => n !== null && abs(n - target) <= 1e-9 * Math.max(1e-12, abs(target))

/** Drop misconceptions that coincide with the right answer or are not finite. */
const only = (ans: number, ms: Misconception[]) => ms.filter((m) => m.value === undefined || (isFinite(m.value) && abs(m.value - ans) > 1e-9))

/** A number line that shows where you start (but not where you land). */
function startLine(rng: Rng, from: number, to: number, extra: number[] = []): Visual {
  const lo = Math.min(from, to, 0, ...extra) - rng.int(1, 3)
  const hi = Math.max(from, to, 0, ...extra) + rng.int(1, 3)
  return { type: 'numberline', min: lo, max: hi, marks: [from] }
}

/** Polynomial text from [coefficient, variable] terms; '' = constant. Valid TeX and parser input. */
function poly(terms: [number, string][], keepOrder = false): string {
  const ts = keepOrder ? terms : terms.filter(([c]) => c !== 0)
  if (!ts.length) return '0'
  return ts
    .map(([c, v], i) => {
      if (i === 0) return v ? coef(c, v) : `${c}`
      return v ? sterm(c, v) : sgn(c)
    })
    .join(' ')
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Adding & subtracting negatives
// ════════════════════════════════════════════════════════════════════════════

function intAddProblem(rng: Rng, a: number, op: '+' | '-', b: number): Problem {
  const e = op === '-' ? -b : b
  const ans = a + e
  const same = a > 0 === e > 0
  const dir = e > 0 ? 'right' : 'left'
  const big = Math.max(abs(a), abs(e))
  const small = Math.min(abs(a), abs(e))
  const bigNum = abs(a) >= abs(e) ? a : e
  const rewrite = op === '-' ? `${a} - ${par(b)} = ${a} + ${par(e)}` : `${a} + ${par(b)}`
  const rule = same
    ? `Both moves point ${a < 0 ? 'left' : 'right'}, so the sizes **add**: $${abs(a)} + ${abs(e)} = ${abs(ans)}$, and the answer stays ${sign(a)}.`
    : ans === 0
      ? 'The two moves are the same size in opposite directions, so they cancel out exactly.'
      : `The moves point opposite ways, so the sizes **subtract**: $${big} - ${small} = ${abs(ans)}$. The bigger size belongs to $${bigNum}$, so the answer is ${sign(bigNum)}.`
  const mistakes: Misconception[] = []
  if (op === '-' && b < 0)
    mistakes.push({ value: a + b, say: `You subtracted $${-b}$, but this subtracts a **negative**. Taking away a negative is adding its opposite: $${a} - (${b}) = ${a} + ${-b}$.` })
  if (op === '-' && b > 0 && a < 0)
    mistakes.push({ value: a + b, say: `It looks like you found the gap between $${-a}$ and $${b}$. But $${a} - ${b}$ starts **below** zero and moves $${b}$ further left — both moves point the same way, so you go deeper negative.` })
  if (op === '+' && b < 0) mistakes.push({ value: a - b, say: `Adding a negative moves you **left**. $${a} + (${b})$ is the same as $${a} - ${-b}$.` })
  if (ans !== 0) mistakes.push({ value: -ans, say: `Right size, wrong sign. Picture the number line: from $${a}$, move $${abs(e)}$ to the ${dir}. Do you finish above or below zero?` })
  if (same) mistakes.push({ when: (_, n) => n !== null && abs(n) === big - small && n !== ans, say: 'Both moves point the same direction, so the sizes **add** — you only subtract sizes when the signs are different.' })
  else mistakes.push({ when: (_, n) => n !== null && abs(n) === big + small && n !== ans, say: 'The moves point in **opposite** directions, so they partly cancel: subtract the sizes instead of adding them.' })
  return {
    prompt: `$${a} ${op} ${par(b)} = \\;?$`,
    answer: { kind: 'num', value: ans },
    placeholder: 'e.g. -7',
    visual: startLine(rng, a, ans),
    hints: [
      op === '-'
        ? b < 0
          ? 'Subtracting a negative is the same as **adding a positive**. Rewrite it first.'
          : 'Rewrite the subtraction as adding the opposite: subtracting a positive moves you **left**.'
        : b < 0
          ? 'Adding a negative moves you **left** on the number line.'
          : 'Adding a positive moves you **right** on the number line.',
      `$${rewrite}$. Start at $${a}$ (the dot) and move $${abs(e)}$ to the ${dir}.`,
      same
        ? `Same direction: the sizes add, $${abs(a)} + ${abs(e)} = ${abs(a) + abs(e)}$. Are you above or below zero?`
        : `Opposite directions: $${big} - ${small} = ${abs(ans)}$. The number with the bigger size, $${bigNum}$, decides the sign.`,
    ],
    steps: [
      ...(op === '-' ? [{ text: 'Subtracting means adding the opposite:', math: rewrite }] : []),
      { text: rule },
      { text: `Start at $${a}$, move $${abs(e)}$ ${dir} → land on **${ans}**.`, math: `${a} ${op} ${par(b)} = ${ans}` },
    ],
    mistakes: only(ans, mistakes),
  }
}

const intAdd: Skill = {
  id: 'int-add',
  unit: 'pre',
  title: 'Adding & subtracting negatives',
  blurb: 'Moves on a number line: positives go right, negatives go left.',
  prereqs: ['sub'],
  why: 'Temperatures below zero, depths below sea level, an overdrawn account, altitude changes on a descent — negative numbers are how we measure “below the starting line.”',
  learn: [
    { kind: 'idea', title: 'Numbers have a direction', body: 'A negative number is a position **below zero**: $-5^\\circ$ is 5 degrees colder than freezing-point zero, $-30$ m is 30 m below sea level. On a number line, **adding a positive moves right; adding a negative moves left.**', math: '-3 + 5 = 2 \\qquad 4 + (-6) = -2' },
    { kind: 'explore', title: 'Hop along the line', body: 'Set a starting number and a move. Watch which way the hops go — and flip between + and − to see what subtracting does.', widget: { w: 'numberline', mode: 'integers' }, task: 'Set −3 + 5, then −3 − 5, then −3 − (−5). Two of those land in the same place. Which two, and why?' },
    { kind: 'idea', title: 'Subtracting = adding the opposite', body: 'Every subtraction can be rewritten as an addition: $a - b = a + (-b)$. So **subtracting a negative is adding a positive.** Think of debt: if someone *takes away* a \\$5 debt, you are \\$5 richer.', math: '7 - (-3) = 7 + 3 = 10' },
    { kind: 'trap', title: 'Ignoring the sign out front', wrong: '$-3 - 5 = 2$ (did $5 - 3$)', right: '$-3 - 5 = -3 + (-5) = -8$', why: 'You start at $-3$, already below zero, and move 5 **more** to the left. Both moves point the same way, so you go further negative: sizes add, $3 + 5 = 8$, sign stays negative.' },
    { kind: 'trap', title: 'Subtracting a negative', wrong: '$4 - (-6) = -2$', right: '$4 - (-6) = 4 + 6 = 10$', why: 'Two minus signs side by side — “minus a negative” — flip into a plus. Removing a drop of 6 degrees leaves you 6 degrees warmer.' },
    { kind: 'check', question: 'Which expression is the same as $-7 - (-2)$?', options: ['$-7 + 2$', '$-7 - 2$', '$7 + 2$', '$-7 + (-2)$'], correct: 0, explain: 'Subtract a number = add its opposite. The opposite of $-2$ is $2$, so $-7 - (-2) = -7 + 2 = -5$.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      let a: number, b: number, op: '+' | '-'
      do {
        a = rng.nz(-9, 9)
        b = rng.int(1, 9)
        op = rng.pick(['+', '-'] as const)
      } while (!(a < 0 || (op === '-' ? a - b : a + b) < 0))
      return intAddProblem(rng, a, op, b)
    }
    if (level === 2) {
      let a: number, b: number
      do {
        a = rng.nz(-15, 15)
        b = rng.nz(-12, 12)
      } while (a > 0 && b > 0)
      return intAddProblem(rng, a, rng.chance(0.55) ? '-' : '+', b)
    }
    const kind = rng.pick(['temp', 'gap', 'dive', 'three', 'three', 'bank'] as const)
    if (kind === 'temp') {
      const t0 = rng.int(-15, 8)
      const d = rng.int(4, 22)
      const up = t0 < -5 ? rng.chance(0.7) : rng.chance(0.4)
      const ans = up ? t0 + d : t0 - d
      return {
        prompt: `At 0600 the temperature on the flight line is $${t0}^\\circ\\text{F}$. By noon it has ${up ? 'risen' : 'dropped'} $${d}$ degrees. What is the temperature at noon?`,
        answer: { kind: 'num', value: ans, unit: '°F' },
        visual: startLine(rng, t0, ans),
        hints: [`${up ? 'Rising' : 'Dropping'} means move ${up ? 'right (up)' : 'left (down)'} on the number line.`, `Compute $${t0} ${up ? '+' : '-'} ${d}$.`, up ? (t0 < 0 ? `It takes $${-t0}$ degrees just to reach zero. How much of the $${d}$ is left after that?` : `$${t0} + ${d}$ — both positive.`) : t0 < 0 ? `You start below zero and go further down: sizes add, $${-t0} + ${d}$.` : `It takes $${t0}$ degrees to reach zero; the remaining $${d - t0}$ take you below.`],
        steps: [{ text: `${up ? 'A rise adds' : 'A drop subtracts'}:`, math: `${t0} ${up ? '+' : '-'} ${d} = ${ans}` }, { text: `The noon temperature is **${ans}°F**.` }],
        mistakes: only(ans, [
          { value: up ? t0 - d : t0 + d, say: `Check the direction: the temperature ${up ? 'rose, so add' : 'dropped, so subtract'}.` },
          { value: -ans, say: 'Right size, wrong sign. Check whether you finish above or below zero.' },
        ]),
      }
    }
    if (kind === 'gap') {
      const hi = rng.int(2, 25)
      const lo = rng.int(-25, -2)
      const ans = hi - lo
      return {
        prompt: `The high temperature at a mountain airstrip was $${hi}^\\circ\\text{F}$ and the low was $${lo}^\\circ\\text{F}$. How many degrees apart are they?`,
        answer: { kind: 'num', value: ans, unit: 'degrees' },
        visual: { type: 'numberline', min: lo - 2, max: hi + 2, marks: [lo, hi] },
        hints: ['“How far apart” is a subtraction: high − low.', `Compute $${hi} - (${lo})$. Subtracting a negative becomes adding.`, `From $${lo}$ up to $0$ is $${-lo}$ degrees, then from $0$ up to $${hi}$ is $${hi}$ more.`],
        steps: [{ text: 'Difference = high − low:', math: `${hi} - (${lo}) = ${hi} + ${-lo} = ${ans}` }, { text: `On the number line: $${-lo}$ up to zero, then $${hi}$ more — **${ans} degrees** in all.` }],
        mistakes: only(ans, [
          { value: hi + lo, say: `You computed $${hi} + (${lo})$. The gap is high **minus** low, and minus a negative means add: $${hi} + ${-lo}$.` },
          { value: abs(hi + lo), say: 'That treats the gap like a subtraction of the sizes. Count it on the number line: the distance up to zero **plus** the distance above zero.' },
          { value: -ans, say: 'A distance between two temperatures is positive — subtract the lower from the higher.' },
        ]),
      }
    }
    if (kind === 'dive') {
      const d0 = -5 * rng.int(2, 12)
      const down = 5 * rng.int(1, 8)
      const up = 5 * rng.int(1, 8)
      const ans = d0 - down + up
      return {
        prompt: `A rescue diver is at $${d0}$ ft (below sea level). She descends $${down}$ ft, then rises $${up}$ ft. What is her new position?`,
        answer: { kind: 'num', value: ans, unit: 'ft' },
        placeholder: 'e.g. -45',
        visual: { type: 'numberline', min: Math.min(d0 - down, ans, 0) - 5, max: Math.max(ans, 0) + 5, marks: [d0], jumps: [{ from: d0, to: d0 - down, label: `−${down}` }] },
        hints: ['Descending = subtracting, rising = adding.', `Write it as one expression: $${d0} - ${down} + ${up}$.`, `First: $${d0} - ${down} = ${d0 - down}$ (deeper). Then add $${up}$.`],
        steps: [{ text: 'Descend first (the arrow on the diagram):', math: `${d0} - ${down} = ${d0 - down}` }, { text: 'Then rise:', math: `${d0 - down} + ${up} = ${ans}` }, { text: `She is at **${ans} ft**${ans < 0 ? ` — still ${-ans} ft below the surface` : ans === 0 ? ' — right at the surface' : ''}.` }],
        mistakes: only(ans, [
          { value: d0 + down - up, say: 'Directions got swapped. Descending goes **down** (subtract); rising goes **up** (add).' },
          { value: -ans, say: 'Right size, wrong sign. She started below sea level — did she climb out?' },
          { value: abs(d0) + down - up, say: 'Keep the starting depth negative: she starts **below** sea level.' },
        ]),
      }
    }
    if (kind === 'bank') {
      const bal = -rng.int(5, 60)
      const dep = rng.int(10, 90)
      const fee = rng.int(3, 25)
      const ans = bal + dep - fee
      return {
        prompt: `A checking account is overdrawn, with a balance of $${bal}$ dollars. You deposit $${dep}$ dollars, then a $${fee}$-dollar fee is charged. What is the new balance (in dollars)?`,
        answer: { kind: 'num', value: ans, unit: 'dollars' },
        visual: startLine(rng, bal, ans, [bal + dep]),
        hints: ['A deposit adds; a fee subtracts.', `Compute $${bal} + ${dep} - ${fee}$, left to right.`, `$${bal} + ${dep} = ${bal + dep}$. Now subtract $${fee}$.`],
        steps: [{ text: 'Deposit:', math: `${bal} + ${dep} = ${bal + dep}` }, { text: 'Fee:', math: `${bal + dep} - ${fee} = ${ans}` }, { text: `New balance: **${ans} dollars**.` }],
        mistakes: only(ans, [
          { value: -bal + dep - fee, say: 'The starting balance is **negative** (overdrawn) — keep its minus sign.' },
          { value: bal + dep + fee, say: 'A fee takes money **away** — subtract it.' },
          { value: -ans, say: 'Right size, wrong sign — check which side of zero you end on.' },
        ]),
      }
    }
    // three-term expression, first move drawn as a scaffold
    const a = rng.nz(-12, 12)
    const b = rng.nz(-9, 9)
    const c = rng.nz(-9, 9)
    const mid = a - b
    const ans = mid + c
    return {
      prompt: `$${a} - ${par(b)} + ${par(c)} = \\;?$`,
      answer: { kind: 'num', value: ans },
      visual: { type: 'numberline', min: Math.min(a, mid, ans, 0) - 2, max: Math.max(a, mid, ans, 0) + 2, marks: [a], jumps: [{ from: a, to: mid, label: um(`-${par(b)}`) }] },
      hints: ['Work left to right, one move at a time. The arrow shows the first move.', `First: $${a} - ${par(b)} = ${a} + ${par(-b)} = ${mid}$.`, `Now $${mid} + ${par(c)}$: move $${abs(c)}$ to the ${c > 0 ? 'right' : 'left'}.`],
      steps: [
        { text: 'Rewrite every subtraction as adding the opposite:', math: `${a} + ${par(-b)} + ${par(c)}` },
        { text: 'First pair:', math: `${a} + ${par(-b)} = ${mid}` },
        { text: 'Then:', math: `${mid} + ${par(c)} = ${ans}` },
      ],
      mistakes: only(ans, [
        { value: a + b + c, say: `The middle term is **subtracted**. $-${par(b)}$ becomes $+${par(-b)}$.` },
        { value: -ans, say: 'Right size, wrong sign — trace the two moves on the number line.' },
        { value: a - b - c, say: 'The last operation is **+**, not −.' },
      ]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 2. Multiplying & dividing negatives
// ════════════════════════════════════════════════════════════════════════════

const intMult: Skill = {
  id: 'int-mult',
  unit: 'pre',
  title: 'Multiplying & dividing negatives',
  blurb: 'Multiply the sizes, then count the negative signs.',
  prereqs: ['int-add', 'mult'],
  why: 'A descent of 1,200 ft per minute for 4 minutes, a temperature falling 3° every hour, a loss split evenly across a season — rates of change are often negative, and multiplying them is everyday math.',
  learn: [
    { kind: 'idea', title: 'Positive × negative: follow the pattern', body: 'Watch what happens as the second number goes down by 1. Each answer drops by **3**. Keep the pattern going past zero and it has no choice but to go negative.', math: '3\\times2 = 6,\\; 3\\times1 = 3,\\; 3\\times0 = 0,\\; 3\\times(-1) = -3,\\; 3\\times(-2) = -6' },
    { kind: 'idea', title: 'Negative × negative: the pattern flips', body: 'Now start with $-3$. Each time the second number drops by 1, the answer goes **up** by 3. Past zero, the answers are positive. That’s *why* a negative times a negative is positive — not a rule someone made up.', math: '(-3)\\times2 = -6,\\; (-3)\\times1 = -3,\\; (-3)\\times0 = 0,\\; (-3)\\times(-1) = 3,\\; (-3)\\times(-2) = 6' },
    { kind: 'idea', title: 'The sign rules', body: 'Multiply (or divide) the sizes, then fix the sign:\n**Same signs → positive.** **Different signs → negative.**\nWith many factors, **count the negatives**: even count → positive, odd count → negative. Division follows the same rules, because $-12 \\div 3 = -4$ exactly when $3 \\times (-4) = -12$.' },
    { kind: 'trap', title: '“Two negatives make a positive” — but only for × and ÷', wrong: '$-4 + (-5) = 9$', right: '$-4 + (-5) = -9$, while $(-4)\\times(-5) = 20$', why: 'Adding two negatives moves you further left, so the sum stays negative. The “two negatives” shortcut is a **multiplication** rule.' },
    { kind: 'check', question: 'What is the sign of $(-2)\\times(-3)\\times(-1)\\times 5$?', options: ['Negative — there are 3 negatives (odd)', 'Positive — negatives cancel', 'Positive — 5 is positive', 'Can’t tell without multiplying'], correct: 0, explain: 'Each pair of negatives makes a positive. Three negatives = one pair + one left over, so the product is negative: $-30$.' },
  ],
  generate(rng, level) {
    const kind = level === 3 ? rng.pick(['three', 'word', 'word', 'mixed'] as const) : 'basic'
    if (kind === 'basic') {
      const hi = level === 1 ? 9 : 12
      let a: number, b: number
      do {
        a = rng.int(2, hi) * (rng.chance(0.5) ? -1 : 1)
        b = rng.int(2, hi) * (rng.chance(0.5) ? -1 : 1)
      } while (a > 0 && b > 0)
      const divide = rng.chance(level === 1 ? 0.3 : 0.5)
      if (divide) {
        const n = a * b
        const negs = (n < 0 ? 1 : 0) + (b < 0 ? 1 : 0)
        const asFrac = level === 2 && rng.chance(0.4)
        return {
          prompt: asFrac ? `$\\dfrac{${n}}{${b}} = \\;?$` : `$${n} \\div ${par(b)} = \\;?$`,
          answer: { kind: 'num', value: a },
          placeholder: 'e.g. -4',
          hints: ['Divide the sizes first, ignoring the signs.', `$${abs(n)} \\div ${abs(b)} = ${abs(a)}$. Now decide the sign.`, `There ${negs === 1 ? 'is 1 negative (odd)' : `are ${negs} negatives (even)`}, so the answer is ${sign(a)}.`],
          steps: [
            { text: 'Sizes:', math: `${abs(n)} \\div ${abs(b)} = ${abs(a)}` },
            { text: `Signs: ${negs === 1 ? 'different → negative' : 'same → positive'}.`, math: `${n} \\div ${par(b)} = ${a}` },
            { text: `Check by multiplying back: $${par(b)}\\times${par(a)} = ${n}$ ✓` },
          ],
          mistakes: only(a, [{ value: -a, say: `Right size, wrong sign. ${negs === 1 ? 'The signs are **different**, so the quotient is negative.' : 'Both numbers are negative — same signs give a **positive** quotient.'}` }]),
        }
      }
      const ans = a * b
      const negs = (a < 0 ? 1 : 0) + (b < 0 ? 1 : 0)
      return {
        prompt: rng.chance(0.5) ? `$${par(a)} \\times ${par(b)} = \\;?$` : `$(${a})(${b}) = \\;?$`,
        answer: { kind: 'num', value: ans },
        placeholder: 'e.g. -24',
        hints: ['Multiply the sizes first, ignoring the signs.', `$${abs(a)} \\times ${abs(b)} = ${abs(ans)}$. Now the sign.`, `${negs === 1 ? 'One negative → the answer is negative.' : 'Two negatives → they cancel, so the answer is positive.'}`],
        steps: [
          { text: 'Sizes:', math: `${abs(a)}\\times${abs(b)} = ${abs(ans)}` },
          { text: `Signs: ${negs === 1 ? 'different → **negative**' : 'same → **positive**'}.`, math: `${par(a)}\\times${par(b)} = ${ans}` },
        ],
        mistakes: only(ans, [
          { value: -ans, say: `Right size, wrong sign. ${negs === 1 ? 'A positive times a negative is **negative**.' : 'A negative times a negative is **positive** — remember the pattern: the answers climb back up past zero.'}` },
          { value: a + b, say: 'That’s the sum. This is multiplication: multiply the sizes, then fix the sign.' },
        ]),
      }
    }
    if (kind === 'three') {
      const n = rng.chance(0.3) ? 4 : 3
      const fs: number[] = []
      for (let i = 0; i < n; i++) fs.push(rng.int(1, n === 4 ? 4 : 6) * (rng.chance(0.55) ? -1 : 1))
      if (fs.every((f) => f > 0)) fs[0] = -fs[0]
      const ans = fs.reduce((x, y) => x * y, 1)
      const negs = fs.filter((f) => f < 0).length
      const size = abs(ans)
      return {
        prompt: `$${fs.map((f) => `(${f})`).join('')} = \\;?$`,
        answer: { kind: 'num', value: ans },
        hints: ['Count the negative factors first — that settles the sign.', `There ${negs === 1 ? 'is 1 negative' : `are ${negs} negatives`} — ${negs % 2 ? 'odd → negative' : 'even → positive'}.`, `Sizes: $${fs.map(abs).join('\\times')} = ${size}$.`],
        steps: [
          { text: `Negatives: ${negs} (${negs % 2 ? 'odd' : 'even'}), so the product is **${negs % 2 ? 'negative' : 'positive'}**.` },
          { text: 'Multiply the sizes:', math: `${fs.map(abs).join('\\times')} = ${size}` },
          { text: 'Together:', math: `${fs.map((f) => `(${f})`).join('')} = ${ans}` },
        ],
        mistakes: only(ans, [{ value: -ans, say: `Sign slip. Count the negatives: there ${negs === 1 ? 'is 1' : `are ${negs}`}, which is ${negs % 2 ? 'odd → negative' : 'even → positive'}.` }]),
      }
    }
    if (kind === 'mixed') {
      const c = rng.int(2, 6) * (rng.chance(0.5) ? -1 : 1)
      const q = rng.int(2, 9) * (rng.chance(0.5) ? -1 : 1)
      const a = rng.int(2, 6) * (rng.chance(0.6) ? -1 : 1)
      const prod = c * q
      const b = prod / a
      if (!Number.isInteger(b)) {
        // fall back to a clean (a·b)÷c form
        const x = rng.int(2, 8) * -1
        const y = rng.int(2, 8)
        const d = rng.pick([x, -y, 2, -2].filter((v) => (x * y) % v === 0))
        const ans = (x * y) / d
        return {
          prompt: `$\\dfrac{(${x})(${y})}{${d}} = \\;?$`,
          answer: { kind: 'num', value: ans },
          hints: ['Do the top first, then divide.', `Top: $(${x})(${y}) = ${x * y}$.`, `$${x * y} \\div ${par(d)}$: sizes $${abs(x * y)} \\div ${abs(d)} = ${abs(ans)}$; now the sign.`],
          steps: [{ text: 'Numerator:', math: `(${x})(${y}) = ${x * y}` }, { text: 'Divide:', math: `${x * y} \\div ${par(d)} = ${ans}` }],
          mistakes: only(ans, [{ value: -ans, say: 'Sign slip — count the negatives across the whole thing (top and bottom).' }]),
        }
      }
      return {
        prompt: `$\\dfrac{(${a})(${b})}{${c}} = \\;?$`,
        answer: { kind: 'num', value: q },
        hints: ['Simplify the top first, then divide.', `Top: $(${a})(${b}) = ${prod}$.`, `$${prod} \\div ${par(c)}$: sizes give $${abs(q)}$. Same signs → positive, different → negative.`],
        steps: [{ text: 'Numerator:', math: `(${a})(${b}) = ${prod}` }, { text: 'Divide:', math: `\\frac{${prod}}{${c}} = ${q}` }],
        mistakes: only(q, [{ value: -q, say: 'Sign slip — count every negative sign (top and bottom). Even → positive, odd → negative.' }]),
      }
    }
    // word problems
    const w = rng.pick(['descent', 'temp', 'loss', 'dive'] as const)
    if (w === 'descent') {
      const r = rng.pick([500, 600, 700, 800, 1000, 1200, 1500])
      const t = rng.int(2, 8)
      const ans = -r * t
      return {
        prompt: `An airliner descends at $${T(r)}$ feet per minute for $${t}$ minutes. What is its change in altitude? (Use a negative number for a loss.)`,
        answer: { kind: 'num', value: ans, unit: 'ft' },
        placeholder: 'e.g. -2000',
        hints: ['Descending at $' + T(r) + '$ ft/min is a rate of $' + T(-r) + '$ ft per minute.', `Change = rate × time = $(${-r})\\times${t}$.`, `Sizes: $${T(r)}\\times${t} = ${T(r * t)}$. One negative → negative.`],
        steps: [{ text: 'A descent is a negative rate:', math: `\\text{change} = (${-r})\\times ${t}` }, { text: 'Multiply:', math: `= ${T(ans)}\\text{ ft}` }, { text: `The plane is **${T(r * t)} ft lower**.` }],
        mistakes: only(ans, [{ value: -ans, say: 'Right size — but the plane went **down**, so the change is negative.' }, { value: -r - t, say: 'Rate × time means **multiply**, not add.' }]),
      }
    }
    if (w === 'temp') {
      const r = rng.int(2, 6)
      const h = rng.int(2, 8)
      const ans = (-r) * (-h)
      return {
        prompt: `Overnight the temperature falls a steady $${r}^\\circ\\text{F}$ every hour. How many degrees **warmer** was it $${h}$ hours ago than it is now?`,
        answer: { kind: 'num', value: ans, unit: 'degrees' },
        hints: ['Rate: $' + -r + '$ degrees per hour. Time: going **back** $' + h + '$ hours is $' + -h + '$ hours.', `Multiply: $(${-r})\\times(${-h})$.`, `Two negatives → positive: $${r}\\times${h} = ${r * h}$.`],
        steps: [
          { text: 'Temperature change = rate × time. Going back in time is negative time:', math: `(${-r})\\times(${-h}) = ${ans}` },
          { text: `It was **${ans}° warmer** ${h} hours ago — which makes sense: if it’s been falling, it used to be higher. That’s a negative × negative = positive you can feel.` },
        ],
        mistakes: only(ans, [{ value: -ans, say: 'The size is right, but it was **warmer** before (it has been falling since then), so the answer is positive. Negative rate × negative time = positive.' }, { value: r + h, say: 'Multiply the rate by the time.' }]),
      }
    }
    if (w === 'loss') {
      const per = rng.int(2, 12)
      const n = rng.int(3, 9)
      const total = -per * n
      return {
        prompt: `A football team lost a total of $${-total}$ yards over $${n}$ plays, the same amount each play. What was the change in yards per play? (Use a negative number for a loss.)`,
        answer: { kind: 'num', value: -per, unit: 'yards' },
        hints: ['A total loss of $' + -total + '$ yards is a change of $' + total + '$.', `Split it evenly: $${total} \\div ${n}$.`, `$${-total} \\div ${n} = ${per}$; negative ÷ positive is negative.`],
        steps: [{ text: 'Total change ÷ number of plays:', math: `${total} \\div ${n} = ${-per}` }, { text: `Each play: **${-per} yards**.` }],
        mistakes: only(-per, [{ value: per, say: 'Right size — but it was a **loss**, so the change per play is negative.' }, { value: total * n, say: 'Split the total **evenly** — that’s division, not multiplication.' }]),
      }
    }
    const r = rng.int(2, 9)
    const t = rng.int(3, 12)
    return {
      prompt: `A submarine dives at $${r}$ meters per minute. What is its change in depth after $${t}$ minutes? (Use a negative number for going deeper.)`,
      answer: { kind: 'num', value: -r * t, unit: 'm' },
      hints: [`Diving is a rate of $${-r}$ m per minute.`, `Change = $(${-r})\\times${t}$.`, `Sizes: $${r}\\times${t} = ${r * t}$; one negative → negative.`],
      steps: [{ text: 'Rate × time:', math: `(${-r})\\times${t} = ${-r * t}` }, { text: `The submarine is **${r * t} m deeper**: a change of $${-r * t}$.` }],
      mistakes: only(-r * t, [{ value: r * t, say: 'The submarine went **down** — the change should be negative.' }, { value: -r - t, say: 'Rate × time: multiply, don’t add.' }]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 3. Exponents & powers
// ════════════════════════════════════════════════════════════════════════════

const exponents: Skill = {
  id: 'exponents',
  unit: 'pre',
  title: 'Exponents & powers',
  blurb: 'An exponent counts how many times the base is multiplied.',
  prereqs: ['mult'],
  why: 'Doubling bacteria, compound interest, computer memory ($2^{10} = 1024$), the area of a square ($s^2$), the volume of a cube ($s^3$) — anything that multiplies again and again is written with exponents.',
  learn: [
    { kind: 'idea', title: 'Repeated multiplication', body: 'In $3^4$, the **base** is 3 and the **exponent** is 4. The exponent says how many 3s to multiply together:', math: '3^4 = 3\\times3\\times3\\times3 = 81' },
    { kind: 'explore', title: 'Watch powers grow', body: 'Each bar is the next power of the base. Every step to the right multiplies by the base again — that’s why the bars shoot up so fast.', widget: { w: 'exponent' }, task: 'Set base 2 and slide the exponent from 0 to 8. How does each bar compare to the one before it? Then try base 1 — what’s different?' },
    { kind: 'trap', title: 'Multiplying base × exponent', wrong: '$3^4 = 3\\times4 = 12$', right: '$3^4 = 3\\times3\\times3\\times3 = 81$', why: 'The exponent counts **factors**, it isn’t one of them. $3\\times4$ is “3 added four times”; $3^4$ is “3 **multiplied** four times.”' },
    { kind: 'trap', title: 'Where does the minus sign go?', wrong: '$-2^2 = 4$', right: '$-2^2 = -(2\\times2) = -4$, but $(-2)^2 = (-2)(-2) = 4$', why: 'Exponents come before the negative sign in the order of operations. Without parentheses, the exponent grabs only the $2$. With parentheses, the whole $-2$ is the base.' },
    { kind: 'idea', title: 'Why $x^0 = 1$', body: 'Go down the powers of 2: each step **divides by 2**. One more step down from $2^1 = 2$ lands on $1$, not $0$. Any nonzero base to the 0 power is 1.', math: '2^3 = 8,\\; 2^2 = 4,\\; 2^1 = 2,\\; 2^0 = 1' },
    { kind: 'check', question: 'What is $7^0$?', options: ['$1$', '$0$', '$7$', 'Undefined'], correct: 0, explain: 'Zero factors of 7 leaves the “starting value” of multiplication, which is 1. (The pattern $7^2 = 49, 7^1 = 7, 7^0 = 1$ divides by 7 each step.)' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const kind = rng.pick(['eval', 'eval', 'eval', 'write'] as const)
      if (kind === 'write') {
        const b = rng.int(2, 12)
        const n = rng.int(3, 7)
        return {
          prompt: `Write $${Array(n).fill(b).join('\\times')}$ as a power $${b}^{n}$. What is $n$?`,
          answer: { kind: 'num', value: n },
          hints: ['The exponent counts how many times the base appears as a factor.', `Count the ${b}s being multiplied.`, `There are $${n}$ of them.`],
          steps: [{ text: `${n} factors of ${b}:`, math: `${Array(n).fill(b).join('\\times')} = ${b}^{${n}}` }],
          mistakes: only(n, [{ value: n - 1, say: 'Count the **numbers**, not the × signs — there’s one fewer × than factors.' }, { value: b * n, say: 'The exponent is just the count of factors, not a product.' }]),
        }
      }
      let b: number, n: number
      do {
        b = rng.int(2, 10)
        n = rng.chance(0.12) ? rng.int(0, 1) : rng.int(2, 4)
      } while (b ** n > 10000)
      const ans = b ** n
      return {
        prompt: `$${b}^{${n}} = \\;?$`,
        answer: { kind: 'num', value: ans },
        hints:
          n === 0
            ? ['Look at the pattern: each step down the powers divides by the base.', `$${b}^2 = ${b * b}$, $${b}^1 = ${b}$, so $${b}^0 = ${b} \\div ${b}$.`, 'Any nonzero number to the 0 power is…']
            : n === 1
              ? ['The exponent counts factors.', `$${b}^1$ means just one factor of $${b}$.`, `So it’s $${b}$ itself.`]
              : ['The exponent tells you how many times to use the base as a factor.', `Write it out: $${Array(n).fill(b).join('\\times')}$.`, `Multiply step by step: ${Array.from({ length: n - 1 }, (_, i) => `$${b ** (i + 2)}$`).join(', ')}…`],
        steps:
          n <= 1
            ? [{ text: n === 0 ? `Divide down the pattern: $${b}^1 = ${b}$, so $${b}^0 = ${b}\\div${b} = 1$.` : `One factor of ${b}:`, math: `${b}^{${n}} = ${ans}` }]
            : [{ text: `${n} factors of ${b}:`, math: `${b}^{${n}} = ${Array(n).fill(b).join('\\times')}` }, { text: 'Multiply left to right:', math: Array.from({ length: n }, (_, i) => T(b ** (i + 1))).join('\\to ') }, { text: `So $${b}^{${n}} = ${T(ans)}$.` }],
        mistakes: only(ans, [
          { value: b * n, say: `You multiplied ${b} × ${n}. The exponent says how many ${b}s to **multiply together**: $${Array(Math.max(n, 1)).fill(b).join('\\times')}$.` },
          { value: n ** b, say: 'Base and exponent got swapped. The big number is the base; the small raised number is the exponent.' },
          ...(n === 0 ? [{ value: 0, say: 'Not 0! Follow the pattern down: each step divides by the base, and $b^1 \\div b = 1$.' }] : []),
          ...(n >= 2 ? [{ value: b ** (n - 1), say: `One factor short — there are **${n}** factors of ${b}, not ${n - 1}.` }] : []),
        ]),
      }
    }
    if (level === 2) {
      const kind = rng.pick(['negpar', 'negnopar', 'zero', 'frac', 'ten'] as const)
      if (kind === 'negpar' || kind === 'negnopar') {
        const b = rng.int(2, 6)
        const n = rng.int(2, b <= 3 ? 5 : 3)
        const ans = kind === 'negpar' ? (-b) ** n : -(b ** n)
        const other = kind === 'negpar' ? -(b ** n) : (-b) ** n
        return {
          prompt: kind === 'negpar' ? `$(-${b})^{${n}} = \\;?$` : `$-${b}^{${n}} = \\;?$`,
          answer: { kind: 'num', value: ans },
          hints:
            kind === 'negpar'
              ? ['The parentheses mean the base is the whole $-' + b + '$.', `Write it out: $${Array(n).fill(`(-${b})`).join('')}$.`, `$${b}^{${n}} = ${b ** n}$, and there are ${n} negative factors (${n % 2 ? 'odd' : 'even'}).`]
              : ['No parentheses: exponents happen **before** the negative sign.', `So $-${b}^{${n}} = -(${b}^{${n}})$.`, `$${b}^{${n}} = ${b ** n}$. Now put the minus in front.`],
          steps:
            kind === 'negpar'
              ? [{ text: 'The base is $-' + b + '$:', math: `(-${b})^{${n}} = ${Array(n).fill(`(-${b})`).join('')}` }, { text: `${n} negatives → ${n % 2 ? 'negative' : 'positive'}.`, math: `= ${ans}` }]
              : [{ text: 'The exponent only applies to $' + b + '$:', math: `-${b}^{${n}} = -(${Array(n).fill(b).join('\\times')})` }, { text: 'Then apply the negative:', math: `= ${ans}` }],
          mistakes: only(ans, [
            { value: other, say: kind === 'negpar' ? `That would be $-${b}^{${n}}$. With parentheses, the minus sign is part of the base, so it gets multiplied ${n} times.` : `That would be $(-${b})^{${n}}$. Without parentheses the exponent grabs only the $${b}$ — square/power first, then apply the minus.` },
            { value: -b * n, say: 'The exponent counts factors — it doesn’t multiply the base.' },
            { value: b * n, say: 'The exponent counts factors — it doesn’t multiply the base.' },
          ]),
        }
      }
      if (kind === 'zero') {
        const base = rng.pick([`${rng.int(2, 99)}`, `${rng.int(100, 2099)}`, `\\left(\\tfrac{${rng.int(1, 4)}}{${rng.int(5, 9)}}\\right)`, `(-${rng.int(2, 50)})`, 'x'])
        const outsideNeg = !base.startsWith('(') && base !== 'x' && !base.startsWith('\\left') && rng.chance(0.4)
        const ans = outsideNeg ? -1 : 1
        return {
          prompt: `$${outsideNeg ? '-' : ''}${base}^{0} = \\;?$${base === 'x' ? ' (assume $x \\neq 0$)' : ''}`,
          answer: { kind: 'num', value: ans },
          hints: ['What does a 0 exponent mean? Think about the pattern of powers.', 'Each step down the powers divides by the base; one step below the first power gives 1.', outsideNeg ? 'The minus sign is outside — the exponent applies only to the number. So it’s $-(\\text{something}^0)$.' : 'Any nonzero base to the 0 power is…'],
          steps: [{ text: 'Any nonzero number raised to the 0 power equals 1.', math: `${base}^{0} = 1` }, ...(outsideNeg ? [{ text: 'The negative sign is applied after:', math: `-${base}^{0} = -1` }] : [])],
          mistakes: only(ans, [
            { value: 0, say: 'Zero exponent doesn’t give zero. The powers pattern divides by the base each step: $b^1 \\div b = 1$.' },
            { value: -ans, say: outsideNeg ? 'The minus sign sits **outside** the power: $-(\\ldots)^0 = -1$.' : 'With parentheses the whole thing is the base, so the answer is just 1.' },
          ]),
        }
      }
      if (kind === 'frac') {
        const q = rng.int(2, 7)
        const pp = rng.int(1, q - 1)
        const [nn, dd] = reduce(pp, q)
        const n = rng.int(2, 3)
        const ans = nn ** n / dd ** n
        return {
          prompt: `$\\left(\\dfrac{${nn}}{${dd}}\\right)^{${n}} = \\;?$`,
          answer: { kind: 'num', value: ans },
          placeholder: 'e.g. 4/9',
          hints: ['The whole fraction is the base — multiply it by itself.', `$${Array(n).fill(`\\frac{${nn}}{${dd}}`).join('\\times')}$`, `Tops: $${nn}^{${n}} = ${nn ** n}$. Bottoms: $${dd}^{${n}} = ${dd ** n}$.`],
          steps: [{ text: 'Raise the top and the bottom to the power:', math: `\\left(\\frac{${nn}}{${dd}}\\right)^{${n}} = \\frac{${nn}^{${n}}}{${dd}^{${n}}} = \\frac{${nn ** n}}{${dd ** n}}` }],
          mistakes: only(ans, [
            { value: nn ** n / dd, say: 'The exponent applies to the **bottom** too: the whole fraction is multiplied by itself.' },
            { value: (nn * n) / (dd * n), say: 'Multiplying top and bottom by the exponent just gives the same fraction back. Raise each to the power instead.' },
            { value: (nn / dd) * n, say: 'The exponent counts factors — multiply the fraction by itself, don’t multiply it by ' + n + '.' },
          ]),
        }
      }
      const n = rng.int(2, 9)
      const c = rng.int(2, 9)
      const ans = c * 10 ** n
      return {
        prompt: `$${c}\\times10^{${n}} = \\;?$`,
        answer: { kind: 'num', value: ans },
        hints: ['$10^n$ is a 1 followed by $n$ zeros.', `$10^{${n}} = ${T(10 ** n)}$.`, `Multiply by ${c}: write ${c} followed by ${n} zeros.`],
        steps: [{ text: `$10^{${n}}$ has ${n} zeros:`, math: `10^{${n}} = ${T(10 ** n)}` }, { text: 'Multiply:', math: `${c}\\times${T(10 ** n)} = ${T(ans)}` }],
        mistakes: only(ans, [
          { value: c * 10 * n, say: `$10^{${n}}$ isn’t $10\\times${n}$ — it’s ${n} tens multiplied together.` },
          { value: c * 10 ** (n - 1), say: 'One zero short — $10^n$ has exactly $n$ zeros.' },
          { value: c * 10 ** (n + 1), say: 'One zero too many — $10^n$ has exactly $n$ zeros.' },
        ]),
      }
    }
    // level 3
    const kind = rng.pick(['coefpow', 'sum', 'solve', 'parity', 'growth'] as const)
    if (kind === 'coefpow') {
      const c = rng.int(2, 6)
      const b = rng.int(2, 5)
      const n = rng.int(2, 3)
      const ans = c * b ** n
      return {
        prompt: `Evaluate $${c}\\cdot${b}^{${n}}$.`,
        answer: { kind: 'num', value: ans },
        hints: ['Order of operations: exponents come **before** multiplication.', `First $${b}^{${n}} = ${b ** n}$.`, `Then $${c}\\times${b ** n}$.`],
        steps: [{ text: 'Exponent first:', math: `${b}^{${n}} = ${b ** n}` }, { text: 'Then multiply:', math: `${c}\\cdot${b ** n} = ${ans}` }],
        mistakes: only(ans, [{ value: (c * b) ** n, say: `You multiplied first: $(${c}\\cdot${b})^{${n}}$. The exponent belongs only to the ${b} — do it before multiplying.` }, { value: c * b * n, say: 'The exponent counts factors — it isn’t a multiplier.' }]),
      }
    }
    if (kind === 'sum') {
      const a = rng.int(2, 6)
      const m = rng.int(2, 4)
      const b = rng.int(2, 6)
      const n = rng.int(2, 3)
      const op = rng.pick(['+', '-'] as const)
      const ans = op === '+' ? a ** m + b ** n : a ** m - b ** n
      return {
        prompt: `Evaluate $${a}^{${m}} ${op} ${b}^{${n}}$.`,
        answer: { kind: 'num', value: ans },
        hints: ['Evaluate each power separately first.', `$${a}^{${m}} = ${a ** m}$.`, `$${b}^{${n}} = ${b ** n}$. Now ${op === '+' ? 'add' : 'subtract'}.`],
        steps: [{ text: 'Each power:', math: `${a}^{${m}} = ${a ** m},\\quad ${b}^{${n}} = ${b ** n}` }, { text: 'Combine:', math: `${a ** m} ${op} ${b ** n} = ${ans}` }],
        mistakes: only(ans, [{ value: op === '+' ? a * m + b * n : a * m - b * n, say: 'Exponents aren’t multipliers: $a^m$ means $m$ factors of $a$.' }]),
      }
    }
    if (kind === 'solve') {
      const b = rng.pick([2, 2, 3, 3, 4, 5, 10])
      const n = rng.int(3, b === 2 ? 10 : b === 3 ? 7 : 5)
      const N = b ** n
      return {
        prompt: `Find $n$: $${b}^{n} = ${T(N)}$`,
        answer: { kind: 'num', value: n },
        hints: ['Keep multiplying by the base and count how many factors it takes.', `${Array.from({ length: Math.min(n, 4) }, (_, i) => `$${b}^{${i + 1}} = ${T(b ** (i + 1))}$`).join(', ')}, …`, `Keep going until you reach $${T(N)}$.`],
        steps: [{ text: 'List the powers:', math: Array.from({ length: n }, (_, i) => `${b}^{${i + 1}} = ${T(b ** (i + 1))}`).slice(-4).join(',\\; ') }, { text: `$${T(N)}$ is ${n} factors of ${b}, so **n = ${n}**.` }],
        mistakes: only(n, [{ value: N / b, say: `$${b}^n$ isn’t $${b}\\times n$. Count how many ${b}s multiply to give ${T(N)}.` }, { value: n - 1, say: 'One short — recount, starting from $' + b + '^1 = ' + b + '$.' }]),
      }
    }
    if (kind === 'parity') {
      const n = rng.int(11, 99)
      const ans = n % 2 ? -1 : 1
      return {
        prompt: `$(-1)^{${n}} = \\;?$`,
        answer: { kind: 'num', value: ans },
        hints: ['Try small cases: $(-1)^1, (-1)^2, (-1)^3, (-1)^4$.', 'The answers alternate: $-1, 1, -1, 1, \\ldots$ — what decides which?', `Is ${n} even or odd?`],
        steps: [{ text: 'Each pair of $(-1)$ factors multiplies to $1$.' }, { text: `${n} is ${n % 2 ? 'odd, so one $-1$ is left over' : 'even, so everything pairs up'}:`, math: `(-1)^{${n}} = ${ans}` }],
        mistakes: only(ans, [{ value: -ans, say: `Check the parity: ${n} is ${n % 2 ? 'odd' : 'even'}. Even number of negatives → positive; odd → negative.` }, { value: -n, say: 'The exponent counts factors — multiply −1 by itself, don’t multiply by ' + n + '.' }]),
      }
    }
    const b = rng.pick([2, 3])
    const n = rng.int(4, b === 2 ? 12 : 7)
    const ans = b ** n
    return {
      prompt: b === 2 ? `A culture starts with 1 bacterium, and the population doubles every hour. How many bacteria are there after $${n}$ hours?` : `A message is passed on: the first person tells 3 people, each of them tells 3 new people, and so on. How many people hear it in round $${n}$?`,
      answer: { kind: 'num', value: ans },
      hints: [`Each step multiplies by $${b}$.`, `After $${n}$ steps, you’ve multiplied by $${b}$ a total of $${n}$ times: $${b}^{${n}}$.`, `${Array.from({ length: Math.min(n, 5) }, (_, i) => T(b ** (i + 1))).join(', ')}, …`],
      steps: [{ text: `Repeated multiplication by ${b}, ${n} times:`, math: `${b}^{${n}} = ${T(ans)}` }, { text: `That’s why exponential growth gets huge: after ${n} steps there are **${T(ans)}**.` }],
      mistakes: only(ans, [{ value: b * n, say: `That’s growth by **adding** ${b} each step. ${b === 2 ? 'Doubling' : 'Tripling'} **multiplies** each time.` }, { value: b ** (n - 1), say: 'Off by one step — count the multiplications carefully.' }]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 4. Square roots
// ════════════════════════════════════════════════════════════════════════════

const roots: Skill = {
  id: 'roots',
  unit: 'pre',
  title: 'Square roots & perfect squares',
  blurb: 'Undo a square — and estimate roots that aren’t whole numbers.',
  prereqs: ['exponents'],
  why: 'The side of a square room from its area, distances with the Pythagorean theorem, the length of a runway diagonal — square roots turn areas back into lengths.',
  learn: [
    { kind: 'idea', title: 'Undoing a square', body: '$\\sqrt{49}$ asks: **what number times itself gives 49?** The answer is 7, because $7^2 = 49$. Picture a square with area 49 — its side is 7.', math: '\\sqrt{49} = 7 \\quad\\text{because}\\quad 7\\times7 = 49' },
    { kind: 'idea', title: 'Know your perfect squares', body: 'These come up constantly. Knowing them by heart makes roots instant — and lets you estimate everything in between:', math: '1,\\,4,\\,9,\\,16,\\,25,\\,36,\\,49,\\,64,\\,81,\\,100,\\,121,\\,144,\\,169,\\,196,\\,225' },
    { kind: 'trap', title: 'Halving instead of rooting', wrong: '$\\sqrt{64} = 32$', right: '$\\sqrt{64} = 8$', why: '32 + 32 = 64, but a square root needs a number that **multiplies by itself** to make 64. $32\\times32 = 1024$ — way too big.' },
    { kind: 'idea', title: 'Estimating between squares', body: '$\\sqrt{50}$ isn’t whole, but $49 < 50 < 64$, so $7 < \\sqrt{50} < 8$. And since 50 is very close to 49, $\\sqrt{50}$ is just a bit over 7 (about 7.07). To estimate a decimal, see how far along the gap you are:', math: '\\sqrt{55} \\approx 7 + \\tfrac{55-49}{64-49} = 7 + \\tfrac{6}{15} = 7.4' },
    { kind: 'trap', title: 'Rooting each part of a sum', wrong: '$\\sqrt{9 + 16} = 3 + 4 = 7$', right: '$\\sqrt{9 + 16} = \\sqrt{25} = 5$', why: 'The root bar is a grouping symbol: add first, then take the root. Square roots don’t split over addition.' },
    { kind: 'check', question: '$\\sqrt{30}$ is between which two whole numbers?', options: ['$5$ and $6$', '$15$ and $16$', '$4$ and $5$', '$6$ and $7$'], correct: 0, explain: '$5^2 = 25$ and $6^2 = 36$. Since $25 < 30 < 36$, $\\sqrt{30}$ is between 5 and 6.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const n = rng.int(2, 15)
      if (rng.chance(0.3)) {
        return {
          prompt: `$${n}^2 = \\;?$`,
          answer: { kind: 'num', value: n * n },
          hints: ['Squaring means multiplying a number by itself.', `$${n}^2 = ${n}\\times${n}$.`, n > 10 ? `Split it: $${n}\\times10 + ${n}\\times${n - 10}$.` : `Use your times table for ${n}.`],
          steps: [{ text: 'Multiply the number by itself:', math: `${n}^2 = ${n}\\times${n} = ${n * n}` }],
          mistakes: only(n * n, [{ value: 2 * n, say: `$${n}^2$ means $${n}\\times${n}$, not $${n}\\times2$.` }]),
        }
      }
      const N = n * n
      return {
        prompt: rng.chance(0.25) ? `A square hangar floor has an area of $${N}$ square meters. How long is each side?` : `$\\sqrt{${N}} = \\;?$`,
        answer: { kind: 'num', value: n },
        hints: ['Ask: what number times **itself** gives ' + N + '?', `Try a guess: $${n - 1}\\times${n - 1} = ${(n - 1) ** 2}$ — too ${(n - 1) ** 2 < N ? 'small' : 'big'}.`, `Try $${n}\\times${n}$.`],
        steps: [{ text: `Find the number whose square is ${N}:`, math: `${n}\\times${n} = ${N}` }, { text: `So $\\sqrt{${N}} = ${n}$.` }],
        mistakes: only(n, [
          { value: N / 2, say: `That’s half of ${N}. A square root is the number that **multiplies by itself** to give ${N}.` },
          { value: N * N, say: 'You squared it. A square root goes the other way — it undoes squaring.' },
          { value: N / 4, say: 'Dividing the area by 4 gives a perimeter-style guess. For a square, side × side = area, so look for a number times itself.' },
        ]),
      }
    }
    if (level === 2) {
      const kind = rng.pick(['between', 'nearest', 'decimal'] as const)
      if (kind === 'decimal') {
        const n = rng.int(2, 12)
        const useFrac = rng.chance(0.5)
        if (useFrac) {
          let d = rng.int(2, 12)
          while (d === n) d = rng.int(2, 12)
          return {
            prompt: `$\\sqrt{\\dfrac{${n * n}}{${d * d}}} = \\;?$`,
            answer: { kind: 'num', value: n / d },
            placeholder: 'e.g. 3/4',
            hints: ['The root of a fraction is the root of the top over the root of the bottom.', `$\\sqrt{${n * n}} = ${n}$.`, `$\\sqrt{${d * d}} = ${d}$.`],
            steps: [{ text: 'Root the top and the bottom separately:', math: `\\sqrt{\\frac{${n * n}}{${d * d}}} = \\frac{\\sqrt{${n * n}}}{\\sqrt{${d * d}}} = \\frac{${n}}{${d}}` }, { text: 'Check by squaring:', math: `\\left(\\frac{${n}}{${d}}\\right)^2 = \\frac{${n * n}}{${d * d}}\\ \\checkmark` }],
            mistakes: only(n / d, [{ value: (n * n) / (d * d) / 2, say: 'A square root isn’t half — find the number that multiplies by itself.' }, { value: n / (d * d), say: 'Take the root of the **bottom** too.' }]),
          }
        }
        const v = clean(n / 10)
        const sq = clean((n * n) / 100)
        return {
          prompt: `$\\sqrt{${sq}} = \\;?$`,
          answer: { kind: 'num', value: v },
          hints: ['What decimal times itself gives ' + sq + '?', `Ignore the point: $\\sqrt{${n * n}} = ${n}$.`, `$${sq}$ has 2 decimal places, so the root has 1: $${n}\\to${v}$.`],
          steps: [{ text: `Think of ${sq} as $\\frac{${n * n}}{100}$:`, math: `\\sqrt{\\frac{${n * n}}{100}} = \\frac{${n}}{10} = ${v}` }, { text: `Check: $${v}\\times${v} = ${sq}$ ✓` }],
          mistakes: only(v, [{ value: clean(n / 100), say: `Check by squaring: $${clean(n / 100)}^2$ is much smaller than ${sq}. Squaring a number with 1 decimal place gives 2 decimal places.` }, { value: n, say: 'Put the decimal point back: the root of hundredths is tenths.' }, { value: clean(sq / 2), say: 'That’s half. A root multiplies by itself to make the number.' }]),
        }
      }
      let N: number
      do N = rng.int(3, 220)
      while (Number.isInteger(Math.sqrt(N)))
      const k = Math.floor(Math.sqrt(N))
      if (kind === 'between') {
        const correct = `$${k}$ and $${k + 1}$`
        const half = `$${Math.floor(N / 2)}$ and $${Math.floor(N / 2) + 1}$`
        const c = choices(rng, correct, [`$${k - 1}$ and $${k}$`, `$${k + 1}$ and $${k + 2}$`, half, `$${k + 2}$ and $${k + 3}$`].filter((o) => o !== half || Math.floor(N / 2) > k + 2).slice(0, 3))
        const hi = c.options.indexOf(half)
        return {
          prompt: `$\\sqrt{${N}}$ is between which two whole numbers?`,
          answer: { kind: 'choice', options: c.options, correct: c.correct },
          hints: [`Find the perfect squares just below and just above ${N}.`, `$${k}^2 = ${k * k}$ and $${k + 1}^2 = ${(k + 1) ** 2}$.`, `$${k * k} < ${N} < ${(k + 1) ** 2}$ — take the root of each part.`],
          steps: [{ text: 'Trap it between perfect squares:', math: `${k * k} < ${N} < ${(k + 1) ** 2}` }, { text: 'Take square roots:', math: `${k} < \\sqrt{${N}} < ${k + 1}` }],
          mistakes: [{ when: (raw) => hi >= 0 && raw === String(hi), say: 'That’s around half of ' + N + '. A square root is much smaller — find a number that times itself is close to ' + N + '.' }, { when: (raw) => raw !== String(c.correct), say: `Square the numbers to test: $${k}^2 = ${k * k}$, $${k + 1}^2 = ${(k + 1) ** 2}$. Which pair traps ${N}?` }],
        }
      }
      const ans = Math.round(Math.sqrt(N))
      const other = ans === k ? k + 1 : k
      return {
        prompt: `To the nearest whole number, $\\sqrt{${N}} \\approx \\;?$`,
        answer: { kind: 'num', value: ans },
        hints: [`Find perfect squares on either side of ${N}.`, `$${k * k} < ${N} < ${(k + 1) ** 2}$, so it’s between ${k} and ${k + 1}.`, `${N} is ${N - k * k} above ${k * k} and ${(k + 1) ** 2 - N} below ${(k + 1) ** 2}. Which is closer?`],
        steps: [{ text: 'Trap it:', math: `${k}^2 = ${k * k} < ${N} < ${(k + 1) ** 2} = ${k + 1}^2` }, { text: `${N} is closer to ${ans * ans}, so $\\sqrt{${N}} \\approx ${ans}$. (More precisely, $${clean(Math.sqrt(N), 2)}$.)` }],
        mistakes: only(ans, [{ value: other, say: `Right neighbourhood — but ${N} is closer to ${ans * ans} than to ${other * other}. Compare the distances.` }, { value: Math.round(N / 2), say: 'That’s about half. Look for a number that times itself is close to ' + N + '.' }]),
      }
    }
    const kind = rng.pick(['estimate', 'triple', 'area', 'estimate'] as const)
    if (kind === 'triple') {
      const [a0, b0, c0] = rng.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]] as const)
      const m = a0 === 3 ? rng.int(1, 5) : 1
      const a = a0 * m
      const b = b0 * m
      const c = c0 * m
      return {
        prompt: `Evaluate $\\sqrt{${a}^2 + ${b}^2}$.`,
        answer: { kind: 'num', value: c },
        hints: ['Order of operations: the root bar groups everything under it — do the inside first.', `$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${a * a + b * b}$.`, `Now find $\\sqrt{${a * a + b * b}}$: what times itself is ${a * a + b * b}?`],
        steps: [{ text: 'Inside first:', math: `${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}` }, { text: 'Then the root:', math: `\\sqrt{${c * c}} = ${c}` }, { text: 'This is exactly the Pythagorean theorem — you’ll use it to find the long side of a right triangle.' }],
        mistakes: only(c, [{ value: a + b, say: `Roots don’t split over addition: $\\sqrt{${a}^2 + ${b}^2} \\ne ${a} + ${b}$. Add the squares first, then take one root.` }, { value: a * a + b * b, say: 'Don’t forget to take the square root at the end.' }]),
      }
    }
    if (kind === 'area') {
      const s = rng.int(11, 30)
      const A = s * s
      return {
        prompt: `A square helipad has an area of $${A}$ square feet. How long is each side?`,
        answer: { kind: 'num', value: s, unit: 'ft' },
        hints: ['Area of a square = side × side. Which number times itself is ' + A + '?', `$${Math.floor(s / 10) * 10}^2 = ${(Math.floor(s / 10) * 10) ** 2}$ and $${Math.floor(s / 10) * 10 + 10}^2 = ${(Math.floor(s / 10) * 10 + 10) ** 2}$ — so the side is between those.`, `The last digit of ${A} is ${A % 10}. Which digits squared end in ${A % 10}? Try them.`],
        steps: [{ text: 'Side × side = area, so side = $\\sqrt{\\text{area}}$:', math: `\\sqrt{${A}} = ${s}` }, { text: `Check: $${s}\\times${s} = ${A}$ ✓` }],
        mistakes: only(s, [{ value: A / 4, say: 'Dividing by 4 finds a side from a **perimeter**. From an area, you need side × side = area.' }, { value: A / 2, say: 'Half the area isn’t the side. Find the number that times itself gives ' + A + '.' }]),
      }
    }
    let N: number
    do N = rng.int(2, 150)
    while (Number.isInteger(Math.sqrt(N)))
    const k = Math.floor(Math.sqrt(N))
    const est = clean(k + (N - k * k) / ((k + 1) ** 2 - k * k), 2)
    const val = clean(Math.sqrt(N), 2)
    return {
      prompt: `Estimate $\\sqrt{${N}}$ to one decimal place (no calculator).`,
      answer: { kind: 'num', value: val, tol: 0.1 },
      placeholder: 'e.g. 6.4',
      hints: [`Trap it between perfect squares: which squares are just below and above ${N}?`, `$${k * k} < ${N} < ${(k + 1) ** 2}$, so it’s $${k}$-point-something.`, `${N} is ${N - k * k} of the way along a gap of ${(k + 1) ** 2 - k * k}: $${k} + \\frac{${N - k * k}}{${(k + 1) ** 2 - k * k}} \\approx ${est.toFixed(1)}$.`],
      steps: [
        { text: 'Trap it:', math: `${k}^2 = ${k * k} < ${N} < ${(k + 1) ** 2} = ${k + 1}^2` },
        { text: 'Estimate how far along the gap it is:', math: `${k} + \\frac{${N} - ${k * k}}{${(k + 1) ** 2} - ${k * k}} = ${k} + \\frac{${N - k * k}}{${(k + 1) ** 2 - k * k}} \\approx ${est}` },
        { text: `The true value is $${val}\\ldots$ — anything within 0.1 counts.` },
      ],
      mistakes: [{ when: (_, n) => n !== null && abs(n - N / 2) < 0.6, say: `That’s about half of ${N}. A square root is the number that times **itself** gives ${N} — much smaller.` }, { when: (_, n) => n !== null && n > k + 1, say: `Too big: $${k + 1}^2 = ${(k + 1) ** 2}$ is already more than ${N}.` }, { when: (_, n) => n !== null && n < k, say: `Too small: $${k}^2 = ${k * k}$ is already less than ${N}, so the root is more than ${k}.` }, { when: (_, n) => n !== null && n >= k && n <= k + 1, say: `Right whole-number range. Refine it: ${N} is ${N - k * k} of the ${(k + 1) ** 2 - k * k} steps from ${k * k} to ${(k + 1) ** 2}, so about $${k} + \\frac{${N - k * k}}{${(k + 1) ** 2 - k * k}}$.` }],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 5. Ratios & unit rates
// ════════════════════════════════════════════════════════════════════════════

const ratios: Skill = {
  id: 'ratios',
  unit: 'pre',
  title: 'Ratios & unit rates',
  blurb: 'Compare quantities; scale both parts; find the rate per one.',
  prereqs: ['div', 'frac-equiv'],
  why: 'Miles per hour, fuel burn per hour, price per ounce, mixing concrete or paint — a ratio tells you how two things change together, and a unit rate makes any two deals comparable.',
  learn: [
    { kind: 'idea', title: 'A ratio compares', body: 'If a flight has 3 pilots for every 5 flight attendants, the ratio is $3:5$ (also written $\\frac35$ or “3 to 5”). It doesn’t say there are exactly 3 pilots — it says **for every 3 pilots, there are 5 attendants.** 6 and 10, or 9 and 15, fit the same ratio.' },
    { kind: 'explore', title: 'The double number line', body: 'Two number lines that move together. Every column is the same ratio, scaled up. Slide the scale to move along the lines.', widget: { w: 'ratio' }, task: 'Set A = 3, B = 5. What do you multiply by to reach 12 on the A line? What’s on the B line there?' },
    { kind: 'idea', title: 'Unit rate: “per one”', body: 'A **unit rate** scales the ratio down so the second quantity is 1. Divide: 150 miles in 3 hours is $150 \\div 3 = 50$ miles **per** hour. Unit rates make different-sized deals easy to compare.', math: '\\frac{150\\text{ mi}}{3\\text{ h}} = \\frac{50\\text{ mi}}{1\\text{ h}}' },
    { kind: 'trap', title: 'Part-to-part vs part-to-whole', wrong: 'Pilots : attendants $= 3:5$, so $\\frac35$ of the crew are pilots.', right: '$\\frac{3}{3+5} = \\frac38$ of the crew are pilots.', why: '$3:5$ compares one part to the other part. The **whole** crew is $3 + 5 = 8$ parts, so pilots are 3 out of 8.' },
    { kind: 'trap', title: 'Adding instead of scaling', wrong: '$3:5 = 7:9$ (added 4 to both)', right: '$3:5 = 12:20$ (multiplied both by 4)', why: 'Ratios stay the same when you **multiply** both parts by the same number. Adding the same amount changes the comparison: 3:5 is far from equal, but 103:105 is nearly 1:1.' },
    { kind: 'check', question: 'Which is the better buy: 12 oz for \\$3.00, or 20 oz for \\$4.00?', options: ['20 oz for \\$4.00', '12 oz for \\$3.00', 'They’re the same', 'Can’t tell'], correct: 0, explain: 'Unit prices: \\$3.00 ÷ 12 = \\$0.25 per oz, and \\$4.00 ÷ 20 = \\$0.20 per oz. The bigger pack is cheaper per ounce.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const kind = rng.pick(['missing', 'unit', 'simplify'] as const)
      if (kind === 'missing') {
        const a = rng.int(1, 9)
        let b = rng.int(2, 9)
        while (b === a) b = rng.int(2, 9)
        const k = rng.int(2, 8)
        const ans = b * k
        return {
          prompt: `Fill in the missing number: $${a}:${b} = ${a * k}:\\,?$`,
          answer: { kind: 'num', value: ans },
          visual: { type: 'tape', parts: [{ label: `${a}`, size: a }, { label: `${b}`, size: b }] },
          hints: [`What was $${a}$ multiplied by to get $${a * k}$?`, `$${a}\\times${k} = ${a * k}$. Do the same to the other part.`, `$${b}\\times${k} = ?$`],
          steps: [{ text: `Scale factor: $${a * k}\\div${a} = ${k}$.` }, { text: 'Multiply the other part by the same number:', math: `${b}\\times${k} = ${ans}` }, { text: 'Same ratio, scaled up:', math: `${a}:${b} = ${a * k}:${ans}` }],
          mistakes: only(ans, [{ value: b + (a * k - a), say: `You **added** $${a * k - a}$ to both parts. Ratios scale by **multiplying** both parts by the same number.` }, { value: a * k, say: 'The two parts don’t have to be equal — scale the second part by the same factor.' }]),
        }
      }
      if (kind === 'unit') {
        const t = rng.pick(['plane', 'notebook', 'pages'] as const)
        if (t === 'plane') {
          const r = 10 * rng.int(12, 60)
          const h = rng.int(2, 6)
          return {
            prompt: `A plane flies $${T(r * h)}$ miles in $${h}$ hours at a steady speed. What is its speed in miles per hour?`,
            answer: { kind: 'num', value: r, unit: 'mph' },
            hints: ['“Per hour” means: how many miles in **one** hour?', `Split the distance into ${h} equal hours: divide.`, `$${T(r * h)} \\div ${h} = ?$`],
            steps: [{ text: 'Unit rate = miles ÷ hours:', math: `\\frac{${T(r * h)}\\text{ mi}}{${h}\\text{ h}} = ${r}\\text{ mi per h}` }],
            mistakes: only(r, [{ value: r * h * h, say: 'You multiplied. To get “per one hour,” **divide** by the number of hours.' }, { value: clean(h / (r * h), 6), say: 'That’s hours per mile — flipped. Put miles on top.' }]),
          }
        }
        const n = rng.int(3, 9)
        const per = rng.int(2, 15)
        const item = t === 'notebook' ? 'notebooks' : 'pages'
        return {
          prompt: t === 'notebook' ? `$${n}$ notebooks cost \\$${per * n}. What is the cost of one notebook (in dollars)?` : `A printer prints $${per * n}$ pages in $${n}$ minutes. How many pages per minute?`,
          answer: { kind: 'num', value: per },
          hints: ['A unit rate is “per one” — find the amount for 1.', `Divide the total by ${n}.`, `$${per * n} \\div ${n} = ?$`],
          steps: [{ text: 'Divide by the number of ' + (t === 'notebook' ? item : 'minutes') + ':', math: `${per * n}\\div${n} = ${per}` }],
          mistakes: only(per, [{ value: per * n * n, say: 'Divide, don’t multiply — you want the amount for **one**.' }, { value: per * n - n, say: 'Subtracting doesn’t share it out. Divide the total evenly.' }]),
        }
      }
      let a = rng.int(1, 9)
      let b = rng.int(1, 9)
      while (gcd(a, b) !== 1 || a === b) {
        a = rng.int(1, 9)
        b = rng.int(1, 9)
      }
      const g = rng.int(2, 9)
      return {
        prompt: `Simplify the ratio $${a * g}:${b * g}$. It equals $${a}:\\,?$`,
        answer: { kind: 'num', value: b },
        hints: ['Divide both parts by the same number — their GCF.', `Both are divisible by ${g}.`, `$${b * g}\\div${g} = ?$`],
        steps: [{ text: `GCF of ${a * g} and ${b * g} is ${g}. Divide both parts:`, math: `${a * g}:${b * g} = ${a}:${b}` }],
        mistakes: only(b, [{ value: b * g - (a * g - a), say: 'You subtracted the same amount from both. Ratios simplify by **dividing** both parts by the same number.' }]),
      }
    }
    if (level === 2) {
      const kind = rng.pick(['parts', 'parts', 'price', 'fraction'] as const)
      if (kind === 'parts') {
        let a = rng.int(1, 7)
        let b = rng.int(1, 7)
        while (gcd(a, b) !== 1 || a === b) {
          a = rng.int(1, 7)
          b = rng.int(1, 7)
        }
        const u = rng.int(2, 12)
        const total = (a + b) * u
        const [nA, nB] = rng.pick([['red', 'blue'], ['fighters', 'tankers'], ['sand', 'cement'], ['boys', 'girls']] as const)
        const askA = rng.chance(0.5)
        const want = askA ? a * u : b * u
        const wantName = askA ? nA : nB
        return {
          prompt: `The ratio of ${nA} to ${nB} is $${a}:${b}$. There are $${total}$ in all. How many are ${wantName}?`,
          answer: { kind: 'num', value: want },
          visual: { type: 'tape', parts: [{ label: `${nA}: ${a} part${a > 1 ? 's' : ''}`, size: a }, { label: `${nB}: ${b} part${b > 1 ? 's' : ''}`, size: b }], total: `${total} in all` },
          hints: [`The whole tape is $${a} + ${b} = ${a + b}$ equal parts.`, `Each part is $${total} \\div ${a + b} = ${u}$.`, `${wantName} take ${askA ? a : b} parts: $${askA ? a : b}\\times${u}$.`],
          steps: [{ text: 'Total parts:', math: `${a} + ${b} = ${a + b}` }, { text: 'Size of one part:', math: `${total}\\div${a + b} = ${u}` }, { text: `${wantName}:`, math: `${askA ? a : b}\\times${u} = ${want}` }],
          mistakes: only(want, [
            { value: askA ? b * u : a * u, say: `That’s the number of ${askA ? nB : nA}. The question asks for ${wantName}.` },
            { value: total / (askA ? a : b), say: `You divided the total by ${askA ? a : b}. First split the total into all $${a + b}$ parts.` },
            { value: total * (askA ? a : b) / (askA ? b : a), say: 'The total covers **both** groups. Divide it by the total number of parts ($' + (a + b) + '$), not by one group.' },
          ]),
        }
      }
      if (kind === 'price') {
        const n = rng.int(3, 12)
        const cents = 5 * rng.int(5, 99)
        const total = (n * cents) / 100
        const item = rng.pick(['lb of apples', 'gallons of fuel', 'bottles of water', 'packs of batteries'])
        return {
          prompt: `$${n}$ ${item} cost \\$${total.toFixed(2)}. What is the price per one (in dollars)?`,
          answer: { kind: 'num', value: cents / 100, unit: 'dollars' },
          placeholder: 'e.g. 1.25',
          hints: ['Unit price = total cost ÷ number of units.', `$${total.toFixed(2)} \\div ${n}$`, `Try: $${n}\\times${Math.floor(cents / 100)} = ${n * Math.floor(cents / 100)}$; the rest, $${clean(total - n * Math.floor(cents / 100)).toFixed(2)}$, splits into ${n} too.`],
          steps: [{ text: 'Divide the cost by the count:', math: `${total.toFixed(2)}\\div${n} = ${(cents / 100).toFixed(2)}` }, { text: `**\\$${(cents / 100).toFixed(2)}** each.` }],
          mistakes: only(cents / 100, [{ value: clean(n / total, 4), say: 'That’s units per dollar — flipped. For price per unit, put the **cost** on top.' }, { value: clean(total * n), say: 'Divide the cost by the number of units.' }]),
        }
      }
      let a = rng.int(1, 8)
      let b = rng.int(1, 8)
      while (gcd(a, b) !== 1 || a === b) {
        a = rng.int(1, 8)
        b = rng.int(1, 8)
      }
      return {
        prompt: `In a squadron, the ratio of pilots to maintainers is $${a}:${b}$. What fraction of the squadron are pilots?`,
        answer: { kind: 'num', value: a / (a + b), simplest: true },
        placeholder: 'e.g. 3/8',
        visual: { type: 'tape', parts: [{ label: `pilots: ${a}`, size: a }, { label: `maintainers: ${b}`, size: b }] },
        hints: ['The ratio compares part to part. The fraction needs part over **whole**.', `The whole is $${a} + ${b} = ${a + b}$ parts.`, `Pilots are ${a} of those ${a + b} parts.`],
        steps: [{ text: 'Whole = all parts:', math: `${a} + ${b} = ${a + b}` }, { text: 'Pilots out of the whole:', math: `\\frac{${a}}{${a + b}}` }],
        mistakes: only(a / (a + b), [{ value: a / b, say: `$\\frac{${a}}{${b}}$ compares pilots to maintainers (part to part). Out of the **whole** squadron, divide by all $${a + b}$ parts.` }, { value: b / (a + b), say: 'That’s the maintainers’ share. Pilots are the first part of the ratio.' }]),
      }
    }
    const kind = rng.pick(['best', 'scale', 'diff'] as const)
    if (kind === 'best') {
      const sizes = [8, 10, 12, 16, 20, 24, 32]
      const q1 = rng.pick(sizes)
      let q2 = rng.pick(sizes)
      while (q2 === q1) q2 = rng.pick(sizes)
      const u1 = rng.int(12, 40)
      let u2 = u1 + rng.nz(-8, 8)
      if (u2 === u1) u2 = u1 + 3
      const p1 = (q1 * u1) / 100
      const p2 = (q2 * u2) / 100
      const A = `Pack A: \\$${p1.toFixed(2)} for ${q1} oz`
      const B = `Pack B: \\$${p2.toFixed(2)} for ${q2} oz`
      const correct = u1 < u2 ? A : B
      const c = choices(rng, correct, [u1 < u2 ? B : A, 'They cost the same per ounce'])
      const cheaperSticker = p1 < p2 ? A : B
      const stickerIdx = c.options.indexOf(cheaperSticker)
      return {
        prompt: 'Which is the better buy?',
        answer: { kind: 'choice', options: c.options, correct: c.correct },
        hints: ['Compare the **unit price**: dollars per ounce.', `Pack A: $${p1.toFixed(2)} \\div ${q1}$. Pack B: $${p2.toFixed(2)} \\div ${q2}$.`, `A: \\$${(u1 / 100).toFixed(2)}/oz. B: \\$${(u2 / 100).toFixed(2)}/oz.`],
        steps: [{ text: 'Unit prices:', math: `A: \\frac{${p1.toFixed(2)}}{${q1}} = ${(u1 / 100).toFixed(2)},\\quad B: \\frac{${p2.toFixed(2)}}{${q2}} = ${(u2 / 100).toFixed(2)}` }, { text: `${u1 < u2 ? 'Pack A' : 'Pack B'} costs less per ounce — the better buy.` }],
        mistakes: [{ when: (raw) => raw === String(stickerIdx) && stickerIdx !== c.correct, say: 'That pack has the lower **price tag**, but you get less. Compare price per ounce instead.' }, { when: (raw) => raw !== String(c.correct), say: 'Divide each price by its ounces and compare the cost of one ounce.' }],
      }
    }
    if (kind === 'scale') {
      const r = 50 * rng.int(4, 18)
      const h = rng.int(2, 5)
      let H = rng.int(3, 9)
      while (H === h) H = rng.int(3, 9)
      const ans = r * H
      return {
        prompt: `A fighter burns $${T(r * h)}$ lb of fuel in $${h}$ hours of cruise. At the same rate, how much fuel does it burn in $${H}$ hours?`,
        answer: { kind: 'num', value: ans, unit: 'lb' },
        hints: ['Find the unit rate first: fuel per **one** hour.', `$${T(r * h)} \\div ${h} = ${T(r)}$ lb per hour.`, `Now scale up: $${T(r)}\\times${H}$.`],
        steps: [{ text: 'Unit rate:', math: `${T(r * h)}\\div${h} = ${T(r)}\\text{ lb/h}` }, { text: `${H} hours:`, math: `${T(r)}\\times${H} = ${T(ans)}\\text{ lb}` }],
        mistakes: only(ans, [{ value: r * h + (H - h), say: 'Adding the extra hours doesn’t add fuel correctly — find the fuel per hour, then multiply.' }, { value: r * h * H, say: `That multiplies the ${h}-hour amount by ${H}. Divide by ${h} first to get the rate for one hour.` }]),
      }
    }
    let a = rng.int(2, 9)
    let b = rng.int(1, 8)
    while (gcd(a, b) !== 1 || a <= b) {
      a = rng.int(2, 9)
      b = rng.int(1, 8)
    }
    const u = rng.int(2, 9)
    const d = (a - b) * u
    return {
      prompt: `On a flight line, the ratio of fighters to tankers is $${a}:${b}$. There are $${d}$ more fighters than tankers. How many tankers are there?`,
      answer: { kind: 'num', value: b * u },
      visual: { type: 'tape', parts: [{ label: `fighters: ${a} parts`, size: a }, { label: `tankers: ${b} part${b > 1 ? 's' : ''}`, size: b }] },
      hints: [`Fighters have $${a} - ${b} = ${a - b}$ more parts than tankers.`, `Those ${a - b} extra parts are the ${d} extra fighters, so one part is $${d}\\div${a - b} = ${u}$.`, `Tankers are ${b} part${b > 1 ? 's' : ''}: $${b}\\times${u}$.`],
      steps: [{ text: 'Difference in parts:', math: `${a} - ${b} = ${a - b}` }, { text: 'One part:', math: `${d}\\div${a - b} = ${u}` }, { text: 'Tankers:', math: `${b}\\times${u} = ${b * u}` }],
      mistakes: only(b * u, [{ value: a * u, say: 'That’s the number of fighters. The question asks for tankers.' }, { value: u, say: 'That’s the size of **one part**. Tankers are ' + b + ' parts.' }, { value: d / b, say: `The ${d} extra matches the **difference** in parts ($${a - b}$), not the tanker parts.` }]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 6. Proportions
// ════════════════════════════════════════════════════════════════════════════

/** Build a proportion A/B = C/D with one entry hidden (pos 0..3), solved by cross-multiplying. */
function proportionProblem(vals: [number, number, number, number], pos: number, ctx?: { prompt: string; unit?: string; setup: string }): Problem {
  const [A, B, C, D] = vals
  const ans = vals[pos]
  const show = vals.map((v, i) => (i === pos ? 'x' : `${T(v)}`))
  const partner = [D, C, B, A][pos] // shares a diagonal with x
  const other = pos === 0 || pos === 3 ? B * C : A * D
  const otherTex = pos === 0 || pos === 3 ? `${T(B)}\\cdot${T(C)}` : `${T(A)}\\cdot${T(D)}`
  // classic wrong answers
  const inverted = [(B * D) / C, (A * C) / D, (B * D) / A, (A * C) / B][pos]
  const additive = [C + (B - D), D + (A - C), A + (D - B), B + (C - A)][pos]
  const eqTex = `\\frac{${show[0]}}{${show[1]}} = \\frac{${show[2]}}{${show[3]}}`
  return {
    prompt: ctx ? ctx.prompt : `Solve for $x$: $\\dfrac{${show[0]}}{${show[1]}} = \\dfrac{${show[2]}}{${show[3]}}$`,
    answer: { kind: 'num', value: clean(ans), unit: ctx?.unit },
    placeholder: 'x = ?',
    hints: [
      ctx ? `Set up a proportion with the same units in the same places: ${ctx.setup}` : 'Cross-multiply: the two diagonal products of a proportion are equal.',
      `Cross-multiplying gives $${T(partner)}\\,x = ${otherTex}$.`,
      partner === 1 ? `That already says $x = ${T(other)}$.` : `$${T(partner)}\\,x = ${T(other)}$, so divide both sides by $${T(partner)}$.`,
    ],
    steps: [
      ...(ctx ? [{ text: 'Set up the proportion (matching units top and bottom):', math: eqTex }] : []),
      { text: 'Cross-multiply. (This is just multiplying both sides by both denominators.)', math: `${T(partner)}\\,x = ${otherTex} = ${T(other)}` },
      ...(partner === 1 ? [] : [{ text: `Divide by $${T(partner)}$:`, math: `x = \\frac{${T(other)}}{${T(partner)}} = ${T(ans)}` }]),
      { text: 'Check: with the answer filled in, the diagonal products match.', math: `${T(A)}\\cdot${T(D)} = ${T(clean(A * D))},\\quad ${T(B)}\\cdot${T(C)} = ${T(clean(B * C))}\\ \\checkmark` },
    ],
    mistakes: only(ans, [
      { value: clean(inverted, 8), say: 'It looks like one ratio got flipped (or the wrong pair was multiplied). Keep matching quantities in matching positions, then cross-multiply along the diagonals.' },
      { value: clean(additive, 8), say: 'You kept the **difference** the same. Proportions keep the **ratio** the same — scale by multiplying, not adding.' },
      { value: clean(other, 8), say: `That’s the cross product. Finish by dividing by $${T(partner)}$.` },
    ]),
  }
}

const proportions: Skill = {
  id: 'proportions',
  unit: 'pre',
  title: 'Solving proportions',
  blurb: 'Two equal ratios — cross-multiply to find the missing piece.',
  prereqs: ['ratios', 'frac-mult'],
  why: 'Reading a map or aeronautical chart scale, scaling a recipe, converting currencies, finding a height from shadows — any time “this is to that as this is to ?”, it’s a proportion.',
  learn: [
    { kind: 'idea', title: 'Two equal ratios', body: 'A **proportion** says two ratios are equal. If 2 gallons cover 5 miles, how many gallons cover 30 miles? The ratio gallons : miles stays the same:', math: '\\frac{2}{5} = \\frac{x}{30}' },
    { kind: 'explore', title: 'Every column is a proportion', body: 'On a double number line, any two columns form a proportion — the ratio never changes, only the scale.', widget: { w: 'ratio' }, task: 'Set A = 2, B = 5. Find the column where B = 30. Is A/B the same there as in the first column?' },
    { kind: 'idea', title: 'Why cross-multiplying works', body: 'Start with $\\frac{a}{b} = \\frac{c}{d}$. Multiply both sides by $b$, then by $d$ — the denominators cancel and you’re left with the two **diagonal products**. It isn’t a trick; it’s “do the same thing to both sides.”', math: '\\frac{a}{b} = \\frac{c}{d} \\;\\Rightarrow\\; a\\cdot d = b\\cdot c' },
    { kind: 'trap', title: 'Mismatched setup', wrong: '$\\frac{2\\text{ gal}}{5\\text{ mi}} = \\frac{30\\text{ mi}}{x\\text{ gal}}$', right: '$\\frac{2\\text{ gal}}{5\\text{ mi}} = \\frac{x\\text{ gal}}{30\\text{ mi}}$', why: 'Both ratios must be in the **same order** — gallons on top in both, miles on the bottom in both. Label the units as you set it up and the mismatch jumps out.' },
    { kind: 'trap', title: 'Keeping the difference instead of the ratio', wrong: '$\\frac{3}{4} = \\frac{x}{12} \\Rightarrow x = 11$ (4 went up 8, so 3 goes up 8)', right: '$x = 9$ — 4 was **multiplied** by 3, so 3 is multiplied by 3.', why: 'Proportional means multiplicative. Doubling a recipe doubles every ingredient; it doesn’t add the same amount to each.' },
    { kind: 'check', question: 'A plane burns 3 gallons every 2 hours on a long-endurance drone. Which proportion finds the fuel for 7 hours?', options: ['$\\frac{3}{2} = \\frac{x}{7}$', '$\\frac{3}{2} = \\frac{7}{x}$', '$\\frac{2}{3} = \\frac{x}{7}$', '$\\frac{3}{7} = \\frac{2}{x}$'], correct: 0, explain: 'Gallons over hours on both sides: $\\frac{3\\text{ gal}}{2\\text{ h}} = \\frac{x\\text{ gal}}{7\\text{ h}}$, so $x = 10.5$ gallons.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const a = rng.int(1, 9)
      let b = rng.int(2, 10)
      while (b === a) b = rng.int(2, 10)
      const k = rng.int(2, 7)
      const vals: [number, number, number, number] = rng.chance(0.5) ? [a, b, a * k, b * k] : [a * k, b * k, a, b]
      return proportionProblem(vals, rng.int(0, 3))
    }
    if (level === 2) {
      let pp = rng.int(1, 9)
      let q = rng.int(2, 9)
      while (gcd(pp, q) !== 1 || pp === q) {
        pp = rng.int(1, 9)
        q = rng.int(2, 9)
      }
      const m = rng.int(1, 6)
      let n = rng.int(2, 8)
      while (n === m) n = rng.int(2, 8)
      return proportionProblem([pp * m, q * m, pp * n, q * n], rng.int(0, 3))
    }
    const kind = rng.pick(['map', 'fuel', 'shadow', 'recipe', 'drone'] as const)
    if (kind === 'map') {
      const per = rng.pick([5, 8, 10, 12, 15, 20, 25])
      const d = rng.int(3, 14)
      return proportionProblem([1, per, d, per * d], 3, { prompt: `On an aeronautical chart, 1 inch represents $${per}$ nautical miles. Two airports are $${d}$ inches apart on the chart. How far apart are they really?`, unit: 'nautical miles', setup: `$\\frac{1\\text{ in}}{${per}\\text{ nm}} = \\frac{${d}\\text{ in}}{x\\text{ nm}}$.` })
    }
    if (kind === 'fuel') {
      const r = rng.int(6, 14)
      const h = rng.int(2, 4)
      let H = rng.int(3, 9)
      while (H === h) H = rng.int(3, 9)
      return proportionProblem([r * h, h, r * H, H], 3, { prompt: `A Cessna burns $${r * h}$ gallons in $${h}$ hours. At the same rate, how many hours will $${r * H}$ gallons last?`, unit: 'hours', setup: `$\\frac{${r * h}\\text{ gal}}{${h}\\text{ h}} = \\frac{${r * H}\\text{ gal}}{x\\text{ h}}$.` })
    }
    if (kind === 'shadow') {
      const ht = rng.int(5, 6)
      const s = rng.int(2, 9)
      const k = rng.int(3, 12)
      return proportionProblem([ht, s, ht * k, s * k], 2, { prompt: `A $${ht}$-ft person casts a $${s}$-ft shadow. At the same moment, a control tower casts a $${s * k}$-ft shadow. How tall is the tower?`, unit: 'ft', setup: `$\\frac{${ht}\\text{ ft tall}}{${s}\\text{ ft shadow}} = \\frac{x\\text{ ft tall}}{${s * k}\\text{ ft shadow}}$.` })
    }
    if (kind === 'recipe') {
      const cups = rng.int(2, 5)
      const batch = rng.pick([12, 16, 18, 20, 24])
      const want = batch * rng.pick([0.5, 1.5, 2, 2.5, 3])
      return proportionProblem([cups, batch, clean((cups * want) / batch), want], 2, { prompt: `A recipe uses $${cups}$ cups of flour for $${batch}$ muffins. How many cups are needed for $${want}$ muffins?`, unit: 'cups', setup: `$\\frac{${cups}\\text{ cups}}{${batch}\\text{ muffins}} = \\frac{x\\text{ cups}}{${want}\\text{ muffins}}$.` })
    }
    const km = rng.int(2, 6)
    const min = rng.pick([4, 5, 6, 8, 10])
    const T2 = min * rng.int(2, 9) + rng.pick([0, min / 2])
    return proportionProblem([km, min, clean((km * T2) / min), T2], 2, { prompt: `A survey drone covers $${km}$ km in $${min}$ minutes. At that speed, how far does it fly in $${T2}$ minutes?`, unit: 'km', setup: `$\\frac{${km}\\text{ km}}{${min}\\text{ min}} = \\frac{x\\text{ km}}{${T2}\\text{ min}}$.` })
  },
}


// ════════════════════════════════════════════════════════════════════════════
// 7. Percent increase & decrease
// ════════════════════════════════════════════════════════════════════════════

const pctChange: Skill = {
  id: 'pct-change',
  unit: 'pre',
  title: 'Percent increase & decrease',
  blurb: 'Change ÷ original. A multiplier applies a change in one step.',
  prereqs: ['percent'],
  why: 'Sales and markups, tax and tips, raises, population growth, fuel prices going up and down — and spotting when a headline’s percent is misleading.',
  learn: [
    { kind: 'idea', title: 'Always compare to the original', body: 'Percent change measures the change **relative to where you started**:', math: '\\text{percent change} = \\frac{\\text{new} - \\text{original}}{\\text{original}}\\times100' },
    { kind: 'explore', title: 'Find the change, then apply it', body: 'The grid shades a percent; the bar shows that percent **of** the original amount. That piece is the change — add it on for an increase, take it off for a decrease.', widget: { w: 'percent' }, task: 'Find 20% of 80. What is 80 increased by 20%? What is 80 decreased by 20%?' },
    { kind: 'idea', title: 'The multiplier shortcut', body: 'Increasing by 20% keeps the whole 100% **and** adds 20%: that’s 120%, or $\\times1.2$. Decreasing by 15% leaves 85%: $\\times0.85$. One multiplication does the whole job.', math: '80 \\xrightarrow{+20\\%} 80\\times1.2 = 96 \\qquad 80 \\xrightarrow{-15\\%} 80\\times0.85 = 68' },
    { kind: 'trap', title: 'Up 20%, down 20% — back to the start?', wrong: '\\$100 → up 20% → down 20% → \\$100', right: '\\$100 → \\$120 → \\$120 × 0.8 = **\\$96**', why: 'The 20% decrease is taken from the **bigger** number (\\$120), so it removes \\$24, not \\$20. Percents of different wholes don’t cancel.' },
    { kind: 'trap', title: 'Dividing by the new value', wrong: '\\$40 → \\$50 is a $\\frac{10}{50} = 20\\%$ increase', right: '$\\frac{10}{40} = 25\\%$ increase', why: 'The change is measured against the **original** (\\$40). Dividing by the new value answers a different question.' },
    { kind: 'check', question: 'A \\$50 shirt is marked down 30%. What is the sale price?', options: ['\\$35', '\\$15', '\\$20', '\\$65'], correct: 0, explain: '30% of \\$50 is \\$15 off, so \\$50 − \\$15 = \\$35. Or in one step: \\$50 × 0.70 = \\$35. (\\$15 is the discount, not the price.)' },
  ],
  generate(rng, level) {
    if (level === 1) {
      if (rng.chance(0.3)) {
        const pc = rng.pick([5, 8, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75])
        const up = rng.chance(0.5)
        const correct = String(clean(up ? 1 + pc / 100 : 1 - pc / 100))
        const c = choices(rng, correct, [String(clean(pc / 100)), String(clean(up ? 1 - pc / 100 : 1 + pc / 100)), String(clean(pc < 10 ? 1 + pc / 10 : pc / 10)), String(pc)])
        const decIdx = c.options.indexOf(String(clean(pc / 100)))
        return {
          prompt: `${up ? 'Increasing' : 'Decreasing'} an amount by $${pc}\\%$ is the same as multiplying it by…`,
          answer: { kind: 'choice', options: c.options.map((o) => `$${o}$`), correct: c.correct },
          hints: ['Start from 100% — the whole original amount.', `${up ? 'Add' : 'Subtract'} $${pc}\\%$: $100\\% ${up ? '+' : '-'} ${pc}\\% = ${up ? 100 + pc : 100 - pc}\\%$.`, `As a decimal, $${up ? 100 + pc : 100 - pc}\\% = ${correct}$.`],
          steps: [{ text: `You keep the original (100%) ${up ? 'and add' : 'minus'} ${pc}%:`, math: `100\\% ${up ? '+' : '-'} ${pc}\\% = ${up ? 100 + pc : 100 - pc}\\% = ${correct}` }],
          mistakes: [{ when: (raw) => raw === String(decIdx), say: `Multiplying by $${clean(pc / 100)}$ gives just the **change** (${pc}% of it), not the new amount. Add it to the 100% you already have${up ? '' : ' — or subtract it'}.` }, { when: (raw) => raw !== String(c.correct), say: 'Write the new amount as a percent of the original, then convert to a decimal.' }],
        }
      }
      const v = rng.pick([20, 40, 60, 80, 120, 160, 200, 240, 300, 400, 500])
      const pc = rng.pick([10, 20, 25, 50, 5, 75])
      const up = rng.chance(0.5)
      const ch = (v * pc) / 100
      const ans = up ? v + ch : v - ch
      const ctx = up
        ? rng.pick([`A \\$${v} concert ticket goes up by ${pc}%. What is the new price (in dollars)?`, `A base has ${v} airmen. The number grows by ${pc}%. How many airmen now?`])
        : rng.pick([`A \\$${v} flight jacket is ${pc}% off. What is the sale price (in dollars)?`, `A tank holds ${v} gallons. ${pc}% is used on a flight. How many gallons are left?`])
      return {
        prompt: ctx,
        answer: { kind: 'num', value: ans },
        hints: [`First find the change: $${pc}\\%$ of $${v}$.`, `$${pc}\\%$ of $${v} = ${clean(pc / 100)}\\times${v} = ${ch}$.`, `Now ${up ? 'add it to' : 'subtract it from'} the original: $${v} ${up ? '+' : '-'} ${ch}$.`],
        steps: [{ text: 'The change:', math: `${clean(pc / 100)}\\times${v} = ${ch}` }, { text: up ? 'Increase → add:' : 'Decrease → subtract:', math: `${v} ${up ? '+' : '-'} ${ch} = ${ans}` }, { text: 'One-step check with a multiplier:', math: `${v}\\times${clean(up ? 1 + pc / 100 : 1 - pc / 100)} = ${ans}` }],
        mistakes: only(ans, [
          { value: ch, say: `That’s the **change** (${pc}% of ${v}). ${up ? 'Add it to' : 'Subtract it from'} the original to get the new amount.` },
          { value: up ? v - ch : v + ch, say: `Check the direction — this is a${up ? 'n increase' : ' decrease'}.` },
          { value: up ? v + pc : v - pc, say: `You ${up ? 'added' : 'subtracted'} ${pc} itself. ${pc}% of ${v} is $${ch}$, not ${pc}.` },
        ]),
      }
    }
    if (level === 2) {
      if (rng.chance(0.6)) {
        const old = 20 * rng.int(1, 20)
        const pc = rng.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75])
        const up = rng.chance(0.5)
        const ch = (old * pc) / 100
        const nw = up ? old + ch : old - ch
        const what = rng.pick(['price', 'fuel price', 'number of students', 'ticket price'])
        return {
          prompt: `A ${what} ${up ? 'rises' : 'falls'} from $${old}$ to $${nw}$. What is the percent ${up ? 'increase' : 'decrease'}?`,
          answer: { kind: 'num', value: pc, unit: '%' },
          placeholder: 'e.g. 25',
          hints: ['Percent change = change ÷ **original** × 100.', `The change is $${up ? `${nw} - ${old}` : `${old} - ${nw}`} = ${ch}$. The original is $${old}$.`, `$\\frac{${ch}}{${old}} = ${clean(ch / old)}$. Now × 100.`],
          steps: [{ text: 'Change:', math: `${up ? `${nw} - ${old}` : `${old} - ${nw}`} = ${ch}` }, { text: 'Divide by the original:', math: `\\frac{${ch}}{${old}} = ${clean(ch / old)}` }, { text: 'As a percent:', math: `${clean(ch / old)}\\times100 = ${pc}\\%` }],
          mistakes: only(pc, [
            { value: clean((ch / nw) * 100, 8), say: `You divided by the **new** value (${nw}). Percent change compares to the **original**, ${old}.` },
            { value: ch, say: `${ch} is the raw change. Divide it by the original (${old}), then × 100.` },
            { value: clean(ch / old), say: 'That’s the decimal. Multiply by 100 to make it a percent.' },
            { value: clean((nw / old) * 100), say: `That’s the new value as a percent **of** the original. The ${up ? 'increase' : 'decrease'} is the difference from 100%.` },
          ]),
        }
      }
      const pc = rng.pick([6, 8, 12, 15, 18, 35, 7])
      const v = rng.int(12, 120)
      const kind = rng.pick(['tax', 'tip', 'off'] as const)
      const up = kind !== 'off'
      const ans = clean(v * (up ? 1 + pc / 100 : 1 - pc / 100), 2)
      const ch = clean((v * pc) / 100, 2)
      return {
        prompt: kind === 'tax' ? `A \\$${v} pair of headphones has ${pc}% sales tax added. What is the total (in dollars)?` : kind === 'tip' ? `A dinner bill is \\$${v}. You add a ${pc}% tip. What is the total (in dollars)?` : `A \\$${v} game is ${pc}% off. What is the sale price (in dollars)?`,
        answer: { kind: 'num', value: ans, tol: 0.01 },
        placeholder: 'e.g. 48.60',
        hints: [up ? 'You pay the original 100% plus the extra percent.' : 'You pay 100% minus the discount.', `Multiplier: $${up ? `1 + ${clean(pc / 100)}` : `1 - ${clean(pc / 100)}`} = ${clean(up ? 1 + pc / 100 : 1 - pc / 100)}$.`, `$${v}\\times${clean(up ? 1 + pc / 100 : 1 - pc / 100)} = ?$`],
        steps: [{ text: `The ${kind === 'off' ? 'discount' : kind}:`, math: `${clean(pc / 100)}\\times${v} = ${ch}` }, { text: up ? 'Add it on:' : 'Take it off:', math: `${v} ${up ? '+' : '-'} ${ch} = ${money(ans)}` }, { text: `**\\$${money(ans)}**` }],
        mistakes: only(ans, [{ value: ch, say: `That’s just the ${kind === 'off' ? 'discount' : kind}. ${up ? 'Add it to' : 'Subtract it from'} the price.` }, { value: clean(up ? v - ch : v + ch, 2), say: up ? 'Tax and tips **add** to the bill.' : 'A discount **lowers** the price.' }, { value: clean(v * (up ? 1 + pc / 10 : 1 - pc / 10), 2), say: `${pc}% as a decimal is $${clean(pc / 100)}$ (two places left), not $${clean(pc / 10)}$.` }]),
      }
    }
    const kind = rng.pick(['successive', 'reverse', 'net'] as const)
    const pcs = [10, 20, 25, 50]
    if (kind === 'successive') {
      const v = rng.pick([100, 200, 400, 500, 800, 1000, 1200])
      const a = rng.pick(pcs)
      const b = rng.pick(pcs)
      const upFirst = rng.chance(0.6)
      const m1 = upFirst ? 1 + a / 100 : 1 - a / 100
      const m2 = upFirst ? 1 - b / 100 : 1 + b / 100
      const mid = clean(v * m1)
      const ans = clean(mid * m2)
      const naive = clean(v * (1 + (upFirst ? a - b : b - a) / 100))
      return {
        prompt: `A \\$${v} drone’s price is ${upFirst ? 'raised' : 'cut'} by ${a}%. Later, the new price is ${upFirst ? 'cut' : 'raised'} by ${b}%. What is the final price (in dollars)?`,
        answer: { kind: 'num', value: ans, tol: 0.01 },
        hints: ['Do one change at a time. The second percent is taken of the **new** price.', `After the first change: $${v}\\times${clean(m1)} = ${mid}$.`, `Now $${mid}\\times${clean(m2)}$.`],
        steps: [{ text: 'First change:', math: `${v}\\times${clean(m1)} = ${mid}` }, { text: 'Second change, applied to the new price:', math: `${mid}\\times${clean(m2)} = ${ans}` }, { text: `Final price: **\\$${money(ans)}**.${a === b ? ' Notice it does **not** return to the start.' : ''}` }],
        mistakes: only(ans, [{ value: naive, say: `You combined the percents first (${upFirst ? `+${a}% − ${b}%` : `−${a}% + ${b}%`}). But the second percent is of a **different** whole — apply the changes one after another.` }, { value: mid, say: 'That’s after the first change only. Apply the second one too.' }]),
      }
    }
    if (kind === 'reverse') {
      const O = 20 * rng.int(2, 25)
      const pc = rng.pick([10, 20, 25, 40, 50])
      const up = rng.chance(0.35)
      const S = clean(O * (up ? 1 + pc / 100 : 1 - pc / 100))
      const m = clean(up ? 1 + pc / 100 : 1 - pc / 100)
      return {
        prompt: up ? `After a ${pc}% raise, a technician earns \\$${S} per day. What was the daily pay before the raise (in dollars)?` : `After a ${pc}% discount, a flight simulator headset costs \\$${S}. What was the original price (in dollars)?`,
        answer: { kind: 'num', value: O },
        hints: [`The ${up ? 'new pay' : 'sale price'} is ${up ? 100 + pc : 100 - pc}% of the original.`, `So original × $${m}$ = $${S}$.`, `Undo the multiplication: original $= ${S}\\div${m}$.`],
        steps: [{ text: `${up ? 'New pay' : 'Sale price'} = original × multiplier:`, math: `x\\times${m} = ${S}` }, { text: 'Divide to undo it:', math: `x = ${S}\\div${m} = ${O}` }, { text: `Check: ${pc}% of ${O} is ${clean((O * pc) / 100)}, and $${O} ${up ? '+' : '-'} ${clean((O * pc) / 100)} = ${S}$ ✓` }],
        mistakes: only(O, [{ value: clean(S * (up ? 1 - pc / 100 : 1 + pc / 100), 8), say: `You ${up ? 'took' : 'added'} ${pc}% of **${S}**. But the ${pc}% was of the original price, which is ${up ? 'smaller' : 'bigger'}. Divide by $${m}$ instead.` }, { value: up ? S - pc : S + pc, say: `${pc}% isn’t ${pc} dollars. Divide by the multiplier $${m}$.` }]),
      }
    }
    const a = rng.pick([10, 20, 25, 50, 60])
    const b = rng.pick([10, 20, 25, 40, 50])
    const net = clean(((1 + a / 100) * (1 - b / 100) - 1) * 100)
    return {
      prompt: `A stock rises ${a}% on Monday and falls ${b}% on Tuesday. What is the overall percent change? (Use a negative number for a decrease.)`,
      answer: { kind: 'num', value: net, unit: '%' },
      placeholder: 'e.g. -4',
      hints: ['Pick an easy starting value, like \\$100, and follow it through.', `\\$100 × ${clean(1 + a / 100)} = \\$${clean(100 + a)}. Then × ${clean(1 - b / 100)}.`, `\\$${clean(100 + a)} × ${clean(1 - b / 100)} = \\$${clean(100 + net)}. Compare to \\$100.`],
      steps: [{ text: 'Multiply the two multipliers:', math: `${clean(1 + a / 100)}\\times${clean(1 - b / 100)} = ${clean(1 + net / 100)}` }, { text: `That’s ${clean(100 + net)}% of the original, so the change is:`, math: `${clean(100 + net)}\\% - 100\\% = ${net}\\%` }],
      mistakes: only(net, [{ value: a - b, say: `Percents don’t simply add: the ${b}% drop is taken from the **higher** Monday price. Follow \\$100 through both days.` }, { value: -net, say: 'Check the sign: did the value end up above or below where it started?' }]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 8. Evaluating expressions
// ════════════════════════════════════════════════════════════════════════════

const evaluate: Skill = {
  id: 'evaluate',
  unit: 'pre',
  title: 'Evaluating expressions',
  blurb: 'Substitute in parentheses, then follow the order of operations.',
  prereqs: ['order', 'int-mult'],
  why: 'Every formula — fuel burn, a spreadsheet cell, a physics equation, the temperature in °F — is an expression waiting for you to plug in numbers.',
  learn: [
    { kind: 'idea', title: 'A variable is a placeholder', body: 'In $3x + 2$, the letter $x$ holds a spot for a number. **Evaluating** means replacing it with a value and computing. The $3x$ means $3 \\times x$ — a number written against a letter is always multiplication.', math: 'x = 5:\\quad 3x + 2 = 3(5) + 2 = 17' },
    { kind: 'idea', title: 'Always substitute in parentheses', body: 'Put every substituted value inside parentheses **first**, then simplify. It protects negative signs and makes the multiplication visible.', math: 'x = -2:\\quad 3x + 2 = 3(-2) + 2 = -6 + 2 = -4' },
    { kind: 'trap', title: '3x is not “3 and x”', wrong: '$x = -2$: $3x = 3 - 2 = 1$', right: '$3x = 3(-2) = -6$', why: 'Dropping $-2$ in next to the 3 makes it look like subtraction. With parentheses, $3(-2)$ clearly means multiply. (With $x = 5$, the same slip gives “35”.)' },
    { kind: 'trap', title: 'Squaring a negative', wrong: '$x = -3$: $x^2 = -3^2 = -9$', right: '$x^2 = (-3)^2 = 9$', why: 'The value of $x$ is the whole $-3$, so the whole thing gets squared. Without parentheses, the exponent would only grab the 3.' },
    { kind: 'check', question: 'If $a = 4$ and $b = -1$, what is $2a - b$?', options: ['$9$', '$7$', '$-9$', '$3$'], correct: 0, explain: '$2(4) - (-1) = 8 + 1 = 9$. Subtracting $-1$ adds 1 — the parentheses make that easy to see.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const x = rng.nz(-9, 9)
      const a = rng.int(2, 9)
      const b = rng.nz(-12, 12)
      if (rng.chance(0.3)) {
        const c = rng.int(5, 20)
        const ans = c - a * x
        return {
          prompt: `Evaluate $${c} - ${a}x$ when $x = ${x}$.`,
          answer: { kind: 'num', value: ans },
          hints: ['Substitute, keeping $x$ in parentheses.', `$${c} - ${a}(${x})$. Multiply before subtracting.`, `$${a}(${x}) = ${a * x}$, so it’s $${c} - ${par(a * x)}$.`],
          steps: [{ text: 'Substitute:', math: `${c} - ${a}(${x})` }, { text: 'Multiply first:', math: `${c} - ${par(a * x)}` }, { text: 'Then subtract:', math: `= ${ans}` }],
          mistakes: only(ans, [{ value: (c - a) * x, say: `You subtracted before multiplying. Order of operations: $${a}x$ is a product — do it first.` }, { value: c + a * x, say: `Careful with the sign: it’s $${c}$ **minus** $${a}(${x})$.` }]),
        }
      }
      const ans = a * x + b
      return {
        prompt: `Evaluate $${lin(a, b)}$ when $x = ${x}$.`,
        answer: { kind: 'num', value: ans },
        hints: ['Replace $x$ with its value — in parentheses.', `$${a}(${x}) ${sgn(b)}$. Remember $${a}x$ means $${a}\\times x$.`, `$${a}(${x}) = ${a * x}$. Now ${b < 0 ? 'subtract' : 'add'} $${abs(b)}$.`],
        steps: [{ text: 'Substitute in parentheses:', math: `${a}(${x}) ${sgn(b)}` }, { text: 'Multiply:', math: `${a * x} ${sgn(b)}` }, { text: `${b < 0 ? 'Subtract' : 'Add'}:`, math: `= ${ans}` }],
        mistakes: only(ans, [
          ...(x < 0 ? [{ value: a + x + b, say: `$${a}x$ means $${a}\\times x$. Writing $${a}$ next to $${x}$ made it look like $${a} ${x < 0 ? '-' : '+'} ${abs(x)}$ — use parentheses: $${a}(${x}) = ${a * x}$.` }] : [{ value: Number(`${a}${x}`) + b, say: `$${a}x$ isn’t “${a}${x}” — it means $${a}\\times${x} = ${a * x}$.` }]),
          { value: a * x, say: `Don’t forget the $${sgn(b)}$ at the end.` },
          { value: -a * x + b, say: `Sign slip on $${a}(${x})$: a positive times a ${sign(x)} is ${sign(a * x)}.` },
        ]),
      }
    }
    if (level === 2) {
      const kind = rng.pick(['quad', 'ax2', 'two'] as const)
      if (kind === 'quad') {
        const x = rng.nz(-6, 6) * (rng.chance(0.75) ? (rng.chance(0.5) ? -1 : 1) : 1)
        const b = rng.nz(-7, 7)
        const c = rng.nz(-9, 9)
        const ans = x * x + b * x + c
        const expr = `x^2 ${sterm(b, 'x')} ${sgn(c)}`
        return {
          prompt: `Evaluate $${expr}$ when $x = ${x}$.`,
          answer: { kind: 'num', value: ans },
          hints: ['Substitute $x$ everywhere it appears, in parentheses.', `$(${x})^2 ${b < 0 ? '-' : '+'} ${abs(b)}(${x}) ${sgn(c)}$`, `$(${x})^2 = ${x * x}$ and $${b}(${x}) = ${b * x}$.`],
          steps: [{ text: 'Substitute:', math: `(${x})^2 + (${b})(${x}) ${sgn(c)}` }, { text: 'Exponent, then multiply:', math: `${x * x} + ${par(b * x)} ${sgn(c)}` }, { text: 'Add up:', math: `= ${ans}` }],
          mistakes: only(ans, [
            ...(x < 0 ? [{ value: -x * x + b * x + c, say: `$(${x})^2 = +${x * x}$: a negative times a negative is positive. Keep the parentheses when you square.` }] : []),
            { value: 2 * x + b * x + c, say: `$x^2$ means $x\\times x$, not $2\\times x$.` },
            { value: x * x - b * x + c, say: `Check the middle term: $${b}\\times(${x}) = ${b * x}$.` },
          ]),
        }
      }
      if (kind === 'ax2') {
        const x = -rng.int(2, 6)
        const a = rng.nz(-5, 5)
        const ans = a * x * x
        return {
          prompt: `Evaluate $${coef(a, 'x')}^2$ when $x = ${x}$.`,
          answer: { kind: 'num', value: ans },
          hints: ['The exponent belongs to $x$ only, not to the coefficient.', `$${a === 1 ? '' : a === -1 ? '-' : a}(${x})^2$. Square first.`, `$(${x})^2 = ${x * x}$. Now multiply by $${a}$.`],
          steps: [{ text: 'Substitute:', math: `${a === 1 ? '' : a === -1 ? '-' : a}(${x})^2` }, { text: 'Square first (order of operations):', math: `(${x})^2 = ${x * x}` }, { text: 'Then multiply:', math: `${par(a)}\\times${x * x} = ${ans}` }],
          mistakes: only(ans, [
            { value: (a * x) ** 2, say: `Only $x$ is squared. You squared $${a}x$ as a whole — that would need parentheses: $(${coef(a, 'x')})^2$.` },
            { value: -ans, say: `$(${x})^2$ is **positive** (${x * x}). The sign of the answer comes from the coefficient $${a}$.` },
            { value: a * 2 * x, say: '$x^2$ means $x\\times x$, not $2x$.' },
          ]),
        }
      }
      const x = rng.nz(-8, 8)
      const y = rng.nz(-8, 8)
      const a = rng.int(2, 7)
      const b = rng.int(2, 7)
      const ans = a * x - b * y
      return {
        prompt: `Evaluate $${a}x - ${b}y$ when $x = ${x}$ and $y = ${y}$.`,
        answer: { kind: 'num', value: ans },
        hints: ['Substitute both values, each in parentheses.', `$${a}(${x}) - ${b}(${y})$`, `$${a}(${x}) = ${a * x}$ and $${b}(${y}) = ${b * y}$. Now subtract: $${a * x} - ${par(b * y)}$.`],
        steps: [{ text: 'Substitute:', math: `${a}(${x}) - ${b}(${y})` }, { text: 'Multiply:', math: `${a * x} - ${par(b * y)}` }, { text: y < 0 ? 'Subtracting a negative adds:' : 'Subtract:', math: `= ${ans}` }],
        mistakes: only(ans, [
          { value: a * x + b * y, say: `Watch the minus in front of $${b}y$: $${a * x} - ${par(b * y)}$${y < 0 ? ' — minus a negative is plus' : ''}.` },
          { value: a * y - b * x, say: 'You swapped $x$ and $y$. Match each letter to its own value.' },
        ]),
      }
    }
    const kind = rng.pick(['temp', 'sq', 'negsq', 'fuel'] as const)
    if (kind === 'temp') {
      const C = 5 * rng.int(-8, 8)
      const ans = (9 * C) / 5 + 32
      return {
        prompt: `Convert to Fahrenheit using $F = \\tfrac{9}{5}C + 32$ when $C = ${C}$.`,
        answer: { kind: 'num', value: ans, unit: '°F' },
        hints: ['Substitute $C$ in parentheses, then multiply before adding.', `$\\tfrac95(${C}) = 9\\times(${C / 5}) = ${(9 * C) / 5}$.`, `Now add 32: $${(9 * C) / 5} + 32$.`],
        steps: [{ text: 'Substitute:', math: `F = \\tfrac{9}{5}(${C}) + 32` }, { text: 'Multiply first:', math: `F = ${(9 * C) / 5} + 32` }, { text: 'Then add:', math: `F = ${ans}^\\circ` }],
        mistakes: only(ans, [{ value: (9 / 5) * (C + 32), say: 'You added 32 before multiplying. Order of operations: multiply $\\tfrac95 \\times C$ first, then add 32.' }, { value: (9 * C) / 5, say: 'Don’t forget the $+32$.' }, { value: (5 * C) / 9 + 32, say: 'The fraction is $\\tfrac95$, not $\\tfrac59$.' }]),
      }
    }
    if (kind === 'sq') {
      const a = rng.int(2, 4)
      const b = rng.int(1, 6)
      const x = rng.nz(-4, 9)
      const ans = a * (x - b) ** 2
      return {
        prompt: `Evaluate $${a}(x - ${b})^2$ when $x = ${x}$.`,
        answer: { kind: 'num', value: ans },
        hints: ['Parentheses first, then the exponent, then multiply.', `$x - ${b} = ${x} - ${b} = ${x - b}$.`, `$(${x - b})^2 = ${(x - b) ** 2}$. Now multiply by ${a}.`],
        steps: [{ text: 'Inside the parentheses:', math: `${x} - ${b} = ${x - b}` }, { text: 'Square:', math: `(${x - b})^2 = ${(x - b) ** 2}` }, { text: 'Multiply:', math: `${a}\\times${(x - b) ** 2} = ${ans}` }],
        mistakes: only(ans, [
          { value: (a * (x - b)) ** 2, say: `The exponent applies only to $(x - ${b})$ — square that, **then** multiply by ${a}.` },
          { value: a * (x * x - b * b), say: `$(x - ${b})^2$ is not $x^2 - ${b * b}$. Work out the inside first, then square it.` },
          { value: -ans, say: 'A square is never negative — check the sign.' },
        ]),
      }
    }
    if (kind === 'negsq') {
      const x = -rng.int(2, 7)
      const b = rng.nz(-6, 6)
      const ans = -(x * x) + b * x
      return {
        prompt: `Evaluate $-x^2 ${sterm(b, 'x')}$ when $x = ${x}$.`,
        answer: { kind: 'num', value: ans },
        hints: ['$-x^2$ means “the opposite of $x^2$”: square first, then apply the minus.', `$-(${x})^2 = -(${x * x}) = ${-x * x}$.`, `$${b}(${x}) = ${b * x}$. Add the two parts.`],
        steps: [{ text: 'Substitute in parentheses:', math: `-(${x})^2 + (${b})(${x})` }, { text: 'Square, then apply the negative:', math: `-${x * x} + ${par(b * x)}` }, { text: 'Add:', math: `= ${ans}` }],
        mistakes: only(ans, [{ value: x * x + b * x, say: `$-x^2$ is the **opposite** of $x^2$. $(${x})^2 = ${x * x}$, so $-x^2 = ${-x * x}$ — the leading minus survives.` }, { value: -(x * x) - b * x, say: `Check $${b}(${x})$ — a ${sign(b)} times a negative is ${sign(-b)}.` }]),
      }
    }
    const F0 = 10 * rng.int(30, 90)
    const r = 5 * rng.int(8, 24)
    const t = rng.pick([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])
    const ans = clean(F0 - r * t)
    return {
      prompt: `A jet’s remaining fuel (in pounds) is $F = ${F0} - ${r}t$, where $t$ is hours flown. Find $F$ when $t = ${t}$.`,
      answer: { kind: 'num', value: ans, unit: 'lb' },
      hints: ['Substitute, then multiply before subtracting.', `$${r}(${t}) = ${clean(r * t)}$.`, `$${F0} - ${clean(r * t)}$`],
      steps: [{ text: 'Substitute:', math: `F = ${F0} - ${r}(${t})` }, { text: 'Multiply:', math: `F = ${F0} - ${clean(r * t)}` }, { text: 'Subtract:', math: `F = ${ans}\\text{ lb}` }],
      mistakes: only(ans, [{ value: clean((F0 - r) * t), say: `You subtracted first. $${r}t$ is a product — multiply before subtracting.` }, { value: clean(F0 - r - t), say: `$${r}t$ means $${r}\\times t$.` }]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 9. Like terms & the distributive property
// ════════════════════════════════════════════════════════════════════════════

const likeTerms: Skill = {
  id: 'like-terms',
  unit: 'pre',
  title: 'Like terms & distributing',
  blurb: 'Combine terms with the same variable part; multiply into every term.',
  prereqs: ['evaluate'],
  why: 'Simplifying is how a messy expression becomes something you can actually solve or compute — it’s the first move in nearly every algebra problem.',
  learn: [
    { kind: 'idea', title: 'Like terms', body: 'Terms are **like** when their variable parts match exactly: $3x$ and $5x$ are like; $3x$ and $3x^2$ are not; $3x$ and $4$ are not. Combine like terms by adding their **coefficients** — 3 crates + 5 crates = 8 crates.', math: '3x + 5x = 8x \\qquad 4y - y = 3y' },
    { kind: 'trap', title: 'Combining unlike terms', wrong: '$3x + 2 = 5x$', right: '$3x + 2$ is already simplified.', why: 'Test it with $x = 10$: $3x + 2 = 32$, but $5x = 50$. 3 crates plus 2 loose boxes is not 5 crates.' },
    { kind: 'explore', title: 'Distributing is splitting an area', body: 'The area model splits $23 \\times 14$ into four pieces. The same picture explains $3(x + 4)$: a rectangle 3 tall and $x + 4$ wide is a $3$-by-$x$ piece **plus** a $3$-by-$4$ piece.', widget: { w: 'area' }, task: 'Look at how each part of the width gets multiplied by the height. Which piece would be left out if you only multiplied 3 × x?' },
    { kind: 'idea', title: 'The distributive property', body: 'Multiply the outside number by **every** term inside the parentheses. Carry the signs along:', math: '3(x + 4) = 3x + 12 \\qquad -2(x - 5) = -2x + 10' },
    { kind: 'trap', title: 'Dropping a sign or a term', wrong: '$-2(x - 5) = -2x - 10$ and $4(x + 3) = 4x + 3$', right: '$-2(x - 5) = -2x + 10$ and $4(x + 3) = 4x + 12$', why: 'The $-2$ multiplies the $-5$ too: $(-2)(-5) = +10$. And the 4 has to reach the 3 — every term inside gets multiplied.' },
    { kind: 'check', question: 'Simplify $4x + 3 - x + 5$.', options: ['$3x + 8$', '$5x + 8$', '$11x$', '$3x + 2$'], correct: 0, explain: 'x-terms: $4x - x = 3x$ (the minus belongs to the $x$). Numbers: $3 + 5 = 8$. They can’t combine with each other.' },
  ],
  generate(rng, level) {
    const placeholder = 'e.g. 5x + 3'
    if (level === 1) {
      const a = rng.nz(-9, 9)
      let c = rng.nz(-9, 9)
      while (a + c === 0) c = rng.nz(-9, 9)
      const b = rng.nz(-9, 9)
      const d = rng.nz(-9, 9)
      const v = rng.pick(['x', 'x', 'y', 'n'])
      const order = rng.pick([
        [[a, v], [b, ''], [c, v], [d, '']],
        [[a, v], [c, v], [b, ''], [d, '']],
        [[b, ''], [a, v], [d, ''], [c, v]],
        [[a, v], [b, ''], [d, ''], [c, v]],
      ] as [number, string][][])
      const ans = poly([[a + c, v], [b + d, '']])
      const expr = poly(order, true)
      return {
        prompt: `Simplify: $${expr}$`,
        answer: { kind: 'expr', expr: ans, form: 'simplified' },
        placeholder,
        hints: [`Group the like terms: the ${v}-terms together, the plain numbers together. Each sign belongs to the term after it.`, `${v}-terms: $${poly([[a, v], [c, v]], true)}$. Numbers: $${poly([[b, ''], [d, '']], true)}$.`, `$${a} ${sgn(c)} = ${a + c}$ and $${b} ${sgn(d)} = ${b + d}$.`],
        steps: [
          { text: 'Rearrange so like terms sit together (signs travel with their terms):', math: poly([[a, v], [c, v], [b, ''], [d, '']], true) },
          { text: 'Combine coefficients of the like terms:', math: `(${a} ${sgn(c)})${v} + (${b} ${sgn(d)}) = ${ans}` },
        ],
        mistakes: [
          { when: sameAs(`${a + b + c + d}${v}`), say: `You merged the plain numbers into the ${v}-terms. A number without ${v} isn’t a like term — keep it separate.` },
          ...(c < 0 ? [{ when: sameAs(poly([[a - c, v], [b + d, '']])), say: `The minus in front of $${coef(-c, v)}$ belongs to that term, so it **subtracts**: $${a} - ${-c} = ${a + c}$.` }] : []),
          ...(d < 0 ? [{ when: sameAs(poly([[a + c, v], [b - d, '']])), say: `The minus in front of the $${-d}$ belongs to it, so it **subtracts**: $${b} - ${-d} = ${b + d}$.` }] : []),
          { when: sameAs(poly([[abs(a) + abs(c), v], [abs(b) + abs(d), '']])), say: 'The minus signs belong to their terms. Subtract where there’s a minus.' },
          { when: sameAs(poly([[a + c, v], [-(b + d), '']])), say: `The ${v}-part is right; recheck the plain numbers: $${b} ${sgn(d)} = ${b + d}$.` },
          { when: sameAs(poly([[-(a + c), v], [b + d, '']])), say: `The number part is right; recheck the ${v}-terms: $${a} ${sgn(c)} = ${a + c}$.` },
        ],
      }
    }
    if (level === 2) {
      if (rng.chance(0.35)) {
        // x^2 and x terms
        const a = rng.nz(-6, 6)
        let c = rng.nz(-6, 6)
        while (a + c === 0) c = rng.nz(-6, 6)
        const b = rng.nz(-8, 8)
        let d = rng.nz(-8, 8)
        while (b + d === 0) d = rng.nz(-8, 8)
        const expr = poly([[a, 'x^2'], [b, 'x'], [c, 'x^2'], [d, 'x']], true)
        const ans = poly([[a + c, 'x^2'], [b + d, 'x']])
        return {
          prompt: `Simplify: $${expr}$`,
          answer: { kind: 'expr', expr: ans, form: 'simplified' },
          placeholder: 'e.g. 2x^2 + 7x',
          hints: ['$x^2$ and $x$ are **different** kinds of terms — like squares and lengths.', `$x^2$-terms: $${poly([[a, 'x^2'], [c, 'x^2']], true)}$. $x$-terms: $${poly([[b, 'x'], [d, 'x']], true)}$.`, `$${a} ${sgn(c)} = ${a + c}$ and $${b} ${sgn(d)} = ${b + d}$.`],
          steps: [{ text: 'Group the like terms:', math: poly([[a, 'x^2'], [c, 'x^2'], [b, 'x'], [d, 'x']], true) }, { text: 'Combine each group:', math: ans }],
          mistakes: [
            { when: (raw) => sameAs(`${a + b + c + d}x^2`)(raw) || sameAs(`${a + b + c + d}x^3`)(raw) || sameAs(`${a + b + c + d}x`)(raw), say: '$x^2$ and $x$ are not like terms (at $x = 3$, $x^2 = 9$ but $x = 3$). Combine each kind separately.' },
            { when: sameAs(poly([[a + c, 'x^2'], [-(b + d), 'x']])), say: 'Recheck the signs on the $x$-terms.' },
            { when: sameAs(poly([[-(a + c), 'x^2'], [b + d, 'x']])), say: 'Recheck the signs on the $x^2$-terms.' },
          ],
        }
      }
      const k = rng.nz(-9, 9) === 0 ? 2 : rng.pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8])
      const a = rng.pick([1, 2, 3, 4, 5, -1, -2])
      const b = rng.nz(-9, 9)
      const inner = lin(a, b)
      const ans = lin(k * a, k * b)
      return {
        prompt: `Expand: $${k}(${inner})$`,
        answer: { kind: 'expr', expr: ans, form: 'simplified' },
        placeholder,
        hints: [`Multiply $${k}$ by **each** term inside the parentheses.`, `$${k}\\cdot ${coef(a, 'x')} = ${coef(k * a, 'x')}$.`, `$${par(k)}\\cdot${par(b)} = ${k * b}$. Put them together.`],
        steps: [{ text: 'Distribute to every term:', math: `${k}(${inner}) = ${par(k)}(${coef(a, 'x')}) + ${par(k)}(${b})` }, { text: 'Multiply each — carry the signs:', math: ans }],
        mistakes: [
          { when: sameAs(lin(k * a, b)), say: `The $${k}$ has to multiply the $${b}$ too — every term inside gets multiplied.` },
          { when: sameAs(lin(k * a, -k * b)), say: `Sign slip on the second term: $${par(k)}\\times${par(b)} = ${k * b}$.` },
          { when: sameAs(lin(-k * a, k * b)), say: `Sign slip on the first term: $${par(k)}\\times ${coef(a, 'x')} = ${coef(k * a, 'x')}$.` },
          { when: sameAs(lin(k * a, k + b)), say: `You added $${k}$ to the second term. Distributing means **multiplying** each term by $${k}$.` },
        ],
      }
    }
    // level 3: distribute then combine
    const k = rng.pick([2, 3, 4, 5, -2, -3])
    const a = rng.int(1, 4)
    const b = rng.nz(-7, 7)
    if (rng.chance(0.5)) {
      const m = rng.int(2, 5)
      const c = rng.int(1, 4)
      const d = rng.nz(-7, 7)
      if (k * a - m * c === 0) return likeTerms.generate(rng, 3)
      const ans = lin(k * a - m * c, k * b - m * d)
      return {
        prompt: `Simplify: $${k}(${lin(a, b)}) - ${m}(${lin(c, d)})$`,
        answer: { kind: 'expr', expr: ans, form: 'simplified' },
        placeholder,
        hints: [`Distribute each number — and treat the second one as $-${m}$, since the minus sign goes with it.`, `$${k}(${lin(a, b)}) = ${lin(k * a, k * b)}$ and $-${m}(${lin(c, d)}) = ${lin(-m * c, -m * d)}$.`, `Now combine: $x$-terms $${k * a} ${sgn(-m * c)}$, numbers $${k * b} ${sgn(-m * d)}$.`],
        steps: [
          { text: 'Distribute both — the second multiplier is $-' + m + '$:', math: `${lin(k * a, k * b)} ${sterm(-m * c, 'x')} ${sgn(-m * d)}` },
          { text: 'Combine like terms:', math: ans },
        ],
        mistakes: [
          { when: sameAs(lin(k * a - m * c, k * b + m * d)), say: `The $-${m}$ multiplies **both** terms in the second parentheses: $(-${m})(${d}) = ${-m * d}$.` },
          { when: sameAs(lin(k * a - m * c, k * b - d)), say: `Distribute the $-${m}$ to the ${d} as well — every term inside gets multiplied.` },
          { when: sameAs(lin(k * a + m * c, k * b + m * d)), say: 'The minus sign in front of the second parentheses flips the sign of **everything** inside.' },
        ],
      }
    }
    const c = rng.nz(-6, 6)
    const d = rng.nz(-9, 9)
    if (k * a + c === 0) return likeTerms.generate(rng, 3)
    const ans = lin(k * a + c, k * b + d)
    return {
      prompt: `Simplify: $${k}(${lin(a, b)}) ${sterm(c, 'x')} ${sgn(d)}$`,
      answer: { kind: 'expr', expr: ans, form: 'simplified' },
      placeholder,
      hints: ['Distribute first, then combine like terms.', `$${k}(${lin(a, b)}) = ${lin(k * a, k * b)}$.`, `Now: $${lin(k * a, k * b)} ${sterm(c, 'x')} ${sgn(d)}$ — combine the $x$-terms and the numbers.`],
      steps: [{ text: 'Distribute:', math: `${lin(k * a, k * b)} ${sterm(c, 'x')} ${sgn(d)}` }, { text: 'Group and combine:', math: `(${k * a} ${sgn(c)})x + (${k * b} ${sgn(d)}) = ${ans}` }],
      mistakes: [
        { when: sameAs(lin(k * a + c, b + d)), say: `The $${k}$ must multiply the $${b}$ inside the parentheses too.` },
        { when: sameAs(lin(k * a + c, -k * b + d)), say: `Sign slip distributing: $${par(k)}\\times${par(b)} = ${k * b}$.` },
        { when: sameAs(`${k * a + c + k * b + d}x`), say: 'Numbers without $x$ aren’t like terms with the $x$-terms — keep them separate.' },
      ],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 10. One-step equations
// ════════════════════════════════════════════════════════════════════════════

const oneStep: Skill = {
  id: 'one-step',
  unit: 'pre',
  title: 'One-step equations',
  blurb: 'Undo the operation — and do the same thing to both sides.',
  prereqs: ['int-add', 'evaluate'],
  why: 'Working backward from what you know — how much fuel you started with, what each share costs, how fast you must fly — is solving an equation. This is the move every bigger equation is built on.',
  learn: [
    { kind: 'idea', title: 'An equation is a balance', body: '$x + 7 = 12$ says the two sides **weigh the same**. To find $x$, get it alone — but whatever you do to one side, you must do to the other, or the scale tips.' },
    { kind: 'explore', title: 'Keep it level', body: 'Each box is an $x$; each small square is 1. Your moves change both pans — or just one, if you try the risky button.', widget: { w: 'balance' }, task: 'Solve one equation. Then press “from left only” on a new one — what happens to the scale, and why?' },
    { kind: 'idea', title: 'Undo with the inverse', body: 'Find what was done **to** $x$, then do the opposite to both sides:\n**+ ↔ −** and **× ↔ ÷**', math: 'x - 5 = 12 \\Rightarrow x = 12 + 5 = 17 \\qquad \\frac{x}{4} = 3 \\Rightarrow x = 3\\times4 = 12' },
    { kind: 'trap', title: 'Doing the operation instead of undoing it', wrong: '$x - 5 = 12 \\Rightarrow x = 12 - 5 = 7$', right: '$x - 5 = 12 \\Rightarrow x = 12 + 5 = 17$', why: '5 was **subtracted** from $x$, so add 5 to undo it. Check: $7 - 5 = 2$, not 12 — always plug your answer back in.' },
    { kind: 'trap', title: 'Losing the negative', wrong: '$-4x = 20 \\Rightarrow x = 5$', right: '$x = \\frac{20}{-4} = -5$', why: '$x$ is multiplied by $-4$ (not 4), so divide both sides by $-4$. Check: $-4(-5) = 20$ ✓.' },
    { kind: 'check', question: 'To solve $\\frac{x}{6} = 7$, what should you do to both sides?', options: ['Multiply by 6', 'Divide by 6', 'Subtract 6', 'Add 7'], correct: 0, explain: '$x$ was divided by 6. Multiplication undoes division: $x = 7\\times6 = 42$.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const x = rng.int(1, 25)
      const a = rng.int(2, 20)
      const kind = rng.pick(['plus', 'minus', 'aplus'] as const)
      const lhs = kind === 'plus' ? `x + ${a}` : kind === 'minus' ? `x - ${a}` : `${a} + x`
      const b = kind === 'minus' ? x - a : x + a
      const undo = kind === 'minus' ? 'add' : 'subtract'
      return {
        prompt: `Solve: $${lhs} = ${b}$`,
        answer: { kind: 'num', value: x },
        placeholder: 'x = ?',
        visual: { type: 'balance', left: um(lhs), right: um(String(b)) },
        hints: [`What is being done to $x$? ${kind === 'minus' ? `${a} is subtracted from it.` : `${a} is added to it.`}`, `To undo it, ${undo} ${a} on **both** sides.`, `$x = ${b} ${kind === 'minus' ? '+' : '-'} ${a}$`],
        steps: [{ text: `${undo === 'add' ? 'Add' : 'Subtract'} ${a} on both sides:`, math: `${lhs} ${kind === 'minus' ? '+' : '-'} ${a} = ${b} ${kind === 'minus' ? '+' : '-'} ${a}` }, { text: 'Simplify:', math: `x = ${x}` }, { text: 'Check:', math: `${lhs.replace('x', `(${x})`)} = ${b}\\ \\checkmark` }],
        mistakes: only(x, [{ value: kind === 'minus' ? b - a : b + a, say: `You ${kind === 'minus' ? 'subtracted' : 'added'} ${a} — that repeats the operation. To **undo** ${kind === 'minus' ? 'subtracting' : 'adding'} ${a}, ${undo} ${a}. Check by plugging in.` }]),
      }
    }
    if (level === 2) {
      const kind = rng.pick(['mult', 'div', 'addneg', 'mult'] as const)
      if (kind === 'mult') {
        const a = rng.nz(-12, 12) === 1 ? -3 : rng.pick([-12, -9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12])
        const x = rng.nz(-12, 12)
        const b = a * x
        return {
          prompt: `Solve: $${a}x = ${b}$`,
          answer: { kind: 'num', value: x },
          placeholder: 'x = ?',
          visual: { type: 'balance', left: um(`${a}x`), right: um(String(b)) },
          hints: [`$x$ is **multiplied** by $${a}$.`, `Undo it: divide both sides by $${a}$${a < 0 ? ' — including its negative sign' : ''}.`, `$x = \\frac{${b}}{${a}}$. Sizes: $${abs(b)}\\div${abs(a)} = ${abs(x)}$. Now the sign.`],
          steps: [{ text: `Divide both sides by $${a}$:`, math: `\\frac{${a}x}{${a}} = \\frac{${b}}{${a}}` }, { text: 'Simplify:', math: `x = ${x}` }, { text: 'Check:', math: `${a}(${x}) = ${b}\\ \\checkmark` }],
          mistakes: only(x, [{ value: -x, say: `Right size, wrong sign. You’re dividing by $${a}$ — keep its sign. Check: $${a}\\times${par(-x)} = ${-b}$, not ${b}.` }, { value: a * b, say: `$x$ is multiplied by ${a}, so **divide** to undo it.` }, { value: b - a, say: `$${a}x$ means ${a} **times** $x$ — undo with division, not subtraction.` }]),
        }
      }
      if (kind === 'div') {
        const a = rng.int(2, 9)
        const b = rng.nz(-9, 9)
        const x = a * b
        return {
          prompt: `Solve: $\\dfrac{x}{${a}} = ${b}$`,
          answer: { kind: 'num', value: x },
          placeholder: 'x = ?',
          visual: { type: 'balance', left: `x ÷ ${a}`, right: um(String(b)) },
          hints: [`$x$ is **divided** by ${a}.`, `Undo it: multiply both sides by ${a}.`, `$x = ${par(b)}\\times${a}$`],
          steps: [{ text: `Multiply both sides by ${a}:`, math: `${a}\\cdot\\frac{x}{${a}} = ${par(b)}\\cdot${a}` }, { text: 'Simplify:', math: `x = ${x}` }, { text: 'Check:', math: `\\frac{${x}}{${a}} = ${b}\\ \\checkmark` }],
          mistakes: only(x, [{ value: clean(b / a, 8), say: `That divides again. $x$ was **divided** by ${a}; multiply by ${a} to undo it.` }, { value: -x, say: 'Sign slip — check by plugging your answer back in.' }]),
        }
      }
      const a = rng.nz(-15, 15)
      const x = rng.nz(-15, 15)
      const b = x + a
      const lhs = `x ${sgn(a)}`
      return {
        prompt: `Solve: $${lhs} = ${b}$`,
        answer: { kind: 'num', value: x },
        placeholder: 'x = ?',
        visual: { type: 'balance', left: um(lhs), right: um(String(b)) },
        hints: [`$${a < 0 ? `${-a}$ is subtracted from` : `${a}$ is added to`} $x$.`, `Undo it: ${a < 0 ? `add ${-a}` : `subtract ${a}`} on both sides.`, `$x = ${b} ${sgn(-a)}$`],
        steps: [{ text: `${a < 0 ? `Add ${-a}` : `Subtract ${a}`} on both sides:`, math: `x = ${b} ${sgn(-a)}` }, { text: 'Simplify:', math: `x = ${x}` }, { text: 'Check:', math: `${par(x)} ${sgn(a)} = ${b}\\ \\checkmark` }],
        mistakes: only(x, [{ value: b + a, say: `That repeats the operation instead of undoing it. ${a < 0 ? `Subtracting ${-a} is undone by **adding** ${-a}` : `Adding ${a} is undone by **subtracting** ${a}`}.` }, { value: -x, say: 'Right size, wrong sign. Check by plugging in.' }]),
      }
    }
    const kind = rng.pick(['frac', 'word', 'word', 'dec'] as const)
    if (kind === 'frac') {
      let q = rng.int(2, 9)
      let pp = rng.int(1, q - 1 || 1)
      if (gcd(pp, q) !== 1 || pp === q) {
        pp = 2
        q = 3
      }
      const m = rng.int(1, 8) * (rng.chance(0.25) ? -1 : 1)
      const x = q * m
      const r = pp * m
      return {
        prompt: `Solve: $\\dfrac{${pp}}{${q}}x = ${r}$`,
        answer: { kind: 'num', value: x },
        placeholder: 'x = ?',
        hints: [`$x$ is multiplied by $\\frac{${pp}}{${q}}$. Undo it by multiplying by the **reciprocal**, $\\frac{${q}}{${pp}}$.`, `$x = ${par(r)}\\times\\frac{${q}}{${pp}}$`, `$${par(r)}\\div${pp} = ${m}$, then $\\times ${q}$.`],
        steps: [{ text: `Multiply both sides by $\\frac{${q}}{${pp}}$:`, math: `\\frac{${q}}{${pp}}\\cdot\\frac{${pp}}{${q}}x = \\frac{${q}}{${pp}}\\cdot${par(r)}` }, { text: 'Simplify:', math: `x = ${x}` }, { text: 'Check:', math: `\\frac{${pp}}{${q}}\\cdot${par(x)} = ${r}\\ \\checkmark` }],
        mistakes: only(x, [{ value: clean((r * pp) / q, 8), say: `You multiplied by $\\frac{${pp}}{${q}}$ again. Undo it with the **reciprocal** $\\frac{${q}}{${pp}}$.` }, { value: clean(r - pp / q, 8), say: 'The fraction **multiplies** $x$ — undo it by multiplying by its reciprocal, not by subtracting.' }]),
      }
    }
    if (kind === 'dec') {
      const c = rng.pick([0.5, 0.25, 1.5, 2.5, 0.2, 0.4])
      const x = rng.int(2, 30) * (c === 0.25 ? 4 : c === 0.2 || c === 0.4 ? 5 : 2)
      const b = clean(c * x)
      return {
        prompt: `Solve: $${c}x = ${b}$`,
        answer: { kind: 'num', value: x },
        placeholder: 'x = ?',
        visual: { type: 'balance', left: `${c}x`, right: String(b) },
        hints: [`$x$ is multiplied by ${c}; divide both sides by ${c}.`, `$x = ${b}\\div${c}$. Dividing by a number less than 1 makes it **bigger**.`, `Multiply top and bottom by 10 or 100 to clear the decimal: $\\frac{${clean(b * (c === 0.25 ? 100 : 10))}}{${clean(c * (c === 0.25 ? 100 : 10))}}$.`],
        steps: [{ text: `Divide both sides by ${c}:`, math: `x = \\frac{${b}}{${c}} = ${x}` }, { text: 'Check:', math: `${c}\\times${x} = ${b}\\ \\checkmark` }],
        mistakes: only(x, [{ value: clean(b * c, 8), say: `You multiplied by ${c}. Undo multiplication by **dividing** — and since ${c}${c < 1 ? ' < 1' : ''}, the answer${c < 1 ? ' should be bigger than ' + b : ''}.` }, { value: clean(b - c, 8), say: `$${c}x$ means ${c} times $x$ — divide, don’t subtract.` }]),
      }
    }
    const w = rng.pick(['fuel', 'legs', 'temp', 'share'] as const)
    if (w === 'fuel') {
      const used = rng.int(20, 90)
      const left = rng.int(40, 200)
      const x = used + left
      return {
        prompt: `After burning $${used}$ gallons, a plane has $${left}$ gallons left. How much fuel did it start with? (Equation: $x - ${used} = ${left}$.)`,
        answer: { kind: 'num', value: x, unit: 'gallons' },
        visual: { type: 'balance', left: `x − ${used}`, right: String(left) },
        hints: ['Starting fuel minus fuel burned equals what’s left.', `Undo the subtraction: add ${used} to both sides.`, `$x = ${left} + ${used}$`],
        steps: [{ text: 'Equation:', math: `x - ${used} = ${left}` }, { text: `Add ${used} to both sides:`, math: `x = ${left} + ${used} = ${x}` }, { text: `It started with **${x} gallons**.` }],
        mistakes: only(x, [{ value: left - used, say: 'It must have started with **more** than it has now — add the burned fuel back.' }]),
      }
    }
    if (w === 'legs') {
      const n = rng.int(3, 8)
      const each = 10 * rng.int(15, 60)
      const total = n * each
      return {
        prompt: `A ferry flight is split into $${n}$ equal legs totaling $${T(total)}$ miles. How long is each leg? (Equation: $${n}x = ${T(total)}$.)`,
        answer: { kind: 'num', value: each, unit: 'miles' },
        visual: { type: 'balance', left: `${n}x`, right: String(total) },
        hints: [`${n} legs of $x$ miles: $${n}x = ${T(total)}$.`, `Undo the multiplication: divide both sides by ${n}.`, `$x = ${T(total)}\\div${n}$`],
        steps: [{ text: 'Equation:', math: `${n}x = ${T(total)}` }, { text: `Divide both sides by ${n}:`, math: `x = ${T(each)}` }],
        mistakes: only(each, [{ value: total * n, say: 'Each leg is a **part** of the total — divide, don’t multiply.' }, { value: total - n, say: `$${n}x$ means ${n} times $x$ — undo with division.` }]),
      }
    }
    if (w === 'temp') {
      const drop = rng.int(5, 25)
      const now = rng.int(-15, 10)
      const x = now + drop
      return {
        prompt: `The temperature dropped $${drop}$ degrees overnight and is now $${now}^\\circ$. What was it before the drop? (Equation: $x - ${drop} = ${now}$.)`,
        answer: { kind: 'num', value: x, unit: '°' },
        visual: { type: 'balance', left: `x − ${drop}`, right: um(String(now)) },
        hints: ['Before − drop = now.', `Undo the subtraction: add ${drop} to both sides.`, `$x = ${now} + ${drop}$`],
        steps: [{ text: `Add ${drop} to both sides:`, math: `x = ${now} + ${drop} = ${x}` }, { text: `It was **${x}°** before the drop.` }],
        mistakes: only(x, [{ value: now - drop, say: 'It was **warmer** before a drop — add the drop back.' }, { value: -x, say: 'Sign slip — check: does your answer minus ' + drop + ' give ' + now + '?' }]),
      }
    }
    const n = rng.int(3, 9)
    const each = rng.int(6, 45)
    return {
      prompt: `$${n}$ friends split a bill equally. Each pays \\$${each}. What was the total bill (in dollars)? (Equation: $\\frac{x}{${n}} = ${each}$.)`,
      answer: { kind: 'num', value: n * each },
      visual: { type: 'balance', left: `x ÷ ${n}`, right: String(each) },
      hints: ['Total ÷ number of people = each share.', `Undo the division: multiply both sides by ${n}.`, `$x = ${each}\\times${n}$`],
      steps: [{ text: `Multiply both sides by ${n}:`, math: `x = ${each}\\times${n} = ${n * each}` }, { text: `The bill was **\\$${n * each}**.` }],
      mistakes: only(n * each, [{ value: clean(each / n, 8), say: 'The total is **bigger** than one share — multiply to undo the division.' }, { value: each + n, say: 'Undo division with multiplication, not addition.' }]),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// 11. Scientific notation
// ════════════════════════════════════════════════════════════════════════════

/** Random significant digits, e.g. "34" (= 3.4) or "506" (= 5.06); last digit nonzero. */
function sigDigits(rng: Rng, maxLen = 3): string {
  const len = rng.int(1, maxLen)
  let s = String(rng.int(1, 9))
  for (let i = 1; i < len; i++) s += String(i === len - 1 ? rng.int(1, 9) : rng.int(0, 9))
  return s
}
/** "34" → "3.4" */
const coefStr = (d: string) => (d.length === 1 ? d : `${d[0]}.${d.slice(1)}`)
/** Standard-form string for digits × 10^n, where digits means d0.d1d2… */
function stdStr(d: string, n: number): string {
  const pos = 1 + n
  if (pos <= 0) return '0.' + '0'.repeat(-pos) + d
  if (pos >= d.length) return d + '0'.repeat(pos - d.length)
  return d.slice(0, pos) + '.' + d.slice(pos)
}
/** TeX for a standard-form string with thousands separators on the integer part. */
function stdTex(s: string): string {
  const [i, f] = s.split('.')
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}')
  return f ? `${grouped}.${f}` : grouped
}
const sci = (c: string | number, n: number | string) => `${c}\\times10^{${n}}`
/** num answer that is safe for tiny values */
const numAns = (v: number) => ({ kind: 'num' as const, value: v, ...(abs(v) < 1 ? { tol: abs(v) * 1e-6 } : {}) })

const sciNotation: Skill = {
  id: 'sci-notation',
  unit: 'pre',
  title: 'Scientific notation',
  blurb: 'Huge and tiny numbers as a × 10ⁿ — the exponent counts the moves.',
  prereqs: ['exponents', 'decimals'],
  why: 'The speed of light (3 × 10⁸ m/s), the width of a virus (about 1 × 10⁻⁷ m), a jet engine’s thrust, the national debt — scientists and engineers write very big and very small numbers this way so the size is obvious at a glance.',
  learn: [
    { kind: 'idea', title: 'The format', body: 'A number in scientific notation is **a number from 1 up to (but not including) 10**, times a **power of 10**. The power counts how many places the decimal point moves.', math: '340{,}000 = 3.4\\times10^{5} \\qquad 0.00045 = 4.5\\times10^{-4}' },
    { kind: 'explore', title: 'Powers of ten', body: 'Set the base to 10 and watch: each step up the exponent tacks on one more zero — one more place for the decimal point to move.', widget: { w: 'exponent' }, task: 'Set base 10. How many zeros does $10^6$ have? What do you think $10^{-1}$ would be?' },
    { kind: 'idea', title: 'Positive vs. negative exponents', body: '**Positive exponent → big number:** move the point to the right. **Negative exponent → small number (less than 1):** move the point to the left. $10^{-3}$ means $\\frac{1}{1000}$.', math: '7.1\\times10^{-3} = 0.0071' },
    { kind: 'trap', title: 'Coefficient too big', wrong: '$45{,}000 = 45\\times10^{3}$ (scientific notation)', right: '$45{,}000 = 4.5\\times10^{4}$', why: '$45\\times10^3$ has the right value, but the front number must be at least 1 and less than 10. Move the point one more place and add 1 to the exponent.' },
    { kind: 'trap', title: 'Moving the wrong way', wrong: '$3.2\\times10^{-3} = 3200$', right: '$3.2\\times10^{-3} = 0.0032$', why: 'A negative exponent means **divide** by 10 that many times — the number gets **smaller**, so the point moves left.' },
    { kind: 'check', question: 'Which is greater: $2\\times10^{-3}$ or $9\\times10^{-4}$?', options: ['$2\\times10^{-3}$', '$9\\times10^{-4}$', 'They’re equal', 'Can’t compare'], correct: 0, explain: 'Compare exponents first: $-3 > -4$. In standard form, $0.002 > 0.0009$. The front number only matters when the exponents tie.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const d = sigDigits(rng)
      const n = rng.int(2, 8)
      const s = stdStr(d, n)
      const v = Number(s)
      if (rng.chance(0.5)) {
        const zerosOnly = Number(d + '0'.repeat(n))
        return {
          prompt: `Write $${sci(coefStr(d), n)}$ in standard form.`,
          answer: numAns(v),
          placeholder: 'e.g. 340000',
          hints: [`$10^{${n}}$ means: move the decimal point ${n} places to the **right**.`, `Start from $${coefStr(d)}$ and move the point ${n} places right, filling with zeros.`, d.length - 1 >= n ? `Moving ${n} places uses up digits after the point — count them off one at a time.` : `The digits ${d} stay as they are; ${d.length > 1 ? `${d.length - 1} of the moves pass over digits, so ` : ''}you need $${n - (d.length - 1)}$ zero${n - (d.length - 1) === 1 ? '' : 's'} after them.`],
          steps: [{ text: `Move the decimal point ${n} places right:`, math: `${sci(coefStr(d), n)} = ${stdTex(s)}` }],
          mistakes: [
            ...(d.length > 1 ? [{ when: near(zerosOnly), say: `You wrote ${n} zeros after all the digits. The exponent counts how many places the **decimal point moves** — the digits after the point use some of those places.` }] : []),
            { when: near(v * 10), say: 'One place too far — count exactly ' + n + ' moves.' },
            { when: near(v / 10), say: 'One place short — count exactly ' + n + ' moves.' },
          ],
        }
      }
      const zeros = s.length - s.replace(/0+$/, '').length
      return {
        prompt: `Write $${stdTex(s)}$ in scientific notation: $${stdTex(s)} = ${sci(coefStr(d), 'n')}$. What is $n$?`,
        answer: { kind: 'num', value: n },
        hints: ['Count how many places the decimal point moves to get from ' + coefStr(d) + ' to ' + s + '.', `The point sits at the end of ${s}. Move it left until one digit is in front: ${coefStr(d)}.`, `It moves past ${n} digits.`],
        steps: [{ text: `Place the point after the first digit: ${coefStr(d)}. That’s ${n} places left of where it was.` }, { text: 'So:', math: `${stdTex(s)} = ${sci(coefStr(d), n)}` }],
        mistakes: only(n, [
          { value: zeros, say: 'You counted the zeros. Count the **places the decimal point moves** — every digit after the first, not just the zeros.' },
          { value: n + 1, say: `That counts all ${n + 1} digits. The point stops after the **first** digit, so it moves ${n} places.` },
          { value: -n, say: 'This is a big number (more than 10), so the exponent is **positive**.' },
        ]),
      }
    }
    if (level === 2) {
      const kind = rng.pick(['toStdNeg', 'toSciNeg', 'which', 'which'] as const)
      const d = sigDigits(rng, 2)
      const n = -rng.int(1, 6)
      const s = stdStr(d, n)
      const v = Number(s)
      if (kind === 'toStdNeg') {
        return {
          prompt: `Write $${sci(coefStr(d), n)}$ as a decimal.`,
          answer: numAns(v),
          placeholder: 'e.g. 0.0071',
          hints: ['A negative exponent makes the number **smaller** — move the point left.', `Move the point ${-n} place${n === -1 ? '' : 's'} left from ${coefStr(d)}.`, `Fill the gaps with zeros: $${s}$ has ${-n - 1} zero${-n - 1 === 1 ? '' : 's'} right after the point.`],
          steps: [{ text: `Move the decimal point ${-n} place${n === -1 ? '' : 's'} left:`, math: `${sci(coefStr(d), n)} = ${s}` }, { text: `Check: it’s less than 1, as a negative exponent should give.` }],
          mistakes: [
            { when: near(Number(stdStr(d, -n))), say: 'You moved the point to the right. A **negative** exponent means a small number — move it left.' },
            { when: near(v / 10), say: 'One place too far left. Count exactly ' + -n + ' moves.' },
            { when: near(v * 10), say: 'One place short. Count exactly ' + -n + ' moves.' },
          ],
        }
      }
      if (kind === 'toSciNeg') {
        const zerosAfterPoint = -n - 1
        return {
          prompt: `Write $${s}$ in scientific notation: $${s} = ${sci(coefStr(d), 'n')}$. What is $n$?`,
          answer: { kind: 'num', value: n },
          placeholder: 'e.g. -4',
          hints: ['This number is less than 1, so the exponent will be **negative**.', `Move the point right until one nonzero digit is in front of it: ${coefStr(d)}.`, `Count the moves: ${-n}. So $n = ${n}$.`],
          steps: [{ text: `Move the point right ${-n} place${n === -1 ? '' : 's'} to get ${coefStr(d)}. Moving right on a small number → negative exponent.`, math: `${s} = ${sci(coefStr(d), n)}` }],
          mistakes: only(n, [
            { value: -n, say: 'Right count, wrong sign. Numbers smaller than 1 have **negative** exponents.' },
            ...(zerosAfterPoint > 0 ? [{ value: -zerosAfterPoint, say: 'You counted the zeros after the point. The point also has to jump past the first nonzero digit — one more move.' }] : []),
            { value: n - 1, say: 'One too many. The point stops right **after** the first nonzero digit.' },
          ]),
        }
      }
      // which form is correct scientific notation
      const big = rng.chance(0.5)
      const dd = d.length === 1 ? d + String(rng.int(1, 9)) : d
      const nn = big ? rng.int(3, 8) : -rng.int(2, 6)
      const ss = stdStr(dd, nn)
      const correct = `$${sci(coefStr(dd), nn)}$`
      const tooBig = `$${sci(`${dd[0]}${dd[1]}${dd.length > 2 ? '.' + dd.slice(2) : ''}`, nn - 1)}$`
      const tooSmall = `$${sci(`0.${dd}`, nn + 1)}$`
      const wrongSign = `$${sci(coefStr(dd), -nn)}$`
      const offOne = `$${sci(coefStr(dd), nn + (big ? -1 : 1))}$`
      const c = choices(rng, correct, rng.shuffle([tooBig, tooSmall, wrongSign, offOne]).slice(0, 3))
      const idx = (o: string) => c.options.indexOf(o)
      return {
        prompt: `Which is $${stdTex(ss)}$ written in scientific notation?`,
        answer: { kind: 'choice', options: c.options, correct: c.correct },
        hints: ['The front number must be at least 1 and less than 10.', `So the front number is $${coefStr(dd)}$. Now count how far the point moves.`, `The point moves ${abs(nn)} place${abs(nn) === 1 ? '' : 's'} ${big ? 'left (big number → positive exponent)' : 'right (small number → negative exponent)'}.`],
        steps: [{ text: `Front number: $${coefStr(dd)}$ (between 1 and 10).` }, { text: `Point moves ${abs(nn)} place${abs(nn) === 1 ? '' : 's'}; the number is ${big ? 'big, so the exponent is positive' : 'less than 1, so the exponent is negative'}:`, math: `${stdTex(ss)} = ${sci(coefStr(dd), nn)}` }],
        mistakes: [
          { when: (raw) => raw === String(idx(tooBig)) || raw === String(idx(tooSmall)), say: 'That has the right value, but it isn’t scientific notation: the front number must be **at least 1 and less than 10**.' },
          { when: (raw) => raw === String(idx(wrongSign)), say: big ? 'A big number needs a **positive** exponent.' : 'A number less than 1 needs a **negative** exponent.' },
          { when: (raw) => raw === String(idx(offOne)), say: 'Off by one place — count the moves again, stopping right after the first nonzero digit.' },
        ],
      }
    }
    const kind = rng.pick(['mult', 'mult', 'div', 'light'] as const)
    if (kind === 'mult' || kind === 'light') {
      const a = kind === 'light' ? 3 : rng.int(2, 9)
      const b = rng.int(2, 9)
      const m = kind === 'light' ? 8 : rng.int(2, 9) * (rng.chance(0.3) ? -1 : 1)
      const n = kind === 'light' ? rng.int(2, 3) : rng.int(2, 9)
      const prod = a * b
      const norm = prod >= 10
      const c = norm ? clean(prod / 10) : prod
      const k = m + n + (norm ? 1 : 0)
      const correct = `$${sci(c, k)}$`
      const wrongs = [`$${sci(c, m * n + (norm ? 1 : 0))}$`, norm ? `$${sci(c, m + n)}$` : `$${sci(c, m + n + 1)}$`, `$${sci(a + b >= 10 ? clean((a + b) / 10) : a + b, m + n + (a + b >= 10 ? 1 : 0))}$`, `$${sci(prod, k)}$`]
      const ch = choices(rng, correct, wrongs)
      const idx = (o: string) => ch.options.indexOf(o)
      return {
        prompt:
          kind === 'light'
            ? `Light travels about $${sci(3, 8)}$ meters per second. How far does it travel in $${sci(b, n)}$ seconds? (distance = speed × time)`
            : `Multiply, and write the answer in scientific notation: $(${sci(a, m)})(${sci(b, n)})$`,
        answer: { kind: 'choice', options: ch.options, correct: ch.correct },
        hints: ['Multiply the front numbers; **add** the exponents (because $10^m\\times10^n$ is $m + n$ tens multiplied together).', `$${a}\\times${b} = ${prod}$ and $10^{${m}}\\times10^{${n}} = 10^{${m + n}}$.`, norm ? `$${prod}$ isn’t between 1 and 10: $${prod} = ${c}\\times10^1$, so add 1 more to the exponent.` : `$${prod}$ is already between 1 and 10.`],
        steps: [
          { text: 'Group the front numbers and the powers of 10:', math: `(${a}\\times${b})\\times(10^{${m}}\\times10^{${n}}) = ${prod}\\times10^{${m + n}}` },
          ...(norm ? [{ text: `Fix the front number: $${prod} = ${c}\\times10^1$.`, math: `${prod}\\times10^{${m + n}} = ${sci(c, k)}` }] : []),
          { text: `Answer: $${sci(c, k)}$${kind === 'light' ? ' meters' : ''}.` },
        ],
        mistakes: [
          { when: (raw) => raw === String(idx(wrongs[0])), say: `Exponents **add** when you multiply powers of 10: $10^{${m}}\\times10^{${n}} = 10^{${m + n}}$, not $10^{${m * n}}$.` },
          { when: (raw) => raw === String(idx(wrongs[1])), say: norm ? `$${prod}\\times10^{${m + n}}$ must be adjusted: moving the point one place left (to $${c}$) adds 1 to the exponent.` : 'No adjustment needed here — the front number is already between 1 and 10.' },
          { when: (raw) => raw === String(idx(wrongs[2])), say: 'Multiply the front numbers — don’t add them.' },
          { when: (raw) => raw === String(idx(wrongs[3])), say: `Correct value, but $${prod}$ isn’t between 1 and 10 — that’s not scientific notation yet.` },
        ],
      }
    }
    const [a, b] = rng.pick([[8, 2], [9, 3], [6, 2], [6, 3], [8, 4], [2, 8], [3, 6], [2, 5], [4, 8], [9, 2], [7, 2], [3, 4], [1.2, 4], [4.5, 9]] as const)
    const m = rng.int(5, 12)
    const n = rng.int(2, m - 1) * (rng.chance(0.25) ? -1 : 1)
    const q = clean(a / b)
    const low = q < 1
    const c = low ? clean(q * 10) : q
    const k = m - n - (low ? 1 : 0)
    return {
      prompt: `Divide: $\\dfrac{${sci(a, m)}}{${sci(b, n)}} = ${sci(c, 'k')}$. What is $k$?`,
      answer: { kind: 'num', value: k },
      placeholder: 'e.g. 6',
      hints: ['Divide the front numbers; **subtract** the exponents (top minus bottom).', `$${a}\\div${b} = ${q}$ and $10^{${m}}\\div10^{${n}} = 10^{${m} - ${par(n)}} = 10^{${m - n}}$.`, low ? `$${q}$ is less than 1: $${q} = ${c}\\times10^{-1}$, so the exponent drops by 1.` : `$${q}$ is already between 1 and 10.`],
      steps: [
        { text: 'Divide front numbers, subtract exponents:', math: `\\frac{${a}}{${b}}\\times10^{${m} - ${par(n)}} = ${q}\\times10^{${m - n}}` },
        ...(low ? [{ text: `Fix the front number: $${q} = ${c}\\times10^{-1}$.`, math: `${q}\\times10^{${m - n}} = ${sci(c, k)}` }] : []),
        { text: `So $k = ${k}$.` },
      ],
      mistakes: only(k, [
        { value: m + n, say: 'When dividing, **subtract** the exponents (top minus bottom).' },
        ...(low ? [{ value: m - n, say: `$${q}$ isn’t between 1 and 10. Rewrite it as $${c}\\times10^{-1}$ — that lowers the exponent by 1.` }] : []),
        ...(n < 0 ? [{ value: m + n - (low ? 1 : 0), say: `Subtracting a negative exponent: $${m} - (${n}) = ${m - n}$.` }] : []),
      ]),
    }
  },
}

export const PRE: Skill[] = [intAdd, intMult, exponents, roots, ratios, proportions, pctChange, evaluate, likeTerms, oneStep, sciNotation]
