import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
import { RUNNING_CHANCES } from './probabilities'
import { chooseScenarioChanceOutcome, chooseScenarioOption, getAvailableScenarioChoices, selectScenarioBattingEvent, startScenario } from './scenarioEngine'
import { applyScenarioEffect } from './scenarioEffects'
import { validateScenarioPack, type ScenarioContext } from './scenario'
import { ANNOUNCEMENTS } from './announcementMessages'
import { isRunnerForced } from './gameSetup'
import { formatCurrentPlayerText, SCENARIO_TEXT } from './scenarioText'

const context = (outs = 0, bases: number[] = []): ScenarioContext => ({
  outs,
  bases,
  runs: 0,
  hits: 0,
  flags: {},
  records: [],
  completionRecords: [],
  playerBase: null,
  announcementHistory: [],
  announcementCategory: 'normal',
})

afterEach(() => vi.restoreAllMocks())

describe('isRunnerForced', () => {
  it('correctly identifies forced status across all base runner combinations', () => {
    // 1루 주자: 타자가 1루로 진루하므로 무조건 포스 상태
    expect(isRunnerForced([1], 1)).toBe(true)
    expect(isRunnerForced([1, 2], 1)).toBe(true)
    expect(isRunnerForced([1, 3], 1)).toBe(true)

    // 2루 주자: 1루 주자가 있을 때만 포스 상태
    expect(isRunnerForced([2], 2)).toBe(false)
    expect(isRunnerForced([2, 3], 2)).toBe(false)
    expect(isRunnerForced([1, 2], 2)).toBe(true)
    expect(isRunnerForced([1, 2, 3], 2)).toBe(true)

    // 3루 주자: 1루, 2루 주자가 모두 있을 때만 포스 상태 (만루)
    expect(isRunnerForced([3], 3)).toBe(false)
    expect(isRunnerForced([1, 3], 3)).toBe(false)
    expect(isRunnerForced([2, 3], 3)).toBe(false)
    expect(isRunnerForced([1, 2, 3], 3)).toBe(true)
  })
})

describe('offense core scenario pack', () => {
  it('has valid and reachable node references', () => {
    expect(validateScenarioPack(OFFENSE_CORE_PACK)).toEqual([])
  })

  it('scores every runner on a home run', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 2, 3]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'homeRun')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [], playerBase: null, runs: 4, hits: 1 })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.batting.homeRun, tone: 'positive' })
  })

  it('continues to the second-base runner decision after a double', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'double')

    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [2, 3], playerBase: 2, hits: 1 })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.batting.double, advance: 'normal' })
  })

  it('continues to the third-base runner decision after a triple', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'triple')

    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ bases: [3], playerBase: 3, runs: 1, hits: 1 })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.batting.triple, advance: 'normal' })
  })

  it('forces occupied runners on a walk', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 2, 3]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'walk')

    expect(result.context).toMatchObject({ bases: [1, 2, 3], runs: 1, hits: 0 })
  })

  it('moves the player to first and skips outfield chance after a walk', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'walk')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1], playerBase: 1, hits: 0 })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.batting.walk, advance: 'safe' })
  })

  it('moves the player to first and skips outfield chance after a hit by pitch', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'hitByPitch')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1], playerBase: 1, hits: 0 })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.batting.hitByPitch, advance: 'safe' })
  })

  it('records a normal strikeout when the catcher secures the ball', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.defense.strikeout, tone: 'negative' })
  })

  it('does not offer a dropped third strike when first base is occupied with fewer than two outs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 2, 3]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [1, 2, 3], playerBase: null })
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.defense.strikeout, tone: 'negative' })
  })

  it('offers distinct fielding and throwing errors for an infield ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const fieldingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingError', { manualChance: true })
    const throwingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const throwingErrorClear = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwingError, 'clearMiss', { manualChance: true })

    expect(fielding.nodeId).toBe('ground.infield.check')
    expect(fieldingError.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 0 })
    expect(fieldingError.context.announcement).toEqual(ANNOUNCEMENTS.infieldFieldingError)
    expect(throwingError.nodeId).toBe('ground.infield.throwingError.check')
    expect(throwingError.context.announcement).toEqual(ANNOUNCEMENTS.groundFieldingSuccess)
    expect(throwingErrorClear.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 0 })
    expect(throwingErrorClear.context.announcement).toEqual(ANNOUNCEMENTS.groundThrowingErrorClear)
  })

  it('offers stay or advance after an ambiguous infield ground throwing error at the plate', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const miss = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwingError, 'ambiguousMiss', { manualChance: true })

    expect(miss.nodeId).toBe('followUp.ground.throwingError.ambiguous.decide')
    expect(miss.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 0 })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, miss).map((choice) => choice.id)).toEqual(['stayOnBase', 'advance'])
    expect(miss.context.announcement).toEqual(ANNOUNCEMENTS.groundThrowingErrorAmbiguous)
  })

  it('ends a follow-up ground throwing error when the tracked third-base runner is forced home', () => {
    const loadedThirdRunner = { ...context(0, [1, 2, 3]), playerBase: 3 }
    const fielding = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, { nodeId: 'followUp.ground.check', context: loadedThirdRunner }, 'cleanPlay', { manualChance: true })
    const miss = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'ambiguousMiss', { manualChance: true })

    expect(fielding.nodeId).toBe('followUp.ground.throwingError.check')
    expect(miss.nodeId).toBe('plate.complete')
    expect(miss.context).toMatchObject({ bases: [1, 2, 3], playerBase: null, runs: 1 })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, miss)).toEqual([])
  })

  it('checks whether a third-base runner rushes home on a clean ground ball without a first-base runner', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2, 3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwing = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const cleanPlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwing, 'throwSuccess', { manualChance: true })

    expect(throwing.nodeId).toBe('ground.infield.throwingError.check')
    expect(cleanPlay.nodeId).toBe('ground.infield.runnerThird.advance.check')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, cleanPlay)).toEqual([])

    const advanceHome = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, cleanPlay, 'advanceHome', { manualChance: true })
    const stayThird = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, cleanPlay, 'stayThird', { manualChance: true })

    expect(advanceHome.nodeId).toBe('plate.complete')
    expect(advanceHome.context).toMatchObject({ outs: 1, bases: [2], playerBase: null, runs: 1 })
    expect(stayThird.nodeId).toBe('plate.complete')
    expect(stayThird.context).toMatchObject({ outs: 1, bases: [2, 3], playerBase: null, runs: 0 })
  })

  it('announces lead runner out instead of force out when runner is on second base only', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwing = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const cleanPlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwing, 'throwSuccess', { manualChance: true })
    const leadRunnerOut = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, cleanPlay, 'leadRunnerOut', { manualChance: true })

    expect(leadRunnerOut.context.announcement?.title).toBe('내야 땅볼 선행 주자 아웃!')
    expect(leadRunnerOut.context.records).toContain('내야 땅볼, 선행 주자 아웃')
  })

  it('prioritizes the first-base runner on a ground ball with runners on first and third', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [1, 3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwing = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwing, 'throwSuccess', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, decision, 'forceOut', { manualChance: true })

    expect(throwing.nodeId).toBe('ground.infield.throwingError.check')
    expect(decision.nodeId).toBe('ground.infield.doublePlay.check')
    expect(result.nodeId).toBe('ground.infield.forceOut.runnerThird.advance.check')
    expect(result.context).toMatchObject({ outs: 2, bases: [1, 3], playerBase: 1 })
  })

  it('scores the third-base runner after a force out at second with runners on first and third', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwing = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwing, 'throwSuccess', { manualChance: true })
    const forceOut = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, decision, 'forceOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, forceOut, 'advanceHome', { manualChance: true })

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ outs: 1, bases: [1], playerBase: 1, runs: 1 })
  })

  it('scores the third-base runner after a force out at second with the bases loaded', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 2, 3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwing = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwing, 'throwSuccess', { manualChance: true })
    const forceOut = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, decision, 'forceOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, forceOut, 'advanceHome', { manualChance: true })

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ outs: 1, bases: [1, 2], playerBase: 1, runs: 1 })
  })

  it('offers a double play on a clean ground ball with first base occupied before two outs', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [1, 3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwing = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwing, 'throwSuccess', { manualChance: true })
    const doublePlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, decision, 'doublePlay', { manualChance: true })

    expect(throwing.nodeId).toBe('ground.infield.throwingError.check')
    expect(decision.nodeId).toBe('ground.infield.doublePlay.check')
    expect(doublePlay.nodeId).toBe('plate.complete')
    expect(doublePlay.context).toMatchObject({ outs: 3, bases: [], playerBase: null })
    expect(doublePlay.context.records).toContain('내야 땅볼, 병살')
  })

  it('treats a dropped infield fly as a single', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'infieldFly', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingFailed', { manualChance: true })

    expect(fielding.nodeId).toBe('fly.infield.check')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 1 })
    expect(result.context.announcement).toEqual(ANNOUNCEMENTS.infieldFlyFieldingError)
  })

  it('applies the infield fly rule with runners on first and second before two outs', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [1, 2]), { manualChance: true })
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'infieldFly', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 2, bases: [1, 2], hits: 0 })
    expect(result.context.records).toContain('인필드 플라이 아웃')
    expect(result.context.announcement).toEqual(ANNOUNCEMENTS.infieldFlyRule)
  })

  it('keeps a two-out infield fly as one final announcement', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(2), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'infieldFly', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'caught', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context.announcement).toEqual({ title: '뜬공 처리 성공!', detail: '3아웃 · 공수교대입니다.', tone: 'negative' })
    expect(result.context.announcementHistory[0].announcement.title).toBe('내야 뜬공 발생!')
    expect(result.context.announcementHistory[0].announcement.detail).toBe('내야수가 타구를 처리하러 이동합니다.')
    expect(result.context.announcementHistory).toHaveLength(1)
  })

  it('treats a dropped fly ball as a single', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const failure = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingFailed', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, failure, 'clearDrop', { manualChance: true })

    expect(fielding.nodeId).toBe('fly.outfield.check')
    expect(failure.nodeId).toBe('fly.outfield.failure.check')
    expect(result.nodeId).toBe('runner.first.clearDrop.decide')
    expect(result.context).toMatchObject({ bases: [1], playerBase: 1, hits: 1 })
    expect(result.context.announcementHistory.at(-1)?.announcement).toEqual(ANNOUNCEMENTS.outfieldFieldingError)
    expect(result.context.announcementHistory.at(-1)?.category).toBe('normal')
    expect(OFFENSE_CORE_PACK.nodes[failure.nodeId]?.tags).not.toContain('surprise-event')
    expect(result.context.announcement).toEqual(ANNOUNCEMENTS.outfieldError(true))
  })

  it('announces an outfield fly and then a successful catch as separate steps', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'caught', { manualChance: true })

    expect(result.context.announcementHistory[0].announcement.title).toBe('외야 뜬공 발생!')
    expect(result.context.announcement).toEqual(SCENARIO_TEXT.defense.flyOut)
  })

  it('automatically resolves tag-up for a third-base runner when the player bats', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const depth = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'deepFly', { manualChance: true })

    expect(fielding.nodeId).toBe('fly.outfield.runnerThird.check')
    expect(depth.nodeId).toBe('plate.complete')
    expect(depth.context).toMatchObject({ outs: 2, bases: [], runs: 1, playerBase: null })
    expect(depth.context.completionRecords).toContain('희생플라이')
  })

  it('keeps a third-base runner active after staying on an outfield fly with one out', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
    const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
    const wait = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wait, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'flyOut', { manualChance: true })
    const depth = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'deepFly', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, depth, 'stayThird', { manualChance: true })

    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ outs: 2, bases: [3], playerBase: 3 })
  })

  it('routes a follow-up deep fly tag-up through an explicit 100/0 chance', () => {
    const initial = { nodeId: 'followUp.batting.resolve', context: { ...context(0, [3]), playerBase: 3 } }
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const depth = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'deepFly', { manualChance: true })
    const tagUp = chooseScenarioOption(OFFENSE_CORE_PACK, depth, 'tagUp', { manualChance: true })

    expect(tagUp.nodeId).toBe('runner.third.sacrificeFly.deep.advance')
    expect(tagUp.context.announcement).toEqual({ ...SCENARIO_TEXT.running.deepTagUpAttempt, detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' })

    const failure = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, tagUp, 'out', { manualChance: true })
    const success = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, tagUp, 'success', { manualChance: true })

    expect(success.nodeId).toBe('plate.complete')
    expect(success.context).toMatchObject({ outs: 1, bases: [], runs: 1, playerBase: null })
    expect(failure.context).toMatchObject({ outs: 2, bases: [], runs: 0, playerBase: null })
  })

  it('offers second-base runner choices after a clear outfield error on a fly ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const failure = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingFailed', { manualChance: true })
    const drop = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, failure, 'clearDrop', { manualChance: true })

    expect(fielding.nodeId).toBe('fly.outfield.runnerSecond.check')
    expect(failure.nodeId).toBe('fly.outfield.runnerSecond.failure.check')
    expect(drop.nodeId).toBe('runner.second.outfieldError.clear.decide')
    expect(drop.context).toMatchObject({ bases: [1, 2], playerBase: 1, hits: 1 })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, drop).map((choice) => choice.id)).toEqual(['staySecond', 'advanceThird'])

    const stay = chooseScenarioOption(OFFENSE_CORE_PACK, drop, 'staySecond', { manualChance: true })
    expect(stay.context).toMatchObject({ bases: [1, 2], runs: 0, playerBase: 1 })

    const advance = chooseScenarioOption(OFFENSE_CORE_PACK, drop, 'advanceThird', { manualChance: true })
    expect(advance.nodeId).toBe('runner.first.decide')
    expect(advance.context).toMatchObject({ bases: [1, 3], runs: 0, playerBase: 1 })
  })

  it('splits an ambiguous second-base outfield error into staying or an advance attempt', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const failure = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingFailed', { manualChance: true })
    const drop = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, failure, 'ambiguousDrop', { manualChance: true })

    expect(drop.nodeId).toBe('runner.second.outfieldError.ambiguous.decide')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, drop).map((choice) => choice.id)).toEqual(['staySecond', 'advanceThird'])
    const advance = chooseScenarioOption(OFFENSE_CORE_PACK, drop, 'advanceThird', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'success', { manualChance: true })

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1, 3], playerBase: 1 })
  })

  it('lets an admin select a clear dropped third strike and reach first by running hard', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const catcherCheck = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, catcherCheck, 'clearDrop', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'runHard', { manualChance: true })

    expect(catcherCheck.nodeId).toBe('strikeout.catcher.check')
    expect(decision.nodeId).toBe('strikeout.clearDrop.decide')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ outs: 0, bases: [1], playerBase: 1 })
    expect(result.context.announcement).toEqual({ title: '낫아웃 1루 진루 성공!', detail: '1루에 도착했습니다.', tone: 'positive', advance: 'bold' })
  })

  it('forces a first-base runner to second after a two-out dropped third strike', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(2, [1]), { manualChance: true })
    const catcherCheck = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, catcherCheck, 'clearDrop', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'runHard', { manualChance: true })

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ outs: 2, bases: [1, 2], playerBase: 1, runs: 0 })
  })

  it('forces in a run on a two-out dropped third strike with the bases loaded', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(2, [1, 2, 3]), { manualChance: true })
    const catcherCheck = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, catcherCheck, 'clearDrop', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'runHard', { manualChance: true })

    expect(result.context).toMatchObject({ outs: 2, bases: [1, 2, 3], playerBase: 1, runs: 1 })
  })

  it('lets an admin select a failed slow run after an ambiguous dropped third strike', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const catcherCheck = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, catcherCheck, 'ambiguousDrop', { manualChance: true })
    const runCheck = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'runSlow', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, runCheck, 'out', { manualChance: true })

    expect(runCheck.nodeId).toBe('strikeout.ambiguousDrop.slowRun')
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null })
  })

  it('uses the configured messages and odds for clear and ambiguous dropped third strikes', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const catcherCheck = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout', { manualChance: true })
    const clear = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, catcherCheck, 'clearDrop', { manualChance: true })
    const ambiguous = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, catcherCheck, 'ambiguousDrop', { manualChance: true })

    expect(clear.context.announcement).toEqual({ ...SCENARIO_TEXT.defense.droppedThirdStrikeClear, tone: 'positive', scene: 'dropped-third-strike-clear' })
    expect(ambiguous.context.announcement).toEqual({ ...SCENARIO_TEXT.defense.droppedThirdStrikeAmbiguous, scene: 'dropped-third-strike-ambiguous' })
    expect(RUNNING_CHANCES).toMatchObject({
      runHardOnClearDroppedStrike: 1,
      runSlowOnClearDroppedStrike: 0.5,
      runHardOnAmbiguousDroppedStrike: 0.8,
      runSlowOnAmbiguousDroppedStrike: 0,
    })
  })

  it('offers a runner decision after an empty-base single', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1], hits: 1 })
    expect(result.context.announcement).toEqual(SCENARIO_TEXT.batting.single)
  })

  it('offers stay or steal after a single turns second-and-third into first-and-third', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2, 3]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1, 3], runs: 1, hits: 1 })
    expect(result.context.playerBase).toBe(1)
    expect(result.context.records).toContain('3루 주자 득점')
    expect(result.context.completionRecords).toEqual(['1루타'])
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, result).map((choice) => choice.id)).toEqual(['waitForBatter', 'stealSecond'])
  })

  it('does not offer a steal into an occupied third base', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2, 3]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const second = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stealSecond')

    expect(second.context.bases).toEqual([2, 3])
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, second).map((choice) => choice.id)).toEqual(['waitForBatter'])
  })

  it('continues to the second-base runner decision on a successful steal', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stealSecond')

    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context.bases).toEqual([2])
    expect(result.context.records).toContain('2루 도루 성공')
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.steal.secondSuccess, tone: 'positive', advance: 'bold' })
  })

  it('continues to the third-base runner decision on another successful steal', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const second = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stealSecond')
    const third = chooseScenarioOption(OFFENSE_CORE_PACK, second, 'stealThird')

    expect(third.nodeId).toBe('runner.third.decide')
    expect(third.context.bases).toEqual([3])
    expect(third.context.records).toContain('3루 도루 성공')
  })

  it('clears runners when a failed steal makes three outs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context(2))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stealSecond')

    expect(result.context.outs).toBe(3)
    expect(result.context.bases).toEqual([])
    expect(result.context.records).toContain('2루 도루 실패')
    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.steal.secondFailure, detail: ANNOUNCEMENTS.sideChange, tone: 'negative' })
  })

  it('marks a failed steal as a negative transition before three outs', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stealSecond')

    expect(result.context.announcement).toEqual({ ...SCENARIO_TEXT.steal.secondFailure, tone: 'negative' })
  })

  it('announces a side change instead of scoring when a follow-up strikeout makes three outs', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.5)
    const initial = startScenario(OFFENSE_CORE_PACK, context(2, [1, 3]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 3, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ title: '후속타자의 삼진!', detail: '3아웃 · 공수교대입니다.', tone: 'negative', sceneBase: 1 })
  })

  it('continues to a follow-up hit when staying at first', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [1, 2], hits: 2, battingEvent: 'single', playerBase: 2 })
    expect(result.context.announcement).toEqual({ title: '후속타자의 1루타!', detail: '2루에 도착했습니다.', advance: 'normal', sceneBase: 1 })
    expect(result.context.announcementHistory).toEqual([])
  })

  it('ends the play on a force out when a first-base runner faces a follow-up ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const throwCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'throwSuccess', { manualChance: true })

    expect(fielding.nodeId).toBe('followUp.ground.check')
    expect(throwCheck.nodeId).toBe('followUp.ground.throwingError.check')
    expect(throwCheck.context.announcement).toEqual(ANNOUNCEMENTS.groundFieldingSuccess)
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ title: '내야 땅볼 포스 아웃!', detail: '후속 타자의 내야 땅볼로 인해 2루에서 포스 아웃되었습니다.', tone: 'negative', detailScene: 'out-ground-force', titleImageMode: 'same-as-detail-scene' })
  })

  it('announces the next forced base for runners on first, second, and third', () => {
    const forceOut = { type: 'applyFollowUpGroundOut' as const }
    const first = applyScenarioEffect({ ...context(0, [1]), playerBase: 1 }, forceOut)
    const second = applyScenarioEffect({ ...context(0, [1, 2]), playerBase: 2 }, forceOut)
    const third = applyScenarioEffect({ ...context(0, [1, 2, 3]), playerBase: 3 }, forceOut)

    expect(first.announcement).toMatchObject({ detail: '후속 타자의 내야 땅볼로 인해 2루에서 포스 아웃되었습니다.' })
    expect(second.announcement).toMatchObject({ detail: '후속 타자의 내야 땅볼로 인해 3루에서 포스 아웃되었습니다.' })
    expect(third.announcement).toMatchObject({ detail: '후속 타자의 내야 땅볼로 인해 홈에서 포스 아웃되었습니다.' })
  })

  it('uses first-base catch imagery when a follow-up ground ball retires the batter', () => {
    const batterOut = { type: 'applyFollowUpGroundOut' as const }
    const result = applyScenarioEffect({ ...context(2, [3]), playerBase: 3 }, batterOut)

    expect(result.announcement).toEqual({ title: '후속타자의 내야 땅볼 아웃!', detail: '3아웃 · 공수교대입니다.', detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' })
  })

  it('allows a third-base runner to score while the batter is retired on a clean ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [3]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const throwCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const advanceCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'throwSuccess', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advanceCheck, 'advanceHome', { manualChance: true })

    expect(advanceCheck.nodeId).toBe('ground.infield.runnerThird.advance.check')
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null, runs: 1 })
  })

  it('checks the third-base home advance in one-out regular at-bats with runners on second and third', () => {
    const oneOutInitial = startScenario(OFFENSE_CORE_PACK, context(1, [2, 3]), { manualChance: true })
    const oneOutFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, oneOutInitial, 'groundOut', { manualChance: true })
    const oneOutThrowCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, oneOutFielding, 'cleanPlay', { manualChance: true })
    const advanceCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, oneOutThrowCheck, 'throwSuccess', { manualChance: true })

    expect(advanceCheck.nodeId).toBe('ground.infield.runnerThird.advance.check')
    const advanceNode = OFFENSE_CORE_PACK.nodes[advanceCheck.nodeId]
    expect(advanceNode).toMatchObject({ outcomes: [{ id: 'advanceHome', weight: RUNNING_CHANCES.advanceOnGroundBallToThird }, { id: 'stayThird' }] })
  })

  it('offers a 70 percent third-base advance attempt after a second-base runner stays safe on a ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const throwCheck = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'advanceThird', { manualChance: true })
    const advance = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'throwSuccess', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'success', { manualChance: true })

    expect(decision.nodeId).toBe('runner.second.groundOut.decide')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, decision).map((choice) => choice.id)).toEqual(['staySecond', 'advanceThird'])
    expect(decision.context.announcement).toEqual({ title: '상대 내야수, 1루 송구 준비 완료!', detail: '2루 주자는 송구 시점에 맞춰 3루 진루를 시도할 수 있습니다.', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' })
    expect(throwCheck.nodeId).toBe('followUp.ground.throwingError.check')
    expect(advance.nodeId).toBe('runner.second.groundOut.advance')
    const advanceNode = OFFENSE_CORE_PACK.nodes[advance.nodeId]
    expect(advanceNode).toMatchObject({ outcomes: [{ id: 'success', weight: RUNNING_CHANCES.advanceOnGroundBallToThird }, { id: 'out' }] })
    if (advanceNode.type === 'chance') expect(advanceNode.outcomes[1].weight).toBeCloseTo(1 - RUNNING_CHANCES.advanceOnGroundBallToThird)
    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ bases: [3], playerBase: 3 })
  })

  it('offers a home-plate advance attempt for a third-base runner after a clean ground ball with zero or one out', () => {
    for (const outs of [0, 1]) {
      const initial = startScenario(OFFENSE_CORE_PACK, context(outs), { manualChance: true })
      const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
      const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
      const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
      const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
      const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
      const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
      const wait = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
      const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wait, 'normalPitch', { manualChance: true })
      const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
      const cleanPlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })

      expect(cleanPlay.nodeId).toBe('runner.third.groundOut.decide')
      expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, cleanPlay).map((choice) => choice.id)).toEqual(['stayThird', 'advanceHome'])
    }
  })

  it('does not offer an advance attempt after a two-out follow-up ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const wait = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wait, 'normalPitch', { manualChance: true })
    const strikeout = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'strikeout', { manualChance: true })
    const nextWait = chooseScenarioOption(OFFENSE_CORE_PACK, strikeout, 'waitForBatter', { manualChance: true })
    const nextFollowUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, nextWait, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, nextFollowUp, 'groundOut', { manualChance: true })
    const throwCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'throwSuccess', { manualChance: true })

    expect(throwCheck.nodeId).toBe('followUp.ground.throwingError.check')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, throwCheck)).toEqual([])
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 3, bases: [], playerBase: null })
  })

  it('scores a third-base runner who successfully advances home on a clean ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
    const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
    const wait = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wait, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const cleanPlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    expect(cleanPlay.context.announcementHistory.slice(-2).map(({ announcement }) => announcement)).toEqual([
      { title: '후속타자의 내야 땅볼 발생!', detail: '내야수가 타구를 처리하러 이동합니다.', detailScene: 'ball-ground-infield', titleImageMode: 'same-as-detail-scene' },
      ANNOUNCEMENTS.groundFieldingSuccess,
    ])
    expect(cleanPlay.context.announcement).toEqual({ title: '상대 내야수, 1루 송구 준비 완료!', detail: '3루 주자는 위험을 감수하고 송구 시점에 맞춰 홈 쇄도를 시도할 수 있습니다.', tone: 'caution', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' })
    const throwCheck = chooseScenarioOption(OFFENSE_CORE_PACK, cleanPlay, 'advanceHome', { manualChance: true })
    const advance = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'throwSuccess', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'success', { manualChance: true })

    expect(throwCheck.context.announcement).toEqual({ title: '홈 쇄도를 시도합니다.', detail: '상대 내야수가 송구하는 순간 홈으로 쇄도합니다.', detailScene: 'ground-home-rush', titleImageMode: 'same-as-detail-scene' })
    expect(advance.context.announcement).toEqual({ title: '상대 내야수가 1루 송구에 성공했습니다!', detail: '타자 주자가 1루에서 아웃되었습니다.', detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' })
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null, runs: 1 })
    expect(result.context.announcement).toEqual({ title: '내야 땅볼 중 홈 추가진루 성공!', detail: '송구를 받은 상대 1루수가 홈에 던졌지만, 3루 주자가 먼저 홈 쇄도에 성공했습니다.', tone: 'positive', detailScene: 'home-in-positive', titleImageMode: 'same-as-detail-scene' })
  })

  it('announces the batter-runner out without repeating the throw-ready message before a third-base player is thrown out at home', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
    const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
    const wait = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wait, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const cleanPlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const throwCheck = chooseScenarioOption(OFFENSE_CORE_PACK, cleanPlay, 'advanceHome', { manualChance: true })
    const advance = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'throwSuccess', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'out', { manualChance: true })

    expect(cleanPlay.context.announcement).toEqual({ title: '상대 내야수, 1루 송구 준비 완료!', detail: '3루 주자는 위험을 감수하고 송구 시점에 맞춰 홈 쇄도를 시도할 수 있습니다.', tone: 'caution', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' })
    expect(throwCheck.context.announcement).toEqual({ title: '홈 쇄도를 시도합니다.', detail: '상대 내야수가 송구하는 순간 홈으로 쇄도합니다.', detailScene: 'ground-home-rush', titleImageMode: 'same-as-detail-scene' })
    expect(advance.context.announcement).toEqual({ title: '상대 내야수가 1루 송구에 성공했습니다!', detail: '타자 주자가 1루에서 아웃되었습니다.', detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' })
    expect(advance.context.announcementHistory).toEqual([])
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 2, bases: [], playerBase: null, runs: 0 })
    expect(result.context.announcement).toEqual({ title: '후속타자의 내야 땅볼 중 홈 쇄도 실패', detail: '송구를 받은 상대 1루수가 재빠르게 홈으로 송구합니다.\n추가진루를 시도하던 3루 주자도 홈에서 아웃되었습니다.', tone: 'negative', scene: 'home-advance-failure', detailScene: 'home-advance-failure', titleImageMode: 'same-as-detail-scene' })
  })

  it('offers clear or ambiguous extra-advance choices after a follow-up ground-ball throwing error', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const fieldingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingError', { manualChance: true })
    const throwCheck = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const clearMiss = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'clearMiss', { manualChance: true })
    const ambiguousMiss = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'ambiguousMiss', { manualChance: true })

    expect(fieldingError.context).toMatchObject({ bases: [1, 2], playerBase: 2, hits: 1 })
    expect(throwCheck.nodeId).toBe('followUp.ground.throwingError.check')
    expect(clearMiss.nodeId).toBe('followUp.ground.throw.extra.clear.decide')
    expect(clearMiss.context).toMatchObject({ bases: [1, 2], playerBase: 2, hits: 1 })
    expect(clearMiss.context.announcement).toEqual(ANNOUNCEMENTS.followUpGroundThrowingErrorClear)
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, clearMiss).map((choice) => choice.id)).toEqual(['stayOnBase', 'advance'])
    const clearAdvance = chooseScenarioOption(OFFENSE_CORE_PACK, clearMiss, 'advance', { manualChance: true })
    const clearAdvanceNode = OFFENSE_CORE_PACK.nodes[clearAdvance.nodeId]
    expect(clearAdvanceNode).toMatchObject({ outcomes: [{ id: 'success', weight: RUNNING_CHANCES.followUpGroundThrowClearExtraAdvance }, { id: 'out' }] })
    if (clearAdvanceNode.type === 'chance') expect(clearAdvanceNode.outcomes[1].weight).toBeCloseTo(1 - RUNNING_CHANCES.followUpGroundThrowClearExtraAdvance)

    expect(ambiguousMiss.nodeId).toBe('followUp.ground.throw.extra.ambiguous.decide')
    expect(ambiguousMiss.context).toMatchObject({ bases: [1, 2], playerBase: 2, hits: 1 })
    expect(ambiguousMiss.context.announcement).toEqual(ANNOUNCEMENTS.followUpGroundThrowingErrorAmbiguous)
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, ambiguousMiss).map((choice) => choice.id)).toEqual(['stayOnBase', 'advance'])
    const ambiguousAdvance = chooseScenarioOption(OFFENSE_CORE_PACK, ambiguousMiss, 'advance', { manualChance: true })
    const ambiguousAdvanceNode = OFFENSE_CORE_PACK.nodes[ambiguousAdvance.nodeId]
    expect(ambiguousAdvanceNode).toMatchObject({ outcomes: [{ id: 'success', weight: RUNNING_CHANCES.followUpGroundThrowAmbiguousExtraAdvance }, { id: 'out' }] })
    if (ambiguousAdvanceNode.type === 'chance') expect(ambiguousAdvanceNode.outcomes[1].weight).toBeCloseTo(1 - RUNNING_CHANCES.followUpGroundThrowAmbiguousExtraAdvance)
  })

  it('asks for another extra-advance decision after a runner started on the throw and the throw misses', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const throwCheck = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'advanceThird', { manualChance: true })
    const extra = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'clearMiss', { manualChance: true })

    expect(extra.nodeId).toBe('followUp.ground.throw.extra.clear.decide')
    expect(extra.context).toMatchObject({ bases: [1, 3], playerBase: 3 })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, extra).map((choice) => choice.id)).toEqual(['stayOnBase', 'advance'])
    const advance = chooseScenarioOption(OFFENSE_CORE_PACK, extra, 'advance', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'success', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [1], playerBase: null, runs: 1 })
  })

  it('announces a home score and completes the play after a fielding error advances a third-base runner', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
    const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingError', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [1], playerBase: null, runs: 1 })
    expect(result.context.announcement).toEqual({ title: '상대 내야수가 땅볼 포구에 실패했습니다!', detail: '홈에 들어왔습니다.', tone: 'positive', detailScene: 'ball-ground-infield', titleImageMode: 'same-as-detail-scene' })
  })

  it('completes the play when a throwing error advances a third-base runner home', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
    const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const cleanPlay = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })
    const throwCheck = chooseScenarioOption(OFFENSE_CORE_PACK, cleanPlay, 'advanceHome', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwCheck, 'ambiguousMiss', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [1], playerBase: null, runs: 1 })
    expect(result.context.announcementHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ announcement: ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvanceAttempt.ambiguous }),
    ]))
    const expectedAnnouncement = ANNOUNCEMENTS.followUpGroundThrowingErrorExtraAdvance.ambiguous
    // 홈인은 득점이므로 tone이 positive로 유도되고, home-in-positive 이미지를 쓰도록 detailScene을 강제하지 않는다.
    expect(result.context.announcement).toEqual({
      title: expectedAnnouncement.title,
      detail: formatCurrentPlayerText(expectedAnnouncement.homeDetail, null),
      tone: 'positive',
      advance: expectedAnnouncement.advance,
      titleImageMode: expectedAnnouncement.titleImageMode,
    })
  })

  it('offers the common outfield error choices after a follow-up hit advances the player', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'single', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'clearDrop', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'advance', { manualChance: true })

    expect(fielding.nodeId).toBe('runner.battingAdvance.outfield.check')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, decision).map((choice) => choice.id)).toEqual(['stayOnBase', 'advance'])
    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ bases: [1, 3], playerBase: 3, hits: 2 })
    expect(result.context.announcement).toEqual({ title: '외야수 실책 추가 진루 성공!', detail: '외야수 실책을 이용해 3루에 도착했습니다.', advance: 'normal' })
  })

  it('includes the follow-up hit in the outfield error announcement', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'double', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'ambiguousDrop', { manualChance: true })

    expect(result.context.announcement).toEqual({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다.', detail: '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.', tone: 'caution', scene: 'error-outfield-through-ambiguous' })
    expect(result.context.announcementHistory).toEqual([])
    expect(result.context.announcementCategory).toBe('surprise')
  })

  it('announces a home score when an outfield error advances a player from third', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'double', { manualChance: true })
    const decision = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'clearDrop', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'advance', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [2], playerBase: null, runs: 1 })
    expect(result.context.announcement).toEqual({ title: '외야수 실책 추가 진루 성공!', detail: '홈에 들어왔습니다.', tone: 'positive', advance: 'normal' })
  })

  it('reports that the runner stayed put after a follow-up strikeout', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.5)
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [1, 2]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ outs: 2, bases: [1, 2, 3], playerBase: 1 })
    expect(result.context.announcement).toEqual({ title: '후속타자의 삼진!', detail: '1루에서 움직이지 못했습니다.', advance: 'blocked', sceneBase: 1 })
    expect(result.context.records).toContain('후속 타자 삼진')
    expect(result.context.completionRecords).not.toContain('후속 타자 삼진')
  })

  it('keeps only the follow-up fly-out announcement when the third-base runner has two outs', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(2), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const stealThird = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'stealThird', { manualChance: true })
    const thirdRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealThird, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, thirdRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'flyOut', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context.announcement).toEqual({ title: '뜬공 처리 성공!', detail: '3아웃 · 공수교대입니다.', tone: 'negative', sceneBase: 3 })
    expect(result.context.announcementHistory).toHaveLength(1)
    expect(result.context.announcementHistory[0].announcement.title).toBe('후속타자의 외야 뜬공 발생!')
  })

  it('moves the player from first to third on a follow-up double with runners on first and second', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0.25).mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 3]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')

    expect(single.nodeId).toBe('runner.first.decide')
    expect(single.context).toMatchObject({ bases: [1, 2], runs: 1, playerBase: 1 })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, single).map((choice) => choice.id)).toEqual(['waitForBatter'])

    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ bases: [2, 3], runs: 2, playerBase: 3, battingEvent: 'double' })
    expect(result.context.records).toContain('후속 타자 2루타')
  })

  it('offers a guaranteed advance after a clear outfield drop', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')

    expect(result.nodeId).toBe('runner.first.clearDrop.decide')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, result).map((choice) => choice.id)).toEqual(['stayFirst', 'advanceSecond'])
    expect(result.context.announcementHistory).toHaveLength(1)
    expect(result.context.announcementHistory[0].announcement.title).toBe('1루타 성공!')
    expect(result.context.announcementCategory).toBe('surprise')
  })

  it('updates the announcement after staying at first on an outfield error', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stayFirst')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context.announcement).toEqual({ title: '외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative', advance: 'blocked' })
  })

  it('pauses at the outfield result node in manual chance mode', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })

    expect(result.nodeId).toBe('single.outfield.check')
    expect(OFFENSE_CORE_PACK.nodes[result.nodeId]).toMatchObject({ type: 'chance' })
  })

  it('allows an admin to choose a clear outfield drop and successful advance', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const drop = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'clearDrop', { manualChance: true })
    const advance = chooseScenarioOption(OFFENSE_CORE_PACK, drop, 'advanceSecond', { manualChance: true })

    expect(drop.nodeId).toBe('runner.first.clearDrop.decide')
    expect(advance.context).toMatchObject({ bases: [2], playerBase: 2 })
    expect(advance.context.announcement).toEqual({ title: '2루 진루 성공!', detail: '외야수 실책을 이용해 2루에 도착했습니다.', advance: 'normal' })
    expect(advance.context.announcementCategory).toBe('normal')
  })

  it('pauses at a steal result node in manual chance mode', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'normalFielding', { manualChance: true })
    const steal = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'stealSecond', { manualChance: true })

    expect(steal.nodeId).toBe('runner.first.stealSecond')
    expect(OFFENSE_CORE_PACK.nodes[steal.nodeId]).toMatchObject({ type: 'chance' })
  })

  it('allows an admin to choose the follow-up batting event after waiting', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'strikeout', { manualChance: true })

    expect(wildPitch.nodeId).toBe('wildPitch.check')
    expect(followUp.nodeId).toBe('followUp.batting.resolve')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context.announcement).toEqual({ title: '후속타자의 삼진!', detail: '1루에서 움직이지 못했습니다.', advance: 'blocked', sceneBase: 1 })
  })

  it('checks the outfield when the current second-base runner faces a follow-up fly ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'flyOut', { manualChance: true })
    const failure = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingFailed', { manualChance: true })
    const drop = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, failure, 'clearDrop', { manualChance: true })

    expect(fielding.nodeId).toBe('followUp.fly.outfield.check')
    expect(failure.nodeId).toBe('followUp.fly.outfield.failure.check')
    expect(drop.nodeId).toBe('runner.second.outfieldError.clear.decide')
    expect(drop.context).toMatchObject({ bases: [1, 2], playerBase: 2 })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, drop).map((choice) => choice.id)).toEqual(['staySecond', 'advanceThird'])
  })

  it('announces a successful catch for a follow-up fly ball with a runner on second', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const firstRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const stealSecond = chooseScenarioOption(OFFENSE_CORE_PACK, firstRunner, 'stealSecond', { manualChance: true })
    const secondRunner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, stealSecond, 'success', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, secondRunner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'flyOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'caught', { manualChance: true })

    expect(result.context.announcement).toEqual({ title: '뜬공 처리 성공!', detail: '2루에서 움직이지 못했습니다.', advance: 'blocked', sceneBase: 2 })
    expect(result.context.announcement?.title).not.toContain('발생')
  })

  it('allows an admin to choose either fielding result for a follow-up fly ball with a runner on second', () => {
    const runner = { nodeId: 'followUp.batting.resolve', context: { ...context(0, [2]), playerBase: 2 } }
    const flyOut = selectScenarioBattingEvent(OFFENSE_CORE_PACK, runner, 'flyOut', { manualChance: true })

    const caught = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, flyOut, 'caught', { manualChance: true })
    const failed = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, flyOut, 'fieldingFailed', { manualChance: true })

    expect(caught.context.announcement?.title).toBe('뜬공 처리 성공!')
    expect(failed.nodeId).toBe('followUp.fly.outfield.failure.check')
  })

  it('checks a follow-up fly ball with runners on first and second', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const double = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'double', { manualChance: true })
    const wait = chooseScenarioOption(OFFENSE_CORE_PACK, double, 'waitForBatter', { manualChance: true })
    const normalPitch = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wait, 'normalPitch', { manualChance: true })
    const walk = selectScenarioBattingEvent(OFFENSE_CORE_PACK, normalPitch, 'walk', { manualChance: true })
    const waitWithFirst = chooseScenarioOption(OFFENSE_CORE_PACK, walk, 'waitForBatter', { manualChance: true })
    const nextPitch = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, waitWithFirst, 'normalPitch', { manualChance: true })
    const flyOut = selectScenarioBattingEvent(OFFENSE_CORE_PACK, nextPitch, 'flyOut', { manualChance: true })

    expect(flyOut.nodeId).toBe('followUp.fly.outfield.check')
    expect(flyOut.context.bases).toEqual([1, 2])

    const failure = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, flyOut, 'fieldingFailed', { manualChance: true })
    expect(failure.nodeId).toBe('followUp.fly.outfield.runnerThird.failure.check')
    expect(failure.context.bases).toEqual([1, 2, 3])
    expect(failure.context.playerBase).toBe(3)

    const ambiguous = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, failure, 'ambiguousDrop', { manualChance: true })
    expect(ambiguous.nodeId).toBe('runner.third.outfieldError.ambiguous.decide')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, ambiguous).map((choice) => choice.id)).toEqual(['stayThird', 'advanceHome'])

    const stayThird = chooseScenarioOption(OFFENSE_CORE_PACK, ambiguous, 'stayThird', { manualChance: true })
    expect(stayThird.nodeId).toBe('runner.third.decide')
    expect(stayThird.context).toMatchObject({ bases: [1, 2, 3], playerBase: 3 })
  })

  it('uses a 70 percent chance for an ambiguous outfield drop advance', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.15).mockReturnValueOnce(0.69)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'advanceSecond')

    expect(single.nodeId).toBe('runner.first.ambiguousDrop.decide')
    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context.announcement).toEqual({ title: '2루 진루 성공!', detail: '위험을 감수하고 2루 추가 진루에 성공했습니다.', tone: 'positive', advance: 'bold' })
  })

  it('offers a guaranteed advance after a clear wild pitch', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'advance')

    expect(wildPitch.nodeId).toBe('runner.wildPitch.clear.decide')
    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [2], playerBase: 2 })
    expect(result.context.announcement).toEqual({ title: '폭투 진루 성공!', detail: '2루에 도착했습니다.', advance: 'normal' })
  })

  it('renders the actual destination in wild pitch choices', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, { ...context(0, [2]), playerBase: 2 }, { manualChance: true })
    const wildPitch = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, { ...initial, nodeId: 'wildPitch.check' }, 'clearWildPitch', { manualChance: true })

    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, wildPitch).find((choice) => choice.id === 'advance')?.label).toBe('3루로 진루한다')
  })

  it('uses a 70 percent chance for an ambiguous wild pitch advance', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.15).mockReturnValueOnce(0.69)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'advance')

    expect(wildPitch.nodeId).toBe('runner.wildPitch.ambiguous.decide')
    expect(result.context).toMatchObject({ bases: [2], playerBase: 2 })
  })

  it('identifies the catcher and destination when an ambiguous wild pitch advance fails', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, { ...context(0, [2]), playerBase: 2 }, { manualChance: true })
    const wildPitch = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, { ...initial, nodeId: 'wildPitch.check' }, 'ambiguousWildPitch', { manualChance: true })
    const advance = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'advance', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'out', { manualChance: true })

    expect(result.context.announcement).toEqual({ title: '폭투 진루 실패', detail: '상대 포수의 좋은 송구로 3루에서 아웃되었습니다.', tone: 'negative' })
  })

  it('returns to the runner decision after staying on base during a wild pitch', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'stayOnBase')

    expect(wildPitch.nodeId).toBe('runner.wildPitch.clear.decide')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1], playerBase: 1 })
    expect(result.context.announcement).toEqual({ title: '폭투가 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative', advance: 'blocked' })
  })

  it('scores an existing third-base runner on a wild pitch while the player stays at first', () => {
    const state = startScenario(OFFENSE_CORE_PACK, { ...context(0, [1, 3]), playerBase: 1 }, { manualChance: true })
    const wildPitch = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, { ...state, nodeId: 'wildPitch.check' }, 'clearWildPitch', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'stayOnBase', { manualChance: true })

    expect(result.context).toMatchObject({ bases: [1], playerBase: 1, runs: 1 })
  })

  it('advances other runners and scores one run on a wild pitch with the bases loaded', () => {
    const state = startScenario(OFFENSE_CORE_PACK, { ...context(0, [1, 2, 3]), playerBase: 1 }, { manualChance: true })
    const wildPitch = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, { ...state, nodeId: 'wildPitch.check' }, 'clearWildPitch', { manualChance: true })
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'stayOnBase', { manualChance: true })

    expect(result.context).toMatchObject({ bases: [1, 3], playerBase: 1, runs: 1 })
  })

  it('scores a third-base player on a wild pitch advance', () => {
    const result = applyScenarioEffect(
      { ...context(0, [3]), playerBase: 3 },
      { type: 'advancePlayer' },
    )

    expect(result).toMatchObject({ bases: [], playerBase: null, runs: 1 })
  })

  it('moves the existing runner to third when the player advances into occupied second', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'advanceSecond')

    expect(single.context).toMatchObject({ bases: [1, 2], playerBase: 1 })
    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [2, 3], playerBase: 2, runs: 0 })
  })

  it('scores the existing runner when the player advances into occupied third', () => {
    const result = applyScenarioEffect(
      { ...context(0, [2, 3]), playerBase: 2 },
      { type: 'movePlayer', to: 3 },
    )

    expect(result).toMatchObject({ bases: [3], playerBase: 3, runs: 1 })
  })

  it('does not place two runners on the same base', () => {
    const result = applyScenarioEffect(context(0, [1]), { type: 'placeRunner', base: 1 })

    expect(result.bases).toEqual([1])
  })
})
