// 타석 결산(이번 타석 결산)에 표시되는 "항목"들을 채점 코드/점수와 연결하는 매핑 테이블.
// 코드/점수는 아직 확정되지 않아 비워두었습니다. 값이 정해지면 여기 code/score만 채우면 됩니다.

// completionRecords 에 기록되는 항목 문구의 단일 출처. scenarioEffects.ts/packs/* 는 이 문구를
// 직접 하드코딩하지 말고 반드시 이 상수를 import해서 사용해야 결산 표/매핑이 어긋나지 않는다.
export const PLAY_RESULT_ITEMS = {
  single: '1루타',
  double: '2루타',
  triple: '3루타',
  homeRun: '홈런',
  walk: '볼넷',
  hitByPitch: '사구',
  droppedThirdStrikeAdvance: '낫아웃 1루 진루',
  droppedThirdStrikeOut: '낫아웃 아웃',
  infieldHit: '내야안타',
  infieldFieldingError: '내야수 땅볼 실책',
  outfieldFieldingErrorSingle: '외야수 뜬공 실책',
  infieldFieldingErrorSingle: '내야수 뜬공 실책',
  groundFieldingError: '내야 땅볼 포구 실책',
  groundThrowingError: '내야 땅볼 송구 실책',
  advanceSecondError: '2루 진루 (상대 실책)',
  advanceThirdError: '3루 진루 (상대 실책)',
  advanceHomeError: '홈 진루 (상대 실책)',
  stealSecondSuccess: '2루 도루 성공',
  stealSecondFailure: '2루 도루 실패',
  stealThirdSuccess: '3루 도루 성공',
  stealThirdFailure: '3루 도루 실패',
  groundOut: '내야 땅볼 아웃',
  infieldFlyOut: '내야 뜬공 아웃',
  flyOut: '외야 뜬공 아웃',
  infieldFlyRuleOut: '인필드 플라이 아웃',
  strikeout: '삼진',
  followUpGroundOut: '내야 땅볼 아웃',
  followUpGroundForceOut: '내야 땅볼 포스 아웃',
  groundLeadRunnerOut: '내야 땅볼 선행 주자 아웃',
  groundLeadRunnerForceOut: '내야 땅볼 선행 주자 포스 아웃',
  groundDoublePlay: '내야 땅볼 (더블 플레이)',
  homeAdvanceETB: '홈 진루 (ETB)',
  sacrificeFly: '희생플라이',
  flyOutNoScore: '외야 뜬공 아웃',
} as const satisfies Record<string, string>

export type PlayResultItemKey = keyof typeof PLAY_RESULT_ITEMS

export type PlayResultCodeEntry = {
  /** completionRecords 에 기록되는 항목 문구 (표시되는 그대로) */
  item: string
  /** 항목에 매핑되는 채점 코드 (예: B-O-S). 미정 시 빈 문자열 */
  code: string
  /** 항목에 매핑되는 점수. 미정 시 null */
  score: number | null
  /** 코드가 의미하는 바에 대한 설명. 미정 시 빈 문자열 */
  description: string
}

type PlayResultCodeOverride = { code: string; score: number; description: string }

// 항목별 코드/점수/설명. 값이 정해지지 않은 항목은 이 표에서 생략하면 자동으로 빈 값 처리된다.
const PLAY_RESULT_CODE_OVERRIDES: Partial<Record<PlayResultItemKey, PlayResultCodeOverride>> = {
  single: { code: 'B-O-S', score: 1.0, description: 'Batting-Outfield-Single' },
  double: { code: 'B-O-D', score: 2.0, description: 'Batting-Outfield-Double' },
}

export const PLAY_RESULT_CODES: PlayResultCodeEntry[] = (Object.keys(PLAY_RESULT_ITEMS) as PlayResultItemKey[]).map((key) => {
  const override = PLAY_RESULT_CODE_OVERRIDES[key]
  return {
    item: PLAY_RESULT_ITEMS[key],
    code: override?.code ?? '',
    score: override?.score ?? null,
    description: override?.description ?? '',
  }
})

const PLAY_RESULT_CODE_MAP: Record<string, PlayResultCodeEntry> = Object.fromEntries(
  PLAY_RESULT_CODES.map((entry) => [entry.item, entry]),
)

export const resolvePlayResultCode = (item: string): PlayResultCodeEntry =>
  PLAY_RESULT_CODE_MAP[item] ?? { item, code: '', score: null, description: '' }
