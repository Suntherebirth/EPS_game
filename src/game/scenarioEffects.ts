import type { ScenarioContext, ScenarioEffect } from './scenario'
import { ANNOUNCEMENTS } from './announcementMessages'
import { BATTING_EVENTS } from './battingEvents'

const cloneContext = (context: ScenarioContext): ScenarioContext => ({
  ...context,
  bases: [...context.bases],
  flags: { ...context.flags },
  records: [...context.records],
  completionRecords: [...context.completionRecords],
  announcementHistory: [...context.announcementHistory],
  announcementCategory: context.announcementCategory,
})

const setAnnouncement = (context: ScenarioContext, announcement: ScenarioContext['announcement'], viewLabel?: string) => {
  if (context.announcement && context.announcement.title !== '플레이 종료') context.announcementHistory.push({ announcement: context.announcement, category: context.announcementCategory, viewLabel: context.announcementViewLabel })
  context.announcement = announcement
  context.announcementCategory = context.flags.surpriseEvent === true ? 'surprise' : 'normal'
  context.announcementViewLabel = viewLabel
}

const makeRoomForRunner = (bases: number[], base: number): { bases: number[]; runs: number } => {
  if (!bases.includes(base)) return { bases, runs: 0 }
  const withoutRunner = bases.filter((occupiedBase) => occupiedBase !== base)
  if (base === 3) return { bases: withoutRunner, runs: 1 }
  const advanced = makeRoomForRunner(withoutRunner, base + 1)
  return { bases: [...advanced.bases, base + 1], runs: advanced.runs }
}

export const applyScenarioEffect = (context: ScenarioContext, effect: ScenarioEffect, viewLabel?: string): ScenarioContext => {
  const next = cloneContext(context)

  if (effect.type === 'addOuts') next.outs = Math.min(3, next.outs + effect.value)
  if (effect.type === 'addRuns') next.runs += effect.value
  if (effect.type === 'addHits') next.hits += effect.value
  if (effect.type === 'setBases') next.bases = [...effect.value]
  if (effect.type === 'placeRunner' && !next.bases.includes(effect.base)) next.bases.push(effect.base)
  if (effect.type === 'setFlag') next.flags[effect.key] = effect.value
  if (effect.type === 'record') {
    next.records.push(effect.message)
    if (effect.showInCompletion ?? true) next.completionRecords.push(effect.message)
  }
  if (effect.type === 'setPlayerBase') next.playerBase = effect.value
  if (effect.type === 'announce') {
    setAnnouncement(next, {
      title: effect.title,
      detail: next.outs >= 3 ? ANNOUNCEMENTS.sideChange : effect.detail,
      ...(effect.tone ? { tone: effect.tone } : next.outs >= 3 ? { tone: 'negative' as const } : {}),
    }, viewLabel)
  }
  if (effect.type === 'announceFollowUpOutfieldError') {
    setAnnouncement(next, ANNOUNCEMENTS.followUpOutfieldError(effect.clear), viewLabel)
  }
  if (effect.type === 'announcePlayerAdvance') {
    setAnnouncement(next, {
      title: effect.title,
      detail: next.outs >= 3 ? ANNOUNCEMENTS.sideChange : next.playerBase === null ? (effect.homeDetail ?? '홈에 들어왔습니다.') : effect.detail,
      ...(effect.tone ? { tone: effect.tone } : {}),
    }, viewLabel)
  }

  if (effect.type === 'applyHit') {
    if (next.playerBase !== null) {
      const destination = next.playerBase + effect.batterTo
      next.playerBase = destination >= 4 ? null : destination
    }
    const advanced = next.bases.map((base) => base + effect.batterTo)
    next.runs += advanced.filter((base) => base >= 4).length
    next.bases = advanced.filter((base) => base < 4)
    if (effect.batterTo >= 4) next.runs += 1
    else if (!next.bases.includes(effect.batterTo)) next.bases.push(effect.batterTo)
    if (effect.creditHit) next.hits += 1
  }

  if (effect.type === 'forceWalk') {
    const beforeWalk = new Set(next.bases)
    if (next.playerBase === 1) next.playerBase = 2
    else if (next.playerBase === 2 && beforeWalk.has(1)) next.playerBase = 3
    else if (next.playerBase === 3 && beforeWalk.has(1) && beforeWalk.has(2)) next.playerBase = null
    const occupied = new Set(next.bases)
    if (occupied.has(1)) {
      if (occupied.has(2)) {
        if (occupied.has(3)) next.runs += 1
        occupied.add(3)
      }
      occupied.add(2)
    }
    occupied.add(1)
    next.bases = [...occupied]
    if (effect.creditHit) next.hits += 1
  }

  if (effect.type === 'scoreAll') {
    next.runs += next.bases.length + 1
    next.bases = []
    next.playerBase = null
    if (effect.creditHit) next.hits += 1
  }

  if (effect.type === 'moveRunner') {
    const runnerIndex = next.bases.indexOf(effect.from)
    if (runnerIndex >= 0) next.bases.splice(runnerIndex, 1)
    if (effect.to === 'home') next.runs += 1
    else if (effect.to === 'out') next.outs = Math.min(3, next.outs + 1)
    else if (!next.bases.includes(effect.to)) next.bases.push(effect.to)
    if (next.playerBase === effect.from) next.playerBase = typeof effect.to === 'number' ? effect.to : null
  }

  if (effect.type === 'advanceRunner') {
    const runnerIndex = next.bases.indexOf(effect.from)
    if (runnerIndex < 0) throw new Error(`${effect.from}루 주자가 없는 진루를 적용할 수 없습니다.`)
    next.bases.splice(runnerIndex, 1)
    if (next.bases.includes(effect.to)) {
      next.bases = next.bases.filter((base) => base !== effect.to)
      if (effect.to === 3) next.runs += 1
    }
    next.bases.push(effect.to)
    if (next.playerBase === effect.from) next.playerBase = effect.to
  }

  if (effect.type === 'movePlayer' && next.playerBase !== null) {
    next.bases = next.bases.filter((base) => base !== next.playerBase)
    if (effect.to === 'home') {
      next.runs += 1
      next.playerBase = null
    } else if (effect.to === 'out') {
      next.outs = Math.min(3, next.outs + 1)
      next.playerBase = null
    } else {
      const room = makeRoomForRunner(next.bases, effect.to)
      next.bases = [...room.bases, effect.to]
      next.runs += room.runs
      next.playerBase = effect.to
    }
  }

  if (effect.type === 'advancePlayer' && next.playerBase !== null) {
    return applyScenarioEffect(next, { type: 'movePlayer', to: next.playerBase === 3 ? 'home' : next.playerBase + 1 })
  }

  if (effect.type === 'advanceRunnersAheadOfPlayer' && next.playerBase !== null) {
    const advancingRunners = next.bases.filter((base) => base > next.playerBase!)
    next.bases = next.bases.filter((base) => base <= next.playerBase!)
    const advancedBases = advancingRunners.map((base) => base + 1)
    next.runs += advancedBases.filter((base) => base >= 4).length
    next.bases.push(...advancedBases.filter((base) => base < 4))
  }

  if (effect.type === 'applyFollowUpGroundOut') {
    const playerBase = next.playerBase
    const playerIsForced = playerBase !== null && Array.from({ length: playerBase }, (_, index) => index + 1).every((base) => next.bases.includes(base))
    next.outs = Math.min(3, next.outs + 1)
    next.records.push(playerIsForced ? '후속 타자 내야 땅볼, 포스 아웃' : '후속 타자 내야 땅볼 아웃')
    next.completionRecords.push(playerIsForced ? '내야 땅볼 포스 아웃' : '내야 땅볼 아웃')
    if (playerIsForced && playerBase !== null) {
      next.bases = next.bases.filter((base) => base !== playerBase)
      next.playerBase = null
    }
    setAnnouncement(next, ANNOUNCEMENTS.followUpGroundOut(playerBase, next.outs, playerIsForced))
  }

  if (effect.type === 'applyGroundForceOut') {
    const leadRunnerBase = [...next.bases].sort((a, b) => a - b)[0]
    if (leadRunnerBase === undefined) throw new Error('선행 주자가 없는 포스 아웃을 적용할 수 없습니다.')
    next.bases = next.bases.filter((base) => base !== leadRunnerBase)
    next.bases.push(1)
    next.playerBase = 1
    next.outs = Math.min(3, next.outs + 1)
    next.records.push('내야 땅볼, 선행 주자 포스 아웃')
    next.completionRecords.push('내야 땅볼 선행 주자 포스 아웃')
    setAnnouncement(next, ANNOUNCEMENTS.groundForceOut(next.outs))
  }

  if (effect.type === 'applyGroundDoublePlay') {
    if (!next.bases.includes(1)) throw new Error('1루 주자가 없는 병살을 적용할 수 없습니다.')
    next.bases = next.bases.filter((base) => base !== 1)
    next.outs = Math.min(3, next.outs + 2)
    next.records.push('내야 땅볼, 병살')
    next.completionRecords.push('내야 땅볼 병살')
    setAnnouncement(next, ANNOUNCEMENTS.groundDoublePlay(next.outs))
  }

  if (effect.type === 'applyOutfieldDropWithSecondRunner') {
    if (!next.bases.includes(2)) throw new Error('2루 주자가 없는 외야 실책을 적용할 수 없습니다.')
    next.bases = [...next.bases, 1]
    next.playerBase = 1
    next.hits += 1
  }

  if (effect.type === 'applyFollowUpOutfieldDropWithSecondRunner') {
    if (next.playerBase !== 2 || !next.bases.includes(2)) throw new Error('2루 주자가 없는 후속 외야 실책을 적용할 수 없습니다.')
    if (next.bases.includes(1)) throw new Error('1루 주자가 있는 후속 외야 실책은 일반 타격 흐름으로 처리해야 합니다.')
    next.bases.push(1)
  }

  if (effect.type === 'applySacrificeFlyOut') {
    next.outs = Math.min(3, next.outs + 1)
    next.records.push(effect.score ? '외야 뜬공, 3루 주자 태그업 득점' : '외야 뜬공, 3루 주자 진루하지 않음')
    next.completionRecords.push(effect.score ? '희생플라이' : '외야 뜬공 아웃')
    if (effect.score) {
      const runnerIndex = next.bases.indexOf(3)
      if (runnerIndex >= 0) next.bases.splice(runnerIndex, 1)
      next.runs += 1
      if (next.playerBase === 3) next.playerBase = null
    }
  }

  if (effect.type === 'applyBattingEvent') {
    const event = BATTING_EVENTS.find((item) => item.kind === next.battingEvent)
    if (!event) throw new Error(`적용할 타격 이벤트가 없습니다: ${next.battingEvent ?? 'undefined'}`)
    next.records.push(`후속 타자 ${event.label}`)
    const before = next.playerBase
    const followUpTitle = event.kind === 'flyOut' ? '뜬공 처리 성공!' : `후속타자의 ${event.label}!`
    const resolved = event.kind === 'homeRun'
      ? applyScenarioEffect(next, { type: 'scoreAll', creditHit: true })
      : event.kind === 'walk' || event.kind === 'hitByPitch'
        ? applyScenarioEffect(next, { type: 'forceWalk' })
        : event.advance > 0
          ? applyScenarioEffect(next, { type: 'applyHit', batterTo: event.advance, creditHit: event.hit })
          : applyScenarioEffect(next, { type: 'addOuts', value: event.outs })
    if (resolved.announcement?.title === '플레이 종료') resolved.announcement = undefined
    resolved.flags.advancedByFollowUpHit = event.hit && before !== null && resolved.playerBase !== null && resolved.playerBase > before
    if (resolved.outs >= 3) {
      setAnnouncement(resolved, ANNOUNCEMENTS.followUpBattingEvent(followUpTitle, before, resolved.playerBase, resolved.outs))
      return resolved
    }
    setAnnouncement(resolved, ANNOUNCEMENTS.followUpBattingEvent(followUpTitle, before, resolved.playerBase, resolved.outs))
    return resolved
  }

  next.bases.sort((a, b) => a - b)
  if (next.outs >= 3) {
    next.bases = []
    next.playerBase = null
    if (!next.announcement) next.announcement = ANNOUNCEMENTS.playEnded
  }
  return next
}