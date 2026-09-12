import { describe, expect, it } from 'vitest'
import { PLAY_RESULT_CODES, PLAY_RESULT_ITEMS, resolvePlayResultCode } from './playResultCodes'

describe('playResultCodes', () => {
  it('maps 2B/3B out and steal out to BR-E-1 code', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceSecondFailure)).toEqual({
      item: '2루 진루 실패',
      code: 'BR-E-1',
      score: -1.5,
      description: 'Base Running-Out at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceThirdFailure)).toEqual({
      item: '3루 진루 실패',
      code: 'BR-E-1',
      score: -1.5,
      description: 'Base Running-Out at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.stealSecondFailure)).toEqual({
      item: '2루 도루 실패',
      code: 'BR-E-1',
      score: -1.5,
      description: 'Base Running-Steal Out at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.stealThirdFailure)).toEqual({
      item: '3루 도루 실패',
      code: 'BR-E-1',
      score: -1.5,
      description: 'Base Running-Steal Out at 2B/3B',
    })
  })

  it('maps home out to BR-E-2 code', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.homeAdvanceFailure)).toEqual({
      item: '홈 진루 실패',
      code: 'BR-E-2',
      score: -2.0,
      description: 'Base Running-Out at Home',
    })
  })

  it('maps 2B/3B missed chances to BR-E-3 code and home missed chance to BR-E-5 code', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceSecondMissed)).toEqual({
      item: '2루 진루 포기',
      code: 'BR-E-3',
      score: -1.0,
      description: 'Base Running-Missed Chance at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceThirdMissed)).toEqual({
      item: '3루 진루 포기',
      code: 'BR-E-3',
      score: -1.0,
      description: 'Base Running-Missed Chance at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.homeAdvanceMissed)).toEqual({
      item: '홈 진루 포기',
      code: 'BR-E-5',
      score: -1.5,
      description: 'Base Running-Missed Chance at Home',
    })
  })

  it('includes code entries for all defined items in PLAY_RESULT_ITEMS', () => {
    const itemValues = Object.values(PLAY_RESULT_ITEMS)
    const codeTableItems = PLAY_RESULT_CODES.map((entry) => entry.item)

    expect(codeTableItems).toEqual(expect.arrayContaining(itemValues))
  })
})
