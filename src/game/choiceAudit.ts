import { BATTING_EVENTS } from './battingEvents'
import { BASE_COMBINATIONS, createScenarioContext, describeSituation, type Base, type Situation } from './gameSetup'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
import type { ScenarioState } from './scenario'
import { chooseScenarioChanceOutcome, chooseScenarioOption, getAvailableScenarioChoices, selectScenarioBattingEvent, startScenario } from './scenarioEngine'

export type ChoiceAuditActionKind = 'batting' | 'choice' | 'chance'

export type ChoiceAuditStep = {
  kind: ChoiceAuditActionKind
  id: string
  label: string
}

export type ChoiceAuditCase = {
  id: string
  nodeId: string
  nodeTitle: string
  nodeType: ChoiceAuditActionKind
  situation: string
  actions: ChoiceAuditStep[]
  start: Situation
  steps: ChoiceAuditStep[]
}

type QueueItem = {
  state: ScenarioState
  start: Situation
  steps: ChoiceAuditStep[]
}

const toBases = (bases: number[]): Base[] => bases.filter((base): base is Base => base === 1 || base === 2 || base === 3).sort((left, right) => left - right)

const contextKey = (state: ScenarioState) => [
  state.context.outs,
  toBases(state.context.bases).join(','),
  state.context.playerBase ?? 'none',
  state.context.battingEvent ?? 'none',
  Object.entries(state.context.flags).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join(','),
].join('|')

const branchActionsKey = (state: ScenarioState) =>
  getActions(state).map((action) => action.id).sort().join(',')

export const getChoiceBranchAuditCaseId = (state: ScenarioState) => {
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  if (!node) return ''
  const basesKey = toBases(state.context.bases).join(',')
  const playerBaseKey = state.context.playerBase ?? 'none'
  const actionsKey = branchActionsKey(state)
  return `${OFFENSE_CORE_PACK.id}:v${OFFENSE_CORE_PACK.version}:${state.nodeId}:outs=${state.context.outs}:bases=${basesKey}:playerBase=${playerBaseKey}:actions=${actionsKey}`
}

const getActions = (state: ScenarioState): ChoiceAuditStep[] => {
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  if (!node) return []
  if (node.type === 'batting') {
    return BATTING_EVENTS
      .filter((event) => node.eventIds.includes(event.kind))
      .map((event) => ({ kind: 'batting' as const, id: event.kind, label: event.label }))
  }
  if (node.type === 'choice') {
    return getAvailableScenarioChoices(OFFENSE_CORE_PACK, state)
      .map((choice) => ({ kind: 'choice' as const, id: choice.id, label: choice.label }))
  }
  if (node.type === 'chance') {
    return node.outcomes.map((outcome) => ({ kind: 'chance' as const, id: outcome.id, label: outcome.label ?? outcome.id }))
  }
  return []
}

const applyAction = (state: ScenarioState, action: ChoiceAuditStep): ScenarioState => {
  if (action.kind === 'batting') return selectScenarioBattingEvent(OFFENSE_CORE_PACK, state, action.id as never, { manualChance: true })
  if (action.kind === 'choice') return chooseScenarioOption(OFFENSE_CORE_PACK, state, action.id, { manualChance: true })
  return chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, state, action.id, { manualChance: true })
}

export const replayChoiceAuditCase = (item: ChoiceAuditCase): ScenarioState => {
  let state = startScenario(OFFENSE_CORE_PACK, createScenarioContext(item.start), { manualChance: true })
  for (const step of item.steps) state = applyAction(state, step)
  return state
}

export const createChoiceAuditCases = (): ChoiceAuditCase[] => {
  const seenStates = new Set<string>()
  const cases = new Map<string, ChoiceAuditCase>()
  const queue: QueueItem[] = []

  for (const outs of [0, 1, 2]) {
    for (const bases of BASE_COMBINATIONS) {
      const start = { outs, bases: [...bases] }
      queue.push({ state: startScenario(OFFENSE_CORE_PACK, createScenarioContext(start), { manualChance: true }), start, steps: [] })
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()!
    const node = OFFENSE_CORE_PACK.nodes[item.state.nodeId]
    if (!node) continue
    const actions = getActions(item.state)
    if (actions.length > 0) {
      const branchId = getChoiceBranchAuditCaseId(item.state)
      if (!cases.has(branchId)) {
        cases.set(branchId, {
          id: branchId,
          nodeId: node.id,
          nodeTitle: node.title,
          nodeType: node.type as ChoiceAuditActionKind,
          situation: describeSituation({ outs: item.state.context.outs, bases: toBases(item.state.context.bases) }),
          actions,
          start: item.start,
          steps: item.steps,
        })
      }
    }

    const stateKey = `${item.state.nodeId}:${contextKey(item.state)}`
    if (seenStates.has(stateKey)) continue
    seenStates.add(stateKey)
    queue.push(...actions.map((action) => ({ state: applyAction(item.state, action), start: item.start, steps: [...item.steps, action] })))
  }

  return [...cases.values()].sort((left, right) => left.nodeTitle.localeCompare(right.nodeTitle, 'ko') || left.situation.localeCompare(right.situation, 'ko'))
}