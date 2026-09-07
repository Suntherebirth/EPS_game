import type { ScenarioContext, ScenarioEffect } from './scenario'
import { BATTING_EVENTS } from './battingEvents'

const cloneContext = (context: ScenarioContext): ScenarioContext => ({
  ...context,
  bases: [...context.bases],
  flags: { ...context.flags },
  records: [...context.records],
})

export const applyScenarioEffect = (context: ScenarioContext, effect: ScenarioEffect): ScenarioContext => {
  const next = cloneContext(context)

  if (effect.type === 'addOuts') next.outs = Math.min(3, next.outs + effect.value)
  if (effect.type === 'addRuns') next.runs += effect.value
  if (effect.type === 'addHits') next.hits += effect.value
  if (effect.type === 'setBases') next.bases = [...effect.value]
  if (effect.type === 'placeRunner' && !next.bases.includes(effect.base)) next.bases.push(effect.base)
  if (effect.type === 'setFlag') next.flags[effect.key] = effect.value
  if (effect.type === 'record') next.records.push(effect.message)
  if (effect.type === 'setPlayerBase') next.playerBase = effect.value

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

  if (effect.type === 'applyBattingEvent') {
    const event = BATTING_EVENTS.find((item) => item.kind === next.battingEvent)
    if (!event) throw new Error(`적용할 타격 이벤트가 없습니다: ${next.battingEvent ?? 'undefined'}`)
    next.records.push(`후속 타자 ${event.label}`)
    if (event.kind === 'homeRun') return applyScenarioEffect(next, { type: 'scoreAll', creditHit: true })
    if (event.kind === 'walk' || event.kind === 'hitByPitch') return applyScenarioEffect(next, { type: 'forceWalk' })
    if (event.advance > 0) return applyScenarioEffect(next, { type: 'applyHit', batterTo: event.advance, creditHit: event.hit })
    return applyScenarioEffect(next, { type: 'addOuts', value: event.outs })
  }

  next.bases.sort((a, b) => a - b)
  if (next.outs >= 3) {
    next.bases = []
    next.playerBase = null
  }
  return next
}