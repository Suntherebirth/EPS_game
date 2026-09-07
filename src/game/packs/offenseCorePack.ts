import { BATTING_EVENTS } from '../battingEvents'
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
        { to: 'walk.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'walk' }] },
        { to: 'hitByPitch.generic', when: [{ field: 'battingEvent', operator: 'eq', value: 'hitByPitch' }] },
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
    'hit.double.generic': completeEvent('hit.double.generic', '2루타', [{ type: 'applyHit', batterTo: 2, creditHit: true }]),
    'hit.triple.generic': completeEvent('hit.triple.generic', '3루타', [{ type: 'applyHit', batterTo: 3, creditHit: true }]),
    'hit.homeRun.generic': completeEvent('hit.homeRun.generic', '홈런', [{ type: 'scoreAll', creditHit: true }]),
    'hit.infield.generic': completeEvent('hit.infield.generic', '내야안타', [{ type: 'applyHit', batterTo: 1, creditHit: true }]),
    'error.infield.generic': completeEvent('error.infield.generic', '내야수 땅볼 실책', [{ type: 'applyHit', batterTo: 1, creditHit: false }]),
    'walk.generic': completeEvent('walk.generic', '볼넷', [{ type: 'forceWalk' }]),
    'hitByPitch.generic': completeEvent('hitByPitch.generic', '사구', [{ type: 'forceWalk' }]),
    'out.strikeout.generic': completeEvent('out.strikeout.generic', '삼진', [{ type: 'addOuts', value: 1 }]),
    'out.ground.generic': completeEvent('out.ground.generic', '내야 땅볼 아웃', [{ type: 'addOuts', value: 1 }]),
    'out.fly.generic': completeEvent('out.fly.generic', '외야 뜬공', [{ type: 'addOuts', value: 1 }]),
  },
}

const validationErrors = validateScenarioPack(OFFENSE_CORE_PACK)
if (validationErrors.length > 0) throw new Error(validationErrors.join('\n'))