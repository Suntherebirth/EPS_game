import { ANNOUNCEMENTS } from '../announcementMessages'
import { BATTING_EVENTS } from '../battingEvents'
import { RUNNING_CHANCES } from '../probabilities'
import { SCENARIO_TEXT } from '../scenarioText'
import type { ScenarioEffect, ScenarioPack } from '../scenario'
import { validateScenarioPack } from '../scenario'
import { EMPTY_BASES_SINGLE_NODES } from './emptyBasesSingleNodes'

const GROUND_THROWING_ERROR_AFTER_FIELDING = RUNNING_CHANCES.infieldGroundThrowingError / (1 - RUNNING_CHANCES.infieldGroundFieldingError)
const GROUND_THROW_SUCCESS_AFTER_FIELDING = 1 - GROUND_THROWING_ERROR_AFTER_FIELDING

const completeEvent = (id: string, text: { title: string }, effects: ScenarioEffect[]) => ({
  id,
  type: 'event' as const,
  view: 'result' as const,
  title: text.title,
  effects: [...effects, { type: 'record' as const, message: text.title.replace('!', '') }, { type: 'announce' as const, title: text.title, detail: ANNOUNCEMENTS.playComplete }],
  transition: { to: 'plate.complete' },
})

export const OFFENSE_CORE_PACK: ScenarioPack = {
  id: 'offense.core',
  version: 1,
  entryNodeId: 'batting.select',
  nodes: {
    'batting.select': {
      id: 'batting.select',
      type: 'batting',
      view: 'batter',
      title: '타격 결과 선택',
      mode: 'direct',
      eventIds: BATTING_EVENTS.map((event) => event.kind),
      routes: [
        { to: 'hit.single.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'single' }, { field: 'bases', operator: 'empty' }] },
        { to: 'hit.single.firstThird', when: [{ field: 'battingEvent', operator: 'eq', value: 'single' }, { field: 'bases', operator: 'equals', value: [2, 3] }] },
        { to: 'hit.single.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'single' }] },
        { to: 'hit.double.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'double' }] },
        { to: 'hit.triple.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'triple' }] },
        { to: 'hit.homeRun.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'homeRun' }] },
        { to: 'hit.infield.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'infieldHit' }] },
        { to: 'error.infield.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'infieldError' }] },
        { to: 'walk.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'walk' }] },
        { to: 'hitByPitch.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'hitByPitch' }] },
        { to: 'strikeout.catcher.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'strikeout' }, { field: 'outs', operator: 'lt', value: 2 }, { field: 'bases', operator: 'excludes', value: [1] }] },
        { to: 'strikeout.catcher.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'strikeout' }, { field: 'outs', operator: 'eq', value: 2 }] },
        { to: 'out.strikeout.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'strikeout' }] },
        { to: 'ground.infield.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'groundOut' }], effects: [{ type: 'announce', title: '내야 땅볼 발생!', detail: '내야수가 타구를 처리하러 이동합니다.', detailScene: 'ball-ground-infield-fielder-moving' }] },
        { to: 'infieldFly.rule.out', when: [{ field: 'battingEvent', operator: 'eq', value: 'infieldFly' }, { field: 'outs', operator: 'lt', value: 2 }, { field: 'bases', operator: 'includes', value: [1, 2] }] },
        { to: 'fly.infield.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'infieldFly' }], effects: [{ type: 'announce', title: '내야 뜬공 발생!', detail: '내야수가 타구를 처리하러 이동합니다.' }] },
        { to: 'fly.outfield.route', when: [{ field: 'battingEvent', operator: 'eq', value: 'flyOut' }], effects: [{ type: 'announce', title: '외야 뜬공 발생!', detail: '외야수가 타구를 처리하러 이동합니다.', detailScene: 'ball-fly-outfield-fielder-moving' }] },
      ],
    },
    ...EMPTY_BASES_SINGLE_NODES,
    'hit.single.firstThird': {
      id: 'hit.single.firstThird', type: 'event', view: 'runner:first', title: '1루타',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: true }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '1루타' }, { type: 'record', message: '3루 주자 득점', showInCompletion: false }, { type: 'announce', title: '1루타 성공!', detail: '1루에 안전하게 도착했습니다.', advance: 'normal' }],
      transition: { to: 'single.outfield.check' },
    },
    'hit.single.generic': {
      id: 'hit.single.generic', type: 'event', view: 'runner:first', title: '1루타',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: true }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '1루타' }, { type: 'announce', title: '1루타 성공!', detail: '1루에 안전하게 도착했습니다.', advance: 'normal' }],
      transition: { to: 'single.outfield.check' },
    },
    'hit.double.resolve': {
      id: 'hit.double.resolve', type: 'event', view: 'runner:second', title: '2루타',
      effects: [{ type: 'applyHit', batterTo: 2, creditHit: true }, { type: 'setPlayerBase', value: 2 }, { type: 'record', message: '2루타' }, { type: 'announce', ...SCENARIO_TEXT.batting.double, advance: 'normal' }],
      transition: { to: 'runner.route' },
    },
    'hit.triple.resolve': {
      id: 'hit.triple.resolve', type: 'event', view: 'runner:third', title: '3루타',
      effects: [{ type: 'applyHit', batterTo: 3, creditHit: true }, { type: 'setPlayerBase', value: 3 }, { type: 'record', message: '3루타' }, { type: 'announce', ...SCENARIO_TEXT.batting.triple, advance: 'normal' }],
      transition: { to: 'runner.route' },
    },
    'hit.homeRun.resolve': {
      id: 'hit.homeRun.resolve', type: 'event', view: 'batter', title: '홈런',
      effects: [{ type: 'scoreAll', creditHit: true }, { type: 'record', message: '홈런' }, { type: 'announce', ...SCENARIO_TEXT.batting.homeRun, tone: 'positive' }],
      transition: { to: 'plate.complete' },
    },
    'walk.resolve': {
      id: 'walk.resolve', type: 'event', view: 'runner:first', title: '볼넷',
      effects: [{ type: 'forceWalk' }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '볼넷' }, { type: 'announce', ...SCENARIO_TEXT.batting.walk, advance: 'safe' }],
      transition: { to: 'runner.route' },
    },
    'hitByPitch.resolve': {
      id: 'hitByPitch.resolve', type: 'event', view: 'runner:first', title: '사구',
      effects: [{ type: 'forceWalk' }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '사구' }, { type: 'announce', ...SCENARIO_TEXT.batting.hitByPitch, advance: 'safe' }],
      transition: { to: 'runner.route' },
    },
    'strikeout.catcher.check': {
      id: 'strikeout.catcher.check', type: 'chance', view: 'batter', title: '포수 포구 판정',
      outcomes: [
        { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.droppedThirdStrikeClear, transition: { to: 'strikeout.clearDrop.decide', effects: [{ type: 'record', message: '낫아웃, 포수가 공을 완전히 빠뜨림', showInCompletion: false }, { type: 'announce', ...SCENARIO_TEXT.defense.droppedThirdStrikeClear, tone: 'positive', scene: 'dropped-third-strike-clear' }] } },
        { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.droppedThirdStrikeAmbiguous, transition: { to: 'strikeout.ambiguousDrop.decide', effects: [{ type: 'record', message: '낫아웃, 포수가 공을 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', ...SCENARIO_TEXT.defense.droppedThirdStrikeAmbiguous, scene: 'dropped-third-strike-ambiguous' }] } },
        { id: 'caught', label: '포수 정상 포구', weight: 1 - RUNNING_CHANCES.droppedThirdStrikeClear - RUNNING_CHANCES.droppedThirdStrikeAmbiguous, transition: { to: 'out.strikeout.generic' } },
      ],
    },
    'strikeout.clearDrop.decide': {
      id: 'strikeout.clearDrop.decide', type: 'choice', view: 'batter', title: '낫아웃', tags: ['surprise-event'],
      description: '타자 주자: 1루까지 전력 질주할까요?',
      choices: [
        { id: 'runHard', label: '열심히 뛴다', description: '1루 진루 · 성공률 100%', transition: { to: 'strikeout.reachFirst', effects: [{ type: 'setFlag', key: 'droppedStrikeRun', value: 'hard' }] } },
        { id: 'runSlow', label: '천천히 뛴다', description: `1루 진루 · 성공률 ${Math.round(RUNNING_CHANCES.runSlowOnClearDroppedStrike * 100)}%`, transition: { to: 'strikeout.clearDrop.slowRun' } },
      ],
    },
    'strikeout.clearDrop.slowRun': {
      id: 'strikeout.clearDrop.slowRun', type: 'chance', view: 'batter', title: '1루 승부',
      outcomes: [
        { id: 'safe', label: '1루 진루 성공', weight: RUNNING_CHANCES.runSlowOnClearDroppedStrike, transition: { to: 'strikeout.reachFirst', effects: [{ type: 'setFlag', key: 'droppedStrikeRun', value: 'slow' }] } },
        { id: 'out', label: '1루 진루 실패', weight: 1 - RUNNING_CHANCES.runSlowOnClearDroppedStrike, transition: { to: 'out.strikeout.generic' } },
      ],
    },
    'strikeout.ambiguousDrop.decide': {
      id: 'strikeout.ambiguousDrop.decide', type: 'choice', view: 'batter', title: '낫아웃', tags: ['surprise-event'],
      description: '타자 주자: 1루까지 전력 질주할까요?',
      choices: [
        { id: 'runHard', label: '열심히 뛴다', description: `1루 진루 · 성공률 ${Math.round(RUNNING_CHANCES.runHardOnAmbiguousDroppedStrike * 100)}%`, transition: { to: 'strikeout.ambiguousDrop.hardRun' } },
        { id: 'runSlow', label: '천천히 뛴다', description: `1루 진루 · 성공률 ${Math.round(RUNNING_CHANCES.runSlowOnAmbiguousDroppedStrike * 100)}%`, transition: { to: 'strikeout.ambiguousDrop.slowRun' } },
      ],
    },
    'strikeout.ambiguousDrop.hardRun': {
      id: 'strikeout.ambiguousDrop.hardRun', type: 'chance', view: 'batter', title: '1루 승부',
      outcomes: [
        { id: 'safe', label: '1루 진루 성공', weight: RUNNING_CHANCES.runHardOnAmbiguousDroppedStrike, transition: { to: 'strikeout.reachFirst', effects: [{ type: 'setFlag', key: 'droppedStrikeRun', value: 'hard' }] } },
        { id: 'out', label: '1루 진루 실패', weight: 1 - RUNNING_CHANCES.runHardOnAmbiguousDroppedStrike, transition: { to: 'out.strikeout.generic' } },
      ],
    },
    'strikeout.ambiguousDrop.slowRun': {
      id: 'strikeout.ambiguousDrop.slowRun', type: 'chance', view: 'batter', title: '1루 승부',
      outcomes: [
        { id: 'safe', label: '1루 진루 성공', weight: RUNNING_CHANCES.runSlowOnAmbiguousDroppedStrike, transition: { to: 'strikeout.reachFirst', effects: [{ type: 'setFlag', key: 'droppedStrikeRun', value: 'slow' }] } },
        { id: 'out', label: '1루 진루 실패', weight: 1 - RUNNING_CHANCES.runSlowOnAmbiguousDroppedStrike, transition: { to: 'out.strikeout.generic' } },
      ],
    },
    'strikeout.reachFirst': {
      id: 'strikeout.reachFirst', type: 'event', view: 'batter', title: '낫아웃 1루 진루',
      effects: [{ type: 'forceWalk' }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '낫아웃 1루 진루' }, { type: 'announce', title: '낫아웃 1루 진루 성공!', detail: '열심히 뛴 결과, 상대 포수의 송구보다 먼저 1루에 도착했습니다.', advance: 'normal' }],
      transition: { to: 'runner.route' },
    },
    'ground.infield.check': {
      id: 'ground.infield.check', type: 'chance', view: 'batter', title: '내야 땅볼 수비 판정', tags: ['composite-event-step'],
      outcomes: [
        { id: 'fieldingError', label: '내야수 포구 실책', weight: RUNNING_CHANCES.infieldGroundFieldingError, transition: { to: 'ground.infield.fieldingError' } },
        { id: 'cleanPlay', label: '내야수 포구 성공', weight: 1 - RUNNING_CHANCES.infieldGroundFieldingError, transition: { to: 'ground.infield.throwingError.check', effects: [{ type: 'announce', ...ANNOUNCEMENTS.groundFieldingSuccess }] } },
      ],
    },
    'ground.infield.clean.route': {
      id: 'ground.infield.clean.route', type: 'router', view: 'batter', title: '내야 땅볼 정상 수비 처리',
      routes: [
        { to: 'ground.infield.runnerThird.advance.check', when: [{ field: 'bases', operator: 'includes', value: [3] }, { field: 'bases', operator: 'excludes', value: [1] }, { field: 'outs', operator: 'lt', value: 2 }] },
        { to: 'out.ground.generic', when: [{ field: 'bases', operator: 'empty' }] },
        { to: 'ground.infield.doublePlay.check', when: [{ field: 'bases', operator: 'includes', value: [1] }, { field: 'outs', operator: 'lt', value: 2 }] },
        { to: 'ground.infield.forceOut', when: [{ field: 'bases', operator: 'includes', value: [1] }], effects: [{ type: 'applyGroundForceOut' }] },
        { to: 'ground.infield.force.check' },
      ],
    },
    'ground.infield.runnerThird.advance.check': {
      id: 'ground.infield.runnerThird.advance.check', type: 'chance', view: 'batter', title: '3루 주자 홈 쇄도 판정',
      outcomes: [
        { id: 'advanceHome', label: '3루 주자 홈 쇄도', weight: RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'plate.complete', effects: [{ type: 'addOuts', value: 1 }, { type: 'moveRunner', from: 3, to: 'home' }, { type: 'record', message: '내야 땅볼 타자 아웃, 3루 주자 홈 쇄도 득점' }, { type: 'announce', ...SCENARIO_TEXT.running.battedBallHomeAdvance, advance: 'bold' }] } },
        { id: 'stayThird', label: '3루 주자 잔류', weight: 1 - RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'out.ground.generic' } },
      ],
    },
    'ground.infield.doublePlay.check': {
      id: 'ground.infield.doublePlay.check', type: 'chance', view: 'batter', title: '내야 땅볼 병살 판정',
      outcomes: [
        { id: 'doublePlay', label: '병살', weight: RUNNING_CHANCES.infieldGroundDoublePlay, transition: { to: 'ground.infield.doublePlay', effects: [{ type: 'applyGroundDoublePlay' }] } },
        { id: 'forceOut', label: '선행 주자만 아웃', weight: RUNNING_CHANCES.infieldGroundForceOut, transition: { to: 'ground.infield.forceOut.runnerThird.check', effects: [{ type: 'applyGroundForceOut' }] } },
      ],
    },
    'ground.infield.doublePlay': {
      id: 'ground.infield.doublePlay', type: 'event', view: 'result', title: '내야 땅볼 병살',
      effects: [],
      transition: { to: 'plate.complete' },
    },
    'ground.infield.force.check': {
      id: 'ground.infield.force.check', type: 'chance', view: 'batter', title: '내야 땅볼 선행 주자 아웃 판정',
      outcomes: [
        { id: 'batterOut', label: '타자 주자 아웃', weight: RUNNING_CHANCES.infieldGroundBatterOut, transition: { to: 'out.ground.generic' } },
        { id: 'leadRunnerOut', label: '선행 주자 아웃', weight: RUNNING_CHANCES.infieldGroundLeadRunnerOut, transition: { to: 'ground.infield.forceOut', effects: [{ type: 'applyGroundForceOut' }] } },
      ],
    },
    'ground.infield.forceOut': {
      id: 'ground.infield.forceOut', type: 'event', view: 'runner:first', title: '내야 땅볼 선행 주자 아웃',
      effects: [],
      transition: { to: 'runner.route' },
    },
    'ground.infield.forceOut.runnerThird.check': {
      id: 'ground.infield.forceOut.runnerThird.check', type: 'router', view: 'result', title: '선행 주자 아웃 후 3루 주자 확인',
      routes: [
        { to: 'ground.infield.forceOut.runnerThird.advance.check', when: [{ field: 'bases', operator: 'includes', value: [3] }] },
        { to: 'runner.route' },
      ],
    },
    'ground.infield.forceOut.runnerThird.advance.check': {
      id: 'ground.infield.forceOut.runnerThird.advance.check', type: 'chance', view: 'batter', title: '3루 주자 홈 쇄도 판정',
      outcomes: [
        { id: 'advanceHome', label: '3루 주자 홈 쇄도', weight: RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'runner.route', effects: [{ type: 'moveRunner', from: 3, to: 'home' }, { type: 'record', message: '내야 땅볼 선행 주자 아웃, 3루 주자 홈 쇄도 득점' }, { type: 'announce', ...SCENARIO_TEXT.running.leadRunnerHomeAdvance, advance: 'bold' }] } },
        { id: 'stayThird', label: '3루 주자 잔류', weight: 1 - RUNNING_CHANCES.advanceOnGroundBallToThird, transition: { to: 'runner.route' } },
      ],
    },
    'ground.infield.fieldingError': {
      id: 'ground.infield.fieldingError', type: 'event', view: 'runner:first', title: '내야수 포구 실책',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: false }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '내야 땅볼 포구 실책' }, { type: 'announce', ...ANNOUNCEMENTS.infieldFieldingError }],
      transition: { to: 'runner.route' },
    },
    'ground.infield.throwingError.check': {
      id: 'ground.infield.throwingError.check', type: 'chance', view: 'batter', title: '내야 땅볼 1루 송구 판정', tags: ['composite-event-step'],
      outcomes: [
        { id: 'throwSuccess', label: '송구 성공', weight: GROUND_THROW_SUCCESS_AFTER_FIELDING, transition: { to: 'ground.infield.clean.route', effects: [{ type: 'announce', ...ANNOUNCEMENTS.groundThrowSuccess }] } },
        { id: 'clearMiss', label: '명백히 1루수 뒤로 빠진 송구', weight: GROUND_THROWING_ERROR_AFTER_FIELDING * RUNNING_CHANCES.infieldGroundThrowingErrorClear, transition: { to: 'followUp.ground.throwingError.route', effects: [{ type: 'applyHit', batterTo: 1, creditHit: false }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '내야 땅볼 송구 실책' }, { type: 'setFlag', key: 'groundThrowMiss', value: 'clear' }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.groundThrowingErrorClear }] } },
        { id: 'ambiguousMiss', label: '1루수 뒤로 애매하게 빠진 송구', weight: GROUND_THROWING_ERROR_AFTER_FIELDING * RUNNING_CHANCES.infieldGroundThrowingErrorAmbiguous, transition: { to: 'followUp.ground.throwingError.route', effects: [{ type: 'applyHit', batterTo: 1, creditHit: false }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '내야 땅볼 송구 실책' }, { type: 'setFlag', key: 'groundThrowMiss', value: 'ambiguous' }, { type: 'announcePlayerAdvance', ...ANNOUNCEMENTS.groundThrowingErrorAmbiguous }] } },
      ],
    },
    'fly.outfield.route': {
      id: 'fly.outfield.route', type: 'router', view: 'batter', title: '외야 뜬공 주자 확인',
      routes: [
        { to: 'fly.outfield.runnerThird.check', when: [{ field: 'bases', operator: 'includes', value: [3] }, { field: 'outs', operator: 'lt', value: 2 }] },
        { to: 'fly.outfield.runnerSecond.check', when: [{ field: 'bases', operator: 'includes', value: [2] }, { field: 'bases', operator: 'excludes', value: [1] }] },
        { to: 'fly.outfield.check' },
      ],
    },
    'fly.outfield.check': {
      id: 'fly.outfield.check', type: 'chance', view: 'batter', title: '외야수 포구 판정', tags: ['composite-event-step'],
      outcomes: [
        { id: 'fieldingFailed', label: '외야수 처리 실패', weight: RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'fly.outfield.drop' } },
        { id: 'caught', label: SCENARIO_TEXT.defense.flyOutChoice, weight: 1 - RUNNING_CHANCES.outfieldDropClear - RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'out.fly.generic' } },
      ],
    },
    'fly.outfield.failure.check': {
      id: 'fly.outfield.failure.check', type: 'chance', view: 'batter', title: '외야수 처리 실패', tags: ['composite-event-step'],
      outcomes: [
        { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.first.clearDrop.decide', effects: [{ type: 'record', message: '외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.outfieldError(true) }] } },
        { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.first.ambiguousDrop.decide', effects: [{ type: 'record', message: '외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', ...ANNOUNCEMENTS.outfieldError(false) }] } },
      ],
    },
    'fly.outfield.runnerSecond.check': {
      id: 'fly.outfield.runnerSecond.check', type: 'chance', view: 'runner:second', title: '외야수 포구 판정', tags: ['composite-event-step'],
      outcomes: [
        { id: 'fieldingFailed', label: '외야수 처리 실패', weight: RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'fly.outfield.runnerSecond.failure.check', effects: [{ type: 'applyOutfieldDropWithSecondRunner' }, { type: 'record', message: '외야 뜬공, 외야수 포구 실책', showInCompletion: false }, { type: 'announce', title: '상대 외야수가 뜬공 포구에 실패했습니다!', detail: '실책으로 타자 주자가 1루에 진출합니다.' }] } },
        { id: 'caught', label: SCENARIO_TEXT.defense.flyOutChoice, weight: 1 - RUNNING_CHANCES.outfieldDropClear - RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'out.fly.generic' } },
      ],
    },
    'fly.outfield.runnerSecond.failure.check': {
      id: 'fly.outfield.runnerSecond.failure.check', type: 'chance', view: 'runner:second', title: '외야수 처리 실패', tags: ['surprise-event', 'composite-event-step'],
      outcomes: [
        { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropClear / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.second.outfieldError.clear.decide', effects: [{ type: 'record', message: '외야 뜬공, 외야수 공 완전 빠뜨림', showInCompletion: false }, { type: 'announce', title: '상대 외야수가 타구를 완전히 뒤로 빠뜨렸습니다!', detail: '확실하게 진루할 수 있습니다.', tone: 'positive', scene: 'error-outfield-through-clear' }] } },
        { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.outfieldDropAmbiguous / (RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous), transition: { to: 'runner.second.outfieldError.ambiguous.decide', effects: [{ type: 'record', message: '외야 뜬공, 외야수 공 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', title: '상대 외야수가 타구를 애매하게 뒤로 빠뜨렸습니다!', detail: '진루를 시도하다가 아웃될 수도 있습니다.', tone: 'caution', scene: 'error-outfield-through-ambiguous' }] } },
      ],
    },
    'runner.second.outfieldError.clear.decide': {
      id: 'runner.second.outfieldError.clear.decide', type: 'choice', view: 'runner:second', title: '외야수 실책', tags: ['surprise-event'],
      description: '2루 주자: 주루 방침을 선택하세요.',
      choices: [
        { id: 'staySecond', label: '안전하게 2루에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책, 2루 주자 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '2루에 머물렀습니다.', tone: 'negative', advance: 'blocked', scene: 'error-outfield-through-clear' }] } },
        { id: 'advanceThird', label: '3루로 진루한다', description: '완전히 뒤로 빠진 타구 · 성공률 100%', transition: { to: 'runner.route', effects: [{ type: 'advanceRunner', from: 2, to: 3 }, { type: 'record', message: '외야 실책 이용, 3루 진루', showInCompletion: false }, { type: 'announce', title: '3루 진루 성공!', detail: '외야수 실책을 이용해 3루에 안전하게 도착했습니다.', category: 'normal', advance: 'normal', detailScene: 'advance-clear', titleImageMode: 'same-as-detail-scene' }] } },
      ],
    },
    'runner.second.outfieldError.ambiguous.decide': {
      id: 'runner.second.outfieldError.ambiguous.decide', type: 'choice', view: 'runner:second', title: '외야수 실책', tags: ['surprise-event'],
      description: '2루 주자: 주루 방침을 선택하세요.',
      choices: [
        { id: 'staySecond', label: '안전하게 2루에 머문다', transition: { to: 'runner.route', effects: [{ type: 'record', message: '외야수 실책, 2루 주자 진루하지 않음', showInCompletion: false }, { type: 'announce', title: '외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '위험하다고 판단하여 2루에 머물렀습니다.', tone: 'neutral', advance: 'blocked', scene: 'error-outfield-through-ambiguous' }] } },
        { id: 'advanceThird', label: '3루로 진루를 시도한다', description: `애매한 타구 · 성공률 ${Math.round(RUNNING_CHANCES.advanceOnAmbiguousDrop * 100)}%`, transition: { to: 'runner.second.outfieldError.ambiguous.advance' } },
      ],
    },
    'runner.second.outfieldError.ambiguous.advance': {
      id: 'runner.second.outfieldError.ambiguous.advance', type: 'chance', view: 'runner:second', title: '3루 진루',
      outcomes: [
        { id: 'success', label: '3루 진루 성공', weight: RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'runner.route', effects: [{ type: 'advanceRunner', from: 2, to: 3 }, { type: 'record', message: '외야 실책 이용, 3루 진루 성공', showInCompletion: false }, { type: 'announce', title: '3루 진루 성공!', detail: '상대 외야수 실책을 틈타 위험을 감수하고 3루에 도착했습니다.', advance: 'bold', detailScene: 'advance-ambiguous-safe', titleImageMode: 'same-as-detail-scene' }] } },
        { id: 'out', label: '3루 진루 실패', weight: 1 - RUNNING_CHANCES.advanceOnAmbiguousDrop, transition: { to: 'plate.complete', effects: [{ type: 'moveRunner', from: 2, to: 'out' }, { type: 'record', message: '외야 실책 이용, 3루 진루 실패', showInCompletion: false }, { type: 'announce', ...SCENARIO_TEXT.running.thirdBaseFailure, tone: 'negative', detailScene: 'advance-ambiguous-out', titleImageMode: 'same-as-detail-scene' }] } },
      ],
    },
    'fly.outfield.drop': {
      id: 'fly.outfield.drop', type: 'event', view: 'runner:first', title: '외야수 포구 실책',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: true }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '외야수 포구 실책 1루타' }, { type: 'announce', title: '상대 외야수가 뜬공 포구에 실패했습니다!', detail: '실책으로 타자 주자가 1루에 진출합니다.' }],
      transition: { to: 'fly.outfield.failure.check' },
    },
    'fly.infield.check': {
      id: 'fly.infield.check', type: 'chance', view: 'batter', title: '내야수 포구 판정', tags: ['composite-event-step'],
      outcomes: [
        { id: 'fieldingFailed', label: '내야수 처리 실패', weight: RUNNING_CHANCES.outfieldDropClear + RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'fly.infield.drop', effects: [{ type: 'record', message: '내야 뜬공, 내야수 포구 실책', showInCompletion: false }] } },
        { id: 'caught', label: SCENARIO_TEXT.defense.flyOutChoice, weight: 1 - RUNNING_CHANCES.outfieldDropClear - RUNNING_CHANCES.outfieldDropAmbiguous, transition: { to: 'out.infieldFly.generic' } },
      ],
    },
    'fly.infield.drop': {
      id: 'fly.infield.drop', type: 'event', view: 'runner:first', title: '내야수 포구 실책',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: true }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '내야수 포구 실책 1루타' }, { type: 'announce', title: '상대 내야수가 뜬공 포구에 실패했습니다!', detail: '실책으로 타자 주자가 1루에 진출합니다.' }],
      transition: { to: 'runner.route' },
    },
    'infieldFly.rule.out': {
      id: 'infieldFly.rule.out', type: 'event', view: 'batter', title: '인필드 플라이',
      effects: [{ type: 'addOuts', value: 1 }, { type: 'record', message: '인필드 플라이 아웃' }, { type: 'announce', ...SCENARIO_TEXT.defense.infieldFlyRule }],
      transition: { to: 'plate.complete' },
    },
    'hit.infield.generic': completeEvent('hit.infield.generic', { title: '내야안타!' }, [{ type: 'applyHit', batterTo: 1, creditHit: true }]),
    'error.infield.generic': completeEvent('error.infield.generic', { title: '내야수 땅볼 실책!' }, [{ type: 'applyHit', batterTo: 1, creditHit: false }]),
    'out.strikeout.generic': {
      id: 'out.strikeout.generic', type: 'event', view: 'result', title: '삼진',
      effects: [{ type: 'addOuts', value: 1 }, { type: 'record', message: '삼진' }, { type: 'announce', ...SCENARIO_TEXT.defense.strikeout, tone: 'negative' }],
      transition: { to: 'plate.complete' },
    },
    'out.ground.generic': completeEvent('out.ground.generic', SCENARIO_TEXT.defense.groundOut, [{ type: 'addOuts', value: 1 }]),
    'out.infieldFly.generic': completeEvent('out.infieldFly.generic', SCENARIO_TEXT.defense.infieldFlyOut, [{ type: 'addOuts', value: 1 }]),
    'out.fly.generic': completeEvent('out.fly.generic', SCENARIO_TEXT.defense.flyOut, [{ type: 'addOuts', value: 1 }]),
  },
}

const validationErrors = validateScenarioPack(OFFENSE_CORE_PACK)
if (validationErrors.length > 0) throw new Error(validationErrors.join('\n'))