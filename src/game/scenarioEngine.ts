import { BATTING_EVENTS } from './battingEvents'
import { applyScenarioEffect } from './scenarioEffects'
import type {
  BattingNode,
  ScenarioCondition,
  ScenarioContext,
  ScenarioPack,
  ScenarioState,
  ScenarioTransition,
} from './scenario'

export type ScenarioExecutionOptions = {
  manualChance?: boolean
}

const matchesCondition = (context: ScenarioContext, condition: ScenarioCondition): boolean => {
  if (condition.field === 'outs') {
    if (condition.operator === 'eq') return context.outs === condition.value
    if (condition.operator === 'lt') return context.outs < condition.value
    return context.outs >= condition.value
  }
  if (condition.field === 'bases') {
    if (condition.operator === 'empty') return context.bases.length === 0
    if (condition.operator === 'includes') return (condition.value ?? []).every((base) => context.bases.includes(base))
    if (condition.operator === 'excludes') return (condition.value ?? []).every((base) => !context.bases.includes(base))
    return [...context.bases].sort().join(',') === [...(condition.value ?? [])].sort().join(',')
  }
  if (condition.field === 'battingEvent') {
    return condition.operator === 'eq'
      ? context.battingEvent === condition.value
      : (condition.value as string[]).includes(context.battingEvent ?? '')
  }
  if (condition.field === 'playerBase') return context.playerBase === condition.value
  return context.flags[condition.key] === condition.value
}

const getNodeViewLabel = (pack: ScenarioPack, nodeId: string, context: ScenarioContext) => {
  const node = pack.nodes[nodeId]
  if (!node) return undefined
  if (node.tags?.includes('player-position-view') && context.playerBase) return `${context.playerBase}루 주자 시점`
  if (node.view === 'runner:first') return '1루 주자 시점'
  if (node.view === 'runner:second') return '2루 주자 시점'
  if (node.view === 'runner:third') return '3루 주자 시점'
  if (node.view === 'batter') return '타석 시점'
  return '결과 화면'
}

const applyEffects = (pack: ScenarioPack, state: ScenarioState, effects: ScenarioTransition['effects'] = []) => {
  const viewLabel = getNodeViewLabel(pack, state.nodeId, state.context)
  return effects.reduce((context, effect) => applyScenarioEffect(context, effect, viewLabel), state.context)
}

const applyTransition = (pack: ScenarioPack, state: ScenarioState, transition: ScenarioTransition): ScenarioState => {
  const sourceIsSurprise = pack.nodes[state.nodeId]?.tags?.includes('surprise-event') ?? false
  const targetIsSurprise = pack.nodes[transition.to]?.tags?.includes('surprise-event') ?? false
  const context = {
    ...state.context,
    flags: { ...state.context.flags, surpriseEvent: sourceIsSurprise || targetIsSurprise },
  }
  return {
    nodeId: transition.to,
    context: applyEffects(pack, { ...state, context }, transition.effects),
  }
}

const beginUserAction = (state: ScenarioState, preserveAnnouncement = false): ScenarioState => ({
  ...state,
  context: {
    ...state.context,
    flags: { ...state.context.flags, surpriseEvent: false },
    ...(preserveAnnouncement ? {} : { announcement: undefined, announcementHistory: [], announcementCategory: 'normal' as const }),
  },
})

const pickWeighted = <T extends { weight: number }>(items: T[]): T => {
  let roll = Math.random() * items.reduce((sum, item) => sum + item.weight, 0)
  return items.find((item) => (roll -= item.weight) <= 0) ?? items[0]
}

const resolveBattingNode = (node: BattingNode, context: ScenarioContext) => {
  const events = BATTING_EVENTS.filter((event) => node.eventIds.includes(event.kind))
  const selected = pickWeighted(events.map((event) => ({ event, weight: event.randomWeight }))).event
  const nextContext = { ...context, battingEvent: selected.kind, selectedLabel: context.selectedLabel ?? selected.label }
  const route = node.routes.find((item) => (item.when ?? []).every((condition) => matchesCondition(nextContext, condition)))
  if (!route) throw new Error(`${node.id}에 ${selected.kind} 결과를 처리할 경로가 없습니다.`)
  return { route, context: nextContext }
}

export const settleScenario = (pack: ScenarioPack, initialState: ScenarioState, options: ScenarioExecutionOptions = {}): ScenarioState => {
  let state = initialState
  for (let step = 0; step < 100; step += 1) {
    const node = pack.nodes[state.nodeId]
    if (!node) throw new Error(`시나리오 노드를 찾을 수 없습니다: ${state.nodeId}`)
    if ((node.type === 'choice' || node.type === 'chance') && node.tags?.includes('player-position-view') && state.context.playerBase === null && pack.nodes['runner.route']) {
      state = { ...state, nodeId: 'runner.route' }
      continue
    }
    if (node.type === 'choice' || node.type === 'terminal' || (node.type === 'batting' && (node.mode === 'direct' || options.manualChance)) || (node.type === 'chance' && options.manualChance)) return state
    if (node.type === 'event') state = applyTransition(pack, { ...state, context: applyEffects(pack, state, node.effects) }, node.transition)
    if (node.type === 'chance') state = applyTransition(pack, state, pickWeighted(node.outcomes).transition)
    if (node.type === 'router') {
      const route = node.routes.find((item) => (item.when ?? []).every((condition) => matchesCondition(state.context, condition)))
      if (!route) throw new Error(`${node.id}에서 현재 상태를 처리할 경로가 없습니다.`)
      state = applyTransition(pack, state, route)
    }
    if (node.type === 'batting') {
      const resolved = resolveBattingNode(node, state.context)
      state = applyTransition(pack, { ...state, context: resolved.context }, resolved.route)
    }
  }
  throw new Error('시나리오가 100단계 안에 대기 또는 종료 노드에 도달하지 못했습니다.')
}

export const startScenario = (pack: ScenarioPack, context: ScenarioContext, options?: ScenarioExecutionOptions): ScenarioState =>
  settleScenario(pack, { nodeId: pack.entryNodeId, context }, options)

export const chooseScenarioOption = (pack: ScenarioPack, state: ScenarioState, choiceId: string, options?: ScenarioExecutionOptions): ScenarioState => {
  const node = pack.nodes[state.nodeId]
  if (node?.type !== 'choice') throw new Error(`선택 노드가 아닙니다: ${state.nodeId}`)
  const choice = node.choices.find((item) => item.id === choiceId)
  if (!choice) throw new Error(`선택지를 찾을 수 없습니다: ${choiceId}`)
  if (!(choice.when ?? []).every((condition) => matchesCondition(state.context, condition))) {
    throw new Error(`현재 상황에서 선택할 수 없습니다: ${choiceId}`)
  }
  return settleScenario(pack, applyTransition(pack, beginUserAction(state), choice.transition), options)
}

export const chooseScenarioChanceOutcome = (pack: ScenarioPack, state: ScenarioState, outcomeId: string, options?: ScenarioExecutionOptions): ScenarioState => {
  const node = pack.nodes[state.nodeId]
  if (node?.type !== 'chance') throw new Error(`확률 노드가 아닙니다: ${state.nodeId}`)
  const outcome = node.outcomes.find((item) => item.id === outcomeId)
  if (!outcome) throw new Error(`확률 결과를 찾을 수 없습니다: ${outcomeId}`)
  const preserveAnnouncement = node.tags?.includes('composite-event-step') ?? false
  return settleScenario(pack, applyTransition(pack, beginUserAction(state, preserveAnnouncement), outcome.transition), options)
}

export const getAvailableScenarioChoices = (pack: ScenarioPack, state: ScenarioState) => {
  const node = pack.nodes[state.nodeId]
  if (node?.type !== 'choice') return []
  return node.choices.filter((choice) => (choice.when ?? []).every((condition) => matchesCondition(state.context, condition)))
}

export const selectScenarioBattingEvent = (pack: ScenarioPack, state: ScenarioState, eventId: string, options?: ScenarioExecutionOptions): ScenarioState => {
  const node = pack.nodes[state.nodeId]
  if (node?.type !== 'batting' || (node.mode !== 'direct' && !options?.manualChance)) throw new Error(`타격 결과 선택 노드가 아닙니다: ${state.nodeId}`)
  if (!node.eventIds.includes(eventId as never)) throw new Error(`허용되지 않은 타격 이벤트입니다: ${eventId}`)
  const event = BATTING_EVENTS.find((item) => item.kind === eventId)
  if (!event) throw new Error(`타격 이벤트를 찾을 수 없습니다: ${eventId}`)
  const actionState = beginUserAction(state)
  const context = { ...actionState.context, battingEvent: event.kind, selectedLabel: event.label }
  const route = node.routes.find((item) => (item.when ?? []).every((condition) => matchesCondition(context, condition)))
  if (!route) throw new Error(`${node.id}에 ${eventId} 결과를 처리할 경로가 없습니다.`)
  return settleScenario(pack, applyTransition(pack, { ...actionState, context }, route), options)
}