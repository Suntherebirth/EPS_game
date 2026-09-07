import { RUNNING_CHANCES } from '../battingEvents'
import type { ScenarioNode } from '../scenario'

const FOLLOW_UP_EVENTS = ['single', 'double', 'walk', 'hitByPitch', 'strikeout', 'groundOut', 'flyOut'] as const

export const EMPTY_BASES_SINGLE_NODES: Record<string, ScenarioNode> = {
  'hit.single.resolve': {
    id: 'hit.single.resolve',
    type: 'event',
    view: 'runner:first',
    title: '1루타',
    effects: [
      { type: 'placeRunner', base: 1 },
      { type: 'setPlayerBase', value: 1 },
      { type: 'addHits', value: 1 },
      { type: 'record', message: '1루타' },
    ],
    transition: { to: 'runner.route' },
  },
  'runner.route': {
    id: 'runner.route',
    type: 'router',
    view: 'result',
    title: '주자 위치 확인',
    tags: ['bounded-loop'],
    routes: [
      { to: 'plate.complete', when: [{ field: 'outs', operator: 'gte', value: 3 }] },
      { to: 'plate.complete', when: [{ field: 'playerBase', operator: 'eq', value: null }] },
      { to: 'runner.first.decide', when: [{ field: 'playerBase', operator: 'eq', value: 1 }] },
      { to: 'runner.second.decide', when: [{ field: 'playerBase', operator: 'eq', value: 2 }] },
      { to: 'runner.third.decide', when: [{ field: 'playerBase', operator: 'eq', value: 3 }] },
    ],
  },
  'runner.first.decide': {
    id: 'runner.first.decide',
    type: 'choice',
    view: 'runner:first',
    title: '1루 주자 시점',
    description: '다음 플레이를 선택하세요.',
    choices: [
      { id: 'waitForBatter', label: '1루에 머물면서 타격을 기다린다', description: '후속 타자의 타격 결과를 확인한다', transition: { to: 'followUp.batting.resolve' } },
      { id: 'stealSecond', label: '2루 도루를 시도한다', description: `성공률 ${Math.round(RUNNING_CHANCES.stealSecond * 100)}%`, when: [{ field: 'bases', operator: 'excludes', value: [2] }], transition: { to: 'runner.first.stealSecond' } },
    ],
  },
  'runner.first.stealSecond': {
    id: 'runner.first.stealSecond',
    type: 'chance',
    view: 'runner:first',
    title: '2루 도루',
    outcomes: [
      { id: 'success', weight: RUNNING_CHANCES.stealSecond, transition: { to: 'runner.route', effects: [{ type: 'moveRunner', from: 1, to: 2 }, { type: 'record', message: '2루 도루 성공' }] } },
      { id: 'out', weight: 1 - RUNNING_CHANCES.stealSecond, transition: { to: 'plate.complete', effects: [{ type: 'moveRunner', from: 1, to: 'out' }, { type: 'record', message: '2루 도루 실패' }] } },
    ],
  },
  'runner.second.decide': {
    id: 'runner.second.decide',
    type: 'choice',
    view: 'runner:second',
    title: '2루 주자 시점',
    choices: [
      { id: 'waitForBatter', label: '2루에 머물면서 타격을 기다린다', description: '후속 타자의 타격 결과를 확인한다', transition: { to: 'followUp.batting.resolve' } },
      { id: 'stealThird', label: '3루 도루를 시도한다', description: `성공률 ${Math.round(RUNNING_CHANCES.stealThird * 100)}%`, when: [{ field: 'bases', operator: 'excludes', value: [3] }], transition: { to: 'runner.second.stealThird' } },
    ],
  },
  'runner.second.stealThird': {
    id: 'runner.second.stealThird',
    type: 'chance',
    view: 'runner:second',
    title: '3루 도루',
    outcomes: [
      { id: 'success', weight: RUNNING_CHANCES.stealThird, transition: { to: 'runner.route', effects: [{ type: 'moveRunner', from: 2, to: 3 }, { type: 'record', message: '3루 도루 성공' }] } },
      { id: 'out', weight: 1 - RUNNING_CHANCES.stealThird, transition: { to: 'plate.complete', effects: [{ type: 'moveRunner', from: 2, to: 'out' }, { type: 'record', message: '3루 도루 실패' }] } },
    ],
  },
  'runner.third.decide': {
    id: 'runner.third.decide',
    type: 'choice',
    view: 'runner:third',
    title: '3루 주자 시점',
    choices: [
      { id: 'waitForBatter', label: '3루에 머물면서 타격을 기다린다', description: '후속 타자의 타격 결과를 확인한다', transition: { to: 'followUp.batting.resolve' } },
    ],
  },
  'followUp.batting.resolve': {
    id: 'followUp.batting.resolve',
    type: 'batting',
    view: 'batter',
    title: '후속 타자 결과',
    mode: 'random',
    eventIds: [...FOLLOW_UP_EVENTS],
    routes: [
      { to: 'followUp.batting.apply', when: [{ field: 'battingEvent', operator: 'in', value: [...FOLLOW_UP_EVENTS] }] },
    ],
  },
  'followUp.batting.apply': {
    id: 'followUp.batting.apply',
    type: 'event',
    view: 'result',
    title: '후속 타격 적용',
    effects: [{ type: 'applyBattingEvent' }],
    transition: { to: 'runner.route' },
  },
  'plate.complete': {
    id: 'plate.complete',
    type: 'terminal',
    view: 'result',
    title: '플레이 완료',
    result: 'plateComplete',
  },
}
