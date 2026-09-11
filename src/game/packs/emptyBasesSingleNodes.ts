import { ANNOUNCEMENTS } from '../announcementMessages'
import { RUNNING_CHANCES } from '../probabilities'
import { SCENARIO_TEXT } from '../scenarioText'
import type { ScenarioNode } from '../scenario'

const FOLLOW_UP_EVENTS = ['single', 'double', 'walk', 'hitByPitch', 'strikeout', 'groundOut', 'flyOut'] as const
const FOLLOW_UP_GROUND_THROWING_ERROR_AFTER_FIELDING = RUNNING_CHANCES.infieldGroundThrowingError / (1 - RUNNING_CHANCES.infieldGroundFieldingError)
const FOLLOW_UP_GROUND_THROW_SUCCESS_AFTER_FIELDING = 1 - FOLLOW_UP_GROUND_THROWING_ERROR_AFTER_FIELDING
const FOLLOW_UP_GROUND_THROW_CLEAR_EXTRA_ADVANCE = RUNNING_CHANCES.followUpGroundThrowClearExtraAdvance
const FOLLOW_UP_GROUND_THROW_AMBIGUOUS_EXTRA_ADVANCE = RUNNING_CHANCES.followUpGroundThrowAmbiguousExtraAdvance

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
      { type: 'announce', title: '1루타 성공!', detail: '1루에 안전하게 도착했습니다.' },
    ],
    transition: { to: 'single.outfield.check' },
  },
  'single.outfield.check': {
    id: 'single.outfield.check',
    type: 'chance',
    view: 'runner:first',
    title: '외야 수비 판정',
    tags: ['composite-event-step'],
    outcomes: [
      { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear, transition: { to: 'runner.first.clearDrop.decide', effects: [{ type: 'record', message: '외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.outfieldError(true) }] } },
      { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'runner.first.ambiguousDrop.decide', effects: [{ type: 'record', message: '외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.outfieldError(false) }] } },
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
      { id: 'stayFirst', label: '안전하게 1루에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책, 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative', advance: 'blocked', scene: 'error-outfield-through-clear' }] } },
      { id: 'advanceSecond', label: '2루로 진루한다', description: '완전히 뒤로 빠진 타구 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 2 }, { type: 'record', message: '외야 실책 이용, 2루 진루', showInCompletion: false }, { type: 'announce', title: '2루 진루 성공!', detail: '외야수 실책을 이용해 2루에 안전하게 도착했습니다.', category: 'normal', advance: 'normal', detailScene: 'advance-clear', titleImageMode: 'same-as-detail-scene' }] } },
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
      { id: 'stayFirst', label: '안전하게 1루에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책, 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '위험하다고 판단하여 진루하지 않았습니다.', tone: 'neutral', advance: 'blocked', scene: 'error-outfield-through-ambiguous' }] } },
      { id: 'advanceSecond', label: '2루로 진루한다', description: `애매한 타구 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousDrop * 100)}%`, transition: { to: 'runner.first.ambiguousDrop.advance' } },
    ],
  },
  'runner.first.ambiguousDrop.advance': {
    id: 'runner.first.ambiguousDrop.advance',
    type: 'chance',
    view: 'runner:first',
    title: '2루 진루',
    outcomes: [
      { id: 'success', label: '2루 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 2 }, { type: 'record', message: '외야 실책 이용, 2루 진루 성공', showInCompletion: false }, { type: 'announce', title: '2루 진루 성공!', detail: '위험을 감수하고 2루 추가 진루에 성공했습니다.', advance: 'bold', detailScene: 'advance-ambiguous-safe', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'out', label: '2루 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '외야 실책 이용, 2루 진루 실패', showInCompletion: false }, { type: 'announce', title: '2루 진루 실패', detail: SCENARIO_TEXT.defense.nextBaseOut.replace('{destination}', '2루'), tone: 'negative', detailScene: 'advance-ambiguous-out', titleImageMode: 'same-as-detail-scene' }] } },
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
      { id: 'waitForBatter', label: '1루에 머물면서 타격을 기다린다', description: '후속 타자의 타격 결과를 확인한다', transition: { to: 'wildPitch.check' } },
      { id: 'stealSecond', label: '2루 도루를 시도한다', description: `성공률 ${Math.round(RUNNING_CHANCES.stealSecond * 100)}%`, when: [{ field: 'bases', operator: 'excludes', value: [2] }], transition: { to: 'runner.first.stealSecond' } },
    ],
  },
  'runner.first.stealSecond': {
    id: 'runner.first.stealSecond',
    type: 'chance',
    view: 'runner:first',
    title: '2루 도루',
    outcomes: [
      { id: 'success', label: '2루 도루 성공', weight: RUNNING_CHANCES.stealSecond, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 2 }, { type: 'record', message: '2루 도루 성공' }, { type: 'announce', ...SCENARIO_TEXT.steal.secondSuccess, advance: 'bold' }] } },
      { id: 'out', label: '2루 도루 실패', weight: 1 - RUNNING_CHANCES.stealSecond, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '2루 도루 실패' }, { type: 'announce', ...SCENARIO_TEXT.steal.secondFailure, tone: 'negative' }] } },
    ],
  },
  'runner.second.decide': {
    id: 'runner.second.decide',
    type: 'choice',
    view: 'runner:second',
    title: '2루 주자 시점',
    description: '2루 주자: 주루 방침을 선택하세요.',
    choices: [
      { id: 'waitForBatter', label: '2루에 머물면서 타격을 기다린다', description: '후속 타자의 타격 결과를 확인한다', transition: { to: 'wildPitch.check' } },
      { id: 'stealThird', label: '3루 도루를 시도한다', description: `성공률 ${Math.round(RUNNING_CHANCES.stealThird * 100)}%`, when: [{ field: 'bases', operator: 'excludes', value: [3] }], transition: { to: 'runner.second.stealThird' } },
    ],
  },
  'runner.second.stealThird': {
    id: 'runner.second.stealThird',
    type: 'chance',
    view: 'runner:second',
    title: '3루 도루',
    outcomes: [
      { id: 'success', label: '3루 도루 성공', weight: RUNNING_CHANCES.stealThird, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 3 }, { type: 'record', message: '3루 도루 성공' }, { type: 'announce', ...SCENARIO_TEXT.steal.thirdSuccess, advance: 'bold' }] } },
      { id: 'out', label: '3루 도루 실패', weight: 1 - RUNNING_CHANCES.stealThird, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '3루 도루 실패' }, { type: 'announce', ...SCENARIO_TEXT.steal.thirdFailure, tone: 'negative' }] } },
    ],
  },
  'runner.third.decide': {
    id: 'runner.third.decide',
    type: 'choice',
    view: 'runner:third',
    title: '3루 주자 시점',
    description: '3루 주자: 주루 방침을 선택하세요.',
    choices: [
      { id: 'waitForBatter', label: '3루에 머물면서 타격을 기다린다', description: '후속 타자의 타격 결과를 확인한다', transition: { to: 'wildPitch.check' } },
    ],
  },
  'wildPitch.check': {
    id: 'wildPitch.check',
    type: 'chance',
    view: 'runner:first',
    title: '폭투 판정',
    outcomes: [
      { id: 'clearWildPitch', label: '명백한 폭투', weight: RUNNING_CHANCES.wildPitchClear, transition: { to: 'runner.wildPitch.clear.decide', effects: [{ type: 'advanceRunnersAheadOfPlayer' }, { type: 'record', message: '포수 뒤로 공이 완전히 빠짐', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.wildPitchError(true) }] } },
      { id: 'ambiguousWildPitch', label: '애매한 폭투', weight: RUNNING_CHANCES.wildPitchAmbiguous, transition: { to: 'runner.wildPitch.ambiguous.decide', effects: [{ type: 'advanceRunnersAheadOfPlayer' }, { type: 'record', message: '포수 뒤로 공이 애매하게 빠짐', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.wildPitchError(false) }] } },
      { id: 'normalPitch', label: '정상 포구', weight: 1 - RUNNING_CHANCES.wildPitchClear - RUNNING_CHANCES.wildPitchAmbiguous, transition: { to: 'followUp.batting.resolve' } },
    ],
  },
  'runner.wildPitch.clear.decide': {
    id: 'runner.wildPitch.clear.decide',
    type: 'choice',
    view: 'runner:first',
    title: '폭투',
    tags: ['surprise-event', 'player-position-view'],
    description: '주루 방침을 선택하세요.',
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '폭투, 진루하지 않음', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.wildPitchStay.clear }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceChoice, description: '폭투를 이용한다 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '폭투 이용 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.wildPitchAdvance.clear }] } },
    ],
  },
  'runner.wildPitch.ambiguous.decide': {
    id: 'runner.wildPitch.ambiguous.decide',
    type: 'choice',
    view: 'runner:first',
    title: '폭투',
    tags: ['surprise-event', 'player-position-view'],
    description: '주루 방침을 선택하세요.',
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '폭투, 진루하지 않음', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.wildPitchStay.ambiguous }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceChoice, description: `폭투를 이용한다 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousWildPitch * 100)}%`, transition: { to: 'runner.wildPitch.ambiguous.advance' } },
    ],
  },
  'runner.wildPitch.ambiguous.advance': {
    id: 'runner.wildPitch.ambiguous.advance',
    type: 'chance',
    view: 'runner:first',
    title: '폭투 진루 판정',
    outcomes: [
      { id: 'success', label: '폭투 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousWildPitch, transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '폭투 이용 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.wildPitchAdvance.ambiguous }] } },
      { id: 'out', label: '폭투 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousWildPitch, transition: { to: 'plate.complete', effects: [{ type: 'announcePlayerAdvanceFailure', ...ANNOUNCEMENTS.wildPitchAdvanceFailure }, { type: 'movePlayer', to: 'out' }, { type: 'record', message: '폭투 이용 진루 실패', showInCompletion: false }] } },
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
      { to: 'followUp.ground.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'groundOut' }], effects: [{ type: 'announce', title: '후속타자의 내야 땅볼 발생!', detail: '내야수가 타구를 처리하러 이동합니다.', detailScene: 'ball-ground-infield', titleImageMode: 'same-as-detail-scene' }] },
      { to: 'followUp.fly.outfield.route', when: [{ field: 'battingEvent', operator: 'eq', value: 'flyOut' }], effects: [{ type: 'announce', title: '후속타자의 외야 뜬공 발생!', detail: '외야수가 타구를 처리하러 이동합니다.', detailScene: 'ball-fly-outfield-fielder-moving' }] },
      { to: 'followUp.batting.apply', when: [{ field: 'battingEvent', operator: 'in', value: [...FOLLOW_UP_EVENTS] }] },
    ],
  },
  'followUp.fly.outfield.route': {
    id: 'followUp.fly.outfield.route', type: 'router', view: 'batter', title: '후속 외야 뜬공 주자 확인', tags: ['composite-event-step'],
    routes: [
      { to: 'followUp.fly.outfield.check', when: [{ field: 'playerBase', operator: 'eq', value: 2 }] },
      { to: 'followUp.fly.outfield.runnerThird.check', when: [{ field: 'playerBase', operator: 'eq', value: 3 }, { field: 'outs', operator: 'lt', value: 2 }] },
      { to: 'followUp.batting.apply' },
    ],
  },
  'fly.outfield.runnerThird.check': {
    id: 'fly.outfield.runnerThird.check', type: 'chance', view: 'runner:third', title: '외야수 포구 판정', tags: ['composite-event-step'],
    outcomes: [
      { id: 'ambiguousFly', label: '애매한 외야 플라이', weight: RUNNING_CHANCES.outfieldFlyDepthAmbiguous, transition: { to: 'runner.third.sacrificeFly.ambiguous.auto', effects: [{ type: 'announce', title: '애매한 외야 플라이!', detail: '3루 주자의 태그업 여부를 자동으로 판단합니다.', tone: 'caution', detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'deepFly', label: '명백하게 깊은 외야 플라이', weight: RUNNING_CHANCES.outfieldFlyDepthDeep, transition: { to: 'runner.third.sacrificeFly.deep.auto', effects: [{ type: 'announce', title: '명백하게 깊은 외야 플라이!', detail: '3루 주자가 안전하게 태그업할 수 있습니다.', detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.sacrificeFly.ambiguous.auto': {
    id: 'runner.third.sacrificeFly.ambiguous.auto', type: 'chance', view: 'runner:third', title: '애매한 외야 플라이', tags: ['composite-event-step'],
    outcomes: [
      { id: 'stayThird', label: '3루에 머무름', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly, transition: { to: 'runner.route', effects: [{ type: 'applySacrificeFlyOut', score: false }, { type: 'announce', title: '애매한 외야 플라이, 3루에 머뭅니다.', detail: '태그업을 시도하지 않았습니다.' }] } },
      { id: 'tagUp', label: '홈으로 태그업 시도', weight: RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly, transition: { to: 'runner.third.sacrificeFly.ambiguous.advance', effects: [{ type: 'announce', title: '애매한 외야 플라이, 태그업을 시도합니다.', detail: `태그업 시도 확률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly * 100)}%`, detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.sacrificeFly.deep.auto': {
    id: 'runner.third.sacrificeFly.deep.auto', type: 'event', view: 'runner:third', title: '명백하게 깊은 외야 플라이',
    effects: [{ type: 'applySacrificeFlyOut', score: true }, { type: 'announce', ...SCENARIO_TEXT.running.tagUpSafeSuccess, tone: 'neutral', titleImageMode: 'same-as-detail-scene' }],
    transition: { to: 'plate.complete' },
  },
  'followUp.fly.outfield.check': {
    id: 'followUp.fly.outfield.check', type: 'chance', view: 'runner:second', title: '후속 외야수 포구 판정', tags: ['composite-event-step'],
    outcomes: [
      { id: 'fieldingFailed', label: '외야수 처리 실패', weight: RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'followUp.fly.outfield.failure.route', effects: [{ type: 'applyFollowUpOutfieldDropWithSecondRunner' }, { type: 'record', message: '후속 타자 외야 뜬공, 외야수 포구 실책', showInCompletion: false }, { type: 'announce', title: '상대 외야수가 뜬공 포구에 실패했습니다!', detail: '실책으로 타자 주자가 1루에 진출합니다.' }] } },
      { id: 'caught', label: SCENARIO_TEXT.defense.flyOutChoice, weight: 1 - RUNNING_CHANCES.outfieldDropClear - RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'followUp.batting.apply' } },
    ],
  },
  'followUp.fly.outfield.failure.check': {
    id: 'followUp.fly.outfield.failure.check', type: 'chance', view: 'runner:second', title: '후속 외야수 처리 실패', tags: ['surprise-event', 'composite-event-step', 'player-position-view'],
    outcomes: [
      { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.second.outfieldError.clear.decide', effects: [{ type: 'record', message: '후속 타자 외야 뜬공, 외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.followUpOutfieldErrorByRunner(2, true) }] } },
      { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.second.outfieldError.ambiguous.decide', effects: [{ type: 'record', message: '후속 타자 외야 뜬공, 외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.followUpOutfieldErrorByRunner(2, false) }] } },
    ],
  },
  'followUp.fly.outfield.failure.route': {
    id: 'followUp.fly.outfield.failure.route', type: 'router', view: 'result', title: '후속 외야수 실책 주자 확인',
    routes: [
      { to: 'followUp.fly.outfield.runnerThird.failure.check', when: [{ field: 'flag', operator: 'eq', key: 'followUpOutfieldForcedAdvance', value: true }] },
      { to: 'followUp.fly.outfield.failure.check' },
    ],
  },
  'followUp.fly.outfield.runnerThird.failure.check': {
    id: 'followUp.fly.outfield.runnerThird.failure.check', type: 'chance', view: 'runner:third', title: '후속 외야수 처리 실패', tags: ['surprise-event', 'composite-event-step', 'player-position-view'],
    outcomes: [
      { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.third.outfieldError.clear.decide', effects: [{ type: 'record', message: '후속 타자 외야 뜬공, 외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.followUpOutfieldErrorByRunner(3, true) }] } },
      { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.third.outfieldError.ambiguous.decide', effects: [{ type: 'record', message: '후속 타자 외야 뜬공, 외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.followUpOutfieldErrorByRunner(3, false) }] } },
    ],
  },
  'runner.third.outfieldError.clear.decide': {
    id: 'runner.third.outfieldError.clear.decide', type: 'choice', view: 'runner:third', title: '외야수 실책', tags: ['surprise-event', 'player-position-view'],
    description: '3루 주자: 홈으로 추가 진루할까요?',
    choices: [
      { id: 'stayThird', label: '안전하게 3루에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책 후 홈 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '외야수 실책이 나왔지만 홈으로 진루하지 않았습니다.', detail: '3루에 머물렀습니다.' }] } },
      { id: 'advanceHome', label: '홈으로 진루한다', description: '명백하게 뒤로 빠진 타구 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '외야 실책 이용, 홈 진루', showInCompletion: false }, { type: 'announcePlayerAdvance', title: '홈 진루 성공!', detail: '외야수 실책을 이용해 홈에 안전하게 들어왔습니다.', category: 'normal' }] } },
    ],
  },
  'runner.third.outfieldError.ambiguous.decide': {
    id: 'runner.third.outfieldError.ambiguous.decide', type: 'choice', view: 'runner:third', title: '외야수 실책', tags: ['surprise-event', 'player-position-view'],
    description: '3루 주자: 홈으로 진루할까요?',
    choices: [
      { id: 'stayThird', label: '안전하게 3루에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책 후 홈 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '외야수 실책이 나왔지만 홈으로 진루하지 않았습니다.', detail: '위험을 감수하지 않고 3루에 머물렀습니다.', tone: 'neutral' }] } },
      { id: 'advanceHome', label: '홈으로 진루를 시도한다', description: `애매하게 뒤로 빠진 타구 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousDrop * 100)}%`, transition: { to: 'runner.third.outfieldError.ambiguous.advance' } },
    ],
  },
  'runner.third.outfieldError.ambiguous.advance': {
    id: 'runner.third.outfieldError.ambiguous.advance', type: 'chance', view: 'runner:third', title: '홈 진루', tags: ['player-position-view'],
    outcomes: [
      { id: 'success', label: '홈 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '외야 실책 이용, 홈 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', title: '위험을 감수한 홈 진루 성공!', detail: '위험을 감수하고 3루 주자가 홈에 들어왔습니다.', advance: 'bold' }] } },
      { id: 'out', label: '홈 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '외야 실책 이용, 홈 진루 실패', showInCompletion: false }, { type: 'announce', ...SCENARIO_TEXT.running.homeAdvanceFailure, tone: 'negative', scene: 'home-advance-failure' }] } },
    ],
  },
  'followUp.fly.outfield.runnerThird.check': {
    id: 'followUp.fly.outfield.runnerThird.check', type: 'chance', view: 'runner:third', title: '후속 외야수 포구 판정', tags: ['composite-event-step'],
    outcomes: [
      { id: 'ambiguousFly', label: '애매한 외야 플라이', weight: RUNNING_CHANCES.outfieldFlyDepthAmbiguous, transition: { to: 'runner.third.sacrificeFly.ambiguous.decide', effects: [{ type: 'announce', title: '애매한 외야 플라이!', detail: '3루 주자가 태그업을 시도하다가 아웃될 수도 있습니다.', tone: 'caution', detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'deepFly', label: '명백하게 깊은 외야 플라이', weight: RUNNING_CHANCES.outfieldFlyDepthDeep, transition: { to: 'runner.third.sacrificeFly.deep.decide', effects: [{ type: 'announce', title: '명백하게 깊은 외야 플라이!', detail: '3루 주자가 안전하게 태그업할 수 있습니다.', detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.sacrificeFly.ambiguous.decide': {
    id: 'runner.third.sacrificeFly.ambiguous.decide', type: 'choice', view: 'runner:third', title: '애매한 외야 플라이', tags: ['player-position-view'],
    description: '3루 주자: 태그업 여부를 선택하세요.',
    choices: [
      { id: 'stayThird', label: '3루에 머무른다', transition: { to: 'runner.route', effects: [{ type: 'applySacrificeFlyOut', score: false }, { type: 'announce', title: '애매한 외야 플라이, 3루에 머뭅니다.', detail: '위험을 감수하지 않고 3루를 지켰습니다.', tone: 'neutral' }] } },
      { id: 'tagUp', label: '홈으로 태그업 진루한다', description: `성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly * 100)}%`, transition: { to: 'runner.third.sacrificeFly.ambiguous.advance', effects: [{ type: 'announce', title: '위험을 감수하고 태그업을 시도합니다.', detail: `홈 태그업 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly * 100)}%`, detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.sacrificeFly.ambiguous.advance': {
    id: 'runner.third.sacrificeFly.ambiguous.advance', type: 'chance', view: 'runner:third', title: '홈 태그업',
    outcomes: [
      { id: 'success', label: '홈 태그업 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly, transition: { to: 'plate.complete', effects: [{ type: 'applySacrificeFlyOut', score: true }, { type: 'announce', ...SCENARIO_TEXT.running.tagUpSuccess, advance: 'bold', detailScene: 'home-in-positive', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'out', label: '홈 태그업 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousSacrificeFly, transition: { to: 'plate.complete', effects: [{ type: 'applySacrificeFlyOut', score: false }, { type: 'moveRunner', from: 3, to: 'out' }, { type: 'announce', ...SCENARIO_TEXT.running.tagUpFailure, tone: 'negative', scene: 'home-advance-failure' }] } },
    ],
  },
  'runner.third.sacrificeFly.deep.decide': {
    id: 'runner.third.sacrificeFly.deep.decide', type: 'choice', view: 'runner:third', title: '명백하게 깊은 외야 플라이', tags: ['player-position-view'],
    description: '3루 주자: 태그업 여부를 선택하세요.',
    choices: [
      { id: 'stayThird', label: '3루에 머무른다', transition: { to: 'runner.route', effects: [{ type: 'applySacrificeFlyOut', score: false }, { type: 'announce', title: '명백하게 깊은 외야 플라이, 3루에 머뭅니다.', detail: '명백히 진루할 수 있는 타구였지만 태그업하지 않았습니다.', tone: 'caution' }] } },
      { id: 'tagUp', label: '홈으로 태그업 진루한다', description: '성공률 100%', transition: { to: 'runner.third.sacrificeFly.deep.advance', effects: [{ type: 'announce', ...SCENARIO_TEXT.running.deepTagUpAttempt, detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.sacrificeFly.deep.advance': {
    id: 'runner.third.sacrificeFly.deep.advance', type: 'chance', view: 'runner:third', title: '홈 태그업', tags: ['player-position-view'],
    outcomes: [
      { id: 'success', label: '홈 태그업 성공', weight: 1, transition: { to: 'plate.complete', effects: [{ type: 'applySacrificeFlyOut', score: true }, { type: 'announce', ...SCENARIO_TEXT.running.tagUpSafeSuccess, tone: 'neutral', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'out', label: '홈 태그업 실패', weight: 0, transition: { to: 'plate.complete', effects: [{ type: 'applySacrificeFlyOut', score: false }, { type: 'moveRunner', from: 3, to: 'out' }, { type: 'announce', ...SCENARIO_TEXT.running.deepTagUpFailure, tone: 'negative', scene: 'home-advance-failure' }] } },
    ],
  },
  'followUp.ground.check': {
    id: 'followUp.ground.check', tags: ['composite-event-step'],
    type: 'chance',
    view: 'batter',
    title: '후속 내야 땅볼 수비 판정',
    outcomes: [
      { id: 'fieldingError', label: '내야수 포구 실책', weight: RUNNING_CHANCES.infieldGroundFieldingError, transition: { to: 'followUp.ground.fieldingError' } },
      { id: 'cleanPlay', label: '내야수 포구 성공', weight: 1 - RUNNING_CHANCES.infieldGroundFieldingError, transition: { to: 'followUp.ground.advanceOpportunity.route', effects: [{ type: 'announce', ...ANNOUNCEMENTS.groundFieldingSuccess }] } },
    ],
  },
  'followUp.ground.advanceOpportunity.route': {
    id: 'followUp.ground.advanceOpportunity.route',
    type: 'router',
    view: 'result',
    title: '내야 땅볼 송구 전 주루 확인',
    routes: [
      { to: 'followUp.ground.throwingError.check', when: [{ field: 'playerBase', operator: 'eq', value: 1 }], effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'none' }] },
      { to: 'followUp.ground.throwingError.check', when: [{ field: 'playerBase', operator: 'eq', value: 2 }, { field: 'bases', operator: 'includes', value: [1, 2] }], effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'none' }] },
      { to: 'followUp.ground.throwingError.check', when: [{ field: 'playerBase', operator: 'eq', value: 3 }, { field: 'bases', operator: 'includes', value: [1, 2, 3] }], effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'none' }] },
      { to: 'runner.second.groundOut.decide', when: [{ field: 'playerBase', operator: 'eq', value: 2 }, { field: 'outs', operator: 'lt', value: 2 }], effects: [{ type: 'announce', title: '상대 내야수, 1루 송구 준비 완료!', detail: '2루 주자는 송구 시점에 맞춰 3루 진루를 시도할 수 있습니다.', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] },
      { to: 'runner.third.groundOut.decide', when: [{ field: 'playerBase', operator: 'eq', value: 3 }, { field: 'outs', operator: 'lt', value: 2 }], effects: [{ type: 'announce', title: '상대 내야수, 1루 송구 준비 완료!', detail: '3루 주자는 위험을 감수하고 송구 시점에 맞춰 홈 쇄도를 시도할 수 있습니다.', tone: 'caution', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] },
      { to: 'followUp.ground.throwingError.check', effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'none' }] },
    ],
  },
  'runner.second.groundOut.decide': {
    id: 'runner.second.groundOut.decide',
    type: 'choice',
    view: 'runner:second',
    title: '내야 땅볼 아웃',
    description: '2루 주자: 주루 방침을 선택하세요.',
    choices: [
      { id: 'staySecond', label: '안전하게 2루에 머문다', transition: { to: 'followUp.ground.throwingError.check', effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'stay' }, { type: 'announce', title: '2루에 머무릅니다.', detail: '내야수의 송구 결과를 지켜봅니다.', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'advanceThird', label: '내야수 송구 순간 3루 진루를 시도한다', description: '송구 성공 시 성공률 판정', transition: { to: 'followUp.ground.throwingError.check', effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'attempt' }, { type: 'announce', title: '3루 진루를 시도합니다.', detail: '내야수의 송구 결과에 따라 진루 성공률이 결정됩니다.', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.second.groundOut.advance': {
    id: 'runner.second.groundOut.advance',
    type: 'chance',
    view: 'runner:second',
    title: '3루 진루',
    outcomes: [
      { id: 'success', label: '3루 진루 성공', weight: RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 3 }, { type: 'record', message: '내야 땅볼 중 3루 진루 성공', showInCompletion: false }, { type: 'announce', ...SCENARIO_TEXT.running.advanceThirdSuccess, title: '후속 타자 내야 땅볼 3루 진루 성공!', advance: 'bold', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'out', label: '3루 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '내야 땅볼 중 3루 진루 실패', showInCompletion: false }, { type: 'announce', title: '후속 타자 내야 땅볼 3루 진루 실패', detail: SCENARIO_TEXT.running.thirdBaseFailure.detail, tone: 'negative', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.groundOut.decide': {
    id: 'runner.third.groundOut.decide', type: 'choice', view: 'runner:third', title: '내야 땅볼 아웃',
    description: '3루 주자: 내야수가 던지는 순간 홈 쇄도를 시도할까요?',
    choices: [
      { id: 'stayThird', label: '안전하게 3루에 머문다', transition: { to: 'followUp.ground.throwingError.check', effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'stay' }, { type: 'announce', title: '3루에 머무릅니다.', detail: '내야수의 송구 결과를 지켜봅니다.', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'advanceHome', label: '홈으로 쇄도한다', description: '송구 성공 시 성공률 판정', transition: { to: 'followUp.ground.throwingError.check', effects: [{ type: 'setFlag', key: 'groundAdvanceIntent', value: 'attempt' }, { type: 'announce', title: '홈 쇄도를 시도합니다.', detail: '상대 내야수가 송구하는 순간 홈으로 쇄도합니다.', detailScene: 'ground-home-rush', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.third.groundOut.advance': {
    id: 'runner.third.groundOut.advance', type: 'chance', view: 'runner:third', title: '홈 쇄도',
    outcomes: [
      { id: 'success', label: '홈 쇄도 성공', weight: RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'runner.route', effects: [{ type: 'movePlayer', to: 'home' }, { type: 'record', message: '내야 땅볼 중 홈 쇄도 성공', showInCompletion: false }, { type: 'announce', ...SCENARIO_TEXT.running.homeAdvanceSuccess, advance: 'bold', detailScene: 'home-in-positive', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'out', label: '홈 쇄도 실패', weight: 1 - RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'plate.complete', effects: [{ type: 'movePlayer', to: 'out' }, { type: 'record', message: '내야 땅볼 중 홈 쇄도 실패', showInCompletion: false }, { type: 'announce', title: '후속타자의 내야 땅볼 중 홈 쇄도 실패', detail: '송구를 받은 상대 1루수가 재빠르게 홈으로 송구합니다.\n추가진루를 시도하던 3루 주자도 홈에서 아웃되었습니다.', tone: 'negative', scene: 'home-advance-failure', detailScene: 'home-advance-failure', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'followUp.ground.fieldingError': {
    id: 'followUp.ground.fieldingError',
    type: 'event',
    view: 'runner:first',
    title: '내야수 포구 실책',
    effects: [{ type: 'applyHit', batterTo: 1, creditHit: false }, { type: 'record', message: '후속 타자 내야 땅볼 포구 실책' }, { type: 'announcePlayerAdvance', title: '상대 내야수가 땅볼 포구에 실패했습니다!', detail: '한 베이스 진루했습니다.', detailScene: 'ball-ground-infield', titleImageMode: 'same-as-detail-scene' }],
    transition: { to: 'runner.route' },
  },
  'followUp.ground.throwingError.check': {
    id: 'followUp.ground.throwingError.check',
    type: 'chance',
    view: 'batter',
    title: '후속 내야 땅볼 송구 판정',
    outcomes: [
      { id: 'throwSuccess', label: '송구 성공', weight: FOLLOW_UP_GROUND_THROW_SUCCESS_AFTER_FIELDING, transition: { to: 'followUp.ground.throw.success.route' } },
      { id: 'clearMiss', label: '명백히 1루수 뒤로 빠진 송구', weight: FOLLOW_UP_GROUND_THROWING_ERROR_AFTER_FIELDING * RUNNING_CHANCES.infieldGroundThrowingErrorClear, transition: { to: 'followUp.ground.throw.error.route', effects: [{ type: 'setFlag', key: 'groundThrowMiss', value: 'clear' }] } },
      { id: 'ambiguousMiss', label: '1루수 뒤로 애매하게 빠진 송구', weight: FOLLOW_UP_GROUND_THROWING_ERROR_AFTER_FIELDING * RUNNING_CHANCES.infieldGroundThrowingErrorAmbiguous, transition: { to: 'followUp.ground.throw.error.route', effects: [{ type: 'setFlag', key: 'groundThrowMiss', value: 'ambiguous' }] } },
    ],
  },
  'followUp.ground.throw.success.route': {
    id: 'followUp.ground.throw.success.route',
    type: 'router',
    view: 'result',
    title: '송구 성공 처리',
    routes: [
      { to: 'followUp.ground.throw.success.advance.route', when: [{ field: 'flag', operator: 'eq', key: 'groundAdvanceIntent', value: 'attempt' }], effects: [{ type: 'applyFollowUpGroundOut', announce: false }, { type: 'announce', title: '상대 내야수가 1루 송구에 성공했습니다!', detail: '타자 주자가 1루에서 아웃되었습니다.', detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' }] },
      { to: 'runner.route', when: [{ field: 'flag', operator: 'eq', key: 'groundAdvanceIntent', value: 'stay' }, { field: 'playerBase', operator: 'eq', value: 2 }], effects: [{ type: 'applyFollowUpGroundOut' }, { type: 'announce', title: '후속 타자 내야 땅볼 아웃', detail: '2루에 머물렀습니다.', advance: 'blocked', detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' }] },
      { to: 'runner.route', when: [{ field: 'flag', operator: 'eq', key: 'groundAdvanceIntent', value: 'stay' }, { field: 'playerBase', operator: 'eq', value: 3 }], effects: [{ type: 'applyFollowUpGroundOut' }, { type: 'announce', title: '후속타자의 내야 땅볼 아웃', detail: '3루에 머물렀습니다.', advance: 'blocked', detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' }] },
      { to: 'runner.route', effects: [{ type: 'applyFollowUpGroundOut' }] },
    ],
  },
  'followUp.ground.throw.success.advance.route': {
    id: 'followUp.ground.throw.success.advance.route',
    type: 'router',
    view: 'result',
    title: '송구 성공 후 진루 판정',
    routes: [
      { to: 'runner.second.groundOut.advance', when: [{ field: 'playerBase', operator: 'eq', value: 2 }] },
      { to: 'runner.third.groundOut.advance', when: [{ field: 'playerBase', operator: 'eq', value: 3 }] },
      { to: 'runner.route' },
    ],
  },
  'followUp.ground.throw.error.route': {
    id: 'followUp.ground.throw.error.route',
    type: 'router',
    view: 'result',
    title: '송구 실패 처리',
    routes: [
      { to: 'followUp.ground.throw.error.attempt.clear', when: [{ field: 'flag', operator: 'eq', key: 'groundAdvanceIntent', value: 'attempt' }, { field: 'flag', operator: 'eq', key: 'groundThrowMiss', value: 'clear' }] },
      { to: 'followUp.ground.throw.error.attempt.ambiguous', when: [{ field: 'flag', operator: 'eq', key: 'groundAdvanceIntent', value: 'attempt' }, { field: 'flag', operator: 'eq', key: 'groundThrowMiss', value: 'ambiguous' }] },
      { to: 'followUp.ground.throw.error.clear', when: [{ field: 'flag', operator: 'eq', key: 'groundThrowMiss', value: 'clear' }] },
      { to: 'followUp.ground.throw.error.ambiguous', when: [{ field: 'flag', operator: 'eq', key: 'groundThrowMiss', value: 'ambiguous' }] },
    ],
  },
  'followUp.ground.throw.error.clear': {
    id: 'followUp.ground.throw.error.clear', type: 'event', view: 'runner:first', title: '내야 땅볼 송구 실책',
    effects: [{ type: 'forceWalk' }, { type: 'record', message: '후속 타자 내야 땅볼 송구 실책' }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.followUpGroundThrowingErrorClear }],
    transition: { to: 'followUp.ground.throw.extra.clear.route' },
  },
  'followUp.ground.throw.error.ambiguous': {
    id: 'followUp.ground.throw.error.ambiguous', type: 'event', view: 'runner:first', title: '내야 땅볼 송구 실책',
    effects: [{ type: 'forceWalk' }, { type: 'record', message: '후속 타자 내야 땅볼 송구 실책' }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.followUpGroundThrowingErrorAmbiguous }],
    transition: { to: 'followUp.ground.throw.extra.ambiguous.route' },
  },
  'followUp.ground.throw.error.attempt.clear': {
    id: 'followUp.ground.throw.error.attempt.clear', type: 'event', view: 'runner:first', title: '내야 땅볼 송구 실책 추가 진루',
    effects: [{ type: 'forceWalk' }, { type: 'announce', ...ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvanceAttempt.clear }, { type: 'advancePlayer' }, { type: 'record', message: '후속 타자 내야 땅볼 송구 실책, 추가 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvance.clear }],
    transition: { to: 'followUp.ground.throw.extra.clear.route' },
  },
  'followUp.ground.throw.error.attempt.ambiguous': {
    id: 'followUp.ground.throw.error.attempt.ambiguous', type: 'event', view: 'runner:first', title: '내야 땅볼 송구 실책 추가 진루',
    effects: [{ type: 'forceWalk' }, { type: 'announce', ...ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvanceAttempt.ambiguous }, { type: 'advancePlayer' }, { type: 'record', message: '후속 타자 내야 땅볼 송구 실책, 추가 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvance.ambiguous }],
    transition: { to: 'followUp.ground.throw.extra.ambiguous.route' },
  },
  'followUp.ground.throw.extra.clear.route': {
    id: 'followUp.ground.throw.extra.clear.route', type: 'router', view: 'result', title: '송구 실책 추가 진루 확인',
    routes: [
      { to: 'plate.complete', when: [{ field: 'playerBase', operator: 'eq', value: null }] },
      { to: 'followUp.ground.throw.extra.clear.decide' },
    ],
  },
  'followUp.ground.throw.extra.ambiguous.route': {
    id: 'followUp.ground.throw.extra.ambiguous.route', type: 'router', view: 'result', title: '송구 실책 추가 진루 확인',
    routes: [
      { to: 'plate.complete', when: [{ field: 'playerBase', operator: 'eq', value: null }] },
      { to: 'followUp.ground.throw.extra.ambiguous.decide' },
    ],
  },
  'followUp.ground.throw.extra.clear.decide': {
    id: 'followUp.ground.throw.extra.clear.decide', type: 'choice', view: 'runner:first', title: '내야 땅볼 송구 실책', tags: ['surprise-event', 'player-position-view'],
    description: SCENARIO_TEXT.advanceQuestion,
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '송구 실책 후 추가 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '내야 땅볼 송구 실책 이후 진루하지 않았습니다.', detail: '현재 베이스에 머물렀습니다.', tone: 'neutral', advance: 'blocked', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceAttemptChoice, description: `명백하게 빠진 송구 · 성공률 ${Math.round(FOLLOW_UP_GROUND_THROW_CLEAR_EXTRA_ADVANCE * 100)}%`, transition: { to: 'followUp.ground.throw.extra.clear.advance' } },
    ],
  },
  'followUp.ground.throw.extra.clear.advance': {
    id: 'followUp.ground.throw.extra.clear.advance', type: 'chance', view: 'runner:first', title: '송구 실책 추가 진루', tags: ['player-position-view'],
    outcomes: [
      { id: 'success', label: '추가 진루 성공', weight: FOLLOW_UP_GROUND_THROW_CLEAR_EXTRA_ADVANCE, transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '송구 실책 후 추가 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvance.clear }] } },
      { id: 'out', label: '추가 진루 실패', weight: 1 - FOLLOW_UP_GROUND_THROW_CLEAR_EXTRA_ADVANCE, transition: { to: 'plate.complete', effects: [{ type: 'announcePlayerAdvanceFailure', title: '내야 땅볼 송구 실책 추가 진루 실패', detail: '상대 1루수의 빠른 넥스트 플레이로 {destination}에서 아웃되었습니다.', tone: 'negative', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }, { type: 'movePlayer', to: 'out' }, { type: 'record', message: '송구 실책 후 추가 진루 실패', showInCompletion: false }] } },
    ],
  },
  'followUp.ground.throw.extra.ambiguous.decide': {
    id: 'followUp.ground.throw.extra.ambiguous.decide', type: 'choice', view: 'runner:first', title: '내야 땅볼 송구 실책', tags: ['surprise-event', 'player-position-view'],
    description: SCENARIO_TEXT.advanceQuestion,
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '송구 실책 후 추가 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '내야 땅볼 송구 실책 이후 진루하지 않았습니다.', detail: '현재 베이스에 머물렀습니다.', tone: 'neutral', advance: 'blocked', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceAttemptChoice, description: `애매하게 빠진 송구 · 성공률 ${Math.round(FOLLOW_UP_GROUND_THROW_AMBIGUOUS_EXTRA_ADVANCE * 100)}%`, transition: { to: 'followUp.ground.throw.extra.ambiguous.advance' } },
    ],
  },
  'followUp.ground.throw.extra.ambiguous.advance': {
    id: 'followUp.ground.throw.extra.ambiguous.advance', type: 'chance', view: 'runner:first', title: '송구 실책 추가 진루', tags: ['player-position-view'],
    outcomes: [
      { id: 'success', label: '추가 진루 성공', weight: FOLLOW_UP_GROUND_THROW_AMBIGUOUS_EXTRA_ADVANCE, transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '송구 실책 후 추가 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvance.ambiguous }] } },
      { id: 'out', label: '추가 진루 실패', weight: 1 - FOLLOW_UP_GROUND_THROW_AMBIGUOUS_EXTRA_ADVANCE, transition: { to: 'plate.complete', effects: [{ type: 'announcePlayerAdvanceFailure', title: '내야 땅볼 송구 실책 추가 진루 실패', detail: '상대 1루수의 빠른 넥스트 플레이로 {destination}에서 아웃되었습니다.', tone: 'negative', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }, { type: 'movePlayer', to: 'out' }, { type: 'record', message: '송구 실책 후 추가 진루 실패', showInCompletion: false }] } },
    ],
  },
  'followUp.ground.throwingError.route': {
    id: 'followUp.ground.throwingError.route',
    type: 'router',
    view: 'result',
    title: '송구 실책 주루 확인',
    routes: [
      { to: 'plate.complete', when: [{ field: 'playerBase', operator: 'eq', value: null }] },
      { to: 'followUp.ground.throwingError.clear.decide', when: [{ field: 'flag', operator: 'eq', key: 'groundThrowMiss', value: 'clear' }] },
      { to: 'followUp.ground.throwingError.ambiguous.decide', when: [{ field: 'flag', operator: 'eq', key: 'groundThrowMiss', value: 'ambiguous' }] },
    ],
  },
  'followUp.ground.throwingError.clear.decide': {
    id: 'followUp.ground.throwingError.clear.decide',
    type: 'choice',
    view: 'runner:first',
    title: '내야 땅볼 송구 실책',
    tags: ['surprise-event', 'player-position-view'],
    description: '주루 방침을 선택하세요.',
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '송구 실책, 추가 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '내야 땅볼 송구 실책이 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceChoice, description: '1루수 뒤로 완전히 빠진 송구 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '송구 실책 이용, 추가 진루', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.groundThrowingErrorAdvance.clear }] } },
    ],
  },
  'followUp.ground.throwingError.ambiguous.decide': {
    id: 'followUp.ground.throwingError.ambiguous.decide',
    type: 'choice',
    view: 'runner:first',
    title: '내야 땅볼 송구 실책',
    tags: ['surprise-event', 'player-position-view'],
    description: '주루 방침을 선택하세요.',
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '송구 실책, 추가 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '내야 땅볼 송구 실책이 나왔지만 진루하지 않았습니다.', detail: '위험하다고 판단하여 진루하지 않았습니다.', tone: 'neutral', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceChoice, description: `애매한 송구 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousDrop * 100)}%`, transition: { to: 'followUp.ground.throwingError.ambiguous.advance' } },
    ],
  },
  'followUp.ground.throwingError.ambiguous.advance': {
    id: 'followUp.ground.throwingError.ambiguous.advance',
    type: 'chance',
    view: 'runner:first',
    title: '추가 진루',
    tags: ['player-position-view'],
    outcomes: [
      { id: 'success', label: '추가 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '송구 실책 이용, 추가 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.groundThrowingErrorAdvance.ambiguous }] } },
      { id: 'out', label: '추가 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'plate.complete', effects: [{ type: 'announcePlayerAdvanceFailure', title: '내야 땅볼 송구 실책 추가 진루 실패', detail: '상대 1루수의 빠른 넥스트 플레이로 {destination}에서 아웃되었습니다.', tone: 'negative', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' }, { type: 'movePlayer', to: 'out' }, { type: 'record', message: '송구 실책 이용, 추가 진루 실패', showInCompletion: false }] } },
    ],
  },
  'followUp.batting.apply': {
    id: 'followUp.batting.apply',
    type: 'event',
    view: 'result',
    title: '후속 타격 적용',
    effects: [{ type: 'applyBattingEvent' }],
    transition: { to: 'followUp.batting.route' },
  },
  'followUp.batting.route': {
    id: 'followUp.batting.route',
    type: 'router',
    view: 'result',
    title: '후속 타격 주루 확인',
    routes: [
      { to: 'runner.battingAdvance.outfield.check', when: [{ field: 'flag', operator: 'eq', key: 'advancedByFollowUpHit', value: true }] },
      { to: 'runner.route' },
    ],
  },
  'runner.battingAdvance.outfield.check': {
    id: 'runner.battingAdvance.outfield.check',
    type: 'chance',
    view: 'runner:first',
    title: '외야 수비 판정',
    tags: ['player-position-view'],
    outcomes: [
      { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear, transition: { to: 'runner.battingAdvance.clearDrop.decide', effects: [{ type: 'record', message: '외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announceFollowUpOutfieldError', clear: true }] } },
      { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'runner.battingAdvance.ambiguousDrop.decide', effects: [{ type: 'record', message: '외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announceFollowUpOutfieldError', clear: false }] } },
      { id: 'normalFielding', label: '정상 수비', weight: 1 - RUNNING_CHANCES.outfieldDropClear - RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'runner.route' } },
    ],
  },
  'runner.battingAdvance.clearDrop.decide': {
    id: 'runner.battingAdvance.clearDrop.decide',
    type: 'choice',
    view: 'runner:first',
    title: '외야수 실책',
    tags: ['surprise-event', 'player-position-view'],
    description: '주루 방침을 선택하세요.',
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책, 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '후속 타자 타구 외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative', scene: 'error-outfield-through-clear' }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceChoice, description: '완전히 뒤로 빠진 타구 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '외야 실책 이용, 추가 진루', showInCompletion: false }, { type: 'announcePlayerAdvance', title: '외야수 실책 추가 진루 성공!', detail: '외야수 실책을 이용해 {destination}에 안전하게 도착했습니다.', category: 'normal', advance: 'normal', detailScene: 'advance-clear', titleImageMode: 'same-as-detail-scene' }] } },
    ],
  },
  'runner.battingAdvance.ambiguousDrop.decide': {
    id: 'runner.battingAdvance.ambiguousDrop.decide',
    type: 'choice',
    view: 'runner:first',
    title: '외야수 실책',
    tags: ['surprise-event', 'player-position-view'],
    description: '주루 방침을 선택하세요.',
    choices: [
      { id: 'stayOnBase', label: '안전하게 현재 베이스에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책, 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '후속 타자 타구 외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '위험하다고 판단하여 진루하지 않았습니다.', tone: 'neutral', scene: 'error-outfield-through-ambiguous' }] } },
      { id: 'advance', label: SCENARIO_TEXT.advanceChoice, description: `애매한 타구 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousDrop * 100)}%`, transition: { to: 'runner.battingAdvance.ambiguousDrop.advance' } },
    ],
  },
  'runner.battingAdvance.ambiguousDrop.advance': {
    id: 'runner.battingAdvance.ambiguousDrop.advance',
    type: 'chance',
    view: 'runner:first',
    title: '추가 진루',
    tags: ['player-position-view'],
    outcomes: [
      { id: 'success', label: '추가 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'runner.route', effects: [{ type: 'advancePlayer' }, { type: 'record', message: '외야 실책 이용, 추가 진루 성공', showInCompletion: false }, { type: 'announcePlayerAdvance', title: '외야수 실책 추가 진루 성공!', detail: '위험을 감수하고 {destination} 추가 진루에 성공했습니다.', advance: 'bold', detailScene: 'advance-ambiguous-safe', titleImageMode: 'same-as-detail-scene' }] } },
      { id: 'out', label: '추가 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'plate.complete', effects: [{ type: 'announcePlayerAdvanceFailure', title: '후속 타자 타구 외야수 실책 추가 진루 실패', detail: '상대 외야수의 정확한 송구로 {destination}에서 아웃되었습니다.', tone: 'negative', detailScene: 'advance-ambiguous-out', titleImageMode: 'same-as-detail-scene' }, { type: 'movePlayer', to: 'out' }, { type: 'record', message: '외야 실책 이용, 추가 진루 실패', showInCompletion: false }] } },
    ],
  },
  'plate.complete': {
    id: 'plate.complete',
    type: 'terminal',
    view: 'result',
    title: '플레이 완료',
    result: 'plateComplete',
  },
}
