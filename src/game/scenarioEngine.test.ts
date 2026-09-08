import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
import { RUNNING_CHANCES } from './battingEvents'
import { chooseScenarioChanceOutcome, chooseScenarioOption, getAvailableScenarioChoices, selectScenarioBattingEvent, startScenario } from './scenarioEngine'
import { applyScenarioEffect } from './scenarioEffects'
import { validateScenarioPack, type ScenarioContext } from './scenario'

const context = (outs = 0, bases: number[] = []): ScenarioContext => ({
  outs,
  bases,
  runs: 0,
  hits: 0,
  flags: {},
  records: [],
  completionRecords: [],
  playerBase: null,
})

afterEach(() => vi.restoreAllMocks())

describe('offense core scenario pack', () => {
  it('has valid and reachable node references', () => {
    expect(validateScenarioPack(OFFENSE_CORE_PACK)).toEqual([])
  })

  it('scores every runner on a home run', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 2, 3]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'homeRun')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [], playerBase: null, runs: 4, hits: 1 })
    expect(result.context.announcement).toEqual({ title: '홈런!', detail: '타자와 모든 주자가 홈에 들어왔습니다.', tone: 'positive' })
  })

  it('continues to the second-base runner decision after a double', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'double')

    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [2, 3], playerBase: 2, hits: 1 })
    expect(result.context.announcement).toEqual({ title: '2루타 성공!', detail: '2루에 도착했습니다.' })
  })

  it('continues to the third-base runner decision after a triple', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'triple')

    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ bases: [3], playerBase: 3, runs: 1, hits: 1 })
    expect(result.context.announcement).toEqual({ title: '3루타 성공!', detail: '3루에 도착했습니다.' })
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
    expect(result.context.announcement).toEqual({ title: '볼넷!', detail: '1루에 도착했습니다.' })
  })

  it('moves the player to first and skips outfield chance after a hit by pitch', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'hitByPitch')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1], playerBase: 1, hits: 0 })
    expect(result.context.announcement).toEqual({ title: '사구!', detail: '1루에 도착했습니다.' })
  })

  it('records a normal strikeout when the catcher secures the ball', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'strikeout')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ title: '삼진 아웃되었습니다.', detail: '아웃 카운트가 올라갔습니다.', tone: 'negative' })
  })

  it('offers distinct fielding and throwing errors for an infield ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'groundOut', { manualChance: true })
    const fieldingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingError', { manualChance: true })
    const throwingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'throwingError', { manualChance: true })

    expect(fielding.nodeId).toBe('ground.infield.check')
    expect(fieldingError.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 0 })
    expect(fieldingError.context.announcement).toEqual({ title: '내야수가 땅볼 포구를 놓쳤습니다!', detail: '실책으로 1루에 출루했습니다.' })
    expect(throwingError.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 0 })
    expect(throwingError.context.announcement).toEqual({ title: '내야 땅볼 송구 실책!', detail: '내야수의 1루 송구가 빗나가 실책으로 출루했습니다.' })
  })

  it('treats a dropped infield fly as a single', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'infieldFly', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'dropped', { manualChance: true })

    expect(fielding.nodeId).toBe('fly.infield.check')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 1 })
    expect(result.context.announcement).toEqual({ title: '내야수가 뜬공을 놓쳤습니다!', detail: '1루타가 되었습니다.' })
  })

  it('applies the infield fly rule with runners on first and second before two outs', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [1, 2]), { manualChance: true })
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'infieldFly', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 2, bases: [1, 2], hits: 0 })
    expect(result.context.records).toContain('인필드 플라이 아웃')
    expect(result.context.announcement).toEqual({ title: '인필드 플라이 선언!', detail: '타자 아웃. 주자는 원래 베이스에 머뭅니다.' })
  })

  it('treats a dropped fly ball as a single', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [2]), { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'flyOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'dropped', { manualChance: true })

    expect(fielding.nodeId).toBe('fly.outfield.check')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1, 3], playerBase: 1, hits: 1 })
    expect(result.context.announcement).toEqual({ title: '외야수가 뜬공을 놓쳤습니다!', detail: '1루타가 되었습니다.' })
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
    expect(result.context.announcement).toEqual({ title: '낫아웃 1루 진루 성공!', detail: '1루에 도착했습니다.', tone: 'positive' })
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

    expect(clear.context.announcement).toEqual({ title: '포수가 공을 뒤로 빠뜨렸습니다!', detail: '완전히 뒤로 빠졌습니다. 열심히 뛴다면 확실히 살 수 있습니다.' })
    expect(ambiguous.context.announcement).toEqual({ title: '포수가 공을 뒤로 빠뜨렸습니다!', detail: '애매하게 빠졌습니다. 열심히 뛴다면 살 수 있을지도 모릅니다.' })
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
    expect(result.context.announcement).toEqual({ title: '1루타 성공!', detail: '1루에 도착했습니다.' })
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
    expect(result.context.announcement).toEqual({ title: '2루 도루 성공!', detail: '2루에 도착했습니다.' })
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
    expect(result.context.announcement).toEqual({ title: '2루 도루 실패', detail: '3아웃 · 공수교대입니다.', tone: 'negative' })
  })

  it('marks a failed steal as a negative transition before three outs', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stealSecond')

    expect(result.context.announcement).toEqual({ title: '2루 도루 실패', detail: '2루에서 아웃되었습니다.', tone: 'negative' })
  })

  it('announces a side change instead of scoring when a follow-up strikeout makes three outs', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.5)
    const initial = startScenario(OFFENSE_CORE_PACK, context(2, [1, 3]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 3, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ title: '후속 타자: 삼진!', detail: '3아웃 · 공수교대입니다.', tone: 'negative' })
  })

  it('continues to a follow-up hit when staying at first', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValue(0.99)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [1, 2], hits: 2, battingEvent: 'single', playerBase: 2 })
    expect(result.context.announcement).toEqual({ title: '후속 타자: 1루타!', detail: '2루에 도착했습니다.' })
  })

  it('ends the play on a force out when a first-base runner faces a follow-up ground ball', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'cleanPlay', { manualChance: true })

    expect(fielding.nodeId).toBe('followUp.ground.check')
    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 1, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ title: '내야 땅볼 포스 아웃!', detail: '선행 주자가 아웃되었습니다.', tone: 'negative' })
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
    const advance = chooseScenarioOption(OFFENSE_CORE_PACK, decision, 'advanceThird', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, advance, 'success', { manualChance: true })

    expect(decision.nodeId).toBe('runner.second.groundOut.decide')
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, decision).map((choice) => choice.id)).toEqual(['staySecond', 'advanceThird'])
    expect(decision.context.announcement).toEqual({ title: '후속 타자: 내야 땅볼, 정상 수비!', detail: '내야수 송구 순간 3루 진루를 시도할 수 있습니다.' })
    expect(advance.nodeId).toBe('runner.second.groundOut.advance')
    const advanceNode = OFFENSE_CORE_PACK.nodes[advance.nodeId]
    expect(advanceNode).toMatchObject({ outcomes: [{ id: 'success', weight: 0.7 }, { id: 'out' }] })
    if (advanceNode.type === 'chance') expect(advanceNode.outcomes[1].weight).toBeCloseTo(0.3)
    expect(result.nodeId).toBe('runner.third.decide')
    expect(result.context).toMatchObject({ bases: [3], playerBase: 3 })
  })

  it('advances every runner one base after either follow-up ground-ball error', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'groundOut', { manualChance: true })
    const fieldingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'fieldingError', { manualChance: true })
    const throwingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'throwingError', { manualChance: true })
    const clearMiss = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwingError, 'clearMiss', { manualChance: true })

    expect(fieldingError.context).toMatchObject({ bases: [1, 2], playerBase: 2, hits: 1 })
    expect(throwingError.nodeId).toBe('followUp.ground.throwingError.check')
    expect(clearMiss.nodeId).toBe('followUp.ground.throwingError.clear.decide')
    expect(clearMiss.context).toMatchObject({ bases: [1, 2], playerBase: 2, hits: 1 })
    expect(clearMiss.context.announcement).toEqual({ title: '후속 타자: 내야 땅볼 송구 실책!', detail: '1루수 뒤로 송구가 완전히 빠졌습니다. 확실하게 추가 진루할 수 있습니다.' })
    expect(getAvailableScenarioChoices(OFFENSE_CORE_PACK, clearMiss).map((choice) => choice.id)).toEqual(['stayOnBase', 'advance'])
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
    expect(result.context.announcement).toEqual({ title: '내야수가 땅볼을 포구 실책했습니다!', detail: '홈에 들어왔습니다.' })
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
    const throwingError = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'throwingError', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, throwingError, 'clearMiss', { manualChance: true })

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ bases: [1], playerBase: null, runs: 1 })
    expect(result.context.announcement).toEqual({ title: '후속 타자: 내야 땅볼 송구 실책!', detail: '홈에 들어왔습니다.' })
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
    expect(result.context.announcement).toEqual({ title: '후속 타자 타구 외야수 실책 추가 진루 성공!', detail: '외야수 실책을 이용해 다음 베이스에 도착했습니다.' })
  })

  it('includes the follow-up hit in the outfield error announcement', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(), { manualChance: true })
    const firstFielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single', { manualChance: true })
    const runner = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, firstFielding, 'normalFielding', { manualChance: true })
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const followUp = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, wildPitch, 'normalPitch', { manualChance: true })
    const fielding = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'double', { manualChance: true })
    const result = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, fielding, 'ambiguousDrop', { manualChance: true })

    expect(result.context.announcement).toEqual({ title: '후속 타자: 2루타! 외야수가 타구를 뒤로 빠뜨렸습니다.', detail: '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.', tone: 'caution' })
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
    expect(result.context.announcement).toEqual({ title: '후속 타자 타구 외야수 실책 추가 진루 성공!', detail: '홈에 들어왔습니다.' })
  })

  it('reports that the runner stayed put after a follow-up strikeout', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.5)
    const initial = startScenario(OFFENSE_CORE_PACK, context(1, [1, 2]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ outs: 2, bases: [1, 2, 3], playerBase: 1 })
    expect(result.context.announcement).toEqual({ title: '후속 타자: 삼진!', detail: '1루에서 움직이지 못했습니다.' })
    expect(result.context.records).toContain('후속 타자 삼진')
    expect(result.context.completionRecords).not.toContain('후속 타자 삼진')
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
  })

  it('updates the announcement after staying at first on an outfield error', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'stayFirst')

    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context.announcement).toEqual({ title: '외야수 실책이 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative' })
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
    expect(advance.context.announcement).toEqual({ title: '2루 진루 성공!', detail: '외야수 실책을 이용해 2루에 도착했습니다.' })
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
    expect(result.context.announcement).toEqual({ title: '후속 타자: 삼진!', detail: '1루에서 움직이지 못했습니다.' })
  })

  it('uses a 70 percent chance for an ambiguous outfield drop advance', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.15).mockReturnValueOnce(0.69)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'advanceSecond')

    expect(single.nodeId).toBe('runner.first.ambiguousDrop.decide')
    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context.announcement).toEqual({ title: '2루 진루 성공!', detail: '위험을 감수하고 추가 진루에 성공했습니다.', tone: 'positive' })
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
    expect(result.context.announcement).toEqual({ title: '폭투 진루 성공!', detail: '다음 베이스에 도착했습니다.' })
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

  it('returns to the runner decision after staying on base during a wild pitch', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const wildPitch = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, wildPitch, 'stayOnBase')

    expect(wildPitch.nodeId).toBe('runner.wildPitch.clear.decide')
    expect(result.nodeId).toBe('runner.first.decide')
    expect(result.context).toMatchObject({ bases: [1], playerBase: 1 })
    expect(result.context.announcement).toEqual({ title: '폭투가 나왔지만 진루하지 않았습니다.', detail: '명백히 진루 가능한 찬스를 놓쳤습니다.', tone: 'negative' })
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
