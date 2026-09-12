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

  it('maps dropped-third-strike out to the same code and score as a regular strikeout', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.droppedThirdStrikeOut)).toEqual({
      item: '낫아웃 아웃',
      code: 'B-SO-O',
      score: -1.5,
      description: 'Batting-StrikeOut-Out',
    })
  })

  it('maps successful steals to BR-2nd and BR-3rd with +1 points', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.stealSecondSuccess)).toEqual({
      item: '2루 도루 성공',
      code: 'BR-2nd',
      score: 1.0,
      description: 'Base Running-Steal 2B Success',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.stealThirdSuccess)).toEqual({
      item: '3루 도루 성공',
      code: 'BR-3rd',
      score: 1.0,
      description: 'Base Running-Steal 3B Success',
    })
  })

  it('maps extra-base ETB advances to BR-ETB-1 and BR-ETB-2', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceSecondETB)).toEqual({
      item: '2루 진루 (ETB)',
      code: 'BR-ETB-1',
      score: 1.0,
      description: 'Base Running-Extra Base ETB at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceThirdETB)).toEqual({
      item: '3루 진루 (ETB)',
      code: 'BR-ETB-1',
      score: 1.0,
      description: 'Base Running-Extra Base ETB at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.homeAdvanceETB)).toEqual({
      item: '홈 진루 (ETB)',
      code: 'BR-ETB-2',
      score: 1.5,
      description: 'Base Running-Extra Base ETB at Home',
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
      item: '2루 진루 기회 놓침',
      code: 'BR-E-3',
      score: -1.0,
      description: 'Base Running-Missed Chance at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceThirdMissed)).toEqual({
      item: '3루 진루 기회 놓침',
      code: 'BR-E-3',
      score: -1.0,
      description: 'Base Running-Missed Chance at 2B/3B',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.homeAdvanceMissed)).toEqual({
      item: '홈 진루 기회 놓침',
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
