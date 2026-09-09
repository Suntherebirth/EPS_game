import { BATTING_EVENTS } from './battingEvents'
import { BASE_COMBINATIONS, createScenarioContext, describeSituation, type Base, type Situation } from './gameSetup'
import { OFFENSE_CORE_PACK } from './packs/offenseCorePack'
import type { ScenarioAnnouncement, ScenarioAnnouncementHistoryEntry, ScenarioState } from './scenario'
import { chooseScenarioChanceOutcome, chooseScenarioOption, getAvailableScenarioChoices, selectScenarioBattingEvent, startScenario } from './scenarioEngine'

export type AnnouncementAuditMessage = ScenarioAnnouncement & {
  category: ScenarioAnnouncementHistoryEntry['category']
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
}

type QueueItem = {
  state: ScenarioState
  actionLabel: string
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

const collectCase = (state: ScenarioState, actionLabel: string): AnnouncementAuditCase | null => {
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
  }
}

const getNextItems = ({ state }: QueueItem): QueueItem[] => {
  const node = OFFENSE_CORE_PACK.nodes[state.nodeId]
  if (!node || node.type === 'terminal') return []
  if (node.type === 'batting') {
    return BATTING_EVENTS
      .filter((event) => node.eventIds.includes(event.kind))
      .map((event) => ({
        actionLabel: `${node.title} · ${event.label}`,
        state: selectScenarioBattingEvent(OFFENSE_CORE_PACK, state, event.kind, { manualChance: true }),
      }))
  }
  if (node.type === 'choice') {
    return getAvailableScenarioChoices(OFFENSE_CORE_PACK, state).map((choice) => ({
      actionLabel: `${node.title} · ${choice.label}`,
      state: chooseScenarioOption(OFFENSE_CORE_PACK, state, choice.id, { manualChance: true }),
    }))
  }
  if (node.type === 'chance') {
    return node.outcomes.map((outcome) => ({
      actionLabel: `${node.title} · ${outcome.label ?? outcome.id}`,
      state: chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, state, outcome.id, { manualChance: true }),
    }))
  }
  return []
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
      })
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()!
    const auditCase = collectCase(item.state, item.actionLabel)
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