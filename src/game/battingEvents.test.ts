import { describe, expect, it } from 'vitest'
import {
  PROBABILISTIC_BATTING_CHOICES,
  resolveProbabilisticBattingChoice,
} from './battingEvents'

describe('battingEvents - 확률형 선택지', () => {
  it('세 가지 확률형 선택지가 정의되어 있어야 한다 (컨택트 스윙, 파워 스윙, 지켜본다)', () => {
    const ids = PROBABILISTIC_BATTING_CHOICES.map((choice) => choice.id)
    expect(ids).toEqual(['contact', 'power', 'watch'])

    const labels = PROBABILISTIC_BATTING_CHOICES.map((choice) => choice.label)
    expect(labels).toEqual(['컨택트 스윙', '파워 스윙', '지켜본다'])
  })

  it('지켜본다 선택지는 볼넷, 사구, 삼진 중 하나를 반환한다', () => {
    const watchChoice = PROBABILISTIC_BATTING_CHOICES.find((c) => c.id === 'watch')
    expect(watchChoice).toBeDefined()

    const eventIds = watchChoice!.outcomes.map((o) => o.eventId)
    expect(eventIds).toContain('walk')
    expect(eventIds).toContain('hitByPitch')
    expect(eventIds).toContain('strikeout')

    // 가짜 랜덤 함수로 검증
    // weight: walk(65), hitByPitch(5), strikeout(30), total = 100
    // randomFn가 0.1 이면 roll = 10 -> walk
    expect(resolveProbabilisticBattingChoice('watch', () => 0.1)).toBe('walk')
    // randomFn가 0.68 이면 roll = 68 -> (68 - 65 = 3) -> hitByPitch
    expect(resolveProbabilisticBattingChoice('watch', () => 0.68)).toBe('hitByPitch')
    // randomFn가 0.80 이면 roll = 80 -> (80 - 65 - 5 = 10) -> strikeout
    expect(resolveProbabilisticBattingChoice('watch', () => 0.8)).toBe('strikeout')
  })

  it('컨택트 스윙 선택지는 적절한 타격 결과를 무작위 추첨한다', () => {
    // weight: single(35), infieldHit(10), double(10), groundOut(20), flyOut(15), strikeout(10)
    expect(resolveProbabilisticBattingChoice('contact', () => 0.05)).toBe('single')
    expect(resolveProbabilisticBattingChoice('contact', () => 0.95)).toBe('strikeout')
  })

  it('파워 스윙 선택지는 적절한 타격 결과를 무작위 추첨한다', () => {
    // weight: homeRun(15), double(20), triple(5), single(10), flyOut(20), strikeout(30)
    expect(resolveProbabilisticBattingChoice('power', () => 0.05)).toBe('homeRun')
    expect(resolveProbabilisticBattingChoice('power', () => 0.95)).toBe('strikeout')
  })
})
