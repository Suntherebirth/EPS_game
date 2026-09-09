import { BATTING_EVENTS } from './battingEvents'
import { BASE_COMBINATIONS, createScenarioContext, describeSituation, type Base, type Situation } from './gameSetup'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
import type { ScenarioAnnouncement, ScenarioAnnouncementHistoryEntry, ScenarioState } from './scenario'
import { chooseScenarioChanceOutcome, chooseScenarioOption, getAvailableScenarioChoices, selectScenarioBattingEvent, startScenario } from './scenarioEngine'

export type AnnouncementAuditMessage = ScenarioAnnouncement & {
  category: ScenarioAnnouncementHistoryEntry['category']
}

export type AnnouncementAuditStep = {
  type: 'batting' | 'choice' | 'chance'
  id: string
  label: string
}

export type AnnouncementAuditCase = {
  id: string
  messages: AnnouncementAuditMessage[]
  situation: string
  viewLabel: string
  nodeId: string
  nodeTitle: string
  actionLabel: string
  outs: number
  bases: Base[]
  playerBase: number | null
  isSurprise: boolean
  start: Situation
  steps: AnnouncementAuditStep[]
}

type QueueItem = {
  state: ScenarioState
  actionLabel: string
  start: Situation
  steps: AnnouncementAuditStep[]
}

const toBases = (bases: number[]): Base[] => bases.filter((base): base is Base => base === 1 || base === 2 || base === 3).sort((a, b) => a - b)

const getViewBase = (state: ScenarioState) => {
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  if (!node) return null
  if (node.tags?.includes('player-position-view')) return state.context.playerBase
  if (node.view === 'runner:first') return 1
  if (node.view === 'runner:second') return 2
  if (node.view === 'runner:third') return 3
  return null
}

const getViewLabel = (state: ScenarioState) => {
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  const viewBase = getViewBase(state)
  if (viewBase) return `${viewBase}루 주자 시점`
  if (node?.view === 'batter') return '타석 시점'
  return '결과 화면'
}

const getMessages = (state: ScenarioState): AnnouncementAuditMessage[] => {
  if (!state.context.announcement) return []
  return [
    ...state.context.announcementHistory.map((entry) => ({ ...entry.announcement, category: entry.category })),
    { ...state.context.announcement, category: state.context.announcementCategory },
  ]
}

const stateKey = (state: ScenarioState) => [
  state.nodeId,
  state.context.outs,
  toBases(state.context.bases).join(','),
  state.context.playerBase ?? 'none',
  state.context.battingEvent ?? 'none',
  state.context.flags.groundAdvanceIntent ?? 'none',
  state.context.flags.groundThrowMiss ?? 'none',
  state.context.flags.advancedByFollowUpHit ?? 'none',
  state.context.flags.droppedStrikeRun ?? 'none',
].join('|')

const caseKey = (state: ScenarioState, messages: AnnouncementAuditMessage[]) => [
  messages.map((message) => [message.title, message.detail, message.tone ?? 'neutral', message.category].join('~')).join('>'),
  getViewLabel(state),
  state.context.outs >= 3 ? 'three-outs' : `${state.context.outs}-outs`,
  state.context.playerBase ?? 'none',
  toBases(state.context.bases).join(','),
].join('|')

const collectCase = ({ state, actionLabel, start, steps }: QueueItem): AnnouncementAuditCase | null => {
  const messages = getMessages(state)
  if (messages.length === 0) return null
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  const bases = toBases(state.context.bases)
  const situation: Situation = { outs: state.context.outs, bases }
  return {
    id: caseKey(state, messages),
    messages,
    situation: describeSituation(situation),
    viewLabel: getViewLabel(state),
    nodeId: state.nodeId,
    nodeTitle: node?.title ?? state.nodeId,
    actionLabel,
    outs: state.context.outs,
    bases,
    playerBase: state.context.playerBase,
    isSurprise: messages.some((message) => message.category === 'surprise'),
    start,
    steps,
  }
}

const getNextItems = (item: QueueItem): QueueItem[] => {
  const { state, start, steps } = item
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  if (!node || node.type === 'terminal') return []
  if (node.type === 'batting') {
    return BATTING_EVENTS
      .filter((event) => node.eventIds.includes(event.kind))
      .map((event) => ({
        actionLabel: `${node.title} · ${event.label}`,
        state: selectScenarioBattingEvent(OFFENSE_CORE_PACK, state, event.kind, { manualChance: true }),
        start,
        steps: [...steps, { type: 'batting' as const, id: event.kind, label: `${node.title} · ${event.label}` }],
      }))
  }
  if (node.type === 'choice') {
    return getAvailableScenarioChoices(OFFENSE_CORE_PACK, state).map((choice) => ({
      actionLabel: `${node.title} · ${choice.label}`,
      state: chooseScenarioOption(OFFENSE_CORE_PACK, state, choice.id, { manualChance: true }),
      start,
      steps: [...steps, { type: 'choice' as const, id: choice.id, label: `${node.title} · ${choice.label}` }],
    }))
  }
  if (node.type === 'chance') {
    return node.outcomes.map((outcome) => ({
      actionLabel: `${node.title} · ${outcome.label ?? outcome.id}`,
      state: chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, state, outcome.id, { manualChance: true }),
      start,
      steps: [...steps, { type: 'chance' as const, id: outcome.id, label: `${node.title} · ${outcome.label ?? outcome.id}` }],
    }))
  }
  return []
}

export type AnnouncementReplayOption = {
  id: string
  label: string
  description?: string
  kind: 'batting' | 'choice' | 'chance'
  chosen: boolean
}

export type AnnouncementReplayFrame = {
  stepIndex: number
  label: string
  state: ScenarioState
  options: AnnouncementReplayOption[]
}

const getReplayOptions = (state: ScenarioState, chosen?: AnnouncementAuditStep): AnnouncementReplayOption[] => {
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  if (!node) return []
  if (node.type === 'batting') {
    return BATTING_EVENTS
      .filter((event) => node.eventIds.includes(event.kind))
      .map((event) => ({ id: event.kind, label: event.label, description: event.description, kind: 'batting' as const, chosen: chosen?.type === 'batting' && chosen.id === event.kind }))
  }
  if (node.type === 'choice') {
    return getAvailableScenarioChoices(OFFENSE_CORE_PACK, state).map((choice) => ({ id: choice.id, label: choice.label, ...(choice.description ? { description: choice.description } : {}), kind: 'choice' as const, chosen: chosen?.type === 'choice' && chosen.id === choice.id }))
  }
  if (node.type === 'chance') {
    return node.outcomes.map((outcome) => ({ id: outcome.id, label: outcome.label ?? outcome.id, description: `확률 ${Math.round(outcome.weight * 100)}%`, kind: 'chance' as const, chosen: chosen?.type === 'chance' && chosen.id === outcome.id }))
  }
  return []
}

export const replayAnnouncementCase = (item: AnnouncementAuditCase): AnnouncementReplayFrame[] => {
  const frames: AnnouncementReplayFrame[] = []
  let state = startScenario(OFFENSE_CORE_PACK, createScenarioContext(item.start), { manualChance: true })
  frames.push({ stepIndex: 0, label: `시작 · ${describeSituation(item.start)}`, state, options: getReplayOptions(state, item.steps[0]) })
  item.steps.forEach((step, index) => {
    if (step.type === 'batting') state = selectScenarioBattingEvent(OFFENSE_CORE_PACK, state, step.id as never, { manualChance: true })
    else if (step.type === 'choice') state = chooseScenarioOption(OFFENSE_CORE_PACK, state, step.id, { manualChance: true })
    else state = chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, state, step.id, { manualChance: true })
    frames.push({ stepIndex: index + 1, label: step.label, state, options: getReplayOptions(state, item.steps[index + 1]) })
  })
  return frames
}

export const findMatchingCaseId = (state: ScenarioState): string | null => {
  const messages = getMessages(state)
  if (messages.length === 0) return null
  return caseKey(state, messages)
}

export const createAnnouncementAuditCases = (): AnnouncementAuditCase[] => {
  const seenStates = new Set<string>()
  const cases = new Map<string, AnnouncementAuditCase>()
  const queue: QueueItem[] = []

  for (const outs of [0, 1, 2]) {
    for (const bases of BASE_COMBINATIONS) {
      const situation = { outs, bases: [...bases] }
      queue.push({
        state: startScenario(OFFENSE_CORE_PACK, createScenarioContext(situation), { manualChance: true }),
        actionLabel: describeSituation(situation),
        start: situation,
        steps: [],
      })
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()!
    const auditCase = collectCase(item)
    if (auditCase && !cases.has(auditCase.id)) cases.set(auditCase.id, auditCase)

    const key = stateKey(item.state)
    if (seenStates.has(key)) continue
    seenStates.add(key)

    queue.push(...getNextItems(item))
  }

  return [...cases.values()].sort((left, right) => {
    if (left.isSurprise !== right.isSurprise) return left.isSurprise ? -1 : 1
    if (left.outs !== right.outs) return left.outs - right.outs
    return left.viewLabel.localeCompare(right.viewLabel, 'ko') || left.messages.at(-1)!.title.localeCompare(right.messages.at(-1)!.title, 'ko')
  })
}