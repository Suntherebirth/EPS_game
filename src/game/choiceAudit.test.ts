import { describe, expect, it } from 'vitest'
import { createChoiceAuditCases, replayChoiceAuditCase } from './choiceAudit'

describe('choice audit cases', () => {
  it('collects every reachable decision branch as a uniquely identified case', () => {
    const cases = createChoiceAuditCases()

    expect(cases.length).toBeGreaterThan(20)
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length)
    expect(cases.some((item) => item.nodeId === 'batting.select' && item.actions.some((a) => a.id === 'single'))).toBe(true)
    expect(cases.some((item) => item.nodeId === 'runner.first.decide' && item.actions.some((a) => a.id === 'stealSecond'))).toBe(true)
  })

  it('replays each stored path to the decision branch node', () => {
    for (const item of createChoiceAuditCases()) {
      const state = replayChoiceAuditCase(item)
      expect(state.nodeId).toBe(item.nodeId)
    }
  })
})