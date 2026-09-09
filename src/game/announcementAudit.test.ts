import { describe, expect, it } from 'vitest'
import { createAnnouncementAuditCases } from './announcementAudit'
import { createScenarioContext } from './gameSetup'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
import { chooseScenarioChanceOutcome, chooseScenarioOption, selectScenarioBattingEvent, startScenario } from './scenarioEngine'

describe('announcement audit cases', () => {
  it('collects a bounded set of announcement flows', () => {
    const cases = createAnnouncementAuditCases()
    expect(cases.length).toBeGreaterThan(50)
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length)
  })

  it('replays every stored path to the same announcement flow', () => {
    const cases = createAnnouncementAuditCases()

    for (const item of cases) {
      let state = startScenario(OFFENSE_CORE_PACK, createScenarioContext(item.start), { manualChance: true })
      for (const step of item.steps) {
        if (step.type === 'batting') state = selectScenarioBattingEvent(OFFENSE_CORE_PACK, state, step.id, { manualChance: true })
        else if (step.type === 'choice') state = chooseScenarioOption(OFFENSE_CORE_PACK, state, step.id, { manualChance: true })
        else state = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, state, step.id, { manualChance: true })
      }

      const messages = [
        ...state.context.announcementHistory.map((entry) => entry.announcement),
        ...(state.context.announcement ? [state.context.announcement] : []),
      ]
      expect(messages.map((message) => [message.title, message.detail])).toEqual(item.messages.map((message) => [message.title, message.detail]))
    }
  })
})
