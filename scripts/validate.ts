// Stress-test every skill generator: each generated problem must accept its own answer,
// have hints + steps, render-safe TeX, and (for choice) a valid correct index.
// Usage: npx tsx scripts/validate.ts [unitId]
import katex from 'katex'
import { SKILLS, SKILL } from '../src/content/index'
import { makeRng } from '../src/engine/rng'
import { check, answerText } from '../src/engine/check'
import type { Answer, Level, Problem } from '../src/engine/types'

const only = process.argv[2]
const N = 300
let fails = 0
const seen = new Set<string>()

function correctInput(a: Answer): string {
  switch (a.kind) {
    case 'num': return String(a.value)
    case 'choice': return String(a.correct)
    case 'expr': return a.expr
    case 'pair': return `(${a.x}, ${a.y})`
    case 'set': return a.values.join(', ')
    case 'ineq': return `x ${a.op} ${a.value}`
  }
}

function texOk(text: string, where: string, id: string) {
  const src = text.replace(/\\\$/g, '')
  const parts = src.match(/\$\$[^$]+\$\$|\$[^$]+\$/g) ?? []
  if ((src.match(/\$/g) ?? []).length % 2) { fail(id, `odd number of $ in ${where}: ${text}`); return }
  for (const p of parts) {
    const t = p.replace(/^\$\$?|\$\$?$/g, '')
    try { katex.renderToString(t, { throwOnError: true, strict: false }) } catch (e) { fail(id, `bad TeX in ${where}: ${t} — ${(e as Error).message.slice(0, 80)}`) }
  }
  if (/undefined(?! slope)|NaN|Infinity|\[object/.test(text)) fail(id, `suspicious text in ${where}: ${text}`)
}
function fail(id: string, msg: string) {
  const k = id + msg.slice(0, 60)
  if (seen.has(k)) return
  seen.add(k)
  fails++
  console.log(`✗ ${id}: ${msg}`)
}

for (const s of SKILLS) {
  if (only && s.unit !== only) continue
  for (const p of s.prereqs) if (!SKILL[p]) fail(s.id, `unknown prereq ${p}`)
  if (s.learn.length < 3) fail(s.id, 'needs at least 3 learn cards')
  for (const c of s.learn) {
    if (c.kind === 'idea') { texOk(c.title, 'card', s.id); texOk(c.body, 'card', s.id); if (c.math) try { katex.renderToString(c.math, { throwOnError: true }) } catch (e) { fail(s.id, 'bad card math ' + c.math) } }
    if (c.kind === 'explore') texOk(c.body, 'card', s.id)
    if (c.kind === 'trap') [c.wrong, c.right, c.why].forEach((t) => texOk(t, 'trap', s.id))
    if (c.kind === 'check') { [c.question, c.explain, ...c.options].forEach((t) => texOk(t, 'check', s.id)); if (c.correct < 0 || c.correct >= c.options.length) fail(s.id, 'check correct index out of range') }
  }
  for (const level of [1, 2, 3] as Level[]) {
    const prompts = new Set<string>()
    for (let i = 0; i < N; i++) {
      const rng = makeRng(i * 7919 + level * 104729 + s.id.length)
      let p: Problem
      try { p = s.generate(rng, level) } catch (e) { fail(s.id, `L${level} generate threw: ${(e as Error).message}`); continue }
      prompts.add(p.prompt + answerText(p.answer))
      texOk(p.prompt, 'prompt', s.id)
      p.hints.forEach((h) => texOk(h, 'hint', s.id))
      p.steps.forEach((st) => { texOk(st.text, 'step', s.id); if (st.math) try { katex.renderToString(st.math, { throwOnError: true }) } catch (e) { fail(s.id, `L${level} bad step math: ${st.math}`) } })
      if (p.hints.length < 2) fail(s.id, `L${level} needs ≥2 hints`)
      if (p.steps.length < 1) fail(s.id, `L${level} needs steps`)
      const a = p.answer
      if (a.kind === 'num' && !isFinite(a.value)) { fail(s.id, `L${level} non-finite answer: ${p.prompt}`); continue }
      if (a.kind === 'choice') {
        a.options.forEach((o) => texOk(o, 'option', s.id))
        if (new Set(a.options).size !== a.options.length) fail(s.id, `L${level} duplicate options: ${a.options.join(' | ')}`)
        if (a.options.length < 2) fail(s.id, `L${level} <2 options`)
      }
      let v
      try { v = check(p, correctInput(a)) } catch (e) { fail(s.id, `L${level} check threw: ${(e as Error).message}`); continue }
      if (v.status !== 'correct') fail(s.id, `L${level} own answer rejected (${v.status}${'message' in v ? ': ' + v.message : ''}): ${p.prompt} → ${answerText(a)}`)
      // (a misconception that coincides with the answer is harmless: correct is checked first)
      for (const m of p.mistakes ?? []) texOk(m.say, 'mistake', s.id)
    }
    if (prompts.size < Math.min(15, N / 4)) fail(s.id, `L${level} low variety: only ${prompts.size} distinct prompts`)
  }
}
console.log(fails ? `\n${fails} problem(s)` : `✓ ${SKILLS.filter((s) => !only || s.unit === only).length} skills OK`)
process.exit(fails ? 1 : 0)
