import type { Skill, Unit, UnitId } from '../engine/types'
import { ARITH } from './arith'
import { PRE } from './pre'
import { ALG } from './alg'
import { GEO } from './geo'

export const UNITS: Unit[] = [
  { id: 'arith', title: 'Arithmetic', tagline: 'Whole numbers, fractions, decimals, percents', color: 'var(--u-arith)', skills: ARITH },
  { id: 'pre', title: 'Pre-Algebra', tagline: 'Negatives, exponents, ratios, first equations', color: 'var(--u-pre)', skills: PRE },
  { id: 'alg', title: 'Algebra I', tagline: 'Equations, lines, systems, quadratics', color: 'var(--u-alg)', skills: ALG },
  { id: 'geo', title: 'Geometry', tagline: 'Angles, area, circles, triangles, volume', color: 'var(--u-geo)', skills: GEO },
]

export const SKILLS: Skill[] = UNITS.flatMap((u) => u.skills)
export const SKILL: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
export const unitOf = (id: UnitId) => UNITS.find((u) => u.id === id)!
