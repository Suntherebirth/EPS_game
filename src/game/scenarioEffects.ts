import type { ScenarioContext, ScenarioEffect } from './scenario'
import { BATTING_EVENTS } from './battingEvents'

const cloneContext = (context: ScenarioContext): ScenarioContext => ({
  ...context,
  bases: [...context.bases],
  flags: { ...context.flags },
  records: [...context.records],
  completionRecords: [...context.completionRecords],
})

const makeRoomForRunner = (bases: number[], base: number): { bases: number[]; runs: number } => {
  if (!bases.includes(base)) return { bases, runs: 0 }
  const withoutRunner = bases.filter((occupiedBase) => occupiedBase !== base)
  if (base === 3) return { bases: withoutRunner, runs: 1 }
  const advanced = makeRoomForRunner(withoutRunner, base + 1)
  return { bases: [...advanced.bases, base + 1], runs: advanced.runs }
}

export const applyScenarioEffect = (context: ScenarioContext, effect: ScenarioEffect): ScenarioContext => {
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
    next.announcement = {
      title: effect.title,
      detail: next.outs >= 3 ? '3아웃 · 공수교대입니다.' : effect.detail,
      ...(effect.tone ? { tone: effect.tone } : {}),
    }
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

  if (effect.type === 'applyBattingEvent') {
    const event = BATTING_EVENTS.find((item) => item.kind === next.battingEvent)
    if (!event) throw new Error(`적용할 타격 이벤트가 없습니다: ${next.battingEvent ?? 'undefined'}`)
    next.records.push(`후속 타자 ${event.label}`)
    const before = next.playerBase
    const resolved = event.kind === 'homeRun'
      ? applyScenarioEffect(next, { type: 'scoreAll', creditHit: true })
      : event.kind === 'walk' || event.kind === 'hitByPitch'
        ? applyScenarioEffect(next, { type: 'forceWalk' })
        : event.advance > 0
          ? applyScenarioEffect(next, { type: 'applyHit', batterTo: event.advance, creditHit: event.hit })
          : applyScenarioEffect(next, { type: 'addOuts', value: event.outs })
    resolved.flags.advancedByFollowUpHit = event.hit && before !== null && resolved.playerBase !== null && resolved.playerBase > before
    if (resolved.outs >= 3) {
      resolved.announcement = { title: `후속 타자: ${event.label}!`, detail: '3아웃 · 공수교대입니다.', tone: 'negative' }
      return resolved
    }
    const destination = resolved.playerBase === null
      ? '홈에 들어왔습니다.'
      : resolved.playerBase === before
        ? `${before}루에서 움직이지 못했습니다.`
        : `${resolved.playerBase}루에 도착했습니다.`
    resolved.announcement = {
      title: `후속 타자: ${event.label}!`,
      detail: before === null ? '홈에 들어왔습니다.' : destination,
      ...(resolved.playerBase === null ? { tone: 'positive' as const } : {}),
    }
    return resolved
  }

  next.bases.sort((a, b) => a - b)
  if (next.outs >= 3) {
    next.bases = []
    next.playerBase = null
    if (next.announcement) next.announcement = { ...next.announcement, detail: '3아웃 · 공수교대입니다.', tone: 'negative' }
    else next.announcement = { title: '플레이 종료', detail: '3아웃 · 공수교대입니다.', tone: 'negative' }
  }
  return next
}