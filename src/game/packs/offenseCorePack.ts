import { BATTING_EVENTS, RUNNING_CHANCES } from '../battingEvents'
import type { ScenarioEffect, ScenarioPack } from '../scenario'
import { validateScenarioPack } from '../scenario'
import { EMPTY_BASES_SINGLE_NODES } from './emptyBasesSingleNodes'

const completeEvent = (id: string, title: string, effects: ScenarioEffect[]) => ({
  id,
  type: 'event' as const,
  view: 'result' as const,
  title,
  effects: [...effects, { type: 'record' as const, message: title }, { type: 'announce' as const, title: `${title}!`, detail: '플레이가 완료되었습니다.' }],
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
        { to: 'hit.double.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'double' }] },
        { to: 'hit.triple.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'triple' }] },
        { to: 'hit.homeRun.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'homeRun' }] },
        { to: 'hit.infield.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'infieldHit' }] },
        { to: 'error.infield.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'infieldError' }] },
        { to: 'walk.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'walk' }] },
        { to: 'hitByPitch.resolve', when: [{ field: 'battingEvent', operator: 'eq', value: 'hitByPitch' }] },
        { to: 'strikeout.catcher.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'strikeout' }, { field: 'bases', operator: 'excludes', value: [1] }] },
        { to: 'strikeout.catcher.check', when: [{ field: 'battingEvent', operator: 'eq', value: 'strikeout' }, { field: 'outs', operator: 'eq', value: 2 }] },
        { to: 'out.strikeout.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'strikeout' }] },
        { to: 'out.ground.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'groundOut' }] },
        { to: 'out.fly.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'flyOut' }] },
      ],
    },
    ...EMPTY_BASES_SINGLE_NODES,
    'hit.single.firstThird': {
      id: 'hit.single.firstThird', type: 'event', view: 'runner:first', title: '1루타',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: true }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '1루타' }, { type: 'record', message: '3루 주자 득점', showInCompletion: false }, { type: 'announce', title: '1루타 성공!', detail: '1루에 도착했습니다.' }],
      transition: { to: 'single.outfield.check' },
    },
    'hit.single.generic': {
      id: 'hit.single.generic', type: 'event', view: 'runner:first', title: '1루타',
      effects: [{ type: 'applyHit', batterTo: 1, creditHit: true }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '1루타' }, { type: 'announce', title: '1루타 성공!', detail: '1루에 도착했습니다.' }],
      transition: { to: 'single.outfield.check' },
    },
    'walk.resolve': {
      id: 'walk.resolve', type: 'event', view: 'runner:first', title: '볼넷',
      effects: [{ type: 'forceWalk' }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '볼넷' }, { type: 'announce', title: '볼넷!', detail: '1루에 도착했습니다.' }],
      transition: { to: 'runner.route' },
    },
    'hitByPitch.resolve': {
      id: 'hitByPitch.resolve', type: 'event', view: 'runner:first', title: '사구',
      effects: [{ type: 'forceWalk' }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '사구' }, { type: 'announce', title: '사구!', detail: '1루에 도착했습니다.' }],
      transition: { to: 'runner.route' },
    },
    'strikeout.catcher.check': {
      id: 'strikeout.catcher.check', type: 'chance', view: 'batter', title: '포수 포구 판정',
      outcomes: [
        { id: 'clearDrop', label: '명백하게 완전히 뒤로 빠뜨림', weight: RUNNING_CHANCES.droppedThirdStrikeClear, transition: { to: 'strikeout.clearDrop.decide', effects: [{ type: 'record', message: '낫아웃, 포수가 공을 완전히 빠뜨림', showInCompletion: false }, { type: 'announce', title: '포수가 공을 뒤로 빠뜨렸습니다!', detail: '완전히 뒤로 빠졌습니다. 열심히 뛴다면 확실히 살 수 있습니다.' }] } },
        { id: 'ambiguousDrop', label: '애매하게 뒤로 빠뜨림', weight: RUNNING_CHANCES.droppedThirdStrikeAmbiguous, transition: { to: 'strikeout.ambiguousDrop.decide', effects: [{ type: 'record', message: '낫아웃, 포수가 공을 애매하게 빠뜨림', showInCompletion: false }, { type: 'announce', title: '포수가 공을 뒤로 빠뜨렸습니다!', detail: '애매하게 빠졌습니다. 열심히 뛴다면 살 수 있을지도 모릅니다.' }] } },
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
      id: 'strikeout.reachFirst', type: 'event', view: 'runner:first', title: '낫아웃 1루 진루',
      effects: [{ type: 'placeRunner', base: 1 }, { type: 'setPlayerBase', value: 1 }, { type: 'record', message: '낫아웃 1루 진루' }, { type: 'announce', title: '낫아웃 1루 진루 성공!', detail: '1루에 도착했습니다.', tone: 'positive' }],
      transition: { to: 'runner.route' },
    },
    'hit.double.generic': completeEvent('hit.double.generic', '2루타', [{ type: 'applyHit', batterTo: 2, creditHit: true }]),
    'hit.triple.generic': completeEvent('hit.triple.generic', '3루타', [{ type: 'applyHit', batterTo: 3, creditHit: true }]),
    'hit.homeRun.generic': completeEvent('hit.homeRun.generic', '홈런', [{ type: 'scoreAll', creditHit: true }]),
    'hit.infield.generic': completeEvent('hit.infield.generic', '내야안타', [{ type: 'applyHit', batterTo: 1, creditHit: true }]),
    'error.infield.generic': completeEvent('error.infield.generic', '내야수 땅볼 실책', [{ type: 'applyHit', batterTo: 1, creditHit: false }]),
    'out.strikeout.generic': {
      id: 'out.strikeout.generic', type: 'event', view: 'result', title: '삼진',
      effects: [{ type: 'addOuts', value: 1 }, { type: 'record', message: '삼진' }, { type: 'announce', title: '삼진 아웃되었습니다.', detail: '아웃 카운트가 올라갔습니다.', tone: 'negative' }],
      transition: { to: 'plate.complete' },
    },
    'out.ground.generic': completeEvent('out.ground.generic', '내야 땅볼 아웃', [{ type: 'addOuts', value: 1 }]),
    'out.fly.generic': completeEvent('out.fly.generic', '외야 뜬공', [{ type: 'addOuts', value: 1 }]),
  },
}

const validationErrors = validateScenarioPack(OFFENSE_CORE_PACK)
if (validationErrors.length > 0) throw new Error(validationErrors.join('\n'))