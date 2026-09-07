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
      { type: 'announce', title: '1루타 성공!', detail: '1루에 도착했습니다.' },
    ],
    transition: { to: 'single.outfield.check' },
  },
  'single.outfield.check': {
    id: 'single.outfield.check',
    type: 'chance',
    view: 'runner:first',
    title: '외야 수비 판정',
    outcomes: [
      { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear, transition: { to: 'runner.first.clearDrop.decide', effects: [{ type: 'record', message: '외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announce', title: '외야수가 타구를 뒤로 빠뜨렸습니다!', detail: '완전히 뒤로 빠졌습니다. 확실하게 진루할 수 있습니다.' }] } },
      { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'runner.first.ambiguousDrop.decide', effects: [{ type: 'record', message: '외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', title: '외야수가 타구를 뒤로 빠뜨렸습니다!', detail: '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.' }] } },
      { id: 'normalFielding', label: '정상 수비', weight: 1 - RUNNING_CHANCES.outfieldDropClear - RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'runner.route' } },
    ],
  },
  'runner.first.clearDrop.decide': {
    id: 'runner.first.clearDrop.decide',
    type: 'choice',
    view: 'runner:first',
    title: '외야수 실책',
    tags: ['surprise-event'],
    description: '1루 주자: 주루 방침을 선택하세요.',
    choices: [
      { id: 'stayFirst', label: '안전하게 1루에 머문다', transition: { to: 'runner.route' } },
      { id: 'advanceSecond', label: '2루로 진루한다', description: '완전히 뒤로 빠진 타구 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 2 }, { type: 'record', message: '외야 실책 이용, 2루 진루', showInCompletion: false }, { type: 'announce', title: '2루 진루 성공!', detail: '외야수 실책을 이용해 2루에 도착했습니다.' }] } },
    ],
  },
  'runner.first.ambiguousDrop.decide': {
    id: 'runner.first.ambiguousDrop.decide',
    type: 'choice',
    view: 'runner:first',
    title: '외야수 실책',
    tags: ['surprise-event'],
    description: '1루 주자: 주루 방침을 선택하세요.',
    choices: [
      { id: 'stayFirst', label: '안전하게 1루에 머문다', transition: { to: 'runner.route' } },
      { id: 'advanceSecond', label: '2루로 진루한다', description: `애매한 타구 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousDrop * 100)}%`, transition: { to: 'runner.first.ambiguousDrop.advance' } },
    ],
  },
  'runner.first.ambiguousDrop.advance': {
    id: 'runner.first.ambiguousDrop.advance',
    type: 'chance',
    view: 'runner:first',
    title: '2루 진루',
    outcomes: [
      { id: 'success', label: '2루 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 2 }, { type: 'record', message: '외야 실책 이용, 2루 진루 성공', showInCompletion: false }, { type: 'announce', title: '2루 진루 성공!', detail: '외야수가 공을 수습하기 전에 2루에 도착했습니다.' }] } },
      { id: 'out', label: '2루 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '외야 실책 이용, 2루 진루 실패', showInCompletion: false }, { type: 'announce', title: '2루 진루 실패', detail: '2루에서 아웃되었습니다.' }] } },
    ],
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
    description: '1루 주자: 주루 방침을 선택하세요.',
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
      { id: 'success', label: '2루 도루 성공', weight: RUNNING_CHANCES.stealSecond, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 2 }, { type: 'record', message: '2루 도루 성공' }, { type: 'announce', title: '2루 도루 성공!', detail: '2루에 도착했습니다.' }] } },
      { id: 'out', label: '2루 도루 실패', weight: 1 - RUNNING_CHANCES.stealSecond, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '2루 도루 실패' }, { type: 'announce', title: '2루 도루 실패', detail: '2루에서 아웃되었습니다.' }] } },
    ],
  },
  'runner.second.decide': {
    id: 'runner.second.decide',
    type: 'choice',
    view: 'runner:second',
    title: '2루 주자 시점',
    description: '2루 주자: 주루 방침을 선택하세요.',
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
      { id: 'success', label: '3루 도루 성공', weight: RUNNING_CHANCES.stealThird, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 3 }, { type: 'record', message: '3루 도루 성공' }, { type: 'announce', title: '3루 도루 성공!', detail: '3루에 도착했습니다.' }] } },
      { id: 'out', label: '3루 도루 실패', weight: 1 - RUNNING_CHANCES.stealThird, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '3루 도루 실패' }, { type: 'announce', title: '3루 도루 실패', detail: '3루에서 아웃되었습니다.' }] } },
    ],
  },
  'runner.third.decide': {
    id: 'runner.third.decide',
    type: 'choice',
    view: 'runner:third',
    title: '3루 주자 시점',
    description: '3루 주자: 주루 방침을 선택하세요.',
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
