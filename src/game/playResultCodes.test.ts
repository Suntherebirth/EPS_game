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
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.homeAdvanceNormalSacrificeFly)).toEqual({
      item: '홈 당연 진루 (외야 희생플라이)',
      code: '',
      score: 0.0,
      description: 'Base Running-Normal Advance on Sacrifice Fly',
    })
  })

  it('maps infield ground-ball results by contact strength', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.groundSafeSoft)).toEqual({
      item: '내야 땅볼 세이프 (약한 타구)',
      code: 'B-G-S',
      score: 0.5,
      description: 'Batting-Ground-Safe',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.groundOutSoft)).toEqual({
      item: '내야 땅볼 아웃 (약한 타구)',
      code: 'B-G-O',
      score: -1.0,
      description: 'Batting-Ground-Out',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.groundSafeHard)).toEqual({
      item: '내야 땅볼 세이프 (강한 타구)',
      code: 'B-G-S-H',
      score: 1.0,
      description: 'Batting-Ground-Safe-Hard',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.groundOutHard)).toEqual({
      item: '내야 땅볼 아웃 (강한 타구)',
      code: 'B-G-O-H',
      score: 0.0,
      description: 'Batting-Ground-Out-Hard',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.groundLeadRunnerOutSoft)).toEqual({
      item: '내야 땅볼 선행주자 아웃 (약한 타구)',
      code: 'B-G-O',
      score: -1.0,
      description: 'Batting-Ground-Out',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.groundLeadRunnerOutHard)).toEqual({
      item: '내야 땅볼 선행주자 아웃 (강한 타구)',
      code: 'B-G-O-H',
      score: 0.0,
      description: 'Batting-Ground-Out-Hard',
    })
  })

  it('maps fielding-error advances to BR-FE with zero points', () => {
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceSecondError)).toEqual({
      item: '2루 진루 (상대 실책)',
      code: 'BR-FE',
      score: 0.0,
      description: 'Base Running-Fielding Error',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceThirdError)).toEqual({
      item: '3루 진루 (상대 실책)',
      code: 'BR-FE',
      score: 0.0,
      description: 'Base Running-Fielding Error',
    })
    expect(resolvePlayResultCode(PLAY_RESULT_ITEMS.advanceHomeError)).toEqual({
      item: '홈 진루 (상대 실책)',
      code: 'BR-FE',
      score: 0.0,
      description: 'Base Running-Fielding Error',
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
