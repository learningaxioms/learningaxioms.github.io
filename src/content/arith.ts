import type { Skill } from '../engine/types'
import { choices, fracStr, fracTex, gcd, lcm, reduce, clean } from '../engine/rng'

// ARITHMETIC — the foundation. Every skill: concept cards (idea → explore → trap → check),
// then an infinite generator with hint ladders, worked steps and misconception detection.

/** Unreduced fraction TeX — prompts show exactly the numbers the steps use. */
const fr = (n: number, d: number) => `\\frac{${n}}{${d}}`

const add: Skill = {
  id: 'add',
  unit: 'arith',
  title: 'Adding with regrouping',
  blurb: 'Line up place values and carry when a column reaches 10.',
  prereqs: [],
  why: 'Totals are everywhere — a receipt, a fuel log, a running score. Column addition is the reliable way to get them right on paper.',
  learn: [
    { kind: 'idea', title: 'Add place by place', body: 'Each digit means something different: in $47$, the $4$ is **4 tens** and the $7$ is **7 ones**. So we add ones with ones, tens with tens — never mixing them.' },
    { kind: 'explore', title: 'See the regroup happen', body: 'Blue and red blocks are the two numbers. When a column gets **10 or more**, ten of them get bundled into one block of the next place.', widget: { w: 'placevalue' }, task: 'Find two numbers where the ones need a trade, then two where they don’t.' },
    { kind: 'trap', title: 'Forgetting to carry', wrong: '$47 + 38 = 75$ (wrote 15 ones as just “5” and dropped the ten)', right: '$47 + 38 = 85$ — the 15 ones become 1 ten + 5 ones, and that extra ten joins the tens column.', why: 'Every column can only hold one digit (0–9). The extra ten has to go somewhere — it moves left.' },
    { kind: 'check', question: 'In $58 + 27$, the ones add to $15$. What do you write in the ones place, and what moves to the tens?', options: ['Write 5, carry 1 ten', 'Write 15', 'Write 1, carry 5 tens', 'Write 5, drop the 1'], correct: 0, explain: '15 ones = 1 ten and 5 ones. The 5 stays, the ten gets carried.' },
  ],
  generate(rng, level) {
    const digits = level === 1 ? 2 : 3
    const lo = 10 ** (digits - 1)
    let a: number, b: number
    // make sure at least one column regroups
    do {
      a = rng.int(lo, 10 ** digits - 1)
      b = rng.int(lo, 10 ** digits - 1)
    } while ((a % 10) + (b % 10) < 10)
    if (level === 3 && rng.chance(0.5)) {
      const c = rng.int(10, 99)
      const s = a + b + c
      return {
        prompt: `A pilot logs three flights: $${a}$, $${b}$ and $${c}$ miles. What is the total distance?`,
        answer: { kind: 'num', value: s, unit: 'miles' },
        hints: ['Add two of the numbers first, then add the third.', `Start with $${a} + ${b}$. Line up the ones digits.`, `$${a} + ${b} = ${a + b}$. Now add $${c}$.`],
        steps: [
          { text: `Add the first two.`, math: `${a} + ${b} = ${a + b}` },
          { text: `Add the third.`, math: `${a + b} + ${c} = ${s}` },
          { text: `Total: **${s} miles**.` },
        ],
        mistakes: [
          { value: a + b, say: 'That’s just the first two flights — there are three to add.' },
          { value: noCarry(a + b === 0 ? 0 : a, b) + c, say: 'Looks like a carry got dropped in the first sum. When a column hits 10+, carry 1 to the next place.' },
        ],
      }
    }
    const s = a + b
    const onesSum = (a % 10) + (b % 10)
    const tensSum = (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) + 1
    return {
      prompt: `$${a} + ${b} = \\;?$`,
      answer: { kind: 'num', value: s },
      hints: [
        'Start with the ones column (rightmost digits).',
        `Ones: $${a % 10} + ${b % 10} = ${onesSum}$. That’s 10 or more — what do you carry?`,
        `Write ${onesSum % 10} in the ones place and carry 1 to the tens: $${Math.floor(a / 10) % 10} + ${Math.floor(b / 10) % 10} + 1 = ${tensSum}$.`,
      ],
      steps: [
        { text: `Ones: $${a % 10} + ${b % 10} = ${onesSum}$. Write **${onesSum % 10}**, carry **1**.` },
        { text: `Tens: $${Math.floor(a / 10) % 10} + ${Math.floor(b / 10) % 10} + 1 = ${tensSum}$. ${tensSum >= 10 ? `Write **${tensSum % 10}**, carry 1.` : `Write **${tensSum}**.`}` },
        ...(digits === 3 ? [{ text: `Hundreds: $${Math.floor(a / 100)} + ${Math.floor(b / 100)}${tensSum >= 10 ? ' + 1' : ''} = ${Math.floor(a / 100) + Math.floor(b / 100) + (tensSum >= 10 ? 1 : 0)}$.` }] : []),
        { text: 'Read the result:', math: `${a} + ${b} = ${s}` },
      ],
      mistakes: [
        { value: noCarry(a, b), say: 'You added each column but didn’t **carry**. When a column adds to 10 or more, write the ones digit and move the 1 to the next column left.' },
        { when: (_, n) => n !== null && Math.abs(n - s) === 10, say: 'Off by exactly 10 — check the carry into the tens column.' },
        { when: (_, n) => n !== null && Math.abs(n - s) === 1, say: 'Off by one — recount the ones column.' },
      ],
    }
  },
}

/** column-wise sum with no carrying (the classic error) */
function noCarry(a: number, b: number) {
  let out = 0
  let place = 1
  while (a > 0 || b > 0) {
    out += ((a % 10) + (b % 10)) % 10 * place
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
    place *= 10
  }
  return out
}

/** column-wise "smaller from larger" (the classic subtraction error) */
function smallerFromLarger(a: number, b: number) {
  let out = 0
  let place = 1
  while (a > 0 || b > 0) {
    out += Math.abs((a % 10) - (b % 10)) * place
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
    place *= 10
  }
  return out
}

const sub: Skill = {
  id: 'sub',
  unit: 'arith',
  title: 'Subtracting with regrouping',
  blurb: 'Borrow from the next place when the top digit is too small.',
  prereqs: ['add'],
  why: 'Change from a purchase, fuel remaining, time left on a clock — subtraction answers “how much is left?” and “how far apart?”',
  learn: [
    { kind: 'idea', title: 'Subtraction is distance', body: '$12 - 5$ asks: **how far is it from 5 up to 12?** On a number line you start at 12 and step 5 to the left.' },
    { kind: 'explore', title: 'Step it out', body: 'Move the sliders and watch the hops. Switch between + and − to see they undo each other.', widget: { w: 'numberline', mode: 'subtract' }, task: 'Set 12 − 5. Then set 7 + 5. What do you notice?' },
    { kind: 'idea', title: 'Borrowing (regrouping)', body: 'In $52 - 27$, you can’t take 7 ones from 2 ones. So **break one ten into 10 ones**: $52$ becomes 4 tens and 12 ones. Now $12 - 7 = 5$ and $4 - 2 = 2$.', math: '52 - 27 = 25' },
    { kind: 'trap', title: 'Subtracting the smaller digit from the bigger', wrong: '$52 - 27 = 35$ (did $7 - 2$ in the ones column)', right: '$52 - 27 = 25$ — borrow a ten so the ones become $12 - 7 = 5$.', why: 'The bottom number is always the one being taken away, even when its digit is bigger. Flipping the digits changes the problem.' },
    { kind: 'check', question: 'How can you check that $83 - 46 = 37$ is right?', options: ['Add $37 + 46$ and see if you get 83', 'Subtract $46 - 37$', 'Add $83 + 46$', 'There’s no way to check'], correct: 0, explain: 'Addition undoes subtraction. If 37 + 46 = 83, the subtraction was right. Use this every time!' },
  ],
  generate(rng, level) {
    const digits = level === 3 ? 3 : 2
    let a: number, b: number
    do {
      a = rng.int(10 ** (digits - 1) + 10, 10 ** digits - 1)
      b = rng.int(10 ** (digits - 1), a - 1)
    } while (a % 10 >= b % 10)
    const d = a - b
    if (level >= 2 && rng.chance(0.4)) {
      return {
        prompt: `A tank holds $${a}$ gallons of fuel. After a flight, $${b}$ gallons have been burned. How many gallons are left?`,
        answer: { kind: 'num', value: d, unit: 'gallons' },
        hints: ['“Left” means take away: start amount minus amount used.', `Compute $${a} - ${b}$. The ones digit on top is smaller — borrow.`, `Ones: $${(a % 10) + 10} - ${b % 10} = ${(a % 10) + 10 - (b % 10)}$.`],
        steps: [
          { text: 'Fuel left = start − burned.', math: `${a} - ${b}` },
          { text: `Borrow a ten so the ones column is $${(a % 10) + 10} - ${b % 10}$.` },
          { text: `Result: **${d} gallons**. Check: $${d} + ${b} = ${a}$ ✓` },
        ],
        mistakes: [
          { value: a + b, say: 'You added. “Left after burning” means **subtract** what was used.' },
          { value: smallerFromLarger(a, b), say: 'Looks like you subtracted the smaller digit from the bigger one in a column. Borrow a ten instead.' },
        ],
      }
    }
    return {
      prompt: `$${a} - ${b} = \\;?$`,
      answer: { kind: 'num', value: d },
      hints: [
        'Start with the ones column. Is the top digit big enough?',
        `$${a % 10}$ is less than $${b % 10}$, so borrow 1 ten: the ones become $${(a % 10) + 10}$.`,
        `Ones: $${(a % 10) + 10} - ${b % 10} = ${(a % 10) + 10 - (b % 10)}$. The tens digit on top is now one smaller.`,
      ],
      steps: [
        { text: `Ones: $${a % 10} < ${b % 10}$, so borrow a ten. Ones become $${(a % 10) + 10}$.` },
        { text: `$${(a % 10) + 10} - ${b % 10} = ${(a % 10) + 10 - (b % 10)}$` },
        { text: `Remaining places: with the borrow, the top is now $${Math.floor(a / 10) - 1}$ tens; minus $${Math.floor(b / 10)}$ tens is $${Math.floor(a / 10) - 1 - Math.floor(b / 10)}$ tens.` },
        { text: 'Answer, then check by adding back:', math: `${a} - ${b} = ${d}\\quad(${d} + ${b} = ${a}\\ \\checkmark)` },
      ],
      mistakes: [
        { value: smallerFromLarger(a, b), say: 'You subtracted the smaller digit from the bigger in the ones column. The bottom digit is always taken from the top — borrow a ten so the top is big enough.' },
        { value: d + 10, say: 'Close — after borrowing, remember the tens digit on top goes **down by 1**.' },
        { value: a + b, say: 'That’s the sum. This is a subtraction.' },
      ],
    }
  },
}

const mult: Skill = {
  id: 'mult',
  unit: 'arith',
  title: 'Multi-digit multiplication',
  blurb: 'Break numbers into parts with an area model.',
  prereqs: ['add'],
  why: 'Cost of 24 items at \\$13, square footage of a room, fuel burned over 15 hours at 32 gal/hr — multiplication scales things up.',
  learn: [
    { kind: 'idea', title: 'Multiplication is area', body: '$23 \\times 14$ is the area of a rectangle 23 wide and 14 tall. Big numbers get easier if you **split them into tens and ones**.' },
    { kind: 'explore', title: 'Area model', body: 'Each colored region is one partial product. Their sum is the full product.', widget: { w: 'area' }, task: 'Set 23 × 14. Which region is the biggest? Why does that make sense?' },
    { kind: 'idea', title: 'The distributive property', body: 'Splitting works because multiplication **distributes** over addition:', math: '23\\times14 = 23\\times(10+4) = 230 + 92 = 322' },
    { kind: 'trap', title: 'Only multiplying matching places', wrong: '$23 \\times 14 = 2\\times1 \\,|\\, 3\\times4 = 212$', right: '$23\\times14 = 200 + 30 + 80 + 12 = 322$ — four partial products, not two.', why: 'Every part of the first number multiplies every part of the second. Skipping the “cross” products loses most of the area.' },
    { kind: 'check', question: 'Which expression equals $35 \\times 12$?', options: ['$35\\times10 + 35\\times2$', '$30\\times10 + 5\\times2$', '$35\\times10\\times2$', '$3\\times1 + 5\\times2$'], correct: 0, explain: '12 = 10 + 2, and 35 must be multiplied by both parts: 350 + 70 = 420.' },
  ],
  generate(rng, level) {
    const a = level === 1 ? rng.int(12, 49) : level === 2 ? rng.int(21, 89) : rng.int(101, 399)
    const b = level === 1 ? rng.int(3, 9) : rng.int(11, 39)
    const prod = a * b
    const bt = Math.floor(b / 10) * 10
    const bo = b % 10
    const cross = level === 1 ? [] : [{ value: a * bo + a * Math.floor(b / 10), say: `It looks like you forgot to shift the second partial product. The tens digit of ${b} is really **${bt}**, so that row is $${a}\\times${bt} = ${a * bt}$, not $${a * Math.floor(b / 10)}$.` }]
    const placeOnly = level === 1 ? Math.floor(a / 10) * b * 10 + (a % 10) * b : Math.floor(a / 10) * Math.floor(b / 10) * 100 + (a % 10) * (b % 10)
    return {
      prompt: rng.chance(0.3) ? `A squadron flies $${b}$ sorties. Each burns $${a}$ gallons of fuel. How many gallons in total?` : `$${a} \\times ${b} = \\;?$`,
      answer: { kind: 'num', value: prod },
      hints:
        level === 1
          ? ['Split the bigger number into tens and ones.', `$${a} = ${Math.floor(a / 10) * 10} + ${a % 10}$. Multiply each part by $${b}$.`, `$${Math.floor(a / 10) * 10}\\times${b} = ${Math.floor(a / 10) * 10 * b}$ and $${a % 10}\\times${b} = ${(a % 10) * b}$. Add them.`]
          : ['Split one number into tens and ones.', `$${b} = ${bt} + ${bo}$. Find $${a}\\times${bt}$ and $${a}\\times${bo}$.`, `$${a}\\times${bt} = ${a * bt}$ and $${a}\\times${bo} = ${a * bo}$. Add the two partial products.`],
      steps:
        level === 1
          ? [
              { text: 'Split into tens and ones:', math: `${a}\\times${b} = (${Math.floor(a / 10) * 10} + ${a % 10})\\times${b}` },
              { text: 'Multiply each part:', math: `${Math.floor(a / 10) * 10 * b} + ${(a % 10) * b}` },
              { text: 'Add:', math: `= ${prod}` },
            ]
          : [
              { text: `Split $${b}$ into $${bt} + ${bo}$.`, math: `${a}\\times${b} = ${a}\\times${bt} + ${a}\\times${bo}` },
              { text: 'Find each partial product:', math: `${a * bt} + ${a * bo}` },
              { text: 'Add them:', math: `= ${prod}` },
            ],
      mistakes: [{ value: placeOnly, say: 'You multiplied only the matching places (tens×tens, ones×ones). Every part must multiply every part — use the area model: there are cross pieces too.' }, ...cross, { value: a + b, say: 'That’s the sum. Multiplication means ' + b + ' groups of ' + a + '.' }],
    }
  },
}

const div: Skill = {
  id: 'div',
  unit: 'arith',
  title: 'Division & remainders',
  blurb: 'Split into equal groups; what’s left is the remainder.',
  prereqs: ['mult', 'sub'],
  why: 'Splitting a bill, rationing supplies, figuring out how many full trips you need — division answers “how many in each?” and “how many groups?”',
  learn: [
    { kind: 'idea', title: 'Division = equal groups', body: '$23 \\div 4$ asks: if you deal 23 things into 4 equal groups, **how many does each get?** Anything that can’t be shared evenly is the **remainder**.' },
    { kind: 'explore', title: 'Deal them out', body: 'Change the total and the number of groups.', widget: { w: 'groups' }, task: 'Can the remainder ever be as big as the number of groups? Try to make it happen.' },
    { kind: 'idea', title: 'Division undoes multiplication', body: 'Use multiplication facts to divide: $56 \\div 7 = 8$ because $7 \\times 8 = 56$. Long division just repeats this one place at a time.', math: '\\text{dividend} = \\text{divisor}\\times\\text{quotient} + \\text{remainder}' },
    { kind: 'check', question: '$47 \\div 5 = 9$ R $2$. Which check proves it?', options: ['$5\\times9 + 2 = 47$', '$9\\times2 + 5 = 23$', '$47 - 9 = 38$', '$5 + 9 + 2 = 16$'], correct: 0, explain: 'Groups × size + leftover should rebuild the original total.' },
  ],
  generate(rng, level) {
    const d = level === 1 ? rng.int(2, 9) : rng.int(3, 12)
    const q = level === 1 ? rng.int(3, 12) : level === 2 ? rng.int(12, 40) : rng.int(25, 99)
    const exact = level === 1 || rng.chance(0.5)
    if (exact) {
      const n = d * q
      return {
        prompt: rng.chance(0.4) ? `$${n}$ cadets split evenly into $${d}$ flights. How many cadets per flight?` : `$${n} \\div ${d} = \\;?$`,
        answer: { kind: 'num', value: q },
        hints: [`Ask: $${d} \\times \\;?\\; = ${n}$.`, `Try a round number first: $${d}\\times10 = ${d * 10}$. Is ${n} more or less than that?`, `$${d}\\times${q} = ${n}$.`],
        steps: [
          { text: `Find the number that times $${d}$ gives $${n}$.` },
          { text: 'Multiply to check:', math: `${d}\\times${q} = ${n}` },
          { text: `So $${n}\\div${d} = ${q}$.` },
        ],
        mistakes: [
          { value: n - d, say: 'You subtracted. Division asks how many groups of ' + d + ' fit into ' + n + '.' },
          { value: n * d, say: 'That’s multiplication — the answer to a division should be smaller than ' + n + ' here.' },
        ],
      }
    }
    const r = rng.int(1, d - 1)
    const n = d * q + r
    return {
      prompt: `What is the **remainder** when $${n}$ is divided by $${d}$?`,
      answer: { kind: 'num', value: r },
      hints: [`Find the biggest multiple of $${d}$ that’s not more than $${n}$.`, `$${d}\\times${q} = ${d * q}$. How far is that from $${n}$?`, `$${n} - ${d * q} = ${r}$`],
      steps: [
        { text: `Largest multiple of ${d} that fits: $${d}\\times${q} = ${d * q}$.` },
        { text: 'What’s left over:', math: `${n} - ${d * q} = ${r}` },
        { text: `So $${n} \\div ${d} = ${q}$ R **${r}**. Check: $${d}\\times${q} + ${r} = ${n}$ ✓` },
      ],
      mistakes: [
        { value: q, say: `That’s the **quotient** (how many in each group). The question asks for the **remainder** — what’s left over.` },
        { when: (_, x) => x !== null && x >= d, say: `A remainder can’t be ${d} or more — that would be enough for another full group.` },
      ],
    }
  },
}

const order: Skill = {
  id: 'order',
  unit: 'arith',
  title: 'Order of operations',
  blurb: 'Parentheses, exponents, × ÷, then + − (left to right).',
  prereqs: ['mult', 'div'],
  why: 'Every calculator, spreadsheet and programming language follows these rules. Without them, $2 + 3 \\times 4$ could mean two different things.',
  learn: [
    { kind: 'idea', title: 'Why we need a rule', body: 'Is $2 + 3\\times4$ equal to $20$ or $14$? Mathematicians agreed: **multiplication binds tighter than addition**, so it’s $2 + 12 = 14$.' },
    { kind: 'idea', title: 'The order', body: '1. **Parentheses** (grouping)\n2. **Exponents**\n3. **Multiply & divide** — together, left to right\n4. **Add & subtract** — together, left to right' },
    { kind: 'trap', title: 'Multiplication doesn’t always beat division', wrong: '$24 \\div 4 \\times 2 = 24\\div8 = 3$', right: '$24 \\div 4 \\times 2 = 6\\times2 = 12$', why: '× and ÷ have the **same** rank. When they tie, go left to right. Same for + and −. (“PEMDAS” makes it look like M comes first — it doesn’t.)' },
    { kind: 'check', question: 'What is $10 - 4 + 3$?', options: ['$9$', '$3$', '$17$', '$11$'], correct: 0, explain: 'Subtraction and addition tie, so go left to right: 10 − 4 = 6, then 6 + 3 = 9. (Doing 4 + 3 first gives the wrong 3.)' },
  ],
  generate(rng, level) {
    const a = rng.int(2, 9)
    const b = rng.int(2, 9)
    const c = rng.int(2, 9)
    const forms =
      level === 1
        ? ['a+b*c', 'a*b-d', 'a+b*c-d']
        : level === 2
          ? ['(a+b)*c', 'a*(b+c)-d', 'e/b*c', 'a+b^2']
          : ['(a+b)^2-c*d', 'a*b-e/b+c', 'a+b*(c+d)^2', '(e/b+a)*c']
    const f = rng.pick(forms)
    const d = rng.int(1, Math.min(9, a * b - 1))
    const e = b * rng.int(2, 6)
    const env: Record<string, number> = { a, b, c, d, e }
    const exprStr = f.replace(/[a-e]/g, (k) => String(env[k]))
    const val = evalSimple(exprStr)
    const leftToRight = evalLeftToRight(exprStr)
    const texStr = exprStr.replace(/\*/g, '\\times ').replace(/\//g, '\\div ')
    const steps = stepsFor(exprStr)
    return {
      prompt: `Evaluate: $${texStr}$`,
      answer: { kind: 'num', value: val },
      hints: ['Look for parentheses first, then exponents.', 'Next, do every × and ÷ from left to right — before any + or −.', `The first operation to do is: $${steps[0].op.replace(/\*/g, '\\times ').replace(/\//g, '\\div ')}$`],
      steps: [...steps.map((s, i) => ({ text: i === 0 ? `First: $${s.op.replace(/\*/g, '\\times ').replace(/\//g, '\\div ')}$` : `Then: $${s.op.replace(/\*/g, '\\times ').replace(/\//g, '\\div ')}$`, math: s.after.replace(/\*/g, '\\times ').replace(/\//g, '\\div ') })), { text: `Answer: **${val}**` }],
      mistakes: leftToRight !== null && leftToRight !== val ? [{ value: leftToRight, say: 'You worked straight left to right. Multiplication and division (and exponents, and parentheses) come **before** addition and subtraction.' }] : [],
    }
  },
}

// tiny evaluator for order-of-ops content (digits, + - * / ^ and parens)
function evalSimple(s: string): number {
  // eslint-disable-next-line no-new-func
  return Function(`return (${s.replace(/\^/g, '**')})`)() as number
}
function evalLeftToRight(s: string): number | null {
  if (/[()^]/.test(s)) return null
  const toks = s.match(/\d+|[+\-*/]/g)!
  let v = +toks[0]
  for (let i = 1; i < toks.length; i += 2) {
    const n = +toks[i + 1]
    v = toks[i] === '+' ? v + n : toks[i] === '-' ? v - n : toks[i] === '*' ? v * n : v / n
  }
  return v
}
/** produce successive simplifications following PEMDAS */
function stepsFor(s: string): { op: string; after: string }[] {
  const out: { op: string; after: string }[] = []
  let cur = s
  for (let guard = 0; guard < 12 && !/^-?\d+(\.\d+)?$/.test(cur); guard++) {
    let m = cur.match(/\(([^()]+)\)/)
    if (m && /^-?\d+$/.test(m[1])) {
      cur = cur.replace(m[0], m[1])
      continue
    }
    if (m) {
      const inner = stepsFor(m[1])
      const first = inner[0]
      const replaced = cur.replace(m[1], first.after)
      out.push({ op: first.op, after: replaced })
      cur = replaced
      continue
    }
    m = cur.match(/(\d+)\^(\d+)/)
    if (!m) m = cur.match(/(\d+)([*/])(\d+)/)
    if (!m) m = cur.match(/(-?\d+)([+-])(\d+)/)
    if (!m) break
    const v = evalSimple(m[0])
    cur = cur.replace(m[0], String(v))
    out.push({ op: m[0], after: cur })
  }
  return out
}

const factors: Skill = {
  id: 'factors',
  unit: 'arith',
  title: 'Factors, primes, GCF & LCM',
  blurb: 'What divides evenly — and what numbers share.',
  prereqs: ['div'],
  why: 'Simplifying fractions needs the GCF; adding them needs the LCM. Scheduling (two events that repeat every 6 and 8 days) is an LCM problem.',
  learn: [
    { kind: 'idea', title: 'Factors build rectangles', body: 'A **factor** of 12 divides 12 with no remainder. Every factor pair is a rectangle you can make from 12 dots: $1\\times12$, $2\\times6$, $3\\times4$.' },
    { kind: 'explore', title: 'Build every rectangle', body: 'Slide the number of dots. Each button is a factor pair.', widget: { w: 'array' }, task: 'Find three numbers that only make one rectangle. Those are **primes**.' },
    { kind: 'idea', title: 'GCF and LCM', body: '**Greatest Common Factor**: the biggest number that divides both. GCF(12, 18) = 6.\n**Least Common Multiple**: the smallest number both divide into. LCM(4, 6) = 12.' },
    { kind: 'trap', title: 'Mixing up GCF and LCM', wrong: 'LCM(4, 6) = 2', right: 'LCM(4, 6) = 12. (2 is the GCF.)', why: 'A **multiple** is at least as big as the number. The LCM can never be smaller than either number; the GCF can never be bigger.' },
    { kind: 'check', question: 'Is 1 a prime number?', options: ['No — a prime has exactly two factors, and 1 has only one', 'Yes — nothing divides it', 'Yes — it’s the smallest prime', 'Only sometimes'], correct: 0, explain: 'Primes have exactly two different factors: 1 and themselves. 1 only has one factor, so it isn’t prime. The smallest prime is 2.' },
  ],
  generate(rng, level) {
    const kind = level === 1 ? rng.pick(['prime', 'count']) : level === 2 ? rng.pick(['gcf', 'lcm']) : rng.pick(['gcf', 'lcm', 'word'])
    if (kind === 'prime') {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]
      const comps = [9, 15, 21, 27, 33, 39, 49, 51, 57, 25, 35]
      const correct = String(rng.pick(primes))
      const wrong = rng.shuffle(comps).slice(0, 3).map(String)
      const c = choices(rng, correct, wrong)
      return {
        prompt: 'Which of these numbers is **prime**?',
        answer: { kind: 'choice', options: c.options, correct: c.correct },
        hints: ['A prime’s only factors are 1 and itself.', 'Test each number: does 3, 5 or 7 divide it?', 'Odd numbers can still be composite: $21 = 3\\times7$, $49 = 7\\times7$.'],
        steps: [...wrong.map((w) => ({ text: `$${w}$ = ${factorPairText(+w)} — composite.` })), { text: `$${correct}$ has no factors except 1 and itself — **prime**.` }],
        mistakes: [{ when: (raw) => raw !== String(c.correct), say: 'That one has a factor besides 1 and itself. Try dividing by 3 or 7.' }],
      }
    }
    if (kind === 'count') {
      const n = rng.pick([12, 16, 18, 20, 24, 28, 30, 36, 40])
      const fs = [] as number[]
      for (let i = 1; i <= n; i++) if (n % i === 0) fs.push(i)
      return {
        prompt: `How many factors does $${n}$ have? (Count 1 and ${n} too.)`,
        answer: { kind: 'num', value: fs.length },
        hints: ['List factor **pairs**: start with $1 \\times ' + n + '$.', 'Then try 2, 3, 4, … until the pairs start repeating.', `Pairs: ${pairsTex(n)}`],
        steps: [{ text: `Factor pairs: ${pairsTex(n)}` }, { text: `Factors: ${fs.join(', ')} — that’s **${fs.length}**.` }],
        mistakes: [
          { value: fs.length - 2, say: 'Don’t forget 1 and the number itself — they count as factors.' },
          { value: fs.length / 2, say: 'That’s the number of factor **pairs**. Each pair has two factors (except a square pair like 6 × 6).' },
        ],
      }
    }
    const g = rng.int(2, level === 3 ? 12 : 8)
    let x = rng.int(2, 7)
    let y = rng.int(2, 7)
    while (gcd(x, y) !== 1 || x === y) {
      x = rng.int(2, 7)
      y = rng.int(2, 7)
    }
    const a = g * x
    const b = g * y
    if (kind === 'gcf')
      return {
        prompt: `Find the GCF of $${a}$ and $${b}$.`,
        answer: { kind: 'num', value: g },
        hints: ['List the factors of each number.', `Which factors appear in **both** lists? Pick the biggest.`, `$${a} = ${g}\\times${x}$ and $${b} = ${g}\\times${y}$.`],
        steps: [{ text: `Factors of ${a}: ${factorList(a)}` }, { text: `Factors of ${b}: ${factorList(b)}` }, { text: `Biggest in both: **${g}**.` }],
        mistakes: [
          { value: a * b / g, say: 'That’s the LCM (smallest common **multiple**). The GCF is the greatest common **factor** — it divides both.' },
          { value: 1, say: 'They share a bigger factor than 1 — check what divides both.' },
          { when: (_, n) => n !== null && n < g && n > 1 && a % n === 0 && b % n === 0, say: 'That divides both, but it isn’t the **greatest**. Look for a bigger common factor.' },
        ],
      }
    const L = lcm(a, b)
    const prompt =
      kind === 'word'
        ? `One radar sweeps every $${a}$ seconds, another every $${b}$ seconds. They both sweep at time 0. When do they next sweep together?`
        : `Find the LCM of $${a}$ and $${b}$.`
    return {
      prompt,
      answer: { kind: 'num', value: L, unit: kind === 'word' ? 'seconds' : undefined },
      hints: ['List multiples of the bigger number.', `Multiples of ${Math.max(a, b)}: ${[1, 2, 3, 4].map((k) => k * Math.max(a, b)).join(', ')}, … Which is also a multiple of ${Math.min(a, b)}?`, `Shortcut: $\\text{LCM} = \\dfrac{${a}\\times${b}}{\\text{GCF}} = \\dfrac{${a * b}}{${g}}$.`],
      steps: [
        { text: `Multiples of ${Math.max(a, b)}: ${Array.from({ length: L / Math.max(a, b) }, (_, k) => (k + 1) * Math.max(a, b)).join(', ')}` },
        { text: `The first one that ${Math.min(a, b)} also divides is **${L}**.` },
      ],
      mistakes: [
        { value: a * b, say: `${a * b} works as a common multiple, but it isn’t the **least** one. A smaller number is shared by both.` },
        { value: g, say: 'That’s the GCF. The LCM is a **multiple** — at least as big as both numbers.' },
      ],
    }
  },
}
function factorList(n: number) {
  const f: number[] = []
  for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i)
  return f.join(', ')
}
function pairsTex(n: number) {
  const p: string[] = []
  for (let i = 1; i * i <= n; i++) if (n % i === 0) p.push(`$${i}\\times${n / i}$`)
  return p.join(', ')
}
function factorPairText(n: number) {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return `$${i}\\times${n / i}$`
  return `$1\\times${n}$`
}

const fracEquiv: Skill = {
  id: 'frac-equiv',
  unit: 'arith',
  title: 'Equivalent fractions',
  blurb: 'Same amount, different-sized pieces. Simplify to lowest terms.',
  prereqs: ['factors'],
  why: 'Recipes, wrench sizes (5/16 vs 3/8), and comparing scores (18/24 vs 7/10) all depend on seeing when fractions are the same amount.',
  learn: [
    { kind: 'idea', title: 'What a fraction means', body: '$\\frac{3}{4}$ means: cut a whole into **4 equal pieces** (the bottom), and take **3** of them (the top).' },
    { kind: 'explore', title: 'Re-cut the pieces', body: 'The top bar is your fraction. The bottom bar cuts every piece into smaller ones.', widget: { w: 'fraction' }, task: 'Make 2/3 and cut each piece into 4. What fraction do you get? Is the shaded part any bigger?' },
    { kind: 'idea', title: 'The rule', body: 'Multiply or divide the top **and** bottom by the same number — the value doesn’t change. To **simplify**, divide both by their GCF.', math: '\\frac{18}{24} = \\frac{18\\div6}{24\\div6} = \\frac{3}{4}' },
    { kind: 'trap', title: 'Changing only one part', wrong: '$\\frac{2}{3} = \\frac{2}{6}$ (doubled just the bottom)', right: '$\\frac{2}{3} = \\frac{4}{6}$', why: 'Doubling the number of pieces makes each piece half as big — so you need twice as many pieces to cover the same amount.' },
    { kind: 'check', question: 'Which is bigger: $\\frac{1}{3}$ or $\\frac{1}{4}$?', options: ['$\\frac13$ — fewer pieces means bigger pieces', '$\\frac14$ — 4 is bigger than 3', 'They’re equal', 'Can’t tell'], correct: 0, explain: 'Splitting into 3 makes bigger pieces than splitting into 4. A bigger bottom number means smaller pieces.' },
  ],
  generate(rng, level) {
    let n = rng.int(1, 8)
    let d = rng.int(n + 1, 12)
    ;[n, d] = reduce(n, d)
    if (level === 1) {
      const k = rng.int(2, 5)
      return {
        prompt: `Fill in the missing number: $\\dfrac{${n}}{${d}} = \\dfrac{?}{${d * k}}$`,
        answer: { kind: 'num', value: n * k },
        hints: [`What did the bottom get multiplied by to go from $${d}$ to $${d * k}$?`, `It was multiplied by $${k}$. Do the same to the top.`, `$${n}\\times${k} = ?$`],
        steps: [{ text: `Bottom: $${d}\\times${k} = ${d * k}$.` }, { text: `Do the same to the top: $${n}\\times${k} = ${n * k}$.`, math: `\\frac{${n}}{${d}} = \\frac{${n * k}}{${d * k}}` }],
        mistakes: [
          { value: n, say: 'The top has to change too — if the pieces are cut smaller, you need more of them.' },
          { value: n + (d * k - d), say: 'You **added** to the top. Equivalent fractions come from **multiplying** top and bottom by the same number.' },
        ],
      }
    }
    const k = rng.int(2, level === 3 ? 9 : 6)
    const N = n * k
    const D = d * k
    return {
      prompt: `Simplify $\\dfrac{${N}}{${D}}$ to lowest terms.`,
      answer: { kind: 'num', value: n / d, simplest: true },
      placeholder: 'e.g. 3/4',
      hints: ['Find a number that divides both the top and the bottom.', `Both are divisible by $${k}$. (Is there anything bigger?)`, `$${N}\\div${k} = ${n}$ and $${D}\\div${k} = ${d}$.`],
      steps: [{ text: `GCF of ${N} and ${D} is **${k}**.` }, { text: 'Divide top and bottom by it:', math: `\\frac{${N}\\div${k}}{${D}\\div${k}} = ${fracTex(n, d)}` }],
      mistakes: [{ when: (raw) => /\//.test(raw) && (() => { const [a, b] = raw.split('/').map(Number); return b === D || a === N })(), say: 'Divide **both** the top and the bottom by the same number.' }],
    }
  },
}

const fracAdd: Skill = {
  id: 'frac-add',
  unit: 'arith',
  title: 'Adding & subtracting fractions',
  blurb: 'Common denominators first — then add the tops.',
  prereqs: ['frac-equiv'],
  why: 'Combining measurements like 3/8" + 1/4" in a workshop, or 1/2 cup + 1/3 cup in a recipe.',
  learn: [
    { kind: 'idea', title: 'Only add same-size pieces', body: '$\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}$: one fifth plus two fifths is three fifths. The **denominator is the unit** (fifths) — like adding 1 meter + 2 meters.' },
    { kind: 'explore', title: 'Make the pieces match', body: 'The bottom bar re-cuts both fractions into the same-size pieces so they can be counted together.', widget: { w: 'fractionadd' }, task: 'Try 1/2 + 1/3. What size pieces does the sum use? Why that size?' },
    { kind: 'trap', title: 'Adding the bottoms', wrong: '$\\frac12 + \\frac13 = \\frac25$', right: '$\\frac12 + \\frac13 = \\frac36 + \\frac26 = \\frac56$', why: '2/5 is *less* than 1/2 — adding something can’t make it smaller! The bottom names the piece size; you never add piece sizes.' },
    { kind: 'idea', title: 'The method', body: '1. Find a common denominator (the LCM of the bottoms).\n2. Rewrite each fraction with it.\n3. Add or subtract the tops. Keep the bottom.\n4. Simplify.' },
    { kind: 'check', question: 'What common denominator would you use for $\\frac{3}{4} + \\frac{1}{6}$?', options: ['$12$', '$10$', '$24$ only', '$2$'], correct: 0, explain: 'The LCM of 4 and 6 is 12. (24 also works, but 12 keeps numbers small.)' },
  ],
  generate(rng, level) {
    const subtract = level >= 2 && rng.chance(0.4)
    for (;;) {
      const b = rng.int(2, level === 1 ? 6 : 10)
      const d = level === 1 ? b : rng.int(2, 10)
      if (level > 1 && d === b) continue
      const a = rng.int(1, b - 1)
      const c = rng.int(1, d - 1)
      if (subtract && a * d === c * b) continue
      if (level > 1 && (gcd(a, b) > 1 || gcd(c, d) > 1)) continue
      // subtraction: put the bigger fraction first so the answer stays positive
      return subtract && a * d < c * b ? fracAddProblem(c, d, a, b, true, level) : fracAddProblem(a, b, c, d, subtract, level)
    }
  },
}

function fracAddProblem(a: number, b: number, c: number, d: number, subtract: boolean, level: number) {
  const L = lcm(b, d)
  const A = a * (L / b)
  const C = c * (L / d)
  const top = subtract ? A - C : A + C
  const [rn, rd] = reduce(top, L)
  const op = subtract ? '-' : '+'
  const naive = subtract ? (a - c) / (b - d || NaN) : (a + c) / (b + d)
  return {
    prompt: level === 3 && !subtract ? `A pilot flies $${fr(a, b)}$ of a route before lunch and $${fr(c, d)}$ after. What fraction of the route is that in total?` : `$${fr(a, b)} ${op} ${fr(c, d)} = \\;?$`,
    answer: { kind: 'num' as const, value: top / L, simplest: true },
    placeholder: 'e.g. 5/6',
    hints:
      b === d
        ? ['The denominators already match.', `Just ${subtract ? 'subtract' : 'add'} the tops and keep the bottom $${b}$.`, `$${a} ${op} ${c} = ${subtract ? a - c : a + c}$. Simplify if you can.`]
        : ['The pieces are different sizes — find a common denominator.', `The LCM of ${b} and ${d} is ${L}. Rewrite both fractions as ${L}ths.`, `$${fr(a, b)} = \\frac{${A}}{${L}}$ and $${fr(c, d)} = \\frac{${C}}{${L}}$. Now ${subtract ? 'subtract' : 'add'} the tops.`],
    steps: [
      ...(b === d ? [] : [{ text: `Common denominator: LCM(${b}, ${d}) = ${L}.`, math: `\\frac{${a}}{${b}} = \\frac{${A}}{${L}},\\quad \\frac{${c}}{${d}} = \\frac{${C}}{${L}}` }]),
      { text: `${subtract ? 'Subtract' : 'Add'} the tops, keep the bottom:`, math: `\\frac{${A}}{${L}} ${op} \\frac{${C}}{${L}} = \\frac{${top}}{${L}}` },
      ...(rd !== L ? [{ text: 'Simplify:', math: `\\frac{${top}}{${L}} = ${fracTex(rn, rd)}` }] : []),
      ...(rn > rd ? [{ text: `As a mixed number that’s $${Math.floor(rn / rd)}\\tfrac{${rn % rd}}{${rd}}$ — either form is fine.` }] : []),
    ],
    mistakes: [
      {
        value: naive,
        say:
          b === d
            ? `You ${subtract ? 'subtracted' : 'added'} the bottoms too. The bottom names the piece size (${b}ths) — it stays the same. Only ${subtract ? 'subtract' : 'add'} the tops.`
            : `You ${subtract ? 'subtracted' : 'added'} the bottoms too. The denominator is the piece size — get a **common denominator** first, then combine only the tops.`,
      },
      { value: subtract ? (A + C) / L : (A - C) / L, say: `Check the operation — this one is ${subtract ? 'subtraction' : 'addition'}.` },
    ],
  }
}

const fracMult: Skill = {
  id: 'frac-mult',
  unit: 'arith',
  title: 'Multiplying & dividing fractions',
  blurb: 'Multiply straight across. To divide, flip and multiply.',
  prereqs: ['frac-equiv'],
  why: 'Half of three-quarters of a tank. How many 3/4-hour shifts fit in 6 hours. Scaling any recipe.',
  learn: [
    { kind: 'idea', title: '“Of” means multiply', body: '$\\frac12$ of $\\frac34$ is $\\frac12\\times\\frac34$. Taking half of three quarters leaves three eighths:', math: '\\frac12\\times\\frac34 = \\frac{1\\times3}{2\\times4} = \\frac38' },
    { kind: 'idea', title: 'No common denominator needed', body: 'Unlike adding, you **multiply tops together and bottoms together** — straight across.' },
    { kind: 'idea', title: 'Dividing: how many fit?', body: '$6 \\div \\frac34$ asks **how many 3/4s fit into 6?** Dividing by a fraction = multiplying by its **reciprocal** (flip it):', math: '6 \\div \\frac34 = 6 \\times \\frac43 = 8' },
    { kind: 'trap', title: 'Flipping the wrong fraction', wrong: '$\\frac23 \\div \\frac45 = \\frac32\\times\\frac45$', right: '$\\frac23 \\div \\frac45 = \\frac23\\times\\frac54 = \\frac{10}{12} = \\frac56$', why: 'Keep the first fraction, change ÷ to ×, and flip the **second** one (the divisor). “Keep, change, flip.”' },
    { kind: 'check', question: 'Is $5 \\div \\frac12$ bigger or smaller than 5?', options: ['Bigger — it’s 10, because ten halves fit in 5', 'Smaller — dividing always makes things smaller', 'Exactly 5', '2.5'], correct: 0, explain: 'Dividing by a number less than 1 gives a bigger result. Ten halves fit into 5.' },
  ],
  generate(rng, level) {
    const divide = level >= 2 && rng.chance(0.5)
    let a: number, b: number, c: number, d: number
    do {
      b = rng.int(2, 9)
      d = rng.int(2, 9)
      a = rng.int(1, b - 1)
      c = rng.int(1, d - 1)
    } while (gcd(a, b) > 1 || gcd(c, d) > 1)
    if (!divide) {
      const val = (a * c) / (b * d)
      return {
        prompt: level === 1 ? `$${fr(a, b)} \\times ${fr(c, d)} = \\;?$` : `What is $${fr(a, b)}$ of $${fr(c, d)}$?`,
        answer: { kind: 'num', value: val, simplest: true },
        placeholder: 'e.g. 3/8',
        hints: ['“Of” means multiply.', 'Multiply the tops together and the bottoms together.', `$\\frac{${a}\\times${c}}{${b}\\times${d}} = \\frac{${a * c}}{${b * d}}$ — simplify if possible.`],
        steps: [{ text: 'Multiply straight across:', math: `\\frac{${a}\\times${c}}{${b}\\times${d}} = \\frac{${a * c}}{${b * d}}` }, ...(gcd(a * c, b * d) > 1 ? [{ text: 'Simplify:', math: `= ${fracTex(a * c, b * d)}` }] : [])],
        mistakes: [
          { value: (a * d + b * c) / (b * d), say: 'That’s the **sum**. For multiplication you don’t need a common denominator — just multiply tops and bottoms.' },
          { value: (a * d) / (b * c), say: 'You flipped the second fraction — that’s only for **division**.' },
        ],
      }
    }
    const val = (a * d) / (b * c)
    return {
      prompt: `$${fr(a, b)} \\div ${fr(c, d)} = \\;?$`,
      answer: { kind: 'num', value: val, simplest: true },
      placeholder: 'e.g. 5/6',
      hints: ['Keep the first fraction, change ÷ to ×, flip the second.', `$${fr(a, b)} \\times \\frac{${d}}{${c}}$`, `$\\frac{${a}\\times${d}}{${b}\\times${c}} = \\frac{${a * d}}{${b * c}}$ — simplify.`],
      steps: [
        { text: 'Keep, change, flip:', math: `\\frac{${a}}{${b}} \\div \\frac{${c}}{${d}} = \\frac{${a}}{${b}} \\times \\frac{${d}}{${c}}` },
        { text: 'Multiply across:', math: `= \\frac{${a * d}}{${b * c}}${gcd(a * d, b * c) > 1 ? ` = ${fracTex(a * d, b * c)}` : ''}` },
      ],
      mistakes: [
        { value: (a * c) / (b * d), say: 'You multiplied without flipping. To divide, flip the **second** fraction first.' },
        { value: (b * c) / (a * d), say: 'You flipped the **first** fraction. Keep the first one, flip the second.' },
      ],
    }
  },
}

const decimals: Skill = {
  id: 'decimals',
  unit: 'arith',
  title: 'Decimals',
  blurb: 'Line up the decimal point; count decimal places when multiplying.',
  prereqs: ['add', 'sub', 'mult'],
  why: 'Money, measurements, GPS coordinates and lap times are all decimals.',
  learn: [
    { kind: 'idea', title: 'Decimals are place value', body: '$3.47$ = 3 ones + 4 **tenths** + 7 **hundredths**. Each place to the right is 10× smaller.' },
    { kind: 'idea', title: 'Adding: line up the points', body: 'Line up the **decimal points** (not the right edges). Fill gaps with zeros:', math: '\\begin{array}{r} 12.50\\\\ +\\;\\;3.75\\\\ \\hline 16.25\\end{array}' },
    { kind: 'trap', title: 'Lining up the right edges', wrong: '$4.5 + 1.25 = 1.70$ (lined up 45 and 125)', right: '$4.50 + 1.25 = 5.75$', why: 'The 5 in 4.5 is 5 tenths; the 5 in 1.25 is 5 hundredths. Only line up places that mean the same thing.' },
    { kind: 'idea', title: 'Multiplying: count the places', body: 'Multiply as if there were no decimal points, then put back as many decimal places as the two factors have **in total**:', math: '0.3\\times0.4 = 0.12 \\quad (\\text{1 place} + \\text{1 place} = \\text{2 places})' },
    { kind: 'check', question: 'Which is greater: $0.5$ or $0.45$?', options: ['$0.5$', '$0.45$', 'Equal', 'Can’t tell'], correct: 0, explain: '0.5 = 0.50 = 50 hundredths, and 0.45 = 45 hundredths. More digits doesn’t mean bigger.' },
  ],
  generate(rng, level) {
    const kind = level === 1 ? 'add' : level === 2 ? rng.pick(['add', 'sub', 'mul']) : rng.pick(['mul', 'sub', 'mul2'])
    if (kind === 'add' || kind === 'sub') {
      const a = clean(rng.int(100, 2500) / (rng.chance(0.5) ? 10 : 100))
      const b = clean(rng.int(10, 999) / (rng.chance(0.5) ? 100 : 10))
      const [x, y] = kind === 'sub' && b > a ? [b, a] : [a, b]
      const val = clean(kind === 'add' ? x + y : x - y)
      const pa = (x.toString().split('.')[1] ?? '').length
      const pb = (y.toString().split('.')[1] ?? '').length
      const misaligned = kind === 'add' && pa !== pb ? misalign(x, y) : null
      return {
        prompt: `$${x} ${kind === 'add' ? '+' : '-'} ${y} = \\;?$`,
        answer: { kind: 'num', value: val },
        hints: ['Line up the decimal points.', `Pad with zeros so both have the same number of decimal places: $${x.toFixed(Math.max(pa, pb))}$ and $${y.toFixed(Math.max(pa, pb))}$.`, `Now ${kind === 'add' ? 'add' : 'subtract'} like whole numbers and bring the point straight down.`],
        steps: [
          { text: 'Line up the points and pad with zeros:', math: `${x.toFixed(Math.max(pa, pb))} ${kind === 'add' ? '+' : '-'} ${y.toFixed(Math.max(pa, pb))}` },
          { text: 'Compute, keeping the point in place:', math: `= ${val}` },
        ],
        mistakes: misaligned !== null ? [{ value: misaligned, say: 'It looks like the right edges were lined up instead of the decimal points. Tenths must line up with tenths.' }] : [],
      }
    }
    const a = kind === 'mul2' ? clean(rng.int(11, 99) / 10) : clean(rng.int(2, 9) / 10)
    const b = kind === 'mul2' ? clean(rng.int(2, 9) / 10) : rng.chance(0.5) ? rng.int(2, 9) : clean(rng.int(2, 9) / 10)
    const val = clean(a * b)
    const places = (a.toString().split('.')[1] ?? '').length + (b.toString().split('.')[1] ?? '').length
    const intProd = Math.round(a * 10 ** ((a.toString().split('.')[1] ?? '').length)) * Math.round(b * 10 ** ((b.toString().split('.')[1] ?? '').length))
    return {
      prompt: `$${a} \\times ${b} = \\;?$`,
      answer: { kind: 'num', value: val },
      hints: ['Ignore the decimal points and multiply the whole numbers.', `Count the decimal places in both numbers: ${places} in total.`, `$${intProd}$ with ${places} decimal place${places > 1 ? 's' : ''} → ?`],
      steps: [
        { text: 'Multiply without the points:', math: `${String(a).replace('.', '').replace(/^0+/, '')}\\times${String(b).replace('.', '').replace(/^0+/, '')} = ${intProd}` },
        { text: `Total decimal places: ${places}. Move the point ${places} place${places > 1 ? 's' : ''} left:`, math: `${a}\\times${b} = ${val}` },
      ],
      mistakes: [
        { value: clean(val * 10), say: 'One too few decimal places. Count the places in **both** factors and add them.' },
        { value: clean(val / 10), say: 'One too many decimal places — recount the places in each factor.' },
        { value: intProd, say: 'Don’t forget to put the decimal point back in!' },
      ],
    }
  },
}
function misalign(x: number, y: number) {
  const sx = String(x).replace('.', '')
  const sy = String(y).replace('.', '')
  const px = (String(x).split('.')[1] ?? '').length
  const py = (String(y).split('.')[1] ?? '').length
  // right-edge alignment uses the larger place count for both
  return clean((+sx + +sy) / 10 ** Math.max(px, py))
}

const percent: Skill = {
  id: 'percent',
  unit: 'arith',
  title: 'Percents',
  blurb: 'Percent means “per hundred.” Find a percent of a number.',
  prereqs: ['decimals', 'frac-mult'],
  why: 'Discounts, tips, battery level, test scores, interest rates, probability of rain — percents are how the world reports proportions.',
  learn: [
    { kind: 'idea', title: 'Per hundred', body: '$35\\%$ means 35 out of every 100. As a fraction that’s $\\frac{35}{100}$; as a decimal, $0.35$.' },
    { kind: 'explore', title: 'Percent of a number', body: 'Shade the grid to set the percent; the bar shows that percent of any number.', widget: { w: 'percent' }, task: 'Find 25% of 80 and 50% of 80. What’s 10% of anything?' },
    { kind: 'idea', title: 'Two quick ways', body: '**Decimal:** $35\\%$ of $80 = 0.35\\times80 = 28$.\n**Build from 10%:** 10% of 80 is 8, so 30% is 24, 5% is 4 → 35% is $28$.' },
    { kind: 'trap', title: 'Moving the point the wrong amount', wrong: '$5\\% = 0.5$', right: '$5\\% = 0.05$', why: 'Percent ÷ 100 → move the decimal point **two** places left. 0.5 is 50%.' },
    { kind: 'check', question: '20 is what percent of 80?', options: ['$25\\%$', '$20\\%$', '$400\\%$', '$60\\%$'], correct: 0, explain: '20/80 = 1/4 = 0.25 = 25%. “Part ÷ whole,” then × 100.' },
  ],
  generate(rng, level) {
    const kind = level === 1 ? 'of' : level === 2 ? rng.pick(['of', 'what']) : rng.pick(['what', 'whole', 'of'])
    if (kind === 'of') {
      const p = level === 1 ? rng.pick([10, 20, 25, 50, 75]) : rng.pick([5, 15, 30, 35, 40, 60, 65, 12, 8])
      const n = rng.pick([20, 40, 60, 80, 120, 200, 240, 360, 500])
      const val = clean((p / 100) * n)
      return {
        prompt: rng.chance(0.4) ? `A jacket costs \\$${n}. It’s ${p}% off. How many dollars do you save?` : `What is $${p}\\%$ of $${n}$?`,
        answer: { kind: 'num', value: val },
        hints: ['Convert the percent to a decimal: divide by 100.', `$${p}\\% = ${p / 100}$. Multiply by ${n}.`, `Or: 10% of ${n} is ${n / 10}. Build ${p}% from that.`],
        steps: [{ text: `Percent → decimal: $${p}\\% = ${p / 100}$` }, { text: 'Multiply:', math: `${p / 100}\\times${n} = ${val}` }],
        mistakes: [
          { value: clean((p / 10) * n), say: 'Off by a factor of 10 — a percent is divided by **100**, so move the point two places.' },
          { value: clean(p * n), say: 'Convert the percent to a decimal first (divide by 100).' },
          { value: clean(n - val), say: 'That’s the price **after** the discount. The question asks how much you save.' },
        ],
      }
    }
    if (kind === 'what') {
      const whole = rng.pick([20, 25, 40, 50, 80, 200])
      const p = rng.pick([10, 20, 25, 40, 60, 75, 5, 15])
      const part = clean((p / 100) * whole)
      return {
        prompt: `$${part}$ is what percent of $${whole}$?`,
        answer: { kind: 'num', value: p },
        placeholder: 'e.g. 25',
        hints: ['Percent = part ÷ whole × 100.', `$\\frac{${part}}{${whole}} = ${part / whole}$`, `$${part / whole}\\times100 = ?$`],
        steps: [{ text: 'Part over whole:', math: `\\frac{${part}}{${whole}} = ${part / whole}` }, { text: 'Times 100:', math: `${part / whole}\\times100 = ${p}\\%` }],
        mistakes: [
          { value: clean(part / whole), say: 'That’s the decimal. Multiply by 100 to get the percent.' },
          { value: clean((whole / part) * 100), say: 'You divided whole ÷ part. It’s **part ÷ whole** — the part goes on top.' },
        ],
      }
    }
    const p = rng.pick([10, 20, 25, 40, 50])
    const whole = rng.pick([40, 60, 80, 120, 160, 200])
    const part = (p / 100) * whole
    return {
      prompt: `$${part}$ is $${p}\\%$ of what number?`,
      answer: { kind: 'num', value: whole },
      hints: [`If ${p}% is ${part}, what is 1%?`, `1% = ${part} ÷ ${p} = ${part / p}.`, `100% = ${part / p} × 100.`],
      steps: [{ text: `$${p}\\%$ of the number is ${part}, so 1% is $${part}\\div${p} = ${part / p}$.` }, { text: '100% is', math: `${part / p}\\times100 = ${whole}` }],
      mistakes: [{ value: clean((p / 100) * part), say: `You took ${p}% of ${part}. Here ${part} is the **part** — you're looking for the whole, which is bigger.` }],
    }
  },
}

export const ARITH: Skill[] = [add, sub, mult, div, order, factors, fracEquiv, fracAdd, fracMult, decimals, percent]

// keep unused-import checker quiet for helpers only some generators use
void fracStr
