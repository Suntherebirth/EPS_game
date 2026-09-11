import { describe, expect, it } from 'vitest'
import { inferAdvanceConcept, resolveAdvanceConcept, resolveAdvanceTone } from './advanceConcept'
import { createAnnouncementAuditCases } from './announcementAudit'

describe('advance concept', () => {
  it('prefers the explicit advance over the text heuristic', () => {
    expect(resolveAdvanceConcept({ title: '낫아웃 1루 진루 성공!', detail: '1루에 도착했습니다.', advance: 'bold' })).toBe('bold')
    expect(resolveAdvanceConcept({ title: '낫아웃 1루 진루 성공!', detail: '1루에 도착했습니다.' })).toBe('normal')
  })

  it('falls back to the text heuristic when advance is missing', () => {
    expect(inferAdvanceConcept({ title: '볼넷!', detail: '1루에 도착했습니다.' })).toBe('safe')
    expect(inferAdvanceConcept({ title: '2루 도루 성공!', detail: '2루에 도착했습니다.' })).toBe('bold')
    expect(inferAdvanceConcept({ title: '후속타자의 삼진!', detail: '1루에서 움직이지 못했습니다.' })).toBe('blocked')
    expect(inferAdvanceConcept({ title: '1루타 성공!', detail: '1루에 도착했습니다.' })).toBe('normal')
  })

  it('derives tone from the advance concept', () => {
    expect(resolveAdvanceTone('bold')).toBe('positive')
    expect(resolveAdvanceTone('safe')).toBeUndefined()
    expect(resolveAdvanceTone('normal')).toBeUndefined()
    expect(resolveAdvanceTone('blocked')).toBeUndefined()
  })

  it('keeps tone and advance consistent across every reachable announcement', () => {
    const scored = /홈에 (?:안전하게 |그대로 )?들어왔습니다/
    const mismatches = createAnnouncementAuditCases().flatMap((auditCase) => auditCase.messages
      .filter((message) => {
        if (!message.advance) return false
        if (message.advance === 'bold') return message.tone !== 'positive'
        // 득점하는 홈인은 진루 성격과 별개로 positive를 쓴다.
        return message.tone === 'positive' && !scored.test(message.detail)
      })
      .map((message) => `${auditCase.id}: ${message.title} / ${message.detail} (advance=${message.advance}, tone=${message.tone})`))

    expect(mismatches).toEqual([])
  })
})
