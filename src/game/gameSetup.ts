import type { ScenarioContext } from './scenario'

export type Base = 1 | 2 | 3

export type Situation = {
  outs: number
  bases: Base[]
}

export const BASE_COMBINATIONS: Base[][] = [
  [],
  [1],
  [2],
  [3],
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 2, 3],
]

export const createRandomSituation = (): Situation => ({
  outs: Math.floor(Math.random() * 3),
  bases: [...BASE_COMBINATIONS[Math.floor(Math.random() * BASE_COMBINATIONS.length)]],
})

export const createScenarioContext = (situation: Situation): ScenarioContext => ({
  outs: situation.outs,
  bases: [...situation.bases],
  runs: 0,
  hits: 0,
  flags: {},
  records: [],
  completionRecords: [],
  playerBase: null,
})

export const describeBases = (bases: Base[]): string =>
  bases.length === 0 ? '주자 없음' : bases.length === 3 ? '만루' : `${bases.join('·')}루 주자`

export const describeSituation = (situation: Situation): string =>
  `${situation.outs}아웃 · ${describeBases(situation.bases)}`