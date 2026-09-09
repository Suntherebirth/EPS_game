import { BATTING_EVENT_RANDOM_WEIGHTS } from './probabilities'

export type BattingMode = 'direct' | 'random'

export type BattingEventId =
  | 'single'
  | 'double'
  | 'triple'
  | 'homeRun'
  | 'walk'
  | 'hitByPitch'
  | 'strikeout'
  | 'infieldHit'
  | 'infieldError'
  | 'groundOut'
  | 'infieldFly'
  | 'flyOut'

export type Play = {
  kind: BattingEventId
  label: string
  description: string
  detail: string
  advance: number
  outs: number
  hit: boolean
  randomWeight: number
}

const battingEvent = (
  kind: BattingEventId,
  label: string,
  description: string,
  detail: string,
  advance: number,
  outs: number,
  hit: boolean,
  randomWeight: number,
): Play => ({ kind, label, description, detail, advance, outs, hit, randomWeight })

export const BATTING_EVENTS: Play[] = [
  battingEvent('single', '1루타', '타자주자가 1루에 진출한다', '깨끗한 안타로 1루에 진출합니다.', 1, 0, true, BATTING_EVENT_RANDOM_WEIGHTS.single),
  battingEvent('double', '2루타', '타자주자가 2루에 진출한다', '장타로 2루까지 진출합니다.', 2, 0, true, BATTING_EVENT_RANDOM_WEIGHTS.double),
  battingEvent('triple', '3루타', '타자주자가 3루에 진출한다', '타구가 외야 깊숙한 곳까지 굴러갑니다.', 3, 0, true, BATTING_EVENT_RANDOM_WEIGHTS.triple),
  battingEvent('homeRun', '홈런', '모든 주자가 홈으로 들어온다', '타구가 담장을 넘어갑니다.', 4, 0, true, BATTING_EVENT_RANDOM_WEIGHTS.homeRun),
  battingEvent('infieldHit', '내야안타', '빠른 발로 1루에서 세이프된다', '내야수가 처리하기 전에 1루를 밟습니다.', 1, 0, true, BATTING_EVENT_RANDOM_WEIGHTS.infieldHit),
  battingEvent('infieldError', '내야수 땅볼 실책', '수비 실책으로 1루에 진출한다', '내야수가 땅볼 처리에 실패했습니다.', 1, 0, false, BATTING_EVENT_RANDOM_WEIGHTS.infieldError),
  battingEvent('walk', '볼넷', '타자주자가 걸어서 1루에 진출한다', '네 개의 볼을 골라 1루에 진출합니다.', 1, 0, false, BATTING_EVENT_RANDOM_WEIGHTS.walk),
  battingEvent('hitByPitch', '사구', '몸에 맞는 공으로 1루에 진출한다', '몸에 맞는 공으로 1루에 진출합니다.', 1, 0, false, BATTING_EVENT_RANDOM_WEIGHTS.hitByPitch),
  battingEvent('strikeout', '삼진', '아웃 카운트가 하나 올라간다', '타자가 삼진으로 물러납니다.', 0, 1, false, BATTING_EVENT_RANDOM_WEIGHTS.strikeout),
  battingEvent('groundOut', '내야 땅볼', '내야로 굴러간 타구', '내야수가 타구를 처리합니다.', 0, 1, false, BATTING_EVENT_RANDOM_WEIGHTS.groundOut),
  battingEvent('infieldFly', '내야 뜬공', '내야수가 뜬공을 잡아낸다', '내야수가 타구를 잡아 아웃됩니다.', 0, 1, false, BATTING_EVENT_RANDOM_WEIGHTS.infieldFly),
  battingEvent('flyOut', '외야 뜬공', '외야수가 타구를 잡아낸다', '외야수가 낙구 지점에서 타구를 잡습니다.', 0, 1, false, BATTING_EVENT_RANDOM_WEIGHTS.flyOut),
]
