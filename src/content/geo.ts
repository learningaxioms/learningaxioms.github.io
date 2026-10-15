import type { Misconception, Problem, Rng, Skill } from '../engine/types'
import { clean, lin } from '../engine/rng'
import { parseNum } from '../engine/parse'

// GEOMETRY — shape, space and measurement. Same contract as every unit: concept cards
// (idea → explore → trap → check), then infinite generated practice with hint ladders,
// worked solutions and misconception detection. Most problems carry a diagram.

// ── helpers ────────────────────────────────────────────────────────────────
/** TeX degrees: dg(40) = "40^\circ" */
const dg = (n: number | string) => `${n}^\\circ`
/** the value of π every problem in this unit tells the student to use */
const PI = 3.14
/** kill float noise from π arithmetic: 3.14 * 3 = 9.42, not 9.4200000001 */
const c4 = (x: number) => clean(x, 4)
/** tolerance for π answers: accepts 3.14 work, calculator-π work, and rounding to the tenth */
const piTol = (x: number) => Math.max(0.05, Math.abs(x) * 0.0012)
/** misconception matcher for a rounded / π-based wrong answer */
const near = (x: number, tol = piTol(x)) => (_: string, n: number | null) => n !== null && Math.abs(n - x) <= tol
const r1 = (x: number) => Math.round(x * 10) / 10
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))
const pick2 = <T,>(rng: Rng, arr: readonly T[]): [T, T] => {
  const s = rng.shuffle(arr)
  return [s[0], s[1]]
}

/** read "(3, -2)" / "3,-2" / "(1/2, 3)" into numbers, for pair misconceptions */
function readPair(raw: string): [number, number] | null {
  const parts = raw.replace(/[()[\]]/g, '').split(/[,;]/)
  if (parts.length !== 2) return null
  const a = parseNum(parts[0])
  const b = parseNum(parts[1])
  return a && b ? [a.value, b.value] : null
}
/** misconception matcher for a specific wrong ordered pair */
const pairIs = (x: number, y: number) => (raw: string) => {
  const p = readPair(raw)
  return !!p && Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6
}
const pt = (x: number, y: number) => `(${x}, ${y})`
/** parenthesise negatives inside TeX arithmetic */
const pn = (n: number) => (n < 0 ? `(${n})` : `${n}`)

// ═══════════════════════════════════════════════════════════════════════════
// 1. ANGLE RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════════════════
const angles: Skill = {
  id: 'angles',
  unit: 'geo',
  title: 'Angle relationships',
  blurb: 'Complementary make 90°, supplementary make 180°, vertical angles match.',
  prereqs: ['sub'],
  why: 'Runway headings, roof pitches, the bank of a turn — angles fit together by a few simple rules, and those rules let you find any angle from the ones you already know.',
  learn: [
    { kind: 'idea', title: 'Angles measure turn', body: 'An angle measures how far one ray is turned away from another, in **degrees**. A full spin is $360^\\circ$. A straight line is half a spin — $180^\\circ$. A square corner (a **right angle**) is a quarter spin — $90^\\circ$.' },
    { kind: 'explore', title: 'Split a straight line', body: 'The red and blue angles share a ray. In **straight line** mode they sit on one line; in **crossing lines** mode a second line runs right through the middle.', widget: { w: 'angles' }, task: 'Drag the angle to 30°, then 120°. Does red + blue ever stop being 180°? Then switch to crossing lines — which angles always match?' },
    { kind: 'idea', title: 'Three relationships to know', body: '**Complementary**: two angles that add to $90^\\circ$ — together they fill a **corner**.\n**Supplementary**: two angles that add to $180^\\circ$ — together they fill a **straight** line.\n**Vertical**: the angles **across** from each other where two lines cross — always **equal**.', math: 'a + b = 90^\\circ \\qquad a + b = 180^\\circ \\qquad a = b' },
    { kind: 'trap', title: 'Mixing up complement and supplement', wrong: 'The complement of $35^\\circ$ is $145^\\circ$.', right: 'The complement of $35^\\circ$ is $90^\\circ - 35^\\circ = 55^\\circ$. ($145^\\circ$ is its **supplement**.)', why: 'Memory hook: **C**omplementary = **C**orner (90°), **S**upplementary = **S**traight (180°). C comes before S in the alphabet, just like 90 comes before 180.' },
    { kind: 'idea', title: 'Why vertical angles are equal', body: 'Where two lines cross, angle $a$ and its neighbour $n$ sit on a straight line, so $a = 180^\\circ - n$. The angle **across** from $a$ also sits on a straight line with that same neighbour, so it is **also** $180^\\circ - n$. Same recipe, same answer — they have to be equal.' },
    { kind: 'check', question: 'Two lines cross and one of the four angles is $70^\\circ$. What is the angle **right next to it**?', options: ['$110^\\circ$', '$70^\\circ$', '$20^\\circ$', '$290^\\circ$'], correct: 0, explain: 'Neighbours share a straight line, so they’re supplementary: $180 - 70 = 110$. It’s the angle **across** from it that equals $70^\\circ$.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      const kind = rng.pick(['comp', 'supp', 'vert', 'name'] as const)
      if (kind === 'comp') {
        const a = rng.int(12, 78)
        const x = 90 - a
        return {
          prompt: `The two angles in the corner are **complementary**. One measures $${dg(a)}$. Find $x$.`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: ['Complementary angles fill a right angle — a square corner.', `So the two angles add to $${dg(90)}$: $${a} + x = 90$.`, `$x = 90 - ${a}$`],
          steps: [
            { text: 'Complementary angles add to $90^\\circ$:', math: `${a} + x = 90` },
            { text: 'Take the known angle away from 90:', math: `x = 90 - ${a} = ${x}` },
            { text: `So $x = ${dg(x)}$. Check: $${a} + ${x} = 90$ ✓` },
          ],
          mistakes: [
            { value: 180 - a, say: 'That’s the **supplement** (it adds to 180°). Complementary angles fill a **corner**, so they add to **90°**.' },
            { value: 90 + a, say: 'You added. The two angles **together** make 90°, so subtract the known angle from 90.' },
          ],
          visual: { type: 'angles', kind: 'comp', labels: rng.chance(0.5) ? [`${a}°`, 'x'] : ['x', `${a}°`] },
        }
      }
      if (kind === 'supp') {
        let a = rng.int(15, 165)
        if (a === 90) a = 91
        const x = 180 - a
        return {
          prompt: `The two angles sit on a straight line, so they are **supplementary**. One measures $${dg(a)}$. Find $x$.`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: ['A straight line is half a full turn.', `Supplementary angles add to $${dg(180)}$: $${a} + x = 180$.`, `$x = 180 - ${a}$`],
          steps: [
            { text: 'Angles on a straight line add to $180^\\circ$:', math: `${a} + x = 180` },
            { text: 'Subtract:', math: `x = 180 - ${a} = ${x}` },
            { text: `So $x = ${dg(x)}$. Check: $${a} + ${x} = 180$ ✓` },
          ],
          mistakes: [
            ...(a < 90 ? [{ value: 90 - a, say: 'That’s the **complement** (adds to 90°). A straight line is **180°**.' }] : []),
            { value: 360 - a, say: '360° is a full turn. Angles on a straight line only make a **half** turn: 180°.' },
          ],
          visual: { type: 'angles', kind: 'supp', labels: a < 90 ? [`${a}°`, 'x'] : ['x', `${a}°`] },
        }
      }
      if (kind === 'vert') {
        let a = rng.int(20, 160)
        if (a === 90) a = 89
        return {
          prompt: `Two straight lines cross. The angle on one side is $${dg(a)}$. Find the angle $x$ directly **across** from it.`,
          answer: { kind: 'num', value: a },
          placeholder: 'degrees',
          hints: ['Angles directly across from each other at a crossing are called **vertical angles**.', 'Vertical angles are always **equal**.', `So $x$ is the same as $${dg(a)}$.`],
          steps: [
            { text: 'The two marked angles are across from each other — **vertical angles**.' },
            { text: 'Vertical angles are equal:', math: `x = ${a}^\\circ` },
            { text: `(Each **neighbour** would be $180 - ${a} = ${180 - a}^\\circ$ — that’s a different angle.)` },
          ],
          mistakes: [
            { value: 180 - a, say: 'That’s the angle **next to** it (they make a straight line). The angle **across** the crossing is equal to the one you’re given.' },
            { value: 360 - a, say: 'No subtraction needed here — vertical angles are simply equal.' },
          ],
          visual: { type: 'angles', kind: 'vert', labels: rng.chance(0.5) ? [`${a}°`, 'x'] : ['x', `${a}°`] },
        }
      }
      // name the relationship
      const rel = rng.pick(['comp', 'supp', 'none'] as const)
      let a = rng.int(15, 75)
      if (a === 45) a = 44
      let b: number
      if (rel === 'comp') b = 90 - a
      else if (rel === 'supp') b = 180 - a
      else {
        do b = rng.int(20, 150)
        while (a + b === 90 || a + b === 180 || b === a)
      }
      const opts = rng.shuffle(['Complementary', 'Supplementary', 'Vertical angles', 'None of these'])
      const want = rel === 'comp' ? 'Complementary' : rel === 'supp' ? 'Supplementary' : 'None of these'
      const sum = a + b
      return {
        prompt: `Two angles measure $${dg(a)}$ and $${dg(b)}$. Which word describes this pair?`,
        answer: { kind: 'choice', options: opts, correct: opts.indexOf(want) },
        hints: ['Add the two angles together.', 'Complementary pairs add to $90^\\circ$. Supplementary pairs add to $180^\\circ$. Vertical angles are equal.', `$${a} + ${b} = ${sum}$`],
        steps: [
          { text: 'Add them:', math: `${a} + ${b} = ${sum}` },
          { text: rel === 'comp' ? 'They add to $90^\\circ$ — they would fill a corner. **Complementary.**' : rel === 'supp' ? 'They add to $180^\\circ$ — they would fill a straight line. **Supplementary.**' : `$${sum}$ is neither 90 nor 180, and the angles aren’t equal, so **none of these** fit.` },
        ],
        mistakes: [
          { when: (raw) => raw === String(opts.indexOf('Complementary')), say: `Complementary angles add to exactly **90°**. These add to ${sum}°.` },
          { when: (raw) => raw === String(opts.indexOf('Supplementary')), say: `Supplementary angles add to exactly **180°**. These add to ${sum}°.` },
          { when: (raw) => raw === String(opts.indexOf('Vertical angles')), say: 'Vertical angles are **equal** — these two are different sizes.' },
          { when: (raw) => raw === String(opts.indexOf('None of these')), say: `Add them: ${a} + ${b} = ${sum}. Does that number ring a bell?` },
        ],
      }
    }

    if (level === 2) {
      const kind = rng.pick(['around', 'line3', 'cross', 'runway', 'heading'] as const)
      if (kind === 'around') {
        let a: number, b: number, c: number, x: number
        do {
          a = rng.int(40, 130)
          b = rng.int(35, 120)
          c = rng.int(30, 110)
          x = 360 - a - b - c
        } while (x < 20 || x > 170)
        const known = a + b + c
        return {
          prompt: `Four angles meet at a point and fill the full turn around it. Three of them are $${dg(a)}$, $${dg(b)}$ and $${dg(c)}$. Find the fourth angle.`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: ['Angles all the way around a point make one full turn.', 'A full turn is $360^\\circ$. Add up what you know first.', `$${a} + ${b} + ${c} = ${known}$. How much more to reach 360?`],
          steps: [
            { text: 'Angles around a point add to $360^\\circ$.' },
            { text: 'Add the known angles:', math: `${a} + ${b} + ${c} = ${known}` },
            { text: 'Subtract from a full turn:', math: `360 - ${known} = ${x}` },
          ],
          mistakes: [
            { value: 180 - known, say: '180° is only a straight line. Angles **all the way around** a point make a full turn: 360°.' },
            { value: known, say: 'That’s the total of the three you were given. Subtract it from 360° to find what’s left.' },
          ],
        }
      }
      if (kind === 'line3') {
        let a: number, b: number, x: number
        do {
          a = rng.int(20, 100)
          b = rng.int(20, 120)
          x = 180 - a - b
        } while (x < 15)
        return {
          prompt: `Three angles sit side by side along a straight line. Two of them are $${dg(a)}$ and $${dg(b)}$. Find the third.`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: ['All the angles along one side of a straight line add to the same total, however many there are.', 'They add to $180^\\circ$.', `$180 - ${a} - ${b} = \\;?$`],
          steps: [
            { text: 'Angles on a straight line add to $180^\\circ$ — even when there are three of them.', math: `${a} + ${b} + x = 180` },
            { text: 'Combine what you know:', math: `${a + b} + x = 180` },
            { text: 'Subtract:', math: `x = 180 - ${a + b} = ${x}` },
          ],
          mistakes: [
            { value: 360 - a - b, say: '360° is a full turn. Angles along a straight line make only a **half** turn: 180°.' },
            ...(a + b < 90 ? [{ value: 90 - a - b, say: '90° is a corner. A straight line is 180°.' }] : []),
            { value: a + b, say: 'That’s the two given angles added. The third angle is whatever is **left** of the 180°.' },
          ],
        }
      }
      if (kind === 'cross') {
        let a = rng.int(25, 155)
        if (a === 90) a = 88
        const across = rng.chance(0.4)
        const x = across ? a : 180 - a
        return {
          prompt: across
            ? `Two lines cross, making four angles. One of them is $${dg(a)}$. What is the angle **directly across** from it?`
            : `Two lines cross, making four angles. One of them is $${dg(a)}$. What is the angle **right next to** it?`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: across
            ? ['Across from each other at a crossing = vertical angles.', 'Vertical angles are always equal.', `The answer is the same as the given angle.`]
            : ['Neighbouring angles at a crossing share one of the straight lines.', 'Angles on a straight line are supplementary — they add to $180^\\circ$.', `$180 - ${a} = \\;?$`],
          steps: across
            ? [{ text: 'The angle across a crossing is the **vertical angle** — always equal.', math: `x = ${a}^\\circ` }, { text: `(Its two neighbours are each $180 - ${a} = ${180 - a}^\\circ$.)` }]
            : [{ text: 'The neighbour shares a straight line with the given angle, so they’re supplementary:', math: `x + ${a} = 180` }, { text: 'Subtract:', math: `x = 180 - ${a} = ${x}` }, { text: `(The angle **across** from $${dg(a)}$ is also $${dg(a)}$ — vertical angles match.)` }],
          mistakes: across
            ? [{ value: 180 - a, say: 'That’s a **neighbouring** angle. The one directly **across** is a vertical angle — equal to the original.' }]
            : [
                { value: a, say: 'That’s the angle **across** the crossing (vertical angles are equal). The neighbour shares a straight line, so it’s $180^\\circ$ minus the angle.' },
                { value: 360 - a, say: 'Neighbours share a straight line (180°), not a full turn (360°).' },
              ],
          visual: across ? { type: 'angles', kind: 'vert', labels: [`${a}°`, 'x'] } : { type: 'angles', kind: 'supp', labels: a < 90 ? [`${a}°`, 'x'] : ['x', `${a}°`] },
        }
      }
      if (kind === 'runway') {
        let a = rng.int(25, 155)
        if (a === 90) a = 92
        const x = 180 - a
        return {
          prompt: `A taxiway meets a straight runway. On one side, the angle between them is $${dg(a)}$. What is the angle on the **other** side, along the same runway?`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: ['The runway is a straight line, and the taxiway splits it into two angles.', 'Those two angles are supplementary.', `$180 - ${a} = \\;?$`],
          steps: [
            { text: 'The two angles together make the straight runway: $180^\\circ$.', math: `${a} + x = 180` },
            { text: 'Subtract:', math: `x = ${x}^\\circ` },
          ],
          mistakes: [
            ...(a < 90 ? [{ value: 90 - a, say: 'That would fill a corner (90°). The runway is a straight line — **180°**.' }] : []),
            { value: a, say: 'The two sides only match if the taxiway is perpendicular. Here they must add to 180°.' },
          ],
          visual: { type: 'angles', kind: 'supp', labels: a < 90 ? [`${a}°`, 'x'] : ['x', `${a}°`] },
        }
      }
      // heading: complementary in disguise
      const a = rng.int(10, 80)
      const x = 90 - a
      return {
        prompt: `A pilot is heading $${dg(a)}$ east of due north. How many more degrees must she turn (toward the east) to fly **due east**?`,
        answer: { kind: 'num', value: x },
        placeholder: 'degrees',
        hints: ['Sketch it: north is straight up, east is straight right.', 'North and east are a quarter turn apart — $90^\\circ$. Her heading splits that corner into two parts.', `The two parts are complementary: $${a} + x = 90$.`],
        steps: [
          { text: 'North to east is a right angle, $90^\\circ$. Her heading splits it into two complementary parts.', math: `${a} + x = 90` },
          { text: 'Subtract:', math: `x = 90 - ${a} = ${x}` },
        ],
        mistakes: [
          { value: 180 - a, say: 'North to east is a quarter turn (90°), not a half turn. Use 90°.' },
          { value: a, say: 'That’s how far she has already turned from north. How much is **left** to reach east?' },
        ],
        visual: { type: 'angles', kind: 'comp', labels: [`x`, `${a}°`] },
      }
    }

    // level 3: algebra with angle relationships
    const kind = rng.pick(['alg-supp', 'alg-comp', 'alg-vert', 'ratio'] as const)
    if (kind === 'alg-supp' || kind === 'alg-comp') {
      const T = kind === 'alg-supp' ? 180 : 90
      const other = 270 - T
      let k: number, x: number, c: number
      do {
        k = rng.int(2, 4)
        x = rng.int(5, Math.floor(T / (k + 1)) + 8)
        c = T - (k + 1) * x
      } while (c === 0 || Math.abs(c) > 40 || k * x + c <= 5 || x <= 5)
      const big = k * x + c
      const askAngle = rng.chance(0.5)
      const larger = Math.max(x, big)
      const smaller = Math.min(x, big)
      const name = T === 180 ? 'supplementary' : 'complementary'
      const expr = lin(k, c)
      const mist: Misconception[] = askAngle
        ? [
            x === smaller
              ? { value: x, say: `That’s $x$ — which here is also the **smaller** angle. Substitute $x = ${x}$ into $${expr}$ to get the larger one.` }
              : { value: x, say: `That’s $x$. The question asks for the **angle** — substitute $x = ${x}$ back into both expressions and take the larger one.` },
            ...(smaller !== larger && smaller !== x ? [{ value: smaller, say: 'That’s the **smaller** angle. The question asks for the larger one.' }] : []),
          ]
        : [
            { value: (T + c) / (k + 1), say: `Sign slip: to move the ${c > 0 ? '+' : '−'}${Math.abs(c)} to the other side you must ${c > 0 ? 'subtract' : 'add'} it.` },
            { value: (T - c) / k, say: `Don’t forget the lone $x$: $x + ${k}x = ${k + 1}x$, not $${k}x$.` },
            { value: (other - c) / (k + 1), say: `${name[0].toUpperCase() + name.slice(1)} angles add to **${T}°**, not ${other}°.` },
          ]
      return {
        prompt: `Two angles are **${name}**. One measures $${dg('x')}$ and the other measures $(${expr})^\\circ$. Find ${askAngle ? 'the measure of the **larger** angle' : '$x$'}.`,
        answer: { kind: 'num', value: askAngle ? larger : x },
        placeholder: askAngle ? 'degrees' : 'x = ?',
        hints: [`${name[0].toUpperCase() + name.slice(1)} means the two angles add to $${dg(T)}$.`, `Write the equation: $x + (${expr}) = ${T}$. Combine the $x$ terms.`, `$${k + 1}x ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${T}$, so $${k + 1}x = ${T - c}$.${askAngle ? ' Then plug $x$ back in.' : ''}`],
        steps: [
          { text: `${name[0].toUpperCase() + name.slice(1)} angles add to $${dg(T)}$:`, math: `x + (${expr}) = ${T}` },
          { text: 'Combine like terms:', math: `${k + 1}x ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${T}` },
          { text: `${c < 0 ? 'Add' : 'Subtract'} ${Math.abs(c)}, then divide by ${k + 1}:`, math: `${k + 1}x = ${T - c} \\;\\Rightarrow\\; x = ${x}` },
          { text: 'Find both angles:', math: `x = ${x}^\\circ,\\quad ${k}(${x}) ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${big}^\\circ` },
          { text: `Check: $${x} + ${big} = ${T}$ ✓${askAngle ? ` The larger angle is **${larger}°**.` : ''}` },
        ],
        mistakes: mist,
        visual: { type: 'angles', kind: T === 180 ? 'supp' : 'comp', labels: T === 180 && x > big ? [`(${expr})°`, 'x°'] : ['x°', `(${expr})°`] },
      }
    }
    if (kind === 'alg-vert') {
      let x: number, p: number, q: number, b: number, d: number, ang: number
      do {
        x = rng.int(5, 25)
        ;[p, q] = pick2(rng, [2, 3, 4, 5, 6])
        b = rng.int(-20, 30)
        ang = p * x + b
        d = ang - q * x
      } while (ang < 20 || ang > 160 || ang === 90 || d === 0 || b === 0)
      const askAngle = rng.chance(0.5)
      const L = lin(p, b)
      const R = lin(q, d)
      const big = Math.max(p, q)
      const small = Math.min(p, q)
      const [bigC, smallC] = p > q ? [b, d] : [d, b]
      return {
        prompt: `Two lines cross. A pair of **vertical angles** measure $(${L})^\\circ$ and $(${R})^\\circ$. Find ${askAngle ? 'the measure of each of these angles' : '$x$'}.`,
        answer: { kind: 'num', value: askAngle ? ang : x },
        placeholder: askAngle ? 'degrees' : 'x = ?',
        hints: ['Vertical angles are **equal** — so set the two expressions equal.', `$${L} = ${R}$. Get the $x$ terms on one side.`, `Subtract $${small}x$ from both sides: $${big - small}x ${bigC < 0 ? '-' : '+'} ${Math.abs(bigC)} = ${smallC}$.${askAngle ? ' Then substitute $x$ back.' : ''}`],
        steps: [
          { text: 'Vertical angles are equal:', math: `${L} = ${R}` },
          { text: `Subtract $${small}x$ from both sides:`, math: `${lin(big - small, bigC)} = ${smallC}` },
          { text: 'Solve:', math: `${big - small === 1 ? '' : big - small}x = ${smallC - bigC} \\;\\Rightarrow\\; x = ${x}` },
          { text: 'Substitute to get the angle:', math: `${p}(${x}) ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${ang}^\\circ` },
          { text: `Both angles are **${ang}°** ✓` },
        ],
        mistakes: askAngle
          ? [{ value: x, say: `That’s $x$. Plug $x = ${x}$ into either expression to get the angle.` }, { value: 180 - ang, say: 'That’s the neighbouring angle. The vertical angles themselves equal the expressions.' }]
          : [
              { value: (smallC + bigC) / (big - small), say: 'Sign slip when moving the constant across. Do the same operation to both sides.' },
              { value: (smallC - bigC) / (big + small), say: 'When you move an $x$ term across, you **subtract** it — so the coefficients subtract too.' },
              { value: ang, say: 'That’s the angle, not $x$. The question asks for $x$.' },
            ],
        visual: { type: 'angles', kind: 'vert', labels: [`(${L})°`, `(${R})°`] },
      }
    }
    // ratio
    const T = rng.pick([90, 180])
    const pairs: [number, number][] = []
    for (let m = 1; m <= 9; m++) for (let n = m + 1; n <= 13; n++) if (T % (m + n) === 0 && gcdSmall(m, n) === 1) pairs.push([m, n])
    const [m, n] = rng.pick(pairs)
    const part = T / (m + n)
    const askLarger = rng.chance(0.6)
    const ans = (askLarger ? n : m) * part
    const name = T === 180 ? 'supplementary' : 'complementary'
    return {
      prompt: `Two **${name}** angles are in the ratio $${m}:${n}$. What is the ${askLarger ? 'larger' : 'smaller'} angle?`,
      answer: { kind: 'num', value: ans },
      placeholder: 'degrees',
      hints: [`${name[0].toUpperCase() + name.slice(1)} angles add to $${dg(T)}$.`, `A ratio of $${m}:${n}$ means $${m + n}$ equal parts in total.`, `Each part is $${T} \\div ${m + n} = ${part}^\\circ$.`],
      steps: [
        { text: `The angles are $${m}k$ and $${n}k$, and they add to $${T}$:`, math: `${m}k + ${n}k = ${T} \\Rightarrow ${m + n}k = ${T} \\Rightarrow k = ${part}` },
        { text: 'Multiply out:', math: `${m}(${part}) = ${m * part}^\\circ,\\quad ${n}(${part}) = ${n * part}^\\circ` },
        { text: `The ${askLarger ? 'larger' : 'smaller'} angle is **${ans}°**. Check: $${m * part} + ${n * part} = ${T}$ ✓` },
      ],
      mistakes: [
        { value: part, say: `That’s the size of **one part**. Multiply by ${askLarger ? n : m} to get the angle.` },
        { value: (askLarger ? m : n) * part, say: `That’s the ${askLarger ? 'smaller' : 'larger'} angle — re-read which one is asked for.` },
        { value: ((askLarger ? n : m) * (270 - T)) / (m + n), say: `${name[0].toUpperCase() + name.slice(1)} angles add to **${T}°**, not ${270 - T}°.` },
      ],
    }
  },
}

function gcdSmall(a: number, b: number): number {
  return b ? gcdSmall(b, a % b) : a
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. TRIANGLE ANGLE SUM
// ═══════════════════════════════════════════════════════════════════════════
const triAngles: Skill = {
  id: 'tri-angles',
  unit: 'geo',
  title: 'Angles in a triangle',
  blurb: 'The three angles always add to 180°. Isosceles base angles match.',
  prereqs: ['angles'],
  why: 'Triangles are the strongest shape in engineering — truss bridges, roof frames and aircraft wing ribs are built from them — and every triangle obeys the same 180° rule.',
  learn: [
    { kind: 'idea', title: 'The 180° rule', body: 'In **every** triangle — tall, flat, tiny or huge — the three inside angles add to exactly $180^\\circ$. If you know two angles, the third is forced.', math: 'A + B + C = 180^\\circ' },
    { kind: 'explore', title: 'Try to break the rule', body: 'Drag any corner of the triangle. Watch the three colored angles, and the strip underneath that lines them up end to end.', widget: { w: 'triangle' }, task: 'Make one angle huge (over 150°). What happens to the other two? Can you ever get the total above 180°?' },
    { kind: 'idea', title: 'Why it’s always 180°', body: 'Draw a line through the top corner, parallel to the bottom side. The top angle plus the two angles beside it now sit along that **straight line** — and those side angles exactly copy the triangle’s two bottom angles. Three angles on a straight line: $180^\\circ$. (Tear the corners off a paper triangle and they line up the same way.)' },
    { kind: 'idea', title: 'Special triangles', body: '**Isosceles**: two equal sides, so the two **base angles** (opposite those sides) are equal.\n**Equilateral**: all sides equal, so every angle is $180 \\div 3 = 60^\\circ$.\n**Right**: one angle is $90^\\circ$, so the other two must share the remaining $90^\\circ$.' },
    { kind: 'trap', title: 'Isosceles: splitting the wrong amount', wrong: 'The top angle is $40^\\circ$, so each base angle is $180 - 40 = 140^\\circ$.', right: '$180 - 40 = 140^\\circ$ is **both** base angles together. Each one is $140 \\div 2 = 70^\\circ$.', why: 'Two angles of 140° would already add to 280° — way past 180°. Always sanity-check: the three angles must total 180°.' },
    { kind: 'check', question: 'Can a triangle have two right angles?', options: ['No — two 90° angles already use up all 180°', 'Yes, if it’s big enough', 'Yes, if it’s isosceles', 'Only in a right triangle'], correct: 0, explain: '$90 + 90 = 180$, leaving $0^\\circ$ for the third corner — the sides would be parallel and never meet.' },
  ],
  generate(rng, level) {
    if (level === 1) {
      if (rng.chance(0.7)) {
        let a: number, b: number, c: number
        do {
          a = rng.int(25, 110)
          b = rng.int(20, 130)
          c = 180 - a - b
        } while (c < 15)
        const vals = [a, b, c]
        const idx = rng.int(0, 2)
        const x = vals[idx]
        const [p, q] = vals.filter((_, i) => i !== idx)
        return {
          prompt: `Two angles of a triangle are $${dg(p)}$ and $${dg(q)}$. Find the third angle, $x$.`,
          answer: { kind: 'num', value: x },
          placeholder: 'degrees',
          hints: ['The three angles of any triangle add to the same total.', `They add to $${dg(180)}$. Start by adding the two you know.`, `$${p} + ${q} = ${p + q}$. What’s left of 180?`],
          steps: [
            { text: 'The angles of a triangle add to $180^\\circ$:', math: `${p} + ${q} + x = 180` },
            { text: 'Add the known angles:', math: `${p + q} + x = 180` },
            { text: 'Subtract:', math: `x = 180 - ${p + q} = ${x}` },
          ],
          mistakes: [
            { value: 360 - p - q, say: '360° is the total for a four-sided shape (or a full turn). A triangle’s angles add to **180°**.' },
            { value: p + q, say: 'That’s the two known angles added together. The third angle is what’s **left** of 180°.' },
            ...(p + q < 90 ? [{ value: 90 - p - q, say: 'Triangle angles add to 180°, not 90°.' }] : []),
          ],
          visual: { type: 'tri', angles: [0, 1, 2].map((i) => (i === idx ? 'x' : `${vals[i]}°`)) as [string, string, string] },
        }
      }
      const a = rng.int(15, 75)
      const top = rng.chance(0.5)
      return {
        prompt: `In this **right** triangle, one of the acute angles is $${dg(a)}$. Find the other acute angle, $x$.`,
        answer: { kind: 'num', value: 90 - a },
        placeholder: 'degrees',
        hints: ['The little square marks a right angle. How many degrees is that?', 'The right angle is $90^\\circ$, so the other two angles share the remaining $180 - 90 = 90^\\circ$.', `$90 - ${a} = \\;?$`],
        steps: [
          { text: 'All three angles add to $180^\\circ$, and one is the right angle:', math: `90 + ${a} + x = 180` },
          { text: 'Combine and subtract:', math: `x = 180 - ${90 + a} = ${90 - a}` },
          { text: 'Shortcut for next time: the two acute angles of a right triangle are **complementary** (they add to 90°).' },
        ],
        mistakes: [
          { value: 180 - a, say: 'You forgot the right angle. It uses up 90° of the 180°, so subtract it too.' },
          { value: a, say: 'The two acute angles are only equal when both are 45°. Use the 180° rule.' },
        ],
        visual: { type: 'tri', right: true, angles: top ? ['', `${a}°`, 'x'] : ['', 'x', `${a}°`] },
      }
    }

    if (level === 2) {
      const kind = rng.pick(['iso-base', 'iso-vertex', 'iso-obtuse', 'ladder', 'equi-ext'] as const)
      if (kind === 'iso-base') {
        const v = 2 * rng.int(10, 75)
        const base = (180 - v) / 2
        return {
          prompt: `This triangle is **isosceles** (the two marked sides are equal). The angle between the equal sides is $${dg(v)}$. Find one base angle, $x$.`,
          answer: { kind: 'num', value: base },
          placeholder: 'degrees',
          hints: ['In an isosceles triangle the two **base angles** (at the ends of the third side) are equal.', `First find how much is left for the base angles together: $180 - ${v}$.`, `$180 - ${v} = ${180 - v}$, shared equally between two angles.`],
          steps: [
            { text: 'Angles add to $180^\\circ$, and the two base angles are equal:', math: `${v} + x + x = 180` },
            { text: 'Subtract the top angle:', math: `2x = ${180 - v}` },
            { text: 'Split evenly:', math: `x = ${180 - v} \\div 2 = ${base}` },
          ],
          mistakes: [
            { value: 180 - v, say: `${180 - v}° is what’s left for **both** base angles together. Split it between the two equal angles.` },
            { value: v, say: 'The **base** angles match each other — not the top angle.' },
          ],
          visual: { type: 'tri', angles: ['x', `${v}°`, 'x'], ticks: [true, true, false] },
        }
      }
      if (kind === 'iso-vertex') {
        let b = rng.int(20, 85)
        if (b === 60) b = 61
        const v = 180 - 2 * b
        return {
          prompt: `An **isosceles** triangle has base angles of $${dg(b)}$ each. Find the angle at the top, $x$, between the equal sides.`,
          answer: { kind: 'num', value: v },
          placeholder: 'degrees',
          hints: ['Both base angles are given — that’s two angles, not one.', `The base angles together are $${b} + ${b} = ${2 * b}^\\circ$.`, `$180 - ${2 * b} = \\;?$`],
          steps: [
            { text: 'Add both base angles:', math: `${b} + ${b} = ${2 * b}` },
            { text: 'The rest of the 180° goes to the top angle:', math: `x = 180 - ${2 * b} = ${v}` },
          ],
          mistakes: [
            { value: 180 - b, say: 'There are **two** base angles of that size — subtract both from 180°.' },
            { value: (180 - b) / 2, say: 'Only the top angle is unknown here. Subtract **both** base angles from 180°, no halving needed.' },
          ],
          visual: { type: 'tri', angles: [`${b}°`, 'x', `${b}°`], ticks: [true, true, false] },
        }
      }
      if (kind === 'iso-obtuse') {
        const v = 2 * rng.int(46, 84)
        const base = (180 - v) / 2
        return {
          prompt: `An isosceles triangle has one angle of $${dg(v)}$. What is the size of each of the other two angles?`,
          answer: { kind: 'num', value: base },
          placeholder: 'degrees',
          hints: [`Could there be **two** angles of $${dg(v)}$? Add them up and see.`, `$${v} + ${v} > 180$, so $${dg(v)}$ must be the single top angle — the other two are the equal base angles.`, `They share $180 - ${v} = ${180 - v}^\\circ$ equally.`],
          steps: [
            { text: `Two angles of $${dg(v)}$ would total $${2 * v}^\\circ$ — impossible. So $${dg(v)}$ is the one odd angle, and the other two are equal.` },
            { text: 'They share what’s left:', math: `180 - ${v} = ${180 - v}` },
            { text: 'Each one:', math: `${180 - v} \\div 2 = ${base}^\\circ` },
          ],
          mistakes: [
            { value: v, say: `If two angles were ${v}°, they’d already add to ${2 * v}° — more than 180°. The ${v}° angle must be the odd one out.` },
            { value: 180 - v, say: 'That’s the two remaining angles **together**. They’re equal, so halve it.' },
            { value: 180 - 2 * v, say: `That’s negative — a sign that ${v}° can’t appear twice. Make it the top angle instead.` },
          ],
          visual: { type: 'tri', angles: ['x', `${v}°`, 'x'], ticks: [true, true, false] },
        }
      }
      if (kind === 'ladder') {
        const a = rng.int(50, 82)
        return {
          prompt: `A ladder leans against a vertical wall and makes an angle of $${dg(a)}$ with the level ground. What angle does the ladder make with the **wall**?`,
          answer: { kind: 'num', value: 90 - a },
          placeholder: 'degrees',
          hints: ['The wall, the ground and the ladder make a triangle.', 'The wall meets the ground at a right angle, $90^\\circ$.', `$180 - 90 - ${a} = \\;?$`],
          steps: [
            { text: 'Wall + ground + ladder form a right triangle (wall ⟂ ground).' },
            { text: 'Use the 180° rule:', math: `90 + ${a} + x = 180` },
            { text: 'Solve:', math: `x = 180 - ${90 + a} = ${90 - a}^\\circ` },
          ],
          mistakes: [
            { value: 180 - a, say: 'Don’t forget the right angle where the wall meets the ground — it takes 90° of the 180°.' },
            { value: a, say: 'That’s the angle with the ground. The angle at the wall is the **other** acute angle.' },
          ],
          visual: { type: 'tri', right: true, angles: ['', 'x', `${a}°`], sides: ['wall', 'ladder', 'ground'] },
        }
      }
      // equilateral / mixed: two angles given with one obtuse
      let a: number, b: number, c: number
      do {
        a = rng.int(95, 140)
        b = rng.int(10, 60)
        c = 180 - a - b
      } while (c < 8)
      return {
        prompt: `A triangle has an obtuse angle of $${dg(a)}$ and another angle of $${dg(b)}$. Find the third angle.`,
        answer: { kind: 'num', value: c },
        placeholder: 'degrees',
        hints: ['Obtuse just means bigger than $90^\\circ$. The 180° rule still holds.', `Add the two known angles: $${a} + ${b}$.`, `$180 - ${a + b} = \\;?$`],
        steps: [
          { text: 'Add the known angles:', math: `${a} + ${b} = ${a + b}` },
          { text: 'Subtract from 180:', math: `180 - ${a + b} = ${c}` },
        ],
        mistakes: [
          { value: 360 - a - b, say: 'A triangle’s angles add to 180°, not 360°.' },
          { value: a - b, say: 'Subtract **both** known angles from 180°.' },
        ],
        visual: { type: 'tri', angles: ['x', `${a}°`, `${b}°`] },
      }
    }

    // level 3
    const kind = rng.pick(['exterior', 'exterior-rev', 'alg', 'alg-iso'] as const)
    if (kind === 'exterior') {
      let a: number, b: number
      do {
        a = rng.int(25, 95)
        b = rng.int(20, 90)
      } while (a + b >= 170 || a === b)
      const ext = a + b
      return {
        prompt: `A triangle has interior angles of $${dg(a)}$ and $${dg(b)}$ at two of its corners. The side at the third corner is extended past the triangle, making an **exterior angle** there. How big is that exterior angle?`,
        answer: { kind: 'num', value: ext },
        placeholder: 'degrees',
        hints: ['First find the interior angle at the third corner.', `Interior angle: $180 - ${a} - ${b} = ${180 - ext}^\\circ$. The exterior angle sits next to it on a straight line.`, `Exterior $= 180 - ${180 - ext}$. (Notice anything about $${a} + ${b}$?)`],
        steps: [
          { text: 'Interior angle at the third corner:', math: `180 - ${a} - ${b} = ${180 - ext}` },
          { text: 'The exterior angle makes a straight line with it:', math: `180 - ${180 - ext} = ${ext}` },
          { text: `**Shortcut:** an exterior angle always equals the sum of the two far-away interior angles: $${a} + ${b} = ${ext}$.` },
        ],
        mistakes: [
          { value: 180 - ext, say: 'That’s the **interior** angle at the third corner. The exterior angle is outside — on the straight line next to it.' },
          { value: 360 - ext, say: 'Close idea, wrong total. The exterior angle plus the interior angle make a straight line: 180°.' },
        ],
        visual: { type: 'tri', angles: [`${a}°`, `${b}°`, ''] },
      }
    }
    if (kind === 'exterior-rev') {
      let a: number, ext: number
      do {
        a = rng.int(20, 80)
        ext = rng.int(a + 20, 165)
      } while (ext - a < 15)
      const b = ext - a
      return {
        prompt: `An exterior angle of a triangle measures $${dg(ext)}$. One of the two interior angles **not** next to it is $${dg(a)}$. Find the other one.`,
        answer: { kind: 'num', value: b },
        placeholder: 'degrees',
        hints: ['An exterior angle equals the sum of the two far-away (remote) interior angles.', `So $${a} + x = ${ext}$.`, `$x = ${ext} - ${a}$`],
        steps: [
          { text: 'Exterior angle = sum of the two remote interior angles:', math: `${a} + x = ${ext}` },
          { text: 'Subtract:', math: `x = ${b}^\\circ` },
          { text: `Check the long way: the interior angle next to the exterior is $180 - ${ext} = ${180 - ext}$, and $${a} + ${b} + ${180 - ext} = 180$ ✓` },
        ],
        mistakes: [
          { value: 180 - ext, say: 'That’s the interior angle **next to** the exterior angle. You want a far-away corner.' },
          { value: 180 - ext - a, say: 'The exterior angle already equals the sum of the two remote angles — just subtract the one you know from it.' },
          { value: 180 - a, say: 'Use the exterior-angle rule: remote angles add up to the exterior angle.' },
        ],
      }
    }
    if (kind === 'alg') {
      let x: number, k: [number, number, number], c: [number, number, number], angs: number[]
      do {
        x = rng.int(8, 30)
        k = [rng.int(1, 4), rng.int(1, 5), rng.int(1, 5)]
        c = [0, rng.int(-20, 25), 0]
        c[2] = 180 - (k[0] + k[1] + k[2]) * x - c[0] - c[1]
        angs = k.map((ki, i) => ki * x + c[i])
      } while (angs.some((a) => a < 10 || a > 150) || Math.abs(c[2]) > 40 || k[1] === k[2])
      const askAngle = rng.chance(0.5)
      const K = k[0] + k[1] + k[2]
      const C = c[0] + c[1] + c[2]
      const exprs = k.map((ki, i) => lin(ki, c[i]))
      const biggest = Math.max(...angs)
      return {
        prompt: `The angles of a triangle measure $${exprs.map((e) => `(${e})^\\circ`).join(',\\ ')}$. Find ${askAngle ? 'the **largest** angle' : '$x$'}.`,
        answer: { kind: 'num', value: askAngle ? biggest : x },
        placeholder: askAngle ? 'degrees' : 'x = ?',
        hints: ['The three angles add to $180^\\circ$ — write that as an equation.', `Add the expressions: the $x$ terms give $${K}x$ and the numbers give $${C}$.`, `$${lin(K, C)} = 180$, so $${K}x = ${180 - C}$.${askAngle ? ' Then substitute $x$ into each expression.' : ''}`],
        steps: [
          { text: 'Angles add to 180:', math: `${exprs.map((e) => `(${e})`).join(' + ')} = 180` },
          { text: 'Combine like terms:', math: `${lin(K, C)} = 180` },
          { text: 'Solve:', math: `${K}x = ${180 - C} \\;\\Rightarrow\\; x = ${x}` },
          { text: 'Substitute to get each angle:', math: angs.map((a) => `${a}^\\circ`).join(',\\ ') },
          { text: `Check: $${angs.join(' + ')} = 180$ ✓${askAngle ? ` The largest is **${biggest}°**.` : ''}` },
        ],
        mistakes: askAngle
          ? [{ value: x, say: `That’s $x$. Substitute $x = ${x}$ into each expression and pick the biggest angle.` }]
          : [
              { value: (180 + C) / K, say: 'Sign slip moving the constant: to undo + c you subtract c from both sides (and to undo − c you add).' },
              { value: (360 - C) / K, say: 'A triangle’s angles add to 180°, not 360°.' },
              { value: biggest, say: 'That’s an angle. The question asks for $x$.' },
            ],
      }
    }
    // isosceles with algebra: base angles (px + b) and (qx + d), top angle given
    let x: number, p: number, q: number, b: number, d: number, base: number
    do {
      x = rng.int(5, 20)
      ;[p, q] = pick2(rng, [2, 3, 4, 5])
      b = rng.int(-15, 25)
      base = p * x + b
      d = base - q * x
    } while (base < 25 || base > 80 || d === 0 || b === 0)
    const top = 180 - 2 * base
    const askTop = rng.chance(0.5)
    return {
      prompt: `In an isosceles triangle, the two base angles measure $(${lin(p, b)})^\\circ$ and $(${lin(q, d)})^\\circ$. Find ${askTop ? 'the **top** angle (between the equal sides)' : '$x$'}.`,
      answer: { kind: 'num', value: askTop ? top : x },
      placeholder: askTop ? 'degrees' : 'x = ?',
      hints: ['Base angles of an isosceles triangle are **equal** — set the two expressions equal.', `$${lin(p, b)} = ${lin(q, d)}$. Collect the $x$ terms on one side.`, `This gives $x = ${x}$, so each base angle is $${base}^\\circ$.${askTop ? ' Now use the 180° rule.' : ''}`],
      steps: [
        { text: 'Base angles are equal:', math: `${lin(p, b)} = ${lin(q, d)}` },
        { text: 'Solve for $x$:', math: `${Math.abs(p - q) === 1 ? '' : Math.abs(p - q)}x = ${p > q ? d - b : b - d} \\;\\Rightarrow\\; x = ${x}` },
        { text: 'Each base angle:', math: `${p}(${x}) ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${base}^\\circ` },
        ...(askTop ? [{ text: 'Top angle:', math: `180 - 2(${base}) = ${top}^\\circ` }] : []),
      ],
      mistakes: askTop
        ? [
            { value: base, say: 'That’s a **base** angle. The top angle is what’s left after subtracting both base angles from 180°.' },
            { value: 180 - base, say: 'There are **two** base angles — subtract both.' },
            { value: x, say: 'That’s $x$. Find the base angles, then the top angle.' },
          ]
        : [{ value: base, say: 'That’s the base angle itself. The question asks for $x$.' }],
      visual: { type: 'tri', angles: [`(${lin(p, b)})°`, askTop ? 'y' : '', `(${lin(q, d)})°`], ticks: [true, true, false] },
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. AREA & PERIMETER OF RECTANGLES AND PARALLELOGRAMS
// ═══════════════════════════════════════════════════════════════════════════
const UNITS = ['cm', 'm', 'ft', 'in'] as const

const areaRect: Skill = {
  id: 'area-rect',
  unit: 'geo',
  title: 'Area & perimeter: rectangles',
  blurb: 'Area fills the inside; perimeter walks the edge. Parallelograms use the straight-up height.',
  prereqs: ['mult'],
  why: 'Flooring, paint, fencing, a solar panel’s collecting surface, a wing’s lift area — you’re always either covering a surface (area) or going around it (perimeter).',
  learn: [
    { kind: 'idea', title: 'Two different questions', body: '**Area** asks: how many unit squares does it take to **cover** the shape? A $5 \\times 3$ rectangle holds 3 rows of 5 squares — $15$ square units.\n**Perimeter** asks: how far is it **around** the edge? $5 + 3 + 5 + 3 = 16$ units.', math: 'A = l \\times w \\qquad P = 2l + 2w' },
    { kind: 'explore', title: 'Count the squares', body: 'In **rectangle** mode every unit square is drawn. Then switch to **parallelogram** and slide the top sideways.', widget: { w: 'rect' }, task: 'Make a 6 × 4 rectangle and note the area. Switch to parallelogram and slide the top — does the area change? Why not?' },
    { kind: 'idea', title: 'Parallelogram = rectangle in disguise', body: 'Slice the triangle off one end of a parallelogram and slide it to the other end — it becomes a rectangle with the **same base** and the **same height**. No area was gained or lost, so:', math: 'A = b \\times h \\quad (h \\text{ measured straight up, at } 90^\\circ)' },
    { kind: 'trap', title: 'Using the slanted side as the height', wrong: 'A parallelogram with base 10, slanted side 6 and height 5 has area $10 \\times 6 = 60$.', right: '$A = 10 \\times 5 = 50$ — use the dashed **perpendicular** height.', why: 'Lean a parallelogram over further and the slanted side stays 6 while the shape gets flatter and flatter — the area shrinks. Only the straight-up height measures how tall it really is.' },
    { kind: 'trap', title: 'Area vs. perimeter', wrong: 'A $7 \\times 4$ room needs $22$ square feet of carpet.', right: 'Carpet covers the floor: $7 \\times 4 = 28$ ft². ($22$ ft is the perimeter — the baseboard length.)', why: 'Ask yourself: am I **covering** it (area, square units) or **walking around** it (perimeter, plain units)?' },
    { kind: 'check', question: 'A square has sides of 6 cm. Which is true?', options: ['Area $36$ cm², perimeter $24$ cm', 'Area $24$ cm², perimeter $36$ cm', 'Area and perimeter are both $36$', 'Area $12$ cm², perimeter $24$ cm'], correct: 0, explain: 'Area: $6 \\times 6 = 36$ square cm. Perimeter: four sides of 6 = $24$ cm. Different questions, different units.' },
  ],
  generate(rng, level) {
    const u = rng.pick(UNITS)
    if (level === 1) {
      const kind = rng.pick(['area', 'perim', 'square'] as const)
      if (kind === 'square') {
        const s = rng.int(3, 15)
        const askArea = rng.chance(0.5)
        return {
          prompt: `A square has sides of $${s}$ ${u}. Find its **${askArea ? 'area' : 'perimeter'}**.`,
          answer: { kind: 'num', value: askArea ? s * s : 4 * s, unit: askArea ? `${u}²` : u },
          hints: askArea
            ? ['Area counts the unit squares that cover the shape.', 'A square is a rectangle whose length and width are equal: $A = s \\times s$.', `$${s} \\times ${s} = \\;?$`]
            : ['Perimeter is the distance all the way around.', 'A square has **four** equal sides.', `$4 \\times ${s} = \\;?$`],
          steps: askArea
            ? [{ text: 'Area of a square = side × side:', math: `${s} \\times ${s} = ${s * s}` }, { text: `**${s * s} ${u}²** (square units, because we counted squares).` }]
            : [{ text: 'Add the four equal sides:', math: `${s} + ${s} + ${s} + ${s} = 4(${s}) = ${4 * s}` }, { text: `**${4 * s} ${u}** (a length, so plain units).` }],
          mistakes: askArea
            ? [
                { value: 4 * s, say: 'That’s the **perimeter** (distance around). Area counts the squares inside: side × side.' },
                { value: 2 * s, say: 'Area is side **times** side, not side times 2.' },
              ]
            : [
                { value: s * s, say: 'That’s the **area**. Perimeter is the distance around — add up all four sides.' },
                { value: 2 * s, say: 'A square has **four** sides, not two.' },
              ],
          visual: { type: 'rect', w: `${s} ${u}`, h: `${s} ${u}` },
        }
      }
      const l = rng.int(3, 15)
      let w = rng.int(2, 12)
      if (w === l) w = l - 1
      if (kind === 'area')
        return {
          prompt: `Find the **area** of a rectangle that is $${l}$ ${u} long and $${w}$ ${u} wide.`,
          answer: { kind: 'num', value: l * w, unit: `${u}²` },
          hints: ['Area = how many unit squares fit inside.', `There are $${w}$ rows with $${l}$ squares in each row.`, `$${l} \\times ${w} = \\;?$`],
          steps: [
            { text: 'Area of a rectangle = length × width:', math: `A = ${l} \\times ${w} = ${l * w}` },
            { text: `**${l * w} ${u}²** — square units, because we’re counting squares.` },
          ],
          mistakes: [
            { value: 2 * (l + w), say: 'That’s the **perimeter** (distance around). Area counts the squares inside: length × width.' },
            { value: l + w, say: 'You added the sides. Area **multiplies** them: ' + w + ' rows of ' + l + '.' },
          ],
          visual: { type: 'rect', w: `${l} ${u}`, h: `${w} ${u}` },
        }
      return {
        prompt: `Find the **perimeter** of a rectangle that is $${l}$ ${u} long and $${w}$ ${u} wide.`,
        answer: { kind: 'num', value: 2 * (l + w), unit: u },
        hints: ['Perimeter is the distance all the way around the edge.', `A rectangle has two lengths of $${l}$ and two widths of $${w}$.`, `$${l} + ${w} + ${l} + ${w} = \\;?$`],
        steps: [
          { text: 'Walk around the edge — two lengths and two widths:', math: `P = ${l} + ${w} + ${l} + ${w}` },
          { text: 'Or use the formula:', math: `P = 2(${l} + ${w}) = 2(${l + w}) = ${2 * (l + w)}` },
          { text: `**${2 * (l + w)} ${u}**.` },
        ],
        mistakes: [
          { value: l * w, say: 'That’s the **area** (squares inside). Perimeter is the distance around: add all four sides.' },
          { value: l + w, say: 'That’s only halfway around. A rectangle has **four** sides — two of each.' },
        ],
        visual: { type: 'rect', w: `${l} ${u}`, h: `${w} ${u}` },
      }
    }

    if (level === 2) {
      const kind = rng.pick(['para', 'para', 'missing-area', 'missing-perim'] as const)
      if (kind === 'para') {
        const b = rng.int(5, 16)
        const h = rng.int(3, 10)
        const sl = h + rng.int(1, 4)
        return {
          prompt: `Find the area of the parallelogram. The base is $${b}$ ${u}, the slanted side is $${sl}$ ${u}, and the height (dashed) is $${h}$ ${u}.`,
          answer: { kind: 'num', value: b * h, unit: `${u}²` },
          hints: ['A parallelogram is a rectangle that’s been slid sideways — the area formula is the same idea.', 'Area = base × **height**, where the height is the dashed line that meets the base at a right angle.', `$${b} \\times ${h} = \\;?$ (The slanted ${sl} isn’t needed.)`],
          steps: [
            { text: 'Cut the triangle off one end and slide it to the other: it becomes a rectangle with the same base and height.' },
            { text: 'So:', math: `A = b \\times h = ${b} \\times ${h} = ${b * h}` },
            { text: `**${b * h} ${u}²**. The slanted side (${sl}) is a distractor — it would matter for perimeter, not area.` },
          ],
          mistakes: [
            { value: b * sl, say: 'You used the **slanted side**. The height must be measured straight up — at 90° to the base. Use the dashed line.' },
            { value: 2 * (b + sl), say: 'That’s the **perimeter**. Area is base × perpendicular height.' },
            { value: (b * h) / 2, say: 'No ½ here — that’s for triangles. A parallelogram is a full rectangle rearranged.' },
          ],
          visual: { type: 'rect', shape: 'para', w: `${b} ${u}`, h: `${h} ${u}`, slant: `${sl} ${u}` },
        }
      }
      const l = rng.int(4, 15)
      const w = rng.int(2, 12)
      if (kind === 'missing-area') {
        const A = l * w
        return {
          prompt: `A rectangle has an area of $${A}$ ${u}² and a length of $${l}$ ${u}. How wide is it?`,
          answer: { kind: 'num', value: w, unit: u },
          hints: ['Write the area formula and fill in what you know.', `$${l} \\times w = ${A}$`, `What times $${l}$ makes $${A}$? Divide: $${A} \\div ${l}$.`],
          steps: [
            { text: 'Area = length × width:', math: `${l} \\times w = ${A}` },
            { text: 'Undo the multiplication by dividing:', math: `w = ${A} \\div ${l} = ${w}` },
            { text: `Check: $${l} \\times ${w} = ${A}$ ✓` },
          ],
          mistakes: [
            { value: A - l, say: 'You subtracted. The area is length **times** width, so divide to undo it.' },
            { value: A * l, say: 'You multiplied. To undo “× length”, **divide** by the length.' },
            ...((A - 2 * l) / 2 > 0 ? [{ value: (A - 2 * l) / 2, say: 'That treats the area like a perimeter. Area = length × width, so divide.' }] : []),
          ],
          visual: { type: 'rect', w: `${l} ${u}`, h: '?' },
        }
      }
      const P = 2 * (l + w)
      return {
        prompt: `A rectangle has a perimeter of $${P}$ ${u}. Its length is $${l}$ ${u}. How wide is it?`,
        answer: { kind: 'num', value: w, unit: u },
        hints: ['The perimeter goes around all four sides: two lengths and two widths.', `The two lengths use up $2 \\times ${l} = ${2 * l}$ ${u}. How much is left for the two widths?`, `$${P} - ${2 * l} = ${P - 2 * l}$ is shared by **two** widths.`],
        steps: [
          { text: 'Perimeter = two lengths + two widths:', math: `2(${l}) + 2w = ${P}` },
          { text: 'Subtract the two lengths:', math: `2w = ${P} - ${2 * l} = ${P - 2 * l}` },
          { text: 'Halve it:', math: `w = ${w}` },
          { text: `Check: $${l} + ${w} + ${l} + ${w} = ${P}$ ✓` },
        ],
        mistakes: [
          { value: P - l, say: 'There are **two** lengths in the perimeter, and the leftover is shared by **two** widths.' },
          { value: P - 2 * l, say: 'That’s both widths together. Halve it to get one width.' },
          { value: P / l, say: 'Dividing works for area, not perimeter. Perimeter **adds** the sides.' },
        ],
        visual: { type: 'rect', w: `${l} ${u}`, h: '?' },
      }
    }

    // level 3: word problems & composite shapes
    const kind = rng.pick(['L-area', 'L-perim', 'carpet', 'fence', 'para-h'] as const)
    if (kind === 'L-area' || kind === 'L-perim') {
      const W = rng.int(10, 24)
      const H = rng.int(8, 18)
      const a = rng.int(2, W - 4)
      const b = rng.int(2, H - 3)
      if (kind === 'L-area') {
        const A = W * H - a * b
        return {
          prompt: `A hangar floor is shaped like an L: it’s a $${W}$ m by $${H}$ m rectangle with a $${a}$ m by $${b}$ m rectangle cut out of one corner. What is the floor’s area?`,
          answer: { kind: 'num', value: A, unit: 'm²' },
          hints: ['Think of it as a big rectangle with a small rectangle missing.', `Big rectangle: $${W} \\times ${H}$. Missing corner: $${a} \\times ${b}$.`, `$${W * H} - ${a * b} = \\;?$`],
          steps: [
            { text: 'Area of the full rectangle:', math: `${W} \\times ${H} = ${W * H}` },
            { text: 'Area of the cut-out corner:', math: `${a} \\times ${b} = ${a * b}` },
            { text: 'Subtract the missing part:', math: `${W * H} - ${a * b} = ${A}\\text{ m}^2` },
          ],
          mistakes: [
            { value: W * H, say: 'That’s the full rectangle. Subtract the corner that was cut out.' },
            { value: W * H + a * b, say: 'The corner is **missing** — subtract it, don’t add it.' },
            { value: (W - a) * (H - b), say: 'That only counts the overlap. Big rectangle minus the cut-out works more reliably.' },
          ],
        }
      }
      const P = 2 * (W + H)
      return {
        prompt: `An L-shaped deck is a $${W}$ ft by $${H}$ ft rectangle with a $${a}$ ft by $${b}$ ft rectangle cut out of one corner. How many feet of railing go around its whole edge (its perimeter)?`,
        answer: { kind: 'num', value: P, unit: 'ft' },
        hints: ['Sketch it and label every edge — there are six.', `Cutting a corner removes two edges (${a} and ${b}) but adds two new inside edges of the **same** lengths.`, `So the perimeter is the same as the full rectangle’s: $2(${W} + ${H})$.`],
        steps: [
          { text: `The cut-out pushes two edges inward, but the new edges are still ${a} ft and ${b} ft long — nothing is gained or lost.` },
          { text: 'Perimeter of the L = perimeter of the full rectangle:', math: `2(${W} + ${H}) = ${P}\\text{ ft}` },
          { text: `(Area does go down — by $${a * b}$ ft² — but the distance around stays ${P} ft.)` },
        ],
        mistakes: [
          { value: P - 2 * (a + b), say: 'The cut-out edges don’t disappear — they move inward. The new inside edges have the same total length, so the perimeter is unchanged.' },
          { value: W * H - a * b, say: 'That’s the **area** of the deck. Railing goes around the edge — perimeter.' },
          { value: P - a - b, say: 'Count all six edges. The two inside edges replace exactly the length that was removed.' },
        ],
      }
    }
    if (kind === 'carpet') {
      const l = rng.int(8, 20)
      const w = rng.int(6, 15)
      const price = rng.int(2, 9)
      return {
        prompt: `A briefing room is $${l}$ ft by $${w}$ ft. Carpet costs \\$${price} per square foot. How much will it cost to carpet the floor?`,
        answer: { kind: 'num', value: l * w * price, unit: 'dollars' },
        placeholder: 'dollars',
        hints: ['Carpet **covers** the floor — is that area or perimeter?', `Area: $${l} \\times ${w} = ${l * w}$ square feet.`, `Each square foot costs \\$${price}: $${l * w} \\times ${price}$.`],
        steps: [
          { text: 'Carpet covers the floor, so find the area:', math: `${l} \\times ${w} = ${l * w}\\text{ ft}^2` },
          { text: 'Multiply by the price per square foot:', math: `${l * w} \\times ${price} = ${l * w * price}` },
          { text: `Cost: **\\$${l * w * price}**.` },
        ],
        mistakes: [
          { value: 2 * (l + w) * price, say: 'You used the **perimeter**. Carpet covers the whole floor — that’s area.' },
          { value: l * w, say: 'That’s the area in square feet. Now multiply by the price per square foot.' },
          { value: (l + w) * price, say: 'Area is length **times** width, not plus.' },
        ],
        visual: { type: 'rect', w: `${l} ft`, h: `${w} ft` },
      }
    }
    if (kind === 'fence') {
      const l = rng.int(12, 40)
      const w = rng.int(8, 30)
      const price = rng.int(3, 12)
      return {
        prompt: `A rectangular field is $${l}$ m by $${w}$ m. Fencing costs \\$${price} per meter. How much does it cost to fence all the way around?`,
        answer: { kind: 'num', value: 2 * (l + w) * price, unit: 'dollars' },
        placeholder: 'dollars',
        hints: ['A fence runs **around** the edge — area or perimeter?', `Perimeter: $2(${l} + ${w}) = ${2 * (l + w)}$ m.`, `Each meter costs \\$${price}: $${2 * (l + w)} \\times ${price}$.`],
        steps: [
          { text: 'Fencing goes around the edge, so find the perimeter:', math: `2(${l} + ${w}) = ${2 * (l + w)}\\text{ m}` },
          { text: 'Multiply by the price per meter:', math: `${2 * (l + w)} \\times ${price} = ${2 * (l + w) * price}` },
          { text: `Cost: **\\$${2 * (l + w) * price}**.` },
        ],
        mistakes: [
          { value: l * w * price, say: 'You used the **area**. A fence goes around the edge — that’s perimeter.' },
          { value: (l + w) * price, say: 'That only fences two sides. The perimeter has two lengths **and** two widths.' },
          { value: 2 * (l + w), say: 'That’s the length of fence. Now multiply by the price per meter.' },
        ],
        visual: { type: 'rect', w: `${l} m`, h: `${w} m` },
      }
    }
    const b = rng.int(5, 18)
    const h = rng.int(3, 12)
    const sl = h + rng.int(1, 5)
    return {
      prompt: `A parallelogram has an area of $${b * h}$ ${u}² and a base of $${b}$ ${u}. Its slanted side is $${sl}$ ${u}. What is its height?`,
      answer: { kind: 'num', value: h, unit: u },
      hints: ['Area of a parallelogram = base × height (the perpendicular height).', `$${b} \\times h = ${b * h}$`, `Divide: $${b * h} \\div ${b}$. The slanted side doesn’t enter into it.`],
      steps: [
        { text: 'Use the area formula:', math: `${b} \\times h = ${b * h}` },
        { text: 'Divide by the base:', math: `h = ${b * h} \\div ${b} = ${h}` },
        { text: `Sense check: the height (${h}) must be **shorter** than the slanted side (${sl}) — the straight-up route is always the shortest. ✓` },
      ],
      mistakes: [
        { value: sl, say: 'That’s the slanted side. The height is the perpendicular distance — find it from the area.' },
        { value: b * h - b, say: 'Area is base **times** height, so divide by the base to undo it.' },
      ],
      visual: { type: 'rect', shape: 'para', w: `${b} ${u}`, h: 'h', slant: `${sl} ${u}` },
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. AREA OF TRIANGLES AND TRAPEZOIDS
// ═══════════════════════════════════════════════════════════════════════════
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
  [6, 8, 10],
]

const areaTri: Skill = {
  id: 'area-tri',
  unit: 'geo',
  title: 'Area: triangles & trapezoids',
  blurb: 'A triangle is half a parallelogram; a trapezoid averages its two bases.',
  prereqs: ['area-rect', 'frac-mult'],
  why: 'Delta wings, sails, roof gables and plots of land are triangles and trapezoids. Once you can find their areas, you can find the area of almost any flat shape by chopping it up.',
  learn: [
    { kind: 'idea', title: 'Every triangle is half a parallelogram', body: 'Make a copy of any triangle, flip it, and fit it against the original — the two together always form a **parallelogram** with the same base and height. One triangle is exactly half of that:', math: 'A = \\tfrac12 \\times b \\times h' },
    { kind: 'explore', title: 'See the half', body: 'Choose **triangle** mode. The dashed outline is the parallelogram the triangle is half of.', widget: { w: 'rect' }, task: 'Set base 8 and height 5. Compare the parallelogram’s area with the triangle’s. Then slide the top — does the triangle’s area change?' },
    { kind: 'idea', title: 'Height means straight up', body: 'The **height** is the perpendicular distance from the base to the opposite corner — it meets the base at $90^\\circ$. In a right triangle the two legs are already perpendicular, so one leg is the base and the other is the height. The slanted hypotenuse is never the height.' },
    { kind: 'idea', title: 'Trapezoids: average the bases', body: 'A trapezoid has two parallel sides (bases $b_1$ and $b_2$). Two copies, one flipped, make a parallelogram with base $b_1 + b_2$. Half of that:', math: 'A = \\tfrac12 (b_1 + b_2)\\,h' },
    { kind: 'trap', title: 'Forgetting the ½', wrong: 'A triangle with base 10 and height 6 has area $10 \\times 6 = 60$.', right: '$A = \\tfrac12 \\times 10 \\times 6 = 30$.', why: '$10 \\times 6$ is the area of the whole rectangle (or parallelogram) around the triangle. The triangle only fills half of it.' },
    { kind: 'check', question: 'A triangle and a parallelogram have the same base and the same height. How do their areas compare?', options: ['The triangle has half the area', 'They’re equal', 'The triangle has twice the area', 'It depends on the angles'], correct: 0, explain: 'Two copies of the triangle make that parallelogram, so the triangle is exactly half — whatever its angles.' },
  ],
  generate(rng, level) {
    const u = rng.pick(UNITS)
    if (level === 1) {
      const right = rng.chance(0.5)
      let b: number, h: number
      do {
        b = rng.int(3, 16)
        h = rng.int(2, 14)
      } while ((b * h) % 2 !== 0)
      const A = (b * h) / 2
      return {
        prompt: right
          ? `Find the area of this right triangle. Its two legs are $${b}$ ${u} and $${h}$ ${u}.`
          : `A triangle has a base of $${b}$ ${u} and a height of $${h}$ ${u}. What is its area?`,
        answer: { kind: 'num', value: A, unit: `${u}²` },
        hints: right
          ? ['The two legs of a right triangle meet at 90°, so one is the base and the other is the height.', 'The triangle is half of a rectangle: $A = \\tfrac12 \\times b \\times h$.', `$\\tfrac12 \\times ${b} \\times ${h} = \\tfrac12 \\times ${b * h}$`]
          : ['A triangle is half of a parallelogram with the same base and height.', 'Use $A = \\tfrac12 \\times b \\times h$.', `$${b} \\times ${h} = ${b * h}$. Now take half.`],
        steps: [
          { text: 'Area of a triangle:', math: `A = \\tfrac12 \\times b \\times h` },
          { text: 'Substitute:', math: `A = \\tfrac12 \\times ${b} \\times ${h} = \\tfrac12 \\times ${b * h}` },
          { text: 'Halve:', math: `A = ${A}\\text{ ${u}}^2` },
        ],
        mistakes: [
          { value: b * h, say: 'You forgot the **½**. $b \\times h$ is the whole rectangle around the triangle — the triangle is only half of it.' },
          { value: b + h, say: 'Area multiplies base and height (then halves), it doesn’t add them.' },
        ],
        visual: right ? { type: 'tri', right: true, sides: [`${h} ${u}`, '', `${b} ${u}`] } : { type: 'tri', height: `${h} ${u}`, sides: ['', '', `${b} ${u}`] },
      }
    }

    if (level === 2) {
      const kind = rng.pick(['hyp', 'trap', 'trap', 'odd'] as const)
      if (kind === 'hyp') {
        const t = rng.pick(TRIPLES.slice(0, 4))
        const k = t[0] * t[1] > 150 ? 1 : rng.int(1, 2)
        const [a, b, c] = t.map((s) => s * k)
        const A = (a * b) / 2
        return {
          prompt: `A right triangle has sides $${a}$ ${u}, $${b}$ ${u} and $${c}$ ${u}. Find its area.`,
          answer: { kind: 'num', value: A, unit: `${u}²` },
          hints: ['Which two sides meet at the right angle? Those are the base and height.', `The longest side (${c}) is the hypotenuse — it’s slanted, so it’s not a height. Use the legs ${a} and ${b}.`, `$\\tfrac12 \\times ${a} \\times ${b}$`],
          steps: [
            { text: `The legs ${a} and ${b} meet at 90°, so they are the base and height. The hypotenuse (${c}) isn’t used.` },
            { text: 'Area:', math: `\\tfrac12 \\times ${a} \\times ${b} = \\tfrac12 \\times ${a * b} = ${A}` },
          ],
          mistakes: [
            { value: (a * c) / 2, say: `The ${c} side is the hypotenuse — it’s slanted, so it can’t be the height. Use the two legs.` },
            { value: (b * c) / 2, say: `The ${c} side is the hypotenuse — it’s slanted, so it can’t be the height. Use the two legs.` },
            { value: a * b, say: 'Don’t forget the ½ — the triangle is half of the rectangle formed by its legs.' },
          ],
          visual: { type: 'tri', right: true, sides: [`${a} ${u}`, `${c} ${u}`, `${b} ${u}`] },
        }
      }
      if (kind === 'trap') {
        let b1: number, b2: number, h: number
        do {
          b1 = rng.int(3, 12)
          b2 = rng.int(b1 + 2, 20)
          h = rng.int(2, 12)
        } while (((b1 + b2) * h) % 2 !== 0)
        const A = ((b1 + b2) * h) / 2
        return {
          prompt: `Find the area of the trapezoid. Its parallel sides are $${b1}$ ${u} and $${b2}$ ${u}, and its height is $${h}$ ${u}.`,
          answer: { kind: 'num', value: A, unit: `${u}²` },
          hints: ['Two copies of a trapezoid (one flipped) make a parallelogram.', `That parallelogram’s base is $${b1} + ${b2} = ${b1 + b2}$, so the trapezoid is half of $${b1 + b2} \\times ${h}$.`, `$\\tfrac12 \\times ${b1 + b2} \\times ${h} = \\;?$`],
          steps: [
            { text: 'Trapezoid formula:', math: `A = \\tfrac12 (b_1 + b_2)\\,h` },
            { text: 'Add the parallel sides:', math: `${b1} + ${b2} = ${b1 + b2}` },
            { text: 'Multiply by the height and halve:', math: `\\tfrac12 \\times ${b1 + b2} \\times ${h} = ${A}` },
            { text: `Another way to see it: the **average** base is $${(b1 + b2) / 2}$, and $${(b1 + b2) / 2} \\times ${h} = ${A}$.` },
          ],
          mistakes: [
            { value: (b1 + b2) * h, say: 'You forgot the ½. $(b_1 + b_2) \\times h$ is the area of **two** trapezoids put together.' },
            { value: b2 * h, say: 'That treats it as a rectangle using only the long base. Average the two bases first.' },
            { value: b1 * b2 * h, say: 'The two bases get **added** (then halved), not multiplied.' },
          ],
          visual: { type: 'rect', shape: 'trap', w: `${b2} ${u}`, top: `${b1} ${u}`, h: `${h} ${u}` },
        }
      }
      let b: number, h: number
      do {
        b = rng.int(5, 19)
        h = rng.int(3, 15)
      } while ((b * h) % 2 === 0)
      const A = (b * h) / 2
      return {
        prompt: `A triangular sail has a base of $${b}$ m and a height of $${h}$ m. What is its area? (A decimal answer is fine.)`,
        answer: { kind: 'num', value: A, unit: 'm²' },
        hints: ['Triangle area is half of base × height.', `$${b} \\times ${h} = ${b * h}$`, `Half of ${b * h} is…?`],
        steps: [
          { text: 'Multiply base by height:', math: `${b} \\times ${h} = ${b * h}` },
          { text: 'Take half (it’s okay to get a .5):', math: `${b * h} \\div 2 = ${A}\\text{ m}^2` },
        ],
        mistakes: [
          { value: b * h, say: 'You forgot the **½**. A triangle is half the rectangle around it.' },
          { value: Math.floor(A), say: `Don’t round away the half — ${b * h} ÷ 2 is exactly ${A}.` },
        ],
        visual: { type: 'tri', height: `${h} m`, sides: ['', '', `${b} m`] },
      }
    }

    // level 3
    const kind = rng.pick(['find-h', 'house', 'wings', 'trap-base'] as const)
    if (kind === 'find-h') {
      const b = rng.int(4, 20)
      const h = rng.int(3, 16)
      const A = (b * h) / 2
      return {
        prompt: `A triangle has an area of $${A}$ ${u}² and a base of $${b}$ ${u}. What is its height?`,
        answer: { kind: 'num', value: h, unit: u },
        hints: ['Start from the formula $A = \\tfrac12 b h$ and fill in what you know.', `$${A} = \\tfrac12 \\times ${b} \\times h$. Double both sides to get rid of the ½.`, `$${2 * A} = ${b}h$, so divide by ${b}.`],
        steps: [
          { text: 'Fill in the formula:', math: `${A} = \\tfrac12 \\times ${b} \\times h` },
          { text: 'Double both sides:', math: `${2 * A} = ${b}h` },
          { text: 'Divide by the base:', math: `h = ${2 * A} \\div ${b} = ${h}` },
          { text: `Check: $\\tfrac12 \\times ${b} \\times ${h} = ${A}$ ✓` },
        ],
        mistakes: [
          { value: A / b, say: 'You forgot to undo the ½. Double the area first, then divide by the base.' },
          { value: 2 * A * b, say: 'Divide by the base — don’t multiply.' },
        ],
        visual: { type: 'tri', height: 'h = ?', sides: ['', '', `${b} ${u}`] },
      }
    }
    if (kind === 'house') {
      const W = rng.int(6, 16)
      const H = rng.int(4, 10)
      const r = rng.int(2, 7)
      const A = W * H + (W * r) / 2
      return {
        prompt: `The end wall of a hangar is a rectangle $${W}$ m wide and $${H}$ m tall, topped by a triangular gable that rises another $${r}$ m to the peak. What is the area of the whole wall?`,
        answer: { kind: 'num', value: A, unit: 'm²' },
        hints: ['Split the wall into two simple shapes: a rectangle and a triangle.', `Rectangle: $${W} \\times ${H}$. Triangle: base $${W}$, height $${r}$.`, `$${W * H} + \\tfrac12 \\times ${W} \\times ${r}$`],
        steps: [
          { text: 'Rectangle part:', math: `${W} \\times ${H} = ${W * H}` },
          { text: 'Triangle part (the gable):', math: `\\tfrac12 \\times ${W} \\times ${r} = ${(W * r) / 2}` },
          { text: 'Add them:', math: `${W * H} + ${(W * r) / 2} = ${A}\\text{ m}^2` },
        ],
        mistakes: [
          { value: W * H + W * r, say: 'That treats the whole wall as a rectangle up to the peak. The gable is a **triangle** — only half of its rectangle, so use ½ × base × height for it.' },
          { value: W * H, say: 'That’s just the rectangle. Add the triangular gable on top.' },
        ],
      }
    }
    if (kind === 'wings') {
      const b = rng.int(6, 16)
      const h = rng.int(3, 9)
      const A = b * h
      return {
        prompt: `A model jet has two identical triangular wings. Each wing has a base (along the body) of $${b}$ cm and reaches out $${h}$ cm from the body, at right angles. What is the total wing area?`,
        answer: { kind: 'num', value: A, unit: 'cm²' },
        hints: ['Find the area of one triangular wing first.', `One wing: $\\tfrac12 \\times ${b} \\times ${h} = ${(b * h) / 2}$.`, 'There are **two** wings.'],
        steps: [
          { text: 'One wing is a triangle:', math: `\\tfrac12 \\times ${b} \\times ${h} = ${(b * h) / 2}` },
          { text: 'Two wings:', math: `2 \\times ${(b * h) / 2} = ${A}\\text{ cm}^2` },
          { text: 'Notice: two equal triangles make one whole rectangle — the halves cancel out.' },
        ],
        mistakes: [
          { value: (b * h) / 2, say: 'That’s one wing. The jet has **two**.' },
          { value: 2 * b * h, say: 'Each wing is a triangle — half of base × height — before you double it.' },
        ],
        visual: { type: 'tri', right: true, sides: [`${h} cm`, '', `${b} cm`] },
      }
    }
    let b1: number, b2: number, h: number
    do {
      b1 = rng.int(3, 12)
      b2 = rng.int(b1 + 1, 20)
      h = rng.int(2, 10)
    } while (((b1 + b2) * h) % 2 !== 0)
    const A = ((b1 + b2) * h) / 2
    return {
      prompt: `A trapezoid has an area of $${A}$ ${u}², a height of $${h}$ ${u}, and one parallel side of $${b2}$ ${u}. How long is the other parallel side?`,
      answer: { kind: 'num', value: b1, unit: u },
      hints: ['Start from $A = \\tfrac12 (b_1 + b_2) h$.', `$${A} = \\tfrac12 (b_1 + ${b2}) \\times ${h}$. Double both sides, then divide by ${h}.`, `$b_1 + ${b2} = ${b1 + b2}$`],
      steps: [
        { text: 'Fill in the formula:', math: `${A} = \\tfrac12 (b_1 + ${b2})(${h})` },
        { text: 'Double both sides and divide by the height:', math: `b_1 + ${b2} = \\frac{${2 * A}}{${h}} = ${b1 + b2}` },
        { text: 'Subtract the known base:', math: `b_1 = ${b1 + b2} - ${b2} = ${b1}` },
      ],
      mistakes: [
        { value: A / h - b2, say: 'You forgot to undo the ½ — double the area first.' },
        { value: b1 + b2, say: 'That’s the **sum** of both bases. Subtract the one you know.' },
      ],
      visual: { type: 'rect', shape: 'trap', w: `${b2} ${u}`, top: '?', h: `${h} ${u}` },
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CIRCLES
// ═══════════════════════════════════════════════════════════════════════════
const circles: Skill = {
  id: 'circles',
  unit: 'geo',
  title: 'Circles: circumference & area',
  blurb: 'Around the edge is πd. The inside is πr². Watch radius vs. diameter.',
  prereqs: ['area-rect', 'decimals'],
  why: 'Wheels, propellers, radar coverage, a turning circle on the taxiway — anything that spins or spreads out evenly is a circle problem.',
  learn: [
    { kind: 'idea', title: 'Radius, diameter, and π', body: 'The **radius** $r$ goes from the center to the edge. The **diameter** $d$ goes all the way across through the center, so $d = 2r$.\nFor **every** circle, the distance around (the **circumference**) divided by the diameter is the same number: $\\pi \\approx 3.14159\\ldots$ We’ll use $\\pi \\approx 3.14$.' },
    { kind: 'explore', title: 'Unroll the circle', body: 'The red line is the circle’s edge, unrolled flat. The blue segments are diameters laid end to end.', widget: { w: 'circle' }, task: 'Change the radius. How many diameters fit along the unrolled edge — does it ever change?' },
    { kind: 'idea', title: 'Circumference', body: 'The edge is $\\pi$ diameters long. Since a diameter is two radii, that’s also $2\\pi r$:', math: 'C = \\pi d = 2\\pi r' },
    { kind: 'idea', title: 'Why the area is πr²', body: 'Slice a circle into many thin pizza wedges and lay them alternating point-up, point-down. They form a shape that’s almost a parallelogram: its base is **half the circumference** ($\\pi r$) and its height is the **radius** ($r$). Careful: only the $r$ is squared — $3.14 \\times 3^2 = 3.14 \\times 9$, not $(3.14 \\times 3)^2$.', math: 'A = \\pi r \\times r = \\pi r^2' },
    { kind: 'trap', title: 'Using the diameter as the radius', wrong: 'A circle with diameter 10 has area $3.14 \\times 10^2 = 314$.', right: 'Radius $= 10 \\div 2 = 5$, so $A = 3.14 \\times 5^2 = 78.5$.', why: 'The area formula needs the **radius**. Using the diameter makes the answer 4 times too big, because $(2r)^2 = 4r^2$.' },
    { kind: 'check', question: 'Which tells you how much fence goes **around** a circular garden?', options: ['Circumference, $2\\pi r$', 'Area, $\\pi r^2$', 'Diameter, $2r$', 'Radius, $r$'], correct: 0, explain: 'Around the edge = circumference (a length). Area would tell you how much soil covers the inside.' },
  ],
  generate(rng, level) {
    const u = rng.pick(UNITS)
    const PIT = '3.14'
    if (level === 1) {
      const kind = rng.pick(['C-r', 'C-d', 'A-r'] as const)
      if (kind === 'C-r') {
        const r = rng.int(1, 15)
        const C = c4(2 * PI * r)
        return {
          prompt: `A circle has a radius of $${r}$ ${u}. Find its **circumference**. Use $\\pi \\approx ${PIT}$.`,
          answer: { kind: 'num', value: C, tol: piTol(C), unit: u },
          hints: ['Circumference is the distance around the circle.', '$C = 2\\pi r$ — two radii make a diameter, and the edge is π diameters long.', `$2 \\times ${PIT} \\times ${r} = \\;?$`],
          steps: [
            { text: 'Circumference formula:', math: 'C = 2\\pi r' },
            { text: 'Substitute:', math: `C = 2 \\times ${PIT} \\times ${r} = ${PI * 2} \\times ${r}` },
            { text: 'Multiply:', math: `C = ${C}\\text{ ${u}}` },
          ],
          mistakes: [
            { when: near(c4(PI * r * r)), say: 'That’s the **area** ($\\pi r^2$). Circumference is the distance around: $2\\pi r$.' },
            { when: near(c4(PI * r)), say: 'That’s only half the way around. Use $2\\pi r$ — or $\\pi$ times the **diameter**.' },
          ],
          visual: { type: 'circle', r: `${r} ${u}` },
        }
      }
      if (kind === 'C-d') {
        const d = rng.int(2, 30)
        const C = c4(PI * d)
        return {
          prompt: `A circle has a diameter of $${d}$ ${u}. Find its circumference. Use $\\pi \\approx ${PIT}$.`,
          answer: { kind: 'num', value: C, tol: piTol(C), unit: u },
          hints: ['You’re given the **diameter**, not the radius.', 'The edge is $\\pi$ diameters long: $C = \\pi d$.', `$${PIT} \\times ${d} = \\;?$`],
          steps: [
            { text: 'With the diameter, use:', math: 'C = \\pi d' },
            { text: 'Substitute and multiply:', math: `C = ${PIT} \\times ${d} = ${C}\\text{ ${u}}` },
          ],
          mistakes: [
            { when: near(c4(2 * PI * d)), say: 'You doubled the **diameter**. $2\\pi r$ needs the radius; with the diameter, it’s just $\\pi d$.' },
            { when: near(c4((PI * d * d) / 4)), say: 'That’s the area. Circumference is the distance around.' },
          ],
          visual: { type: 'circle', d: `${d} ${u}` },
        }
      }
      const r = rng.int(1, 12)
      const A = c4(PI * r * r)
      return {
        prompt: `A circle has a radius of $${r}$ ${u}. Find its **area**. Use $\\pi \\approx ${PIT}$.`,
        answer: { kind: 'num', value: A, tol: piTol(A), unit: `${u}²` },
        hints: ['Area is the space inside the circle.', '$A = \\pi r^2$. Square the radius **first**.', `$${r}^2 = ${r * r}$, then $${PIT} \\times ${r * r}$.`],
        steps: [
          { text: 'Area formula:', math: 'A = \\pi r^2' },
          { text: 'Square the radius first:', math: `${r}^2 = ${r * r}` },
          { text: 'Multiply by π:', math: `A = ${PIT} \\times ${r * r} = ${A}\\text{ ${u}}^2` },
        ],
        mistakes: [
          ...(r !== 2 ? [{ when: near(c4(2 * PI * r)), say: 'That’s the **circumference** ($2\\pi r$). Area is $\\pi r^2$ — square the radius.' }] : []),
          ...(r !== 1 ? [{ when: near(c4(PI * PI * r * r)), say: 'You squared π too. Only the radius is squared: $\\pi \\times r^2$.' }] : []),
          ...(r !== 1 ? [{ when: near(c4(PI * r)), say: 'You forgot to square the radius. $r^2 = r \\times r$.' }] : []),
        ],
        visual: { type: 'circle', r: `${r} ${u}` },
      }
    }

    if (level === 2) {
      const kind = rng.pick(['A-d', 'r-from-C', 'r-from-A', 'C-r'] as const)
      if (kind === 'A-d') {
        const r = rng.int(1, 12)
        const d = 2 * r
        const A = c4(PI * r * r)
        return {
          prompt: `A circular helipad has a diameter of $${d}$ m. What is its area? Use $\\pi \\approx ${PIT}$.`,
          answer: { kind: 'num', value: A, tol: piTol(A), unit: 'm²' },
          hints: ['The area formula uses the **radius**.', `Radius = half the diameter: $${d} \\div 2 = ${r}$.`, `$${PIT} \\times ${r}^2 = ${PIT} \\times ${r * r}$`],
          steps: [
            { text: 'Halve the diameter to get the radius:', math: `r = ${d} \\div 2 = ${r}` },
            { text: 'Area:', math: `A = \\pi r^2 = ${PIT} \\times ${r * r} = ${A}\\text{ m}^2` },
          ],
          mistakes: [
            { when: near(c4(PI * d * d)), say: 'You used the **diameter** as the radius. Halve it first — using $d$ makes the area 4 times too big.' },
            ...(r !== 1 ? [{ when: near(c4(PI * d)), say: 'That’s the circumference ($\\pi d$). Area is $\\pi r^2$.' }] : []),
            { when: near(c4(PI * d * 2)), say: 'Area is $\\pi r^2$ — square the radius, don’t double the diameter.' },
          ],
          visual: { type: 'circle', d: `${d} m` },
        }
      }
      if (kind === 'r-from-C') {
        const r = rng.int(2, 20)
        const C = c4(2 * PI * r)
        return {
          prompt: `A circle has a circumference of $${C}$ ${u}. What is its **radius**? Use $\\pi \\approx ${PIT}$.`,
          answer: { kind: 'num', value: r, tol: 0.05, unit: u },
          hints: ['Start from $C = 2\\pi r$ and work backwards.', `$${C} = 2 \\times ${PIT} \\times r = ${2 * PI}r$`, `Divide: $${C} \\div ${2 * PI}$.`],
          steps: [
            { text: 'Write the formula with what you know:', math: `${C} = 2(${PIT})r = ${2 * PI}r` },
            { text: 'Divide both sides by 6.28:', math: `r = ${C} \\div ${2 * PI} = ${r}` },
            { text: `Check: $2 \\times ${PIT} \\times ${r} = ${C}$ ✓` },
          ],
          mistakes: [
            { value: 2 * r, say: `That’s the **diameter** ($C \\div \\pi$). The radius is half of it.` },
            { when: near(c4(C / 2)), say: 'Divide by $2\\pi$ (that’s 6.28), not just by 2.' },
          ],
          visual: { type: 'circle', r: 'r = ?' },
        }
      }
      if (kind === 'r-from-A') {
        const r = rng.int(2, 12)
        const A = c4(PI * r * r)
        return {
          prompt: `A circle has an area of $${A}$ ${u}². What is its radius? Use $\\pi \\approx ${PIT}$.`,
          answer: { kind: 'num', value: r, tol: 0.05, unit: u },
          hints: ['Work backwards from $A = \\pi r^2$.', `Divide by π first: $r^2 = ${A} \\div ${PIT} = ${r * r}$.`, `Which number squared is ${r * r}?`],
          steps: [
            { text: 'Start from the formula:', math: `${A} = ${PIT} \\times r^2` },
            { text: 'Divide by 3.14:', math: `r^2 = ${r * r}` },
            { text: 'Undo the square with a square root:', math: `r = \\sqrt{${r * r}} = ${r}` },
          ],
          mistakes: [
            { value: r * r, say: `That’s $r^2$. Take the square root to get $r$.` },
            { value: (r * r) / 2, say: 'Squaring isn’t doubling — undo it with a **square root**, not by halving.' },
            { value: 2 * r, say: 'That’s the diameter. The radius is half.' },
          ],
          visual: { type: 'circle', r: 'r = ?' },
        }
      }
      const r = r1(rng.int(15, 95) / 10)
      const C = c4(2 * PI * r)
      return {
        prompt: `A propeller blade is $${r}$ ft long, so its tip traces a circle of radius $${r}$ ft. How far does the tip travel in one full turn? Use $\\pi \\approx ${PIT}$ and round to the nearest tenth.`,
        answer: { kind: 'num', value: r1(C), tol: 0.06, unit: 'ft' },
        hints: ['One full turn = once around the circle — the circumference.', `$C = 2\\pi r = 2 \\times ${PIT} \\times ${r}$`, `$6.28 \\times ${r} = ${C}$ — round it.`],
        steps: [
          { text: 'One turn of the tip is one circumference:', math: `C = 2\\pi r = 6.28 \\times ${r}` },
          { text: 'Multiply:', math: `C = ${C}` },
          { text: `Rounded: **${r1(C)} ft**.` },
        ],
        mistakes: [
          { when: near(PI * r * r, 0.06), say: 'That’s the area swept by the blade. Distance traveled by the tip is the circumference.' },
          { when: near(PI * r, 0.06), say: 'That’s half a turn. Use $2\\pi r$.' },
        ],
        visual: { type: 'circle', r: `${r} ft` },
      }
    }

    // level 3
    const kind = rng.pick(['wheel', 'semi-area', 'semi-perim', 'radar', 'pizza'] as const)
    if (kind === 'wheel') {
      const d = rng.int(16, 30)
      const n = rng.pick([10, 20, 25, 50, 100])
      const D = c4(n * PI * d)
      return {
        prompt: `A landing-gear wheel has a diameter of $${d}$ in. How far does the aircraft roll when the wheel turns $${n}$ full times? Use $\\pi \\approx ${PIT}$.`,
        answer: { kind: 'num', value: D, tol: piTol(D), unit: 'in' },
        hints: ['Each full turn rolls the wheel forward by its circumference.', `One turn: $C = \\pi d = ${PIT} \\times ${d} = ${c4(PI * d)}$ in.`, `Now multiply by ${n} turns.`],
        steps: [
          { text: 'One turn rolls one circumference:', math: `C = \\pi d = ${PIT} \\times ${d} = ${c4(PI * d)}` },
          { text: `${n} turns:`, math: `${n} \\times ${c4(PI * d)} = ${D}\\text{ in}` },
        ],
        mistakes: [
          { when: near(c4(2 * n * PI * d)), say: 'You used $2\\pi$ with the **diameter**. With the diameter it’s just $\\pi d$.' },
          { when: near(c4(PI * d)), say: 'That’s one turn. Multiply by the number of turns.' },
          { when: near(c4((n * PI * d * d) / 4)), say: 'Rolling distance comes from the circumference, not the area.' },
        ],
        visual: { type: 'circle', d: `${d} in` },
      }
    }
    if (kind === 'semi-area') {
      const r = rng.int(2, 14)
      const A = c4((PI * r * r) / 2)
      return {
        prompt: `A window is shaped like a half-circle with a radius of $${r}$ ${u}. What is its area? Use $\\pi \\approx ${PIT}$.`,
        answer: { kind: 'num', value: A, tol: piTol(A), unit: `${u}²` },
        hints: ['A half-circle is exactly half of a full circle.', `Full circle: $${PIT} \\times ${r}^2 = ${c4(PI * r * r)}$.`, 'Now take half.'],
        steps: [
          { text: 'Area of the full circle:', math: `\\pi r^2 = ${PIT} \\times ${r * r} = ${c4(PI * r * r)}` },
          { text: 'Half of it:', math: `${c4(PI * r * r)} \\div 2 = ${A}\\text{ ${u}}^2` },
        ],
        mistakes: [
          { when: near(c4(PI * r * r)), say: 'That’s the whole circle. The window is only **half** a circle.' },
          ...(r !== 2 ? [{ when: near(c4(PI * r)), say: 'Square the radius before multiplying by π, then halve.' }] : []),
        ],
        visual: { type: 'circle', r: `${r} ${u}` },
      }
    }
    if (kind === 'semi-perim') {
      const d = 2 * rng.int(2, 15)
      const P = c4((PI * d) / 2 + d)
      return {
        prompt: `A half-circle flower bed has a straight edge $${d}$ m long (the diameter). How much edging goes around the **whole** bed — the curved part and the straight part? Use $\\pi \\approx ${PIT}$.`,
        answer: { kind: 'num', value: P, tol: piTol(P), unit: 'm' },
        hints: ['The edge has two parts: half of a circumference, plus the straight diameter.', `Curved part: $\\tfrac12 \\times ${PIT} \\times ${d} = ${c4((PI * d) / 2)}$.`, `Add the straight edge: $+\\,${d}$.`],
        steps: [
          { text: 'Curved part = half the circumference:', math: `\\tfrac12 \\pi d = \\tfrac12 \\times ${PIT} \\times ${d} = ${c4((PI * d) / 2)}` },
          { text: 'Add the straight diameter:', math: `${c4((PI * d) / 2)} + ${d} = ${P}\\text{ m}` },
        ],
        mistakes: [
          { when: near(c4((PI * d) / 2)), say: 'That’s only the curved edge. Add the straight side too.' },
          { when: near(c4(PI * d)), say: 'That’s a full circle’s edge. The bed is half a circle — plus a straight side.' },
          { when: near(c4(PI * d + d)), say: 'Only **half** of the circumference is curved edge here.' },
        ],
      }
    }
    if (kind === 'radar') {
      const r = rng.int(5, 60)
      const A = c4(PI * r * r)
      return {
        prompt: `A radar station detects aircraft up to $${r}$ miles away in every direction. What area does it cover? Use $\\pi \\approx ${PIT}$.`,
        answer: { kind: 'num', value: A, tol: piTol(A), unit: 'sq miles' },
        hints: ['“Up to r miles in every direction” traces out a circle with radius r.', 'Coverage is the space **inside** the circle — area.', `$${PIT} \\times ${r}^2 = ${PIT} \\times ${r * r}$`],
        steps: [
          { text: 'The covered region is a circle of radius ' + r + ' miles.' },
          { text: 'Area:', math: `A = \\pi r^2 = ${PIT} \\times ${r * r} = ${A}\\text{ mi}^2` },
        ],
        mistakes: [
          { when: near(c4(2 * PI * r)), say: 'That’s the circumference — the length of the boundary. Coverage is the area inside.' },
          { when: near(c4(PI * 4 * r * r)), say: `${r} miles is the radius already — don’t double it.` },
          { when: near(c4(PI * PI * r * r)), say: 'Only the radius is squared, not π.' },
        ],
        visual: { type: 'circle', r: `${r} mi` },
      }
    }
    const [a, b] = rng.chance(0.5) ? [rng.int(8, 12), rng.int(14, 18)] : [rng.int(6, 10), rng.int(12, 16)]
    const ra = a / 2
    const rb = b / 2
    const diff = c4(PI * (rb * rb - ra * ra))
    return {
      prompt: `Pizzas are measured by **diameter**. How many more square inches of pizza do you get from a $${b}$-inch pizza than from a $${a}$-inch pizza? Use $\\pi \\approx ${PIT}$.`,
      answer: { kind: 'num', value: diff, tol: piTol(diff), unit: 'sq in' },
      hints: ['Find each pizza’s area, then subtract. Area needs the **radius**.', `Radii: $${rb}$ in and $${ra}$ in.`, `$${PIT} \\times ${rb}^2 - ${PIT} \\times ${ra}^2$`],
      steps: [
        { text: `Big pizza: radius ${rb}.`, math: `${PIT} \\times ${c4(rb * rb)} = ${c4(PI * rb * rb)}` },
        { text: `Small pizza: radius ${ra}.`, math: `${PIT} \\times ${c4(ra * ra)} = ${c4(PI * ra * ra)}` },
        { text: 'Difference:', math: `${c4(PI * rb * rb)} - ${c4(PI * ra * ra)} = ${diff}\\text{ in}^2` },
        { text: `Notice: the diameter only grew by ${b - a} inches, but the area grew a lot — area grows with the **square** of the size.` },
      ],
      mistakes: [
        { when: near(c4(PI * (b * b - a * a))), say: 'You used the diameters as radii — that makes each area 4× too big. Halve the diameters first.' },
        { when: near(c4(PI * (b - a))), say: 'That’s the difference in circumference. The question is about area (square inches).' },
        { when: near(c4(PI * (rb - ra) * (rb - ra))), say: 'Find each area separately, then subtract — you can’t subtract the radii first and then square.' },
      ],
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. PYTHAGOREAN THEOREM
// ═══════════════════════════════════════════════════════════════════════════
const pythag: Skill = {
  id: 'pythag',
  unit: 'geo',
  title: 'The Pythagorean theorem',
  blurb: 'In a right triangle, a² + b² = c². Find any missing side.',
  prereqs: ['roots'],
  why: 'Straight-line distance: how far a plane really is from base after flying north then east, how long a ladder must be, the diagonal size of a screen. It’s the most-used theorem in all of math.',
  learn: [
    { kind: 'idea', title: 'The rule', body: 'In a **right** triangle, the two sides that make the right angle are the **legs** ($a$ and $b$). The side across from the right angle is the **hypotenuse** ($c$) — always the longest side.', math: 'a^2 + b^2 = c^2' },
    { kind: 'explore', title: 'Squares on the sides', body: 'Each side of the triangle has a square built on it. The numbers are the squares’ areas.', widget: { w: 'pythag' }, task: 'Try legs 3 and 4, then 6 and 8, then 5 and 12. Add the two smaller squares each time. What do you notice about the big square?' },
    { kind: 'idea', title: 'Why it works', body: 'Put four copies of the triangle inside a big square with side $a + b$. Arrange them one way and the empty space is one tilted square of area $c^2$. Rearrange the same four triangles and the empty space becomes two squares: $a^2 + b^2$. Same big square, same triangles — so the empty space must match.' },
    { kind: 'idea', title: 'Finding a leg', body: 'If you know the hypotenuse and one leg, **subtract** instead of add — the hypotenuse’s square is the total:', math: 'b^2 = c^2 - a^2 \\quad\\Rightarrow\\quad b = \\sqrt{c^2 - a^2}' },
    { kind: 'trap', title: 'Just adding the sides', wrong: 'Legs 3 and 4, so the hypotenuse is $3 + 4 = 7$.', right: '$3^2 + 4^2 = 9 + 16 = 25$, so $c = \\sqrt{25} = 5$.', why: 'Cutting across the diagonal is a **shortcut** — it has to be shorter than walking along both legs. Squares add; lengths don’t.' },
    { kind: 'check', question: 'Which side of a right triangle is the hypotenuse?', options: ['The side across from the right angle — the longest side', 'The shortest side', 'The bottom side', 'Either leg'], correct: 0, explain: 'The hypotenuse faces the right angle and is always the longest. That’s the one that goes alone on the $c^2$ side.' },
  ],
  generate(rng, level) {
    const u = rng.pick(UNITS)
    if (level === 1) {
      const t = rng.pick(TRIPLES.slice(0, 4))
      const k = t[0] === 3 ? rng.int(1, 4) : t[0] === 5 ? rng.int(1, 2) : 1
      const [a, b, c] = t.map((s) => s * k)
      const [x, y] = rng.chance(0.5) ? [a, b] : [b, a]
      return {
        prompt: `A right triangle has legs of $${x}$ ${u} and $${y}$ ${u}. How long is the hypotenuse?`,
        answer: { kind: 'num', value: c, unit: u },
        hints: ['Use $a^2 + b^2 = c^2$, where $c$ is the hypotenuse.', `$${x}^2 + ${y}^2 = ${x * x} + ${y * y} = ${c * c}$`, `Now undo the square: $c = \\sqrt{${c * c}}$.`],
        steps: [
          { text: 'Square the legs and add:', math: `${x}^2 + ${y}^2 = ${x * x} + ${y * y} = ${c * c}` },
          { text: 'That’s $c^2$. Take the square root:', math: `c = \\sqrt{${c * c}} = ${c}` },
          { text: `Sense check: ${c} is longer than each leg but shorter than ${x} + ${y} = ${x + y} ✓` },
        ],
        mistakes: [
          { value: x + y, say: 'You added the legs. The diagonal is a shortcut — square the legs, add, then take the square root.' },
          { value: c * c, say: `That’s $c^2$. Take the square root to get $c$.` },
          { when: near(Math.sqrt(x + y), 0.06), say: 'Square each leg **before** adding: $a^2 + b^2$, not $a + b$.' },
        ],
        visual: { type: 'tri', right: true, sides: [`${x}`, 'c', `${y}`] },
      }
    }

    if (level === 2) {
      const kind = rng.pick(['leg', 'leg', 'hyp', 'converse'] as const)
      if (kind === 'converse') {
        const t = rng.pick(TRIPLES)
        const k = t[2] > 20 ? 1 : rng.int(1, 3)
        let [a, b, c] = t.map((s) => s * k)
        const isRight = rng.chance(0.5)
        if (!isRight) c += rng.pick([-1, 1, 2])
        const opts = ['Yes', 'No']
        const sum = a * a + b * b
        return {
          prompt: `A triangle has sides $${a}$, $${b}$ and $${c}$. Is it a right triangle?`,
          answer: { kind: 'choice', options: opts, correct: isRight ? 0 : 1 },
          hints: ['A triangle is right exactly when $a^2 + b^2 = c^2$, with $c$ the longest side.', `Square the two shorter sides and add: $${a}^2 + ${b}^2 = ${sum}$.`, `Compare with the longest side squared: $${c}^2 = ${c * c}$.`],
          steps: [
            { text: 'Shorter sides, squared and added:', math: `${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${sum}` },
            { text: 'Longest side, squared:', math: `${c}^2 = ${c * c}` },
            { text: isRight ? `They match, so **yes** — it’s a right triangle.` : `$${sum} \\ne ${c * c}$, so **no** — it isn’t a right triangle (but it’s close!).` },
          ],
          mistakes: [{ when: (raw) => raw !== String(isRight ? 0 : 1), say: isRight ? `Check: ${a * a} + ${b * b} = ${c * c} exactly — it works.` : `Close isn’t enough: ${sum} ≠ ${c * c}. It has to match exactly.` }],
        }
      }
      const t = rng.pick(TRIPLES)
      const k = t[2] > 20 ? 1 : rng.int(1, 3)
      const [a, b, c] = t.map((s) => s * k)
      if (kind === 'hyp') {
        return {
          prompt: `Find the hypotenuse of a right triangle with legs $${a}$ ${u} and $${b}$ ${u}.`,
          answer: { kind: 'num', value: c, unit: u },
          hints: ['$a^2 + b^2 = c^2$', `$${a * a} + ${b * b} = ${c * c}$`, `$\\sqrt{${c * c}} = \\;?$`],
          steps: [
            { text: 'Square and add the legs:', math: `${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}` },
            { text: 'Square root:', math: `c = \\sqrt{${c * c}} = ${c}` },
          ],
          mistakes: [
            { value: a + b, say: 'Adding the legs gives the long way round. The hypotenuse needs $\\sqrt{a^2 + b^2}$.' },
            { value: c * c, say: 'That’s $c^2$ — take the square root.' },
          ],
          visual: { type: 'tri', right: true, sides: [`${a}`, 'c', `${b}`] },
        }
      }
      const giveA = rng.chance(0.5)
      const known = giveA ? a : b
      const want = giveA ? b : a
      const wrongAdd = Math.sqrt(c * c + known * known)
      return {
        prompt: `A right triangle has a hypotenuse of $${c}$ ${u} and one leg of $${known}$ ${u}. Find the other leg.`,
        answer: { kind: 'num', value: want, unit: u },
        hints: ['The hypotenuse’s square is the **total**: $a^2 + b^2 = c^2$.', `So the missing leg squared is $${c}^2 - ${known}^2$. **Subtract**, don’t add.`, `$${c * c} - ${known * known} = ${want * want}$. Take the square root.`],
        steps: [
          { text: 'Set up the theorem:', math: `${known}^2 + b^2 = ${c}^2` },
          { text: 'Subtract to isolate $b^2$:', math: `b^2 = ${c * c} - ${known * known} = ${want * want}` },
          { text: 'Square root:', math: `b = \\sqrt{${want * want}} = ${want}` },
          { text: `Sense check: the leg (${want}) is shorter than the hypotenuse (${c}) ✓` },
        ],
        mistakes: [
          { when: near(wrongAdd, 0.06), say: 'You **added** the squares. The hypotenuse is the longest side, so its square is the total — subtract the known leg’s square from it.' },
          { value: c - known, say: 'Subtracting the lengths doesn’t work. Subtract the **squares**: $c^2 - a^2$, then take the root.' },
          { value: want * want, say: 'That’s $b^2$. Take the square root.' },
        ],
        visual: { type: 'tri', right: true, sides: giveA ? [`${known}`, `${c}`, '?'] : ['?', `${c}`, `${known}`] },
      }
    }

    // level 3: word problems
    const kind = rng.pick(['ladder', 'flight', 'screen', 'field', 'kite'] as const)
    if (kind === 'ladder') {
      const t = rng.pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [7, 24, 25]] as const)
      const k = t[2] <= 10 ? rng.int(1, 3) : 1
      const [a, b, c] = [t[0] * k, t[1] * k, t[2] * k]
      const findHeight = rng.chance(0.6)
      if (findHeight)
        return {
          prompt: `A $${c}$ ft ladder leans against a wall. Its foot is $${a}$ ft from the base of the wall. How high up the wall does it reach?`,
          answer: { kind: 'num', value: b, unit: 'ft' },
          hints: ['Wall, ground and ladder form a right triangle. Which side is the hypotenuse?', `The ladder (${c} ft) is across from the right angle — it’s $c$. You want a **leg**.`, `$h^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$`],
          steps: [
            { text: 'The ladder is the hypotenuse; the wall height is a leg:', math: `${a}^2 + h^2 = ${c}^2` },
            { text: 'Subtract:', math: `h^2 = ${c * c} - ${a * a} = ${b * b}` },
            { text: 'Square root:', math: `h = ${b}\\text{ ft}` },
          ],
          mistakes: [
            { when: near(Math.sqrt(c * c + a * a), 0.06), say: 'The ladder is the **hypotenuse**, so subtract: $c^2 - a^2$.' },
            { value: c - a, say: 'Subtract the **squares**, not the lengths.' },
          ],
          visual: { type: 'tri', right: true, sides: ['h', `${c} ft`, `${a} ft`] },
        }
      return {
        prompt: `A ladder must reach a window $${b}$ ft up a wall, with its foot $${a}$ ft out from the wall. How long must the ladder be?`,
        answer: { kind: 'num', value: c, unit: 'ft' },
        hints: ['Draw it: the wall and ground meet at a right angle; the ladder is the slanted side.', 'The ladder is the hypotenuse.', `$${a}^2 + ${b}^2 = ${c * c}$`],
        steps: [
          { text: 'Legs are the height and the distance out:', math: `${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}` },
          { text: 'Square root:', math: `L = \\sqrt{${c * c}} = ${c}\\text{ ft}` },
        ],
        mistakes: [
          { value: a + b, say: 'Adding the legs overshoots — the ladder takes the diagonal shortcut. Use $a^2 + b^2 = c^2$.' },
          { value: c * c, say: 'That’s the ladder length **squared**. Take the square root.' },
        ],
        visual: { type: 'tri', right: true, sides: [`${b} ft`, 'L', `${a} ft`] },
      }
    }
    if (kind === 'flight') {
      const t = rng.pick(TRIPLES)
      const k = rng.pick([5, 10, 20])
      const [a, b, c] = t.map((s) => s * k)
      return {
        prompt: `A training jet flies $${a}$ miles due north, then turns and flies $${b}$ miles due east. How far is it now from where it started, in a straight line?`,
        answer: { kind: 'num', value: c, unit: 'miles' },
        hints: ['North and east are at right angles — sketch the path as two legs of a right triangle.', 'The straight-line distance back to the start is the hypotenuse.', `$\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}}$`],
        steps: [
          { text: 'The two legs of the flight meet at 90°:', math: `d^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}` },
          { text: 'Square root:', math: `d = \\sqrt{${c * c}} = ${c}\\text{ miles}` },
          { text: `That saves ${a + b - c} miles compared with flying the two legs back.` },
        ],
        mistakes: [
          { value: a + b, say: 'That’s the distance flown. The straight-line distance is the hypotenuse — shorter.' },
          { value: c * c, say: 'Take the square root at the end.' },
        ],
        visual: { type: 'tri', right: true, sides: [`${a} mi`, 'd', `${b} mi`] },
      }
    }
    // non-triple: round to the nearest tenth
    let a: number, b: number
    do {
      a = rng.int(2, 15)
      b = rng.int(2, 15)
    } while (isSquare(a * a + b * b) || a === b)
    if (kind === 'screen' || kind === 'field') {
      const isScreen = kind === 'screen'
      const unit = isScreen ? 'in' : 'm'
      const [W, H] = isScreen ? [a + 10, b + 5] : [a * 3, b * 2]
      const ex2 = Math.sqrt(W * W + H * H)
      const val = r1(ex2)
      return {
        prompt: isScreen
          ? `A cockpit display is $${W}$ in wide and $${H}$ in tall. Screens are sold by their **diagonal**. How long is the diagonal, to the nearest tenth of an inch?`
          : `A rectangular training field is $${W}$ m long and $${H}$ m wide. How long is a path straight across it from corner to corner? Round to the nearest tenth.`,
        answer: { kind: 'num', value: val, tol: 0.06, unit },
        hints: ['The diagonal cuts the rectangle into two right triangles.', `The diagonal is the hypotenuse; the legs are ${W} and ${H}.`, `$\\sqrt{${W}^2 + ${H}^2} = \\sqrt{${W * W + H * H}}$`],
        steps: [
          { text: 'Square and add the sides:', math: `${W}^2 + ${H}^2 = ${W * W} + ${H * H} = ${W * W + H * H}` },
          { text: 'Square root (a calculator helps):', math: `\\sqrt{${W * W + H * H}} \\approx ${ex2.toFixed(3)}` },
          { text: `To the nearest tenth: **${val} ${unit}**.` },
        ],
        mistakes: [
          { value: W + H, say: 'Adding the sides gives the long way around the corner. The diagonal is $\\sqrt{w^2 + h^2}$.' },
          { value: W * W + H * H, say: 'That’s the diagonal squared. Take the square root.' },
        ],
        visual: { type: 'tri', right: true, sides: [`${H} ${unit}`, 'd', `${W} ${unit}`] },
      }
    }
    // kite: find a leg, rounded
    const c = Math.max(a, b) + rng.int(3, 12)
    const leg = Math.min(a, b)
    const ex3 = Math.sqrt(c * c - leg * leg)
    return {
      prompt: `A kite flies on a $${c}$ m string. The kite is directly above a point $${leg}$ m away from you across the field. How high is the kite? Round to the nearest tenth (ignore your own height).`,
      answer: { kind: 'num', value: r1(ex3), tol: 0.06, unit: 'm' },
      hints: ['The string is the slanted side — the hypotenuse.', `Height is a leg: $h^2 = ${c}^2 - ${leg}^2$.`, `$h = \\sqrt{${c * c - leg * leg}}$`],
      steps: [
        { text: 'The string is the hypotenuse:', math: `h^2 + ${leg}^2 = ${c}^2` },
        { text: 'Subtract:', math: `h^2 = ${c * c} - ${leg * leg} = ${c * c - leg * leg}` },
        { text: 'Square root and round:', math: `h = \\sqrt{${c * c - leg * leg}} \\approx ${ex3.toFixed(3)} \\approx ${r1(ex3)}` },
      ],
      mistakes: [
        { when: near(Math.sqrt(c * c + leg * leg), 0.06), say: 'The string is the **hypotenuse** — subtract the squares, don’t add them.' },
        { value: c - leg, say: 'Subtract the **squares**, then take the root.' },
        { value: c * c - leg * leg, say: 'That’s $h^2$. Take the square root.' },
      ],
      visual: { type: 'tri', right: true, sides: ['h', `${c} m`, `${leg} m`] },
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. VOLUME
// ═══════════════════════════════════════════════════════════════════════════
const volume: Skill = {
  id: 'volume',
  unit: 'geo',
  title: 'Volume: prisms & cylinders',
  blurb: 'Volume = area of the base × height. Boxes and cans, same idea.',
  prereqs: ['area-rect', 'circles'],
  why: 'How much fuel fits in a tank, how much concrete a slab needs, how much cargo a container holds — volume is how much **space** something fills.',
  learn: [
    { kind: 'idea', title: 'Volume counts cubes', body: 'Volume is the number of **unit cubes** that fill a solid. A box $4 \\times 3 \\times 2$: the bottom layer holds $4 \\times 3 = 12$ cubes, and there are $2$ layers — $24$ cubes in all.', math: 'V = l \\times w \\times h' },
    { kind: 'idea', title: 'Base × height works for any prism', body: 'The trick is **layers**: find the area of the base (how many cubes in one layer), then multiply by how many layers stack up (the height). A cylinder is the same thing with a circular base:', math: 'V_{\\text{box}} = (l w)\\,h \\qquad V_{\\text{cylinder}} = (\\pi r^2)\\,h' },
    { kind: 'trap', title: 'Adding the dimensions', wrong: 'A $2 \\times 3 \\times 4$ box has volume $2 + 3 + 4 = 9$.', right: '$V = 2 \\times 3 \\times 4 = 24$ cubic units.', why: 'Volume counts cubes in layers — rows × columns × layers. Adding lengths gives a length, not a space.' },
    { kind: 'trap', title: 'Diameter in the cylinder formula', wrong: 'A can with diameter 6 and height 10: $3.14 \\times 6^2 \\times 10 = 1130.4$', right: 'Radius $= 3$: $3.14 \\times 3^2 \\times 10 = 282.6$', why: 'Same trap as circle area — $\\pi r^2$ needs the **radius**. Using the diameter makes the answer 4× too big.' },
    { kind: 'check', question: 'You double **every** edge of a cube. What happens to its volume?', options: ['It becomes 8 times bigger', 'It doubles', 'It becomes 4 times bigger', 'It becomes 6 times bigger'], correct: 0, explain: 'Length, width and height each double: $2 \\times 2 \\times 2 = 8$. Volume grows with the **cube** of the size — that’s why big tanks hold so much more.' },
  ],
  generate(rng, level) {
    const u = rng.pick(UNITS)
    const PIT = '3.14'
    if (level === 1) {
      const cube = rng.chance(0.2)
      const l = rng.int(2, 12)
      const w = cube ? l : rng.int(2, 10)
      const h = cube ? l : rng.int(2, 10)
      const V = l * w * h
      return {
        prompt: cube ? `A cube has edges of $${l}$ ${u}. What is its volume?` : `A box is $${l}$ ${u} long, $${w}$ ${u} wide and $${h}$ ${u} tall. What is its volume?`,
        answer: { kind: 'num', value: V, unit: `${u}³` },
        hints: ['Volume = how many unit cubes fill the box.', `One layer on the bottom holds $${l} \\times ${w} = ${l * w}$ cubes.`, `There are $${h}$ layers: $${l * w} \\times ${h}$.`],
        steps: [
          { text: 'Area of the base (one layer of cubes):', math: `${l} \\times ${w} = ${l * w}` },
          { text: 'Times the number of layers (the height):', math: `${l * w} \\times ${h} = ${V}` },
          { text: `**${V} ${u}³** — cubic units, because we counted cubes.` },
        ],
        mistakes: [
          { value: l + w + h, say: 'You added the edges. Volume **multiplies** them: length × width × height.' },
          { value: l * w, say: 'That’s just the bottom layer. Multiply by the height to stack up all the layers.' },
          { value: 2 * (l * w + l * h + w * h), say: 'That’s the **surface area** (the wrapping paper). Volume is the space inside: $l \\times w \\times h$.' },
        ],
        visual: { type: 'box', l: `${l} ${u}`, w: `${w} ${u}`, h: `${h} ${u}` },
      }
    }

    if (level === 2) {
      const kind = rng.pick(['cyl', 'cyl', 'missing'] as const)
      if (kind === 'cyl') {
        const r = rng.int(1, 9)
        const h = rng.int(2, 15)
        const V = c4(PI * r * r * h)
        return {
          prompt: `A cylinder has a radius of $${r}$ ${u} and a height of $${h}$ ${u}. Find its volume. Use $\\pi \\approx ${PIT}$.`,
          answer: { kind: 'num', value: V, tol: piTol(V), unit: `${u}³` },
          hints: ['Volume = area of the base × height. What shape is the base?', `The base is a circle: $\\pi r^2 = ${PIT} \\times ${r * r} = ${c4(PI * r * r)}$.`, `Multiply by the height, ${h}.`],
          steps: [
            { text: 'Base area (a circle):', math: `\\pi r^2 = ${PIT} \\times ${r}^2 = ${c4(PI * r * r)}` },
            { text: 'Stack it up to the height:', math: `V = ${c4(PI * r * r)} \\times ${h} = ${V}\\text{ ${u}}^3` },
          ],
          mistakes: [
            ...(r !== 2 ? [{ when: near(c4(2 * PI * r * h)), say: 'That’s $2\\pi r h$ — the area of the curved side (the label on a can). Volume uses the base **area**: $\\pi r^2 h$.' }] : []),
            ...(r !== 1 ? [{ when: near(c4(PI * r * h)), say: 'You forgot to square the radius: $\\pi r^2 h$.' }] : []),
            { when: near(c4(PI * 4 * r * r * h)), say: 'Looks like you used the diameter. The formula needs the **radius**.' },
          ],
          visual: { type: 'cylinder', r: `${r} ${u}`, h: `${h} ${u}` },
        }
      }
      const l = rng.int(2, 12)
      const w = rng.int(2, 10)
      const h = rng.int(2, 10)
      const V = l * w * h
      return {
        prompt: `A crate has a volume of $${V}$ ${u}³. Its base is $${l}$ ${u} by $${w}$ ${u}. How tall is it?`,
        answer: { kind: 'num', value: h, unit: u },
        hints: ['$V = l \\times w \\times h$. Fill in what you know.', `The base area is $${l} \\times ${w} = ${l * w}$, so $${l * w} \\times h = ${V}$.`, `Divide: $${V} \\div ${l * w}$.`],
        steps: [
          { text: 'Base area:', math: `${l} \\times ${w} = ${l * w}` },
          { text: 'Volume = base area × height:', math: `${l * w} \\times h = ${V}` },
          { text: 'Divide:', math: `h = ${V} \\div ${l * w} = ${h}` },
        ],
        mistakes: [
          { value: V - l - w, say: 'Volume is a **product**, so undo it by dividing, not subtracting.' },
          { value: V / l, say: 'Divide by the **whole** base area ($l \\times w$), not just one side.' },
          { value: V - l * w, say: 'Divide by the base area — volume is base area **times** height.' },
        ],
        visual: { type: 'box', l: `${l} ${u}`, w: `${w} ${u}`, h: '?' },
      }
    }

    // level 3
    const kind = rng.pick(['cyl-d', 'cubes', 'water', 'tank-liters'] as const)
    if (kind === 'cyl-d') {
      const r = rng.int(2, 10)
      const d = 2 * r
      const h = rng.int(3, 20)
      const V = c4(PI * r * r * h)
      return {
        prompt: `A cylindrical fuel drum is $${d}$ in across (diameter) and $${h}$ in tall. What is its volume? Use $\\pi \\approx ${PIT}$.`,
        answer: { kind: 'num', value: V, tol: piTol(V), unit: 'in³' },
        hints: ['The formula $V = \\pi r^2 h$ needs the **radius**.', `Radius $= ${d} \\div 2 = ${r}$.`, `$${PIT} \\times ${r * r} \\times ${h}$`],
        steps: [
          { text: 'Halve the diameter:', math: `r = ${r}` },
          { text: 'Base area:', math: `${PIT} \\times ${r}^2 = ${c4(PI * r * r)}` },
          { text: 'Times height:', math: `V = ${c4(PI * r * r)} \\times ${h} = ${V}\\text{ in}^3` },
        ],
        mistakes: [
          { when: near(c4(PI * d * d * h)), say: 'You used the **diameter** as the radius — 4× too big. Halve it first.' },
          { when: near(c4(PI * d * h)), say: 'Square the **radius** for the base area: $\\pi r^2$.' },
        ],
        visual: { type: 'cylinder', r: `d = ${d} in`, h: `${h} in` },
      }
    }
    if (kind === 'cubes') {
      const s = rng.pick([2, 3, 4, 5])
      const a = rng.int(2, 6)
      const b = rng.int(2, 6)
      const c = rng.int(2, 5)
      const n = a * b * c
      return {
        prompt: `How many $${s}$ cm cubes fit exactly inside a box that is $${a * s}$ cm by $${b * s}$ cm by $${c * s}$ cm?`,
        answer: { kind: 'num', value: n },
        hints: ['Count how many cubes fit along each edge.', `Along the length: $${a * s} \\div ${s} = ${a}$. Do the same for the width and height.`, `$${a} \\times ${b} \\times ${c} = \\;?$`],
        steps: [
          { text: 'Cubes along each edge:', math: `${a * s} \\div ${s} = ${a},\\quad ${b * s} \\div ${s} = ${b},\\quad ${c * s} \\div ${s} = ${c}` },
          { text: 'Multiply:', math: `${a} \\times ${b} \\times ${c} = ${n}` },
          { text: `Check with volumes: box $${a * s * b * s * c * s}$ cm³ ÷ one cube $${s ** 3}$ cm³ $= ${n}$ ✓` },
        ],
        mistakes: [
          { value: (a * s * b * s * c * s) / s, say: `Each cube’s volume is $${s}^3 = ${s ** 3}$ cm³, not ${s}. Divide by the cube’s **volume** — or count cubes along each edge.` },
          { value: a * s * b * s * c * s, say: 'That’s the box volume in cm³ — the number of **1 cm** cubes. These cubes are bigger.' },
        ],
        visual: { type: 'box', l: `${a * s} cm`, w: `${b * s} cm`, h: `${c * s} cm` },
      }
    }
    if (kind === 'water') {
      const l = rng.int(4, 15) * 10
      const w = rng.int(3, 8) * 10
      const H = rng.int(4, 8) * 10
      const d = rng.int(2, H / 10 - 1) * 10
      const V = l * w * d
      return {
        prompt: `A fish tank is $${l}$ cm long, $${w}$ cm wide and $${H}$ cm tall. It is filled with water to a depth of $${d}$ cm. What volume of water is in it, in cm³?`,
        answer: { kind: 'num', value: V, unit: 'cm³' },
        hints: ['The water itself is a box shape — but how tall is it?', `The water is ${d} cm deep, not ${H} cm. Use the water’s depth as the height.`, `$${l} \\times ${w} \\times ${d}$`],
        steps: [
          { text: 'The water forms a box with the tank’s base and the water’s depth:', math: `V = ${l} \\times ${w} \\times ${d}` },
          { text: 'Multiply:', math: `V = ${V}\\text{ cm}^3` },
          { text: `(That’s ${V / 1000} liters — 1 liter = 1000 cm³.)` },
        ],
        mistakes: [
          { value: l * w * H, say: 'That’s the whole tank. The water only fills it to ' + d + ' cm.' },
          { value: l * w * (H - d), say: 'That’s the empty space above the water.' },
        ],
        visual: { type: 'box', l: `${l} cm`, w: `${w} cm`, h: `${d} cm (water)` },
      }
    }
    const l = rng.int(3, 12) * 10
    const w = rng.int(2, 8) * 10
    const h = rng.int(2, 8) * 10
    const V = l * w * h
    return {
      prompt: `A rectangular fuel tank measures $${l}$ cm by $${w}$ cm by $${h}$ cm. How many **liters** does it hold? ($1$ liter $= 1000$ cm³.)`,
      answer: { kind: 'num', value: V / 1000, unit: 'L' },
      hints: ['Find the volume in cm³ first.', `$${l} \\times ${w} \\times ${h} = ${V}$ cm³`, `Every 1000 cm³ is one liter: $${V} \\div 1000$.`],
      steps: [
        { text: 'Volume in cubic centimeters:', math: `${l} \\times ${w} \\times ${h} = ${V}\\text{ cm}^3` },
        { text: 'Convert to liters:', math: `${V} \\div 1000 = ${V / 1000}\\text{ L}` },
      ],
      mistakes: [
        { value: V, say: 'That’s in cm³. Divide by 1000 to convert to liters.' },
        { value: V / 100, say: 'One liter is **1000** cm³ (a 10 × 10 × 10 cube), so divide by 1000.' },
        { value: V * 1000, say: 'Going from small units (cm³) to a big unit (L) makes the number **smaller** — divide.' },
      ],
      visual: { type: 'box', l: `${l} cm`, w: `${w} cm`, h: `${h} cm` },
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. SIMILAR FIGURES
// ═══════════════════════════════════════════════════════════════════════════
function triSides(rng: Rng, even = false): [number, number, number] {
  for (;;) {
    const s1 = rng.int(3, 8)
    const s2 = s1 + rng.int(1, 3)
    const s3 = s2 + rng.int(1, 3)
    if (s3 < s1 + s2) return even ? [s1 * 2, s2 * 2, s3 * 2] : [s1, s2, s3]
  }
}

const similar: Skill = {
  id: 'similar',
  unit: 'geo',
  title: 'Similar figures & scale',
  blurb: 'Same shape, different size: every length is multiplied by the same scale factor.',
  prereqs: ['proportions'],
  why: 'Maps, blueprints, scale models and shadows all work by similarity. It’s how surveyors measured mountains — and how you can find the height of a flagpole without climbing it.',
  learn: [
    { kind: 'idea', title: 'Same shape, scaled', body: 'Two figures are **similar** when one is an exact enlargement (or shrink) of the other. Every angle stays the same, and **every** length is multiplied by the same number — the **scale factor** $k$.', math: 'k = \\frac{\\text{new length}}{\\text{matching original length}}' },
    { kind: 'idea', title: 'Finding a missing side', body: 'Match up **corresponding** sides (the ones in the same position). Use a known pair to find $k$, then multiply. Or set up a proportion:', math: '\\frac{\\text{small}_1}{\\text{big}_1} = \\frac{\\text{small}_2}{\\text{big}_2}' },
    { kind: 'trap', title: 'Adding instead of multiplying', wrong: 'Sides 4 and 10 become 6 and $x$. “It grew by 2, so $x = 12$.”', right: '$4 \\to 6$ is $\\times 1.5$, so $x = 10 \\times 1.5 = 15$.', why: 'Scaling stretches everything by the same **factor**. Adding the same amount would warp the shape — short sides would grow proportionally more than long ones.' },
    { kind: 'idea', title: 'Shadows are similar triangles', body: 'At the same moment, the sun hits a person and a flagpole at the same angle. Each object and its shadow make a right triangle — and those triangles are similar:', math: '\\frac{\\text{height}}{\\text{shadow}} = \\frac{\\text{height}}{\\text{shadow}}' },
    { kind: 'check', question: 'Two triangles are similar with scale factor 3. An angle in the small one is $40^\\circ$. What is the matching angle in the big one?', options: ['$40^\\circ$', '$120^\\circ$', '$43^\\circ$', '$13.3^\\circ$'], correct: 0, explain: 'Scaling changes lengths, never angles. That’s what “same shape” means.' },
  ],
  generate(rng, level) {
    const u = rng.pick(UNITS)
    if (level === 1 || (level === 2 && rng.chance(0.6))) {
      // full small triangle known, find a side of the big one (L1: whole k; L2: k = 1.5 or 2.5)
      const half = level === 2
      const small = triSides(rng, half)
      const k = half ? rng.pick([1.5, 2.5]) : rng.int(2, 4)
      const big = small.map((s) => s * k) as [number, number, number]
      const i = rng.int(0, 2)
      let j = rng.int(0, 2)
      if (j === i) j = (i + 1) % 3
      const ans = big[i]
      const bigLabels = big.map((b, n) => (n === i ? 'x' : n === j ? `${b}` : '')) as [string, string, string]
      return {
        prompt: `The two triangles are similar. Find the missing side $x$ of the larger triangle.`,
        answer: { kind: 'num', value: ans, unit: u },
        hints: [`Find a pair of matching sides you know both of: $${small[j]}$ and $${big[j]}$.`, `Scale factor: $k = ${big[j]} \\div ${small[j]} = ${k}$. Every side of the big triangle is $${k}$ times its partner.`, `$x = ${small[i]} \\times ${k}$`],
        steps: [
          { text: 'Scale factor from the known pair:', math: `k = \\frac{${big[j]}}{${small[j]}} = ${k}` },
          { text: `$x$ matches the small side $${small[i]}$:`, math: `x = ${small[i]} \\times ${k} = ${ans}` },
          { text: 'Or as a proportion:', math: `\\frac{x}{${small[i]}} = \\frac{${big[j]}}{${small[j]}}` },
        ],
        mistakes: [
          { value: small[i] + (big[j] - small[j]), say: `You **added** the difference (${big[j] - small[j]}). Similar shapes are scaled by **multiplying** — find the scale factor.` },
          { value: small[i] / k, say: 'You shrank instead of enlarging. The big triangle’s sides are **bigger** — multiply by the scale factor.' },
          ...((big[j] * small[j]) / small[i] !== small[i] / k ? [{ value: (big[j] * small[j]) / small[i], say: 'Your proportion is upside down on one side. Keep small-over-big on **both** sides.' }] : []),
        ],
        visual: { type: 'similar', small: small.map(String) as [string, string, string], big: bigLabels },
      }
    }
    if (level === 2) {
      const kind = rng.pick(['find-small', 'factor'] as const)
      const small = triSides(rng)
      const k = rng.int(2, 5)
      const big = small.map((s) => s * k) as [number, number, number]
      const j = rng.int(0, 2)
      if (kind === 'factor')
        return {
          prompt: `The small triangle is enlarged to make the large one. What is the **scale factor**?`,
          answer: { kind: 'num', value: k },
          hints: ['Scale factor = new length ÷ matching original length.', `Match the corresponding sides: $${small[j]} \\to ${big[j]}$.`, `$${big[j]} \\div ${small[j]} = \\;?$`],
          steps: [
            { text: 'Divide a big side by its matching small side:', math: `k = \\frac{${big[j]}}{${small[j]}} = ${k}` },
            { text: `Check with another pair: $${small[(j + 1) % 3]} \\times ${k} = ${big[(j + 1) % 3]}$ ✓` },
          ],
          mistakes: [
            { value: 1 / k, say: 'That’s the factor for shrinking big → small. Going small → big, the factor is **more** than 1.' },
            { value: big[j] - small[j], say: 'That’s the difference. A scale factor is a **multiplier**: divide, don’t subtract.' },
          ],
          visual: { type: 'similar', small: small.map(String) as [string, string, string], big: big.map(String) as [string, string, string] },
        }
      let i = rng.int(0, 2)
      if (i === j) i = (j + 1) % 3
      const smallLabels = small.map((s, n) => (n === i ? 'x' : n === j ? `${s}` : '')) as [string, string, string]
      return {
        prompt: `The two triangles are similar. Find the missing side $x$ of the **smaller** triangle.`,
        answer: { kind: 'num', value: small[i], unit: u },
        hints: [`Use the matching pair $${small[j]}$ and $${big[j]}$ to find how the sizes compare.`, `The big triangle is $${big[j]} \\div ${small[j]} = ${k}$ times bigger.`, `So the small side is $${big[i]} \\div ${k}$.`],
        steps: [
          { text: 'Scale factor small → big:', math: `k = \\frac{${big[j]}}{${small[j]}} = ${k}` },
          { text: 'Going big → small, divide:', math: `x = ${big[i]} \\div ${k} = ${small[i]}` },
        ],
        mistakes: [
          { value: big[i] * k, say: 'You enlarged again. The small triangle’s sides are **smaller** — divide by the scale factor.' },
          { value: big[i] - (big[j] - small[j]), say: 'Subtracting the difference isn’t how scaling works. Divide by the scale factor.' },
        ],
        visual: { type: 'similar', small: smallLabels, big: big.map(String) as [string, string, string] },
      }
    }

    // level 3: shadows, models, maps
    const kind = rng.pick(['shadow', 'model', 'map'] as const)
    if (kind === 'shadow') {
      const h1 = rng.pick([5, 6])
      let s1 = rng.int(2, 9)
      if (s1 === h1) s1 = h1 + 2
      const m = rng.int(3, 12)
      const s2 = s1 * m
      const H = h1 * m
      return {
        prompt: `A $${h1}$ ft cadet casts a $${s1}$ ft shadow. At the same moment, a flagpole casts a $${s2}$ ft shadow. How tall is the flagpole?`,
        answer: { kind: 'num', value: H, unit: 'ft' },
        hints: ['The sun’s angle is the same for both, so the cadet + shadow and the pole + shadow are similar triangles.', `Shadow scale: the pole’s shadow is $${s2} \\div ${s1} = ${m}$ times longer.`, `So the pole is ${m} times taller than the cadet: $${h1} \\times ${m}$.`],
        steps: [
          { text: 'Set up height ÷ shadow for both:', math: `\\frac{${h1}}{${s1}} = \\frac{H}{${s2}}` },
          { text: 'Cross-multiply:', math: `${s1}H = ${h1} \\times ${s2} = ${h1 * s2}` },
          { text: 'Divide:', math: `H = ${h1 * s2} \\div ${s1} = ${H}\\text{ ft}` },
        ],
        mistakes: [
          { value: h1 + (s2 - s1), say: 'Adding the difference doesn’t keep the same shape. Use the ratio: the pole is as many times taller as its shadow is longer.' },
          ...((s1 * s2) / h1 !== H ? [{ value: (s1 * s2) / h1, say: 'Your proportion is flipped on one side. Keep **height over shadow** on both sides.' }] : []),
        ],
      }
    }
    if (kind === 'model') {
      const scale = rng.pick([24, 32, 48, 72])
      const len = rng.int(15, 45)
      const real = (len * scale) / 100
      const what = rng.pick(['wingspan', 'length'])
      return {
        prompt: `A scale model of a fighter jet is built at $1:${scale}$. The model’s ${what} is $${len}$ cm. What is the real jet’s ${what}, in **meters**?`,
        answer: { kind: 'num', value: real, unit: 'm' },
        hints: [`$1:${scale}$ means every real length is ${scale} times the model’s length.`, `Real ${what}: $${len} \\times ${scale} = ${len * scale}$ cm.`, 'Convert centimeters to meters: there are 100 cm in a meter.'],
        steps: [
          { text: 'Scale up:', math: `${len} \\times ${scale} = ${len * scale}\\text{ cm}` },
          { text: 'Convert to meters:', math: `${len * scale} \\div 100 = ${real}\\text{ m}` },
        ],
        mistakes: [
          { value: len * scale, say: 'That’s the right length, but in **centimeters**. Divide by 100 to get meters.' },
          { value: len / scale, say: 'The real jet is **bigger** than the model — multiply by the scale.' },
          { value: (len * scale) / 1000, say: 'There are 100 cm in a meter (not 1000).' },
        ],
      }
    }
    const kmPerCm = rng.pick([5, 10, 20, 25, 50])
    const cm = rng.int(3, 18) + rng.pick([0, 0.5])
    const km = cm * kmPerCm
    return {
      prompt: `On a flight-planning chart, $1$ cm represents $${kmPerCm}$ km. Two airfields are $${cm}$ cm apart on the chart. How far apart are they in real life?`,
      answer: { kind: 'num', value: km, unit: 'km' },
      hints: ['Every centimeter on the chart stands for the same real distance.', `There are $${cm}$ chart-centimeters, each worth $${kmPerCm}$ km.`, `$${cm} \\times ${kmPerCm} = \\;?$`],
      steps: [
        { text: 'Multiply chart distance by the scale:', math: `${cm} \\times ${kmPerCm} = ${km}\\text{ km}` },
      ],
      mistakes: [
        { value: cm / kmPerCm, say: 'Real distances are much bigger than chart distances — multiply by the scale.' },
        { value: cm + kmPerCm, say: 'Each centimeter is worth ' + kmPerCm + ' km — multiply, don’t add.' },
      ],
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. COORDINATE GEOMETRY: DISTANCE & MIDPOINT
// ═══════════════════════════════════════════════════════════════════════════
const coordGeo: Skill = {
  id: 'coord-geo',
  unit: 'geo',
  title: 'Distance & midpoint',
  blurb: 'Distance is Pythagoras on a grid; the midpoint averages the coordinates.',
  prereqs: ['pythag', 'int-add'],
  why: 'Navigation systems, game engines and GPS all store positions as coordinates. “How far apart?” and “where’s halfway?” are the two questions they answer most.',
  learn: [
    { kind: 'idea', title: 'Straight across or straight up', body: 'If two points share a $y$-coordinate, they’re on the same horizontal line. Their distance is just the gap between the $x$’s — **subtract** (and drop any minus sign). From $(-3, 2)$ to $(5, 2)$: $5 - (-3) = 8$.' },
    { kind: 'idea', title: 'Diagonal distance = Pythagoras', body: 'For any two points, draw the horizontal and vertical legs between them to make a right triangle. The legs are the $x$-gap and the $y$-gap; the distance is the hypotenuse:', math: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}' },
    { kind: 'explore', title: 'It’s the same triangle', body: 'Leg $a$ is the vertical gap, leg $b$ is the horizontal gap. The hypotenuse is the distance between the two points.', widget: { w: 'pythag' }, task: 'Points (1, 2) and (7, 10) have gaps of 6 and 8. Set those legs. How far apart are the points?' },
    { kind: 'idea', title: 'Midpoint = average', body: 'Halfway between two points, you’re halfway in $x$ **and** halfway in $y$. Average each coordinate:', math: 'M = \\left(\\frac{x_1 + x_2}{2},\\ \\frac{y_1 + y_2}{2}\\right)' },
    { kind: 'trap', title: 'Halving the difference', wrong: 'Midpoint of $(2, 4)$ and $(8, 10)$ is $\\left(\\frac{8-2}{2}, \\frac{10-4}{2}\\right) = (3, 3)$.', right: '$\\left(\\frac{2+8}{2}, \\frac{4+10}{2}\\right) = (5, 7)$', why: 'Half the difference tells you how far to **move**, not where you end up. $(3, 3)$ isn’t even between the points. Add, then halve.' },
    { kind: 'check', question: 'How far apart are $(-3, 2)$ and $(5, 2)$?', options: ['$8$', '$2$', '$\\sqrt{68}$', '$4$'], correct: 0, explain: 'Same $y$, so it’s horizontal: from $-3$ to $5$ is $3 + 5 = 8$ steps. (2 comes from $5 - 3$, forgetting that −3 is on the other side of zero.)' },
  ],
  generate(rng, level) {
    const R = 10
    if (level === 1) {
      const kind = rng.pick(['horiz', 'vert', 'mid'] as const)
      if (kind === 'mid') {
        let x1: number, x2: number, y1: number, y2: number
        do {
          x1 = rng.int(-8, 8)
          x2 = rng.int(-8, 8)
          y1 = rng.int(-8, 8)
          y2 = rng.int(-8, 8)
        } while ((x1 + x2) % 2 !== 0 || (y1 + y2) % 2 !== 0 || x1 === x2 || y1 === y2)
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        return midpointProblem(x1, y1, x2, y2, mx, my, R)
      }
      const fixed = rng.int(-7, 7)
      let p = rng.int(-9, 8)
      let q = rng.int(-9, 9)
      while (q === p || Math.abs(q - p) < 2) q = rng.int(-9, 9)
      if (p > q) [p, q] = [q, p]
      const d = q - p
      const A = kind === 'horiz' ? [p, fixed] : [fixed, p]
      const B = kind === 'horiz' ? [q, fixed] : [fixed, q]
      const wrongAbs = Math.abs(Math.abs(q) - Math.abs(p))
      const which = kind === 'horiz' ? 'x' : 'y'
      return {
        prompt: `How far apart are the points $A${pt(A[0], A[1])}$ and $B${pt(B[0], B[1])}$?`,
        answer: { kind: 'num', value: d },
        hints: [`Both points have the same ${kind === 'horiz' ? '$y$' : '$x$'}, so the segment is ${kind === 'horiz' ? 'horizontal' : 'vertical'}.`, `The distance is the gap between the ${which}-values: $${q} - ${pn(p)}$.`, p < 0 && q > 0 ? `From ${p} up to 0 is ${-p}, and from 0 up to ${q} is ${q}. Add them.` : `$${q} - ${pn(p)} = ${d}$`],
        steps: [
          { text: `Same ${kind === 'horiz' ? '$y$' : '$x$'}, so just compare the ${which}-coordinates.` },
          { text: 'Subtract the smaller from the larger:', math: `${q} - ${pn(p)} = ${d}` },
          { text: `They are **${d} units** apart. (Count the grid squares to check.)` },
        ],
        mistakes: [
          ...(wrongAbs !== d ? [{ value: wrongAbs, say: 'When the points are on opposite sides of zero, the distance **crosses** zero: add the two distances from zero (subtracting a negative = adding).' }] : []),
          ...(Math.abs(p + q) !== d && p + q !== 0 && wrongAbs !== Math.abs(p + q) ? [{ value: Math.abs(p + q), say: 'Distance is the **difference** between the coordinates, not their sum.' }] : []),
          { value: d + 1, say: 'Off by one — you probably counted the grid **points** from A to B. Count the **gaps** (steps) between them instead.' },
        ],
        visual: { type: 'plane', range: R, points: [{ x: A[0], y: A[1], label: 'A' }, { x: B[0], y: B[1], label: 'B' }], segment: [[A[0], A[1]], [B[0], B[1]]] },
      }
    }

    if (level === 2) {
      if (rng.chance(0.4)) {
        let x1: number, x2: number, y1: number, y2: number
        do {
          x1 = rng.int(-9, 9)
          x2 = rng.int(-9, 9)
          y1 = rng.int(-9, 9)
          y2 = rng.int(-9, 9)
        } while ((x1 + x2) % 2 !== 0 || (y1 + y2) % 2 !== 0 || x1 === x2 || y1 === y2 || (x1 * x2 > 0 && y1 * y2 > 0))
        return midpointProblem(x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2, R)
      }
      const [a, b, c] = rng.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [4, 3, 5], [12, 5, 13], [9, 12, 15], [12, 9, 15]] as const)
      const sx = rng.chance(0.5) ? 1 : -1
      const sy = rng.chance(0.5) ? 1 : -1
      const x1 = sx > 0 ? rng.int(-R, R - a) : rng.int(-R + a, R)
      const y1 = sy > 0 ? rng.int(-R, R - b) : rng.int(-R + b, R)
      const x2 = x1 + sx * a
      const y2 = y1 + sy * b
      return distanceProblem(x1, y1, x2, y2, c, undefined, R)
    }

    // level 3
    const kind = rng.pick(['dist-round', 'mid-half', 'endpoint'] as const)
    if (kind === 'dist-round') {
      let x1: number, x2: number, y1: number, y2: number
      do {
        x1 = rng.int(-9, 9)
        x2 = rng.int(-9, 9)
        y1 = rng.int(-9, 9)
        y2 = rng.int(-9, 9)
      } while (x1 === x2 || y1 === y2 || isSquare((x2 - x1) ** 2 + (y2 - y1) ** 2))
      const ex = Math.hypot(x2 - x1, y2 - y1)
      return distanceProblem(x1, y1, x2, y2, r1(ex), ex, R)
    }
    if (kind === 'mid-half') {
      let x1: number, x2: number, y1: number, y2: number
      do {
        x1 = rng.int(-9, 9)
        x2 = rng.int(-9, 9)
        y1 = rng.int(-9, 9)
        y2 = rng.int(-9, 9)
      } while (x1 === x2 || y1 === y2 || ((x1 + x2) % 2 === 0 && (y1 + y2) % 2 === 0))
      return midpointProblem(x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2, R)
    }
    // endpoint: given A and midpoint M, find B
    let ax: number, ay: number, bx: number, by: number
    do {
      ax = rng.int(-9, 9)
      ay = rng.int(-9, 9)
      bx = rng.int(-9, 9)
      by = rng.int(-9, 9)
    } while ((ax + bx) % 2 !== 0 || (ay + by) % 2 !== 0 || ax === bx || ay === by)
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    return {
      prompt: `$M${pt(mx, my)}$ is the midpoint of segment $AB$, and $A = ${pt(ax, ay)}$. Find the coordinates of $B$.`,
      answer: { kind: 'pair', x: bx, y: by },
      placeholder: '(x, y)',
      hints: ['The midpoint is halfway, so $B$ is the same distance past $M$ as $M$ is from $A$.', `From $A$ to $M$: $x$ changes by $${mx - ax}$, $y$ changes by $${my - ay}$.`, `Make the same move again from $M$: $(${mx} + ${pn(mx - ax)},\\ ${my} + ${pn(my - ay)})$.`],
      steps: [
        { text: 'Step from $A$ to $M$:', math: `\\Delta x = ${mx} - ${pn(ax)} = ${mx - ax},\\quad \\Delta y = ${my} - ${pn(ay)} = ${my - ay}` },
        { text: 'Take the same step again from $M$:', math: `B = (${mx} + ${pn(mx - ax)},\\ ${my} + ${pn(my - ay)}) = ${pt(bx, by)}` },
        { text: 'Or algebraically: $B = 2M - A$.', math: `(2 \\cdot ${pn(mx)} - ${pn(ax)},\\ 2 \\cdot ${pn(my)} - ${pn(ay)}) = ${pt(bx, by)}` },
      ],
      mistakes: [
        { when: pairIs((ax + mx) / 2, (ay + my) / 2), say: 'That’s the midpoint of $A$ and $M$ — you went **back** toward $A$. $B$ is on the far side of $M$.' },
        { when: pairIs(mx - ax, my - ay), say: 'That’s the **step** from $A$ to $M$. Add it to $M$ to land on $B$.' },
        { when: pairIs(ax - mx + ax, ay - my + ay), say: 'You stepped the wrong way. $B$ is past $M$, on the opposite side from $A$.' },
      ],
      visual: { type: 'plane', range: R, points: [{ x: ax, y: ay, label: 'A' }, { x: mx, y: my, label: 'M' }] },
    }
  },
}

function midpointProblem(x1: number, y1: number, x2: number, y2: number, mx: number, my: number, R: number): Problem {
  return {
    prompt: `Find the midpoint of the segment from $A${pt(x1, y1)}$ to $B${pt(x2, y2)}$.`,
    answer: { kind: 'pair', x: mx, y: my },
    placeholder: '(x, y)',
    hints: ['The midpoint is halfway in $x$ and halfway in $y$ — the **average** of each coordinate.', `$x$: $\\frac{${x1} + ${pn(x2)}}{2}$. $y$: $\\frac{${y1} + ${pn(y2)}}{2}$.`, `$x = \\frac{${x1 + x2}}{2}$, $y = \\frac{${y1 + y2}}{2}$.${Number.isInteger(mx) && Number.isInteger(my) ? '' : ' Decimals like 2.5 are fine.'}`],
    steps: [
      { text: 'Average the $x$-coordinates:', math: `\\frac{${x1} + ${pn(x2)}}{2} = \\frac{${x1 + x2}}{2} = ${mx}` },
      { text: 'Average the $y$-coordinates:', math: `\\frac{${y1} + ${pn(y2)}}{2} = \\frac{${y1 + y2}}{2} = ${my}` },
      { text: `Midpoint: **${pt(mx, my)}**.` },
    ],
    mistakes: [
      { when: pairIs((x2 - x1) / 2, (y2 - y1) / 2), say: 'You halved the **difference** — that’s how far to move, not where you land. Add the coordinates, then halve.' },
      { when: pairIs((x1 - x2) / 2, (y1 - y2) / 2), say: 'You halved the **difference** — that’s how far to move, not where you land. Add the coordinates, then halve.' },
      { when: pairIs(x1 + x2, y1 + y2), say: 'You added the coordinates — now divide each by 2 to get the average.' },
    ],
    visual: { type: 'plane', range: R, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], segment: [[x1, y1], [x2, y2]] },
  }
}

function distanceProblem(x1: number, y1: number, x2: number, y2: number, ans: number, exact: number | undefined, R: number): Problem {
  const dx = x2 - x1
  const dy = y2 - y1
  const sq = dx * dx + dy * dy
  const rounded = exact !== undefined
  return {
    prompt: `Find the distance between $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$.${rounded ? ' Round to the nearest tenth.' : ''}`,
    answer: { kind: 'num', value: ans, ...(rounded ? { tol: 0.06 } : {}) },
    hints: ['Make a right triangle: a horizontal leg and a vertical leg join $A$ to $B$.', `Horizontal leg: $${x2} - ${pn(x1)} = ${dx}$. Vertical leg: $${y2} - ${pn(y1)} = ${dy}$.`, `$d = \\sqrt{${pn(dx)}^2 + ${pn(dy)}^2} = \\sqrt{${sq}}$`],
    steps: [
      { text: 'Find the gaps:', math: `\\Delta x = ${x2} - ${pn(x1)} = ${dx},\\quad \\Delta y = ${y2} - ${pn(y1)} = ${dy}` },
      { text: 'Pythagoras (squaring removes any minus signs):', math: `d = \\sqrt{${pn(dx)}^2 + ${pn(dy)}^2} = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${sq}}` },
      { text: rounded ? `$\\sqrt{${sq}} \\approx ${exact!.toFixed(3)}$, so **${ans}** to the nearest tenth.` : `$\\sqrt{${sq}} = ${ans}$` },
    ],
    mistakes: [
      { value: Math.abs(dx) + Math.abs(dy), say: 'That’s the distance if you walk along the grid lines. The straight-line distance is the hypotenuse: $\\sqrt{\\Delta x^2 + \\Delta y^2}$.' },
      { value: sq, say: 'That’s $d^2$. Take the square root.' },
      { when: (_, n) => n !== null && Math.abs(n - Math.sqrt((x1 + x2) ** 2 + (y1 + y2) ** 2)) < 0.06 && x1 * x2 !== 0, say: 'Use the **differences** of the coordinates ($x_2 - x_1$), not their sums.' },
    ],
    visual: { type: 'plane', range: R, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], segment: [[x1, y1], [x2, y2]] },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. TRANSFORMATIONS
// ═══════════════════════════════════════════════════════════════════════════
type Move = { name: string; tex: string; f: (x: number, y: number) => [number, number]; rule: string; why: string }
const MOVES: Record<string, Move> = {
  rx: { name: 'reflect over the $x$-axis', tex: 'x-axis', f: (x, y) => [x, -y], rule: '(x, y) \\to (x, -y)', why: 'The $x$-axis is the mirror, so the point flips up ↔ down: $x$ stays, $y$ changes sign.' },
  ry: { name: 'reflect over the $y$-axis', tex: 'y-axis', f: (x, y) => [-x, y], rule: '(x, y) \\to (-x, y)', why: 'The $y$-axis is the mirror, so the point flips left ↔ right: $y$ stays, $x$ changes sign.' },
  r180: { name: 'rotate $180^\\circ$ about the origin', tex: '180', f: (x, y) => [-x, -y], rule: '(x, y) \\to (-x, -y)', why: 'A half turn sends the point to the opposite side of the origin: both signs flip.' },
  r90: { name: 'rotate $90^\\circ$ counterclockwise about the origin', tex: '90ccw', f: (x, y) => [-y, x], rule: '(x, y) \\to (-y, x)', why: 'A quarter turn counterclockwise swaps the coordinates and makes the new $x$ the opposite of the old $y$.' },
  r90cw: { name: 'rotate $90^\\circ$ clockwise about the origin', tex: '90cw', f: (x, y) => [y, -x], rule: '(x, y) \\to (y, -x)', why: 'A quarter turn clockwise swaps the coordinates and makes the new $y$ the opposite of the old $x$.' },
  ryx: { name: 'reflect over the line $y = x$', tex: 'y=x', f: (x, y) => [y, x], rule: '(x, y) \\to (y, x)', why: 'The line $y = x$ is the mirror: reflecting over it simply swaps the coordinates.' },
}

function moveMistakes(key: string, x: number, y: number): Misconception[] {
  const out: Misconception[] = []
  const add = (k: string, say: string) => {
    if (k === key) return
    const [a, b] = MOVES[k].f(x, y)
    out.push({ when: pairIs(a, b), say })
  }
  if (key === 'rx') add('ry', 'That’s a reflection over the **y**-axis. Over the $x$-axis, the point flips up/down: keep $x$, negate $y$.')
  if (key === 'ry') add('rx', 'That’s a reflection over the **x**-axis. Over the $y$-axis, the point flips left/right: negate $x$, keep $y$.')
  if (key === 'rx' || key === 'ry') add('r180', 'You flipped **both** signs — that’s a 180° rotation. A reflection only flips one coordinate.')
  if (key === 'r90') {
    add('r90cw', 'That’s **clockwise**. Counterclockwise (the positive direction) is $(x, y) \\to (-y, x)$.')
    add('ryx', 'Swapping alone isn’t enough — one coordinate also changes sign. Counterclockwise: $(-y, x)$.')
    add('r180', 'That’s a half turn (180°). A quarter turn swaps the coordinates: counterclockwise gives $(-y, x)$.')
  }
  if (key === 'r90cw') {
    add('r90', 'That’s **counterclockwise**. Clockwise is $(x, y) \\to (y, -x)$.')
    add('ryx', 'Swapping alone isn’t enough — one coordinate also changes sign. Clockwise: $(y, -x)$.')
    add('r180', 'That’s a half turn (180°). A quarter turn swaps the coordinates: clockwise gives $(y, -x)$.')
  }
  if (key === 'ryx') {
    out.push({ when: pairIs(x, y), say: 'That’s the original point — it hasn’t moved. Reflecting over $y = x$ **swaps** the coordinates: $(x, y) \\to (y, x)$.' })
    add('r90', 'That’s a 90° rotation — it swaps **and** flips a sign. Reflecting over $y = x$ only swaps: $(y, x)$.')
    add('r90cw', 'That’s a 90° rotation — it swaps **and** flips a sign. Reflecting over $y = x$ only swaps: $(y, x)$.')
    out.push({ when: pairIs(-y, -x), say: 'That’s the reflection over $y = -x$. Over $y = x$, just swap: $(y, x)$ — no sign changes.' })
  }
  if (key === 'r180') {
    add('rx', 'That only flips $y$ (a reflection). A 180° turn flips **both** signs.')
    add('ry', 'That only flips $x$ (a reflection). A 180° turn flips **both** signs.')
  }
  return out
}

const dirWords = (dx: number, dy: number) => {
  const parts: string[] = []
  if (dx) parts.push(`$${Math.abs(dx)}$ unit${Math.abs(dx) === 1 ? '' : 's'} ${dx > 0 ? 'right' : 'left'}`)
  if (dy) parts.push(`$${Math.abs(dy)}$ unit${Math.abs(dy) === 1 ? '' : 's'} ${dy > 0 ? 'up' : 'down'}`)
  return parts.join(' and ')
}

const transform: Skill = {
  id: 'transform',
  unit: 'geo',
  title: 'Transformations',
  blurb: 'Slide, flip and turn points on the coordinate plane.',
  prereqs: ['int-add'],
  why: 'Every video game, animation and CAD program moves shapes with exactly these rules. Formation flying is translations in the sky; mirror-image parts (left and right wings) are reflections.',
  learn: [
    { kind: 'idea', title: 'Moving without warping', body: 'A **transformation** moves every point of a shape by the same rule. Translations (slides), reflections (flips) and rotations (turns) never change size or shape — only position and direction. The moved point is called the **image**, often written with a prime: $P \\to P\'$.' },
    { kind: 'idea', title: 'Translations: slide', body: 'Left/right changes $x$; up/down changes $y$. “3 right and 2 down” adds 3 to $x$ and subtracts 2 from $y$:', math: '(x, y) \\to (x + 3,\\ y - 2)' },
    { kind: 'idea', title: 'Reflections: flip in a mirror', body: 'Over the **$x$-axis**: the point flips up ↔ down, so $y$ changes sign — $(x, y) \\to (x, -y)$.\nOver the **$y$-axis**: it flips left ↔ right, so $x$ changes sign — $(x, y) \\to (-x, y)$.\nThe coordinate that **matches the axis name stays the same**.' },
    { kind: 'idea', title: 'Rotations about the origin: turn', body: 'Picture the point at the corner of a little right triangle with legs $x$ and $y$. Turning it a quarter turn **swaps** the legs and flips a sign; a half turn flips both signs.', math: '90^\\circ\\text{ ccw}: (x, y) \\to (-y, x) \\qquad 180^\\circ: (x, y) \\to (-x, -y)' },
    { kind: 'trap', title: 'Flipping the wrong coordinate', wrong: 'Reflect $(4, 3)$ over the $x$-axis: $(-4, 3)$.', right: '$(4, -3)$ — the point flips **down** across the $x$-axis, so its $y$ changes sign.', why: 'A point reflected over the $x$-axis stays the same distance left or right, so $x$ can’t change. Sketch it if unsure.' },
    { kind: 'check', question: 'Rotate $(3, 5)$ by $180^\\circ$ about the origin. Where does it land?', options: ['$(-3, -5)$', '$(-5, 3)$', '$(3, -5)$', '$(5, 3)$'], correct: 0, explain: 'A half turn sends the point straight through the origin to the opposite side: both coordinates change sign.' },
  ],
  generate(rng, level) {
    let x: number, y: number
    do {
      x = rng.nz(-5, 5)
      y = rng.nz(-5, 5)
    } while (Math.abs(x) === Math.abs(y))
    const visual = { type: 'plane' as const, range: 7, points: [{ x, y, label: 'P' }] }

    const translate = (rule: boolean): Problem => {
      let dx: number, dy: number
      do {
        dx = rng.int(-6, 6)
        dy = rng.int(-6, 6)
      } while (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
      const nx = x + dx
      const ny = y + dy
      const ruleTex = `(x, y) \\to (x ${dx < 0 ? '-' : '+'} ${Math.abs(dx)},\\ y ${dy < 0 ? '-' : '+'} ${Math.abs(dy)})`
      return {
        prompt: rule ? `Apply the translation $${ruleTex}$ to the point $P${pt(x, y)}$. What is the image $P'$?` : `Translate $P${pt(x, y)}$ ${dirWords(dx, dy)}. Where does it land?`,
        answer: { kind: 'pair', x: nx, y: ny },
        placeholder: '(x, y)',
        hints: ['Left/right changes the $x$-coordinate. Up/down changes the $y$-coordinate.', `$x$: $${x} ${dx < 0 ? '-' : '+'} ${Math.abs(dx)}$. $y$: $${y} ${dy < 0 ? '-' : '+'} ${Math.abs(dy)}$.`, `$x$ becomes $${nx}$. Now do $y$.`],
        steps: [
          { text: `Move ${dx > 0 ? 'right' : 'left'} ${Math.abs(dx)}:`, math: `x: ${x} ${dx < 0 ? '-' : '+'} ${Math.abs(dx)} = ${nx}` },
          { text: `Move ${dy > 0 ? 'up' : 'down'} ${Math.abs(dy)}:`, math: `y: ${y} ${dy < 0 ? '-' : '+'} ${Math.abs(dy)} = ${ny}` },
          { text: `Image: **${pt(nx, ny)}**.` },
        ],
        mistakes: [
          { when: pairIs(x - dx, y - dy), say: 'You moved the opposite way. Right/up **add**; left/down **subtract**.' },
          { when: pairIs(x + dy, y + dx), say: 'Mixed up which number goes with which coordinate. Left/right is $x$; up/down is $y$.' },
          { when: pairIs(x - dx, y + dy), say: `The ${dx > 0 ? 'right' : 'left'} move went the wrong way. Right adds to $x$, left subtracts.` },
          { when: pairIs(x + dx, y - dy), say: `The ${dy > 0 ? 'up' : 'down'} move went the wrong way. Up adds to $y$, down subtracts.` },
        ],
        visual,
      }
    }
    const single = (key: string): Problem => {
      const m = MOVES[key]
      const [nx, ny] = m.f(x, y)
      const isRot = key.startsWith('r9') || key === 'r180'
      return {
        prompt: `${m.name[0].toUpperCase() + m.name.slice(1)}: where does $P${pt(x, y)}$ go?`,
        answer: { kind: 'pair', x: nx, y: ny },
        placeholder: '(x, y)',
        hints: [
          isRot ? 'Sketch it: draw a line from the origin to $P$ and turn that line.' : 'Sketch it: which axis is the mirror? The point jumps to the same distance on the other side.',
          m.why,
          `Rule: $${m.rule}$.`,
        ],
        steps: [
          { text: m.why },
          { text: 'Apply the rule:', math: `${m.rule}: \\quad ${pt(x, y)} \\to ${pt(nx, ny)}` },
          { text: `Image: **${pt(nx, ny)}**.` },
        ],
        mistakes: moveMistakes(key, x, y),
        visual,
      }
    }

    if (level === 1) {
      const kind = rng.pick(['tw', 'tw', 'rx', 'ry'] as const)
      return kind === 'tw' ? translate(false) : single(kind)
    }
    if (level === 2) {
      const kind = rng.pick(['tr', 'rx', 'ry', 'r180', 'r90', 'r90cw'] as const)
      return kind === 'tr' ? translate(true) : single(kind)
    }

    // level 3: compositions, y = x, and working backwards
    const kind = rng.pick(['combo', 'combo', 'ryx', 'backward', 'r270'] as const)
    if (kind === 'ryx') return single('ryx')
    if (kind === 'r270') {
      const [nx, ny] = MOVES.r90cw.f(x, y)
      return {
        prompt: `Rotate $P${pt(x, y)}$ by $270^\\circ$ **counterclockwise** about the origin. Where does it land?`,
        answer: { kind: 'pair', x: nx, y: ny },
        placeholder: '(x, y)',
        hints: ['270° counterclockwise is three quarter turns. Is there a shorter way to get to the same place?', 'Three quarter turns counterclockwise = one quarter turn **clockwise**.', 'Clockwise 90°: $(x, y) \\to (y, -x)$.'],
        steps: [
          { text: '$270^\\circ$ counterclockwise lands in the same spot as $90^\\circ$ clockwise (since $360 - 270 = 90$).' },
          { text: 'Apply the clockwise rule:', math: `(x, y) \\to (y, -x): \\quad ${pt(x, y)} \\to ${pt(nx, ny)}` },
        ],
        mistakes: [
          { when: pairIs(-y, x), say: 'That’s only 90° counterclockwise. 270° counterclockwise is the same as 90° **clockwise**: $(y, -x)$.' },
          { when: pairIs(-x, -y), say: 'That’s 180°. Go one more quarter turn.' },
        ],
        visual,
      }
    }
    if (kind === 'backward') {
      let dx: number, dy: number
      do {
        dx = rng.int(-6, 6)
        dy = rng.int(-6, 6)
      } while (dx === 0 || dy === 0)
      const ix = x + dx
      const iy = y + dy
      return {
        prompt: `A point was translated ${dirWords(dx, dy)}. Its image is $P'${pt(ix, iy)}$. Where was the **original** point?`,
        answer: { kind: 'pair', x, y },
        placeholder: '(x, y)',
        hints: ['Work backwards: undo the slide.', `Undo ${dx > 0 ? 'right' : 'left'} by moving ${dx > 0 ? 'left' : 'right'}; undo ${dy > 0 ? 'up' : 'down'} by moving ${dy > 0 ? 'down' : 'up'}.`, `$x$: $${ix} ${dx > 0 ? '-' : '+'} ${Math.abs(dx)}$; $y$: $${iy} ${dy > 0 ? '-' : '+'} ${Math.abs(dy)}$.`],
        steps: [
          { text: 'Reverse each move:', math: `x = ${ix} ${dx > 0 ? '-' : '+'} ${Math.abs(dx)} = ${x},\\quad y = ${iy} ${dy > 0 ? '-' : '+'} ${Math.abs(dy)} = ${y}` },
          { text: `Original: **${pt(x, y)}**. Check: sliding it ${dirWords(dx, dy)} gives ${pt(ix, iy)} ✓` },
        ],
        mistakes: [{ when: pairIs(ix + dx, iy + dy), say: 'You applied the translation again instead of undoing it. To go backwards, move the **opposite** way.' }],
        visual: { type: 'plane', range: 12, points: [{ x: ix, y: iy, label: "P'" }] },
      }
    }
    // combo: translate, then reflect/rotate
    let dx: number, dy: number
    do {
      dx = rng.int(-4, 4)
      dy = rng.int(-4, 4)
    } while (dx === 0 || dy === 0)
    const key = rng.pick(['rx', 'ry', 'r180'] as const)
    const tx = x + dx
    const ty = y + dy
    const [fx, fy] = MOVES[key].f(tx, ty)
    const [wx, wy] = MOVES[key].f(x, y)
    return {
      prompt: `Translate $P${pt(x, y)}$ ${dirWords(dx, dy)}, **then** ${MOVES[key].name}. Where does it end up?`,
      answer: { kind: 'pair', x: fx, y: fy },
      placeholder: '(x, y)',
      hints: ['Do the moves in the order given — one at a time.', `After the slide: $(${x} ${dx < 0 ? '-' : '+'} ${Math.abs(dx)},\\ ${y} ${dy < 0 ? '-' : '+'} ${Math.abs(dy)}) = ${pt(tx, ty)}$.`, `Now apply $${MOVES[key].rule}$ to $${pt(tx, ty)}$.`],
      steps: [
        { text: 'Step 1 — translate:', math: `${pt(x, y)} \\to ${pt(tx, ty)}` },
        { text: `Step 2 — ${MOVES[key].name}:`, math: `${MOVES[key].rule}: \\quad ${pt(tx, ty)} \\to ${pt(fx, fy)}` },
        { text: `Final image: **${pt(fx, fy)}**.` },
      ],
      mistakes: [
        { when: pairIs(wx + dx, wy + dy), say: 'You did the moves in the **reverse** order. Translate first, then flip/turn — order matters!' },
        { when: pairIs(tx, ty), say: 'That’s after the first move only. Now apply the second transformation.' },
        ...moveMistakes(key, tx, ty).map((m) => ({ ...m, say: 'Step 2 slipped: ' + m.say })),
      ],
      visual,
    }
  },
}

export const GEO: Skill[] = [angles, triAngles, areaRect, areaTri, circles, pythag, volume, similar, coordGeo, transform]
