import { describe, expect, it } from 'vitest'
import { SCENARIO_TEXT, formatCurrentPlayerText, formatScenarioAdvanceFailureText, formatScenarioText } from './scenarioText'

describe('scenario text', () => {
  it('formats the next destination for runner choices', () => {
    expect(formatScenarioText(SCENARIO_TEXT.advanceChoice, 1)).toBe('2루로 진루한다')
    expect(formatScenarioText(SCENARIO_TEXT.advanceChoice, 2)).toBe('3루로 진루한다')
    expect(formatScenarioText(SCENARIO_TEXT.advanceChoice, 3)).toBe('홈으로 진루한다')
  })

  it('formats the current base for arrival announcements', () => {
    expect(formatCurrentPlayerText(SCENARIO_TEXT.advanceArrival, 2)).toBe('2루에 안전하게 도착했습니다.')
    expect(formatCurrentPlayerText(SCENARIO_TEXT.advanceArrival, 3)).toBe('3루에 안전하게 도착했습니다.')
    expect(formatCurrentPlayerText(SCENARIO_TEXT.advanceArrival, null)).toBe('홈에 안전하게 도착했습니다.')
  })

  it('formats the next destination for advance failures', () => {
    expect(formatScenarioAdvanceFailureText(SCENARIO_TEXT.defense.nextBaseOut, 1)).toBe('2루에서 아웃되었습니다.')
    expect(formatScenarioAdvanceFailureText(SCENARIO_TEXT.defense.nextBaseOut, 2)).toBe('3루에서 아웃되었습니다.')
    expect(formatScenarioAdvanceFailureText(SCENARIO_TEXT.defense.nextBaseOut, 3)).toBe('홈에서 아웃되었습니다.')
  })
})
