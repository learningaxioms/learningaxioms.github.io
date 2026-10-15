import { useSyncExternalStore } from 'react'
import type { Level } from './types'

// ── Mastery model ──────────────────────────────────────────────────────────
// Each skill has a meter 0–100. Problems get harder as it rises (L1 < 35 ≤ L2 < 70 ≤ L3),
// so you can only reach 100 by solving the hardest version unaided.
// Mastered skills enter spaced review; a missed review sends the meter back to 70.

export const REVIEW_DAYS = [1, 3, 7, 16, 35, 75]
const DAY = 86400000

export interface SkillState {
  meter: number
  attempts: number
  correct: number
  /** first-time-learn cards completed */
  learned: boolean
  mastered: boolean
  /** tested out via placement */
  placed?: boolean
  /** index into REVIEW_DAYS */
  stage: number
  due: number | null
  last: number
  /** recent outcomes, newest last: 1 correct, 0.5 with help, 0 wrong */
  recent: number[]
}

export interface AppState {
  skills: Record<string, SkillState>
  xp: number
  /** yyyy-mm-dd → problems solved that day */
  days: Record<string, number>
  dailyGoal: number
  placementDone: string[]
  name: string
}

const KEY = 'axiom.v1'
const blank = (): AppState => ({ skills: {}, xp: 0, days: {}, dailyGoal: 12, placementDone: [], name: '' })

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...blank(), ...JSON.parse(raw) }
  } catch {
    /* storage unavailable — run in memory */
  }
  return blank()
}

let state: AppState = load()
const subs = new Set<() => void>()
function set(next: AppState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f())
}

export const useApp = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
export const getApp = () => state

export const emptySkill = (): SkillState => ({ meter: 0, attempts: 0, correct: 0, learned: false, mastered: false, stage: 0, due: null, last: 0, recent: [] })
export const skillState = (s: AppState, id: string) => s.skills[id] ?? emptySkill()

export const levelFor = (meter: number): Level => (meter < 35 ? 1 : meter < 70 ? 2 : 3)

export const today = (t = Date.now()) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function patchSkill(id: string, fn: (s: SkillState) => SkillState, extra: Partial<AppState> = {}) {
  set({ ...state, ...extra, skills: { ...state.skills, [id]: fn(skillState(state, id)) } })
}

export function markLearned(id: string) {
  patchSkill(id, (s) => ({ ...s, learned: true }))
}

/** How the meter moves for one practice result. */
export function meterDelta(outcome: { correct: boolean; hints: number; tries: number }) {
  if (!outcome.correct) return -10
  if (outcome.tries > 1) return 4
  if (outcome.hints === 0) return 20
  if (outcome.hints === 1) return 10
  return 5
}

export interface PracticeResult {
  meterBefore: number
  meterAfter: number
  justMastered: boolean
  xp: number
}

export function recordPractice(id: string, outcome: { correct: boolean; hints: number; tries: number }): PracticeResult {
  const s = skillState(state, id)
  const delta = meterDelta(outcome)
  const meter = Math.max(0, Math.min(100, s.meter + delta))
  const justMastered = !s.mastered && meter >= 100
  const score = !outcome.correct ? 0 : outcome.hints === 0 && outcome.tries === 1 ? 1 : 0.5
  const xp = outcome.correct ? (outcome.hints === 0 && outcome.tries === 1 ? 10 : 5) + (justMastered ? 50 : 0) : 1
  const now = Date.now()
  const d = today(now)
  patchSkill(
    id,
    (x) => ({
      ...x,
      meter,
      attempts: x.attempts + 1,
      correct: x.correct + (outcome.correct ? 1 : 0),
      mastered: x.mastered || justMastered,
      stage: justMastered ? 0 : x.stage,
      due: justMastered ? now + REVIEW_DAYS[0] * DAY : x.due,
      last: now,
      recent: [...x.recent, score].slice(-10),
    }),
    { xp: state.xp + xp, days: outcome.correct ? { ...state.days, [d]: (state.days[d] ?? 0) + 1 } : state.days },
  )
  return { meterBefore: s.meter, meterAfter: meter, justMastered, xp }
}

/** A spaced-review result: success pushes the next review further out; a miss resets. */
export function recordReview(id: string, correct: boolean) {
  const now = Date.now()
  const d = today(now)
  patchSkill(
    id,
    (s) => {
      if (correct) {
        const stage = Math.min(s.stage + 1, REVIEW_DAYS.length - 1)
        return { ...s, stage, due: now + REVIEW_DAYS[stage] * DAY, last: now, recent: [...s.recent, 1].slice(-10) }
      }
      return { ...s, stage: 0, mastered: false, meter: 70, due: null, last: now, recent: [...s.recent, 0].slice(-10) }
    },
    { xp: state.xp + (correct ? 15 : 1), days: correct ? { ...state.days, [d]: (state.days[d] ?? 0) + 1 } : state.days },
  )
}

/** Placement: credit a skill as known. Review comes sooner than normal to confirm it. */
export function placeSkill(id: string) {
  const now = Date.now()
  patchSkill(id, (s) => (s.mastered ? s : { ...s, meter: 100, mastered: true, placed: true, learned: true, stage: 0, due: now + 2 * DAY }))
}

export function finishPlacement(unit: string) {
  if (!state.placementDone.includes(unit)) set({ ...state, placementDone: [...state.placementDone, unit] })
}

export function setGoal(n: number) {
  set({ ...state, dailyGoal: n })
}

export function resetAll() {
  set(blank())
}

export function dueSkills(s: AppState, now = Date.now()) {
  return Object.entries(s.skills)
    .filter(([, v]) => v.mastered && v.due !== null && v.due <= now)
    .sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    .map(([id]) => id)
}

export function streak(s: AppState, now = Date.now()) {
  let n = 0
  let t = now
  // today counts if practiced; otherwise the streak is still alive from yesterday
  if (!s.days[today(t)]) t -= DAY
  while (s.days[today(t)]) {
    n++
    t -= DAY
  }
  return n
}
