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
  announcementHistory: [],
  announcementCategory: 'normal',
})

export const describeBases = (bases: Base[]): string =>
  bases.length === 0 ? '주자 없음' : bases.length === 3 ? '만루' : `${bases.join('·')}루 주자`

export const describeSituation = (situation: Situation): string =>
  `${situation.outs}아웃 · ${describeBases(situation.bases)}`

/**
 * 주어진 베이스 조합(bases)에서 해당 주자(base)가 강제 진루(Forced) 상태인지 판정합니다.
 * 타자 주자가 1루로 진루하므로, 1부터 (base - 1)까지의 모든 베이스에 주자가 차 있어야 포스 상태가 됩니다.
 */
export const isRunnerForced = (bases: number[], base: number): boolean => {
  for (let b = 1; b < base; b++) {
    if (!bases.includes(b)) return false
  }
  return true
}