import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
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
    expect(result.context).toMatchObject({ bases: [], runs: 4, hits: 1 })
  })

  it('forces occupied runners on a walk', () => {
    const initial = startScenario(OFFENSE_CORE_PACK, context(0, [1, 2, 3]))
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'walk')

    expect(result.context).toMatchObject({ bases: [1, 2, 3], runs: 1, hits: 0 })
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
    expect(result.context.announcement).toEqual({ title: '2루 도루 실패', detail: '3아웃 · 공수교대입니다.' })
  })

  it('announces a side change instead of scoring when a follow-up strikeout makes three outs', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.5)
    const initial = startScenario(OFFENSE_CORE_PACK, context(2, [1, 3]))
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('plate.complete')
    expect(result.context).toMatchObject({ outs: 3, bases: [], playerBase: null })
    expect(result.context.announcement).toEqual({ title: '후속 타자: 삼진!', detail: '3아웃 · 공수교대입니다.' })
  })

  it('continues to a follow-up hit when staying at first', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0)
    const initial = startScenario(OFFENSE_CORE_PACK, context())
    const single = selectScenarioBattingEvent(OFFENSE_CORE_PACK, initial, 'single')
    const result = chooseScenarioOption(OFFENSE_CORE_PACK, single, 'waitForBatter')

    expect(result.nodeId).toBe('runner.second.decide')
    expect(result.context).toMatchObject({ bases: [1, 2], hits: 2, battingEvent: 'single', playerBase: 2 })
    expect(result.context.announcement).toEqual({ title: '후속 타자: 1루타!', detail: '2루에 도착했습니다.' })
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
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.25)
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
    const followUp = chooseScenarioOption(OFFENSE_CORE_PACK, runner, 'waitForBatter', { manualChance: true })
    const result = selectScenarioBattingEvent(OFFENSE_CORE_PACK, followUp, 'strikeout', { manualChance: true })

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
    expect(result.context.announcement).toEqual({ title: '2루 진루 성공!', detail: '외야수가 공을 수습하기 전에 2루에 도착했습니다.' })
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
