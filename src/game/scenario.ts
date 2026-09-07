import type { BattingEventId, BattingMode } from './battingEvents'

export type ScenarioNodeId = string
export type ScenarioView = 'batter' | 'runner:first' | 'runner:second' | 'runner:third' | 'result'

export type ScenarioCondition =
  | { field: 'outs'; operator: 'eq' | 'lt' | 'gte'; value: number }
  | { field: 'bases'; operator: 'empty' | 'includes' | 'excludes' | 'equals'; value?: number[] }
  | { field: 'battingEvent'; operator: 'eq' | 'in'; value: BattingEventId | BattingEventId[] }
  | { field: 'playerBase'; operator: 'eq'; value: number | null }
  | { field: 'flag'; operator: 'eq'; key: string; value: boolean | number | string }

export type ScenarioEffect =
  | { type: 'addOuts'; value: number }
  | { type: 'addRuns'; value: number }
  | { type: 'addHits'; value: number }
  | { type: 'setBases'; value: number[] }
  | { type: 'placeRunner'; base: number }
  | { type: 'applyHit'; batterTo: number; creditHit: boolean }
  | { type: 'forceWalk'; creditHit?: boolean }
  | { type: 'scoreAll'; creditHit: boolean }
  | { type: 'applyBattingEvent' }
  | { type: 'setPlayerBase'; value: number | null }
  | { type: 'announce'; title: string; detail: string }
  | { type: 'moveRunner'; from: number; to: number | 'home' | 'out' }
  | { type: 'setFlag'; key: string; value: boolean | number | string }
  | { type: 'record'; message: string }

export type ScenarioTransition = {
  to: ScenarioNodeId
  when?: ScenarioCondition[]
  effects?: ScenarioEffect[]
}

type ScenarioNodeBase = {
  id: ScenarioNodeId
  view: ScenarioView
  title: string
  description?: string
  tags?: string[]
}

export type BattingNode = ScenarioNodeBase & {
  type: 'batting'
  mode: BattingMode
  eventIds: BattingEventId[]
  routes: ScenarioTransition[]
}

export type ChoiceNode = ScenarioNodeBase & {
  type: 'choice'
  choices: Array<{
    id: string
    label: string
    description?: string
    when?: ScenarioCondition[]
    transition: ScenarioTransition
  }>
}

export type ChanceNode = ScenarioNodeBase & {
  type: 'chance'
  outcomes: Array<{
    id: string
    weight: number
    transition: ScenarioTransition
  }>
}

export type EventNode = ScenarioNodeBase & {
  type: 'event'
  effects: ScenarioEffect[]
  transition: ScenarioTransition
}

export type RouterNode = ScenarioNodeBase & {
  type: 'router'
  routes: ScenarioTransition[]
}

export type TerminalNode = ScenarioNodeBase & {
  type: 'terminal'
  result: 'plateComplete' | 'gameComplete'
  effects?: ScenarioEffect[]
}

export type ScenarioNode = BattingNode | ChoiceNode | ChanceNode | EventNode | RouterNode | TerminalNode

export type ScenarioPack = {
  id: string
  version: number
  entryNodeId: ScenarioNodeId
  nodes: Record<ScenarioNodeId, ScenarioNode>
}

export type ScenarioContext = {
  outs: number
  bases: number[]
  runs: number
  hits: number
  battingEvent?: BattingEventId
  flags: Record<string, boolean | number | string>
  records: string[]
  selectedLabel?: string
  playerBase: number | null
  announcement?: ScenarioAnnouncement
}

export type ScenarioAnnouncement = {
  title: string
  detail: string
}

export type ScenarioState = {
  nodeId: ScenarioNodeId
  context: ScenarioContext
}

const transitionsOf = (node: ScenarioNode): ScenarioTransition[] => {
  if (node.type === 'batting') return node.routes
  if (node.type === 'choice') return node.choices.map((choice) => choice.transition)
  if (node.type === 'chance') return node.outcomes.map((outcome) => outcome.transition)
  if (node.type === 'event') return [node.transition]
  if (node.type === 'router') return node.routes
  return []
}

export const validateScenarioPack = (pack: ScenarioPack): string[] => {
  const errors: string[] = []
  const nodes = Object.values(pack.nodes)

  if (!pack.nodes[pack.entryNodeId]) errors.push(`시작 노드가 없습니다: ${pack.entryNodeId}`)

  for (const [key, node] of Object.entries(pack.nodes)) {
    if (key !== node.id) errors.push(`노드 키와 id가 다릅니다: ${key} != ${node.id}`)
    for (const transition of transitionsOf(node)) {
      if (!pack.nodes[transition.to]) errors.push(`${node.id}가 없는 노드를 가리킵니다: ${transition.to}`)
    }
    if (node.type === 'chance' && node.outcomes.some((outcome) => outcome.weight <= 0)) {
      errors.push(`${node.id}의 확률 가중치는 0보다 커야 합니다.`)
    }
    if (node.type === 'choice' && new Set(node.choices.map((choice) => choice.id)).size !== node.choices.length) {
      errors.push(`${node.id}에 중복된 선택지 id가 있습니다.`)
    }
  }

  if (!nodes.some((node) => node.type === 'terminal')) errors.push('종료 노드가 하나 이상 필요합니다.')

  const reachable = new Set<ScenarioNodeId>()
  const pending = pack.nodes[pack.entryNodeId] ? [pack.entryNodeId] : []
  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (reachable.has(nodeId)) continue
    reachable.add(nodeId)
    for (const transition of transitionsOf(pack.nodes[nodeId])) pending.push(transition.to)
  }
  for (const node of nodes) {
    if (!reachable.has(node.id)) errors.push(`시작 노드에서 도달할 수 없습니다: ${node.id}`)
  }

  const terminationMemo = new Map<ScenarioNodeId, boolean>()
  const reachesTerminal = (nodeId: ScenarioNodeId, visiting = new Set<ScenarioNodeId>()): boolean => {
    const cached = terminationMemo.get(nodeId)
    if (cached !== undefined) return cached
    if (visiting.has(nodeId)) return pack.nodes[nodeId]?.tags?.includes('bounded-loop') ?? false
    const node = pack.nodes[nodeId]
    if (!node) return false
    if (node.type === 'terminal') return true
    const transitions = transitionsOf(node)
    if (transitions.length === 0) return false
    const nextVisiting = new Set(visiting).add(nodeId)
    const result = transitions.every((transition) => reachesTerminal(transition.to, nextVisiting))
    terminationMemo.set(nodeId, result)
    return result
  }

  if (pack.nodes[pack.entryNodeId] && !reachesTerminal(pack.entryNodeId)) {
    errors.push('시작 노드의 모든 경로가 종료 노드에 도달해야 합니다.')
  }

  return errors
}