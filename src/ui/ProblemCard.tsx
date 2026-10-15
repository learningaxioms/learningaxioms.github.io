import { useEffect, useRef, useState } from 'react'
import type { Problem } from '../engine/types'
import { check, answerText, type Verdict } from '../engine/check'
import { Rich, Tex } from '../widgets/Rich'
import { Visual } from '../widgets/Visual'
import { Scratchpad } from './Scratchpad'

export interface Outcome {
  correct: boolean
  hints: number
  tries: number
  gaveUp: boolean
}

type Mode = 'practice' | 'review' | 'test'

/** Convert what the student typed into TeX so they can see how we read it. */
function previewTex(raw: string): string | null {
  const s = raw.trim()
  if (!s || /^-?\d+(\.\d+)?$/.test(s)) return null
  let t = s
    .replace(/<=|=</g, '\\le ')
    .replace(/>=|=>/g, '\\ge ')
    .replace(/\bpi\b/gi, '\\pi ')
    .replace(/sqrt\(([^()]*)\)/gi, '\\sqrt{$1}')
    .replace(/\^\(([^()]*)\)/g, '^{$1}')
    .replace(/\^(-?\d+|[a-z])/gi, '^{$1}')
    .replace(/(-?\d+)\s*\/\s*(\d+)/g, '\\tfrac{$1}{$2}')
    .replace(/\*/g, '\\cdot ')
  if (/[{}]/.test(t.replace(/\\(tfrac|sqrt)\{[^{}]*\}(\{[^{}]*\})?|\^\{[^{}]*\}/g, ''))) t = s
  return t
}

const KEYS: Record<string, string[]> = {
  num: ['−', '/', '.', '%'],
  expr: ['x', '^', '(', ')', '−', '/'],
  pair: ['(', ',', ')', '−', '/'],
  set: [',', '−', '/', '√'],
  ineq: ['x', '<', '>', '≤', '≥', '−'],
}

export function ProblemCard({ problem, mode = 'practice', onDone, accent = 'var(--ink)', label }: { problem: Problem; mode?: Mode; onDone: (o: Outcome) => void; accent?: string; label?: React.ReactNode }) {
  const [input, setInput] = useState('')
  const [hints, setHints] = useState(0)
  const [tries, setTries] = useState(0)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [done, setDone] = useState<Outcome | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<number[]>([])
  const [scratch, setScratch] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const a = problem.answer
  const maxTries = mode === 'test' ? 1 : 2

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 120)
    return () => clearTimeout(t)
  }, [done])

  const finish = (o: Outcome) => {
    setDone(o)
    if (!o.correct && mode !== 'test') setShowSteps(true)
  }

  const submit = (raw = input) => {
    if (done) return
    const v = check(problem, raw)
    setVerdict(v)
    if (v.status === 'invalid' || v.status === 'form') return
    const t = tries + 1
    setTries(t)
    if (v.status === 'correct') finish({ correct: true, hints, tries: t, gaveUp: false })
    else {
      if (a.kind === 'choice') setWrongPicks((w) => [...w, Number(raw)])
      if (t >= maxTries) finish({ correct: false, hints, tries: t, gaveUp: false })
      else inputRef.current?.select()
    }
  }

  const giveUp = () => finish({ correct: false, hints, tries: Math.max(1, tries), gaveUp: true })

  const insert = (k: string) => {
    const el = inputRef.current
    const ch = k === '−' ? '-' : k === '√' ? 'sqrt(' : k
    if (!el) return setInput((s) => s + ch)
    const st = el.selectionStart ?? input.length
    const en = el.selectionEnd ?? input.length
    const next = input.slice(0, st) + ch + input.slice(en)
    setInput(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(st + ch.length, st + ch.length)
    })
  }

  const preview = a.kind !== 'choice' ? previewTex(input) : null
  const wrongNow = verdict?.status === 'wrong' && !done

  return (
    <div className={`problem ${done ? (done.correct ? 'is-right' : 'is-wrong') : ''}`} style={{ ['--accent' as string]: accent }}>
      <div className="problem-head">
        {label}
        <div className="problem-tools">
          <button className={`tool ${scratch ? 'on' : ''}`} onClick={() => setScratch((s) => !s)} title="Scratch paper">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            scratch
          </button>
        </div>
      </div>

      <Rich text={problem.prompt} as="div" className="prompt" />
      {problem.visual && <Visual v={problem.visual} />}
      {scratch && <Scratchpad />}

      {a.kind === 'choice' ? (
        <div className="options">
          {a.options.map((o, i) => {
            const isRight = done && i === a.correct
            const isWrong = wrongPicks.includes(i)
            return (
              <button key={i} className={`option ${isRight ? 'right' : ''} ${isWrong ? 'wrong' : ''}`} disabled={!!done || isWrong} onClick={() => submit(String(i))}>
                <span className="opt-key">{String.fromCharCode(65 + i)}</span>
                <Rich text={o} />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="answer-row">
          <div className="answer-box">
            <input
              ref={inputRef}
              value={input}
              disabled={!!done}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              inputMode={a.kind === 'num' ? 'decimal' : 'text'}
              placeholder={problem.placeholder ?? (a.kind === 'pair' ? '(x, y)' : a.kind === 'set' ? 'e.g. 2, -3' : a.kind === 'ineq' ? 'e.g. x > 3' : a.kind === 'expr' ? 'e.g. 3x + 2' : 'your answer')}
              onChange={(e) => {
                setInput(e.target.value)
                if (verdict?.status === 'invalid' || verdict?.status === 'form') setVerdict(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // stop the same keypress from also activating the Continue button that gets focus
                  e.preventDefault()
                  submit()
                }
              }}
              aria-label="Your answer"
            />
            {preview && (
              <span className="preview" aria-hidden>
                <Tex src={preview} />
              </span>
            )}
          </div>
          {!done && (
            <button className="btn primary" onClick={() => submit()}>
              Check
            </button>
          )}
        </div>
      )}

      {a.kind !== 'choice' && !done && (
        <div className="keys">
          {KEYS[a.kind].map((k) => (
            <button key={k} className="key" onClick={() => insert(k)} tabIndex={-1}>
              {k}
            </button>
          ))}
        </div>
      )}

      {/* feedback */}
      {verdict?.status === 'invalid' && <div className="fb fb-info">{verdict.message}</div>}
      {verdict?.status === 'form' && <div className="fb fb-form">{verdict.message}</div>}
      {wrongNow && (
        <div className="fb fb-wrong">
          <strong>Not quite.</strong> {verdict.status === 'wrong' && verdict.mistake ? <Rich text={verdict.mistake} /> : 'Check your work — you get one more try.'}
          {mode !== 'test' && <span className="fb-sub">{verdict.status === 'wrong' && verdict.mistake ? 'Fix it and try again.' : hints < problem.hints.length ? 'A hint might help.' : ''}</span>}
        </div>
      )}

      {/* hint ladder */}
      {mode !== 'test' && hints > 0 && (
        <ol className="hints">
          {problem.hints.slice(0, hints).map((h, i) => (
            <li key={i} className="hint">
              <span className="hint-n">Hint {i + 1}</span>
              <Rich text={h} />
            </li>
          ))}
        </ol>
      )}

      {!done && mode !== 'test' && (
        <div className="problem-actions">
          {hints < problem.hints.length && (
            <button className="btn ghost" onClick={() => setHints((h) => h + 1)}>
              {hints === 0 ? 'Give me a hint' : 'Another hint'} <small>({problem.hints.length - hints} left)</small>
            </button>
          )}
          <button className="btn ghost quiet" onClick={giveUp}>
            I’m stuck — show me
          </button>
        </div>
      )}
      {!done && mode === 'test' && (
        <div className="problem-actions">
          <button className="btn ghost quiet" onClick={giveUp}>
            I don’t know this yet
          </button>
        </div>
      )}

      {done && (
        <div className={`result ${done.correct ? 'ok' : 'no'}`}>
          <div className="result-line">
            {done.correct ? (
              <>
                <span className="stamp ok">✓</span>
                <div>
                  <strong>{done.tries === 1 && done.hints === 0 ? pickPraise(problem.prompt.length) : 'Got it.'}</strong>
                  <span className="result-sub">
                    {done.tries > 1 ? ' You caught your own mistake — that’s how it sticks.' : done.hints ? ` Solved with ${done.hints} hint${done.hints > 1 ? 's' : ''}. Next time, try one fewer.` : ''}
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="stamp no">✗</span>
                <div>
                  <strong>The answer is </strong>
                  <AnswerShow problem={problem} />
                  {mode !== 'test' && <span className="result-sub"> Read the solution below, then try a similar one.</span>}
                </div>
              </>
            )}
          </div>
          {mode !== 'test' && (
            <>
              {!showSteps && (
                <button className="linkish" onClick={() => setShowSteps(true)}>
                  Compare with the worked solution →
                </button>
              )}
              {showSteps && <Steps problem={problem} />}
            </>
          )}
          <button ref={nextRef} className="btn primary next" onClick={() => onDone(done)}>
            Continue <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  )
}

function pickPraise(seed: number) {
  const p = ['Clean solve.', 'Exactly right.', 'Nailed it.', 'Correct — no help needed.', 'Spot on.']
  return p[seed % p.length]
}

function AnswerShow({ problem }: { problem: Problem }) {
  const a = problem.answer
  if (a.kind === 'choice') return <Rich text={a.options[a.correct]} />
  if (a.kind === 'num' && !Number.isInteger(a.value) && Math.abs(a.value * 12 - Math.round(a.value * 12)) < 1e-9) {
    // show simple fractions as fractions
    for (let d = 2; d <= 12; d++)
      if (Math.abs(a.value * d - Math.round(a.value * d)) < 1e-9)
        return <Tex src={`${a.value < 0 ? '-' : ''}\\frac{${Math.abs(Math.round(a.value * d))}}{${d}}${a.unit ? `\\text{ ${a.unit}}` : ''}`} />
  }
  return <code className="ans">{answerText(a)}</code>
}

export function Steps({ problem }: { problem: Problem }) {
  return (
    <ol className="steps">
      {problem.steps.map((s, i) => (
        <li key={i} style={{ animationDelay: `${i * 70}ms` }}>
          <Rich text={s.text} />
          {s.math && <Tex src={s.math} display className="step-math" />}
        </li>
      ))}
    </ol>
  )
}
