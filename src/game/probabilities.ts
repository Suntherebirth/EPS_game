export const RUNNING_CHANCES = {
  // 외야/내야 포구 실책
  // 외야수가 타구를 명백하게 완전히 뒤로 빠뜨릴 확률
  outfieldDropClear: 0.1,
  // 외야수가 타구를 애매하게 뒤로 빠뜨릴 확률
  outfieldDropAmbiguous: 0.15,
  // 내야 땅볼에서 내야수가 포구 실책을 할 확률
  infieldGroundFieldingError: 0.08,
  // 내야 땅볼에서 포구 성공 후 1루 송구 실책이 날 확률
  infieldGroundThrowingError: 0.08,
  // 내야 뜬공에서 내야수 처리 실패로 떨어뜨리는 확률은 외야 드롭 확률을 함께 사용한다.

  // 내야 땅볼 정상 수비 후 아웃 결과 분기
  // 포스 상황이 아닐 때 타자 주자가 아웃되는 가중치
  infieldGroundBatterOut: 0.5,
  // 포스 상황이 아닐 때 선행 주자가 아웃되는 가중치
  infieldGroundLeadRunnerOut: 0.5,
  // 1루 주자가 있고 2아웃 미만일 때 병살이 되는 가중치
  infieldGroundDoublePlay: 0.5,
  // 1루 주자가 있고 2아웃 미만일 때 선행 주자만 포스 아웃되는 가중치
  infieldGroundForceOut: 0.5,
  // 송구 실책 중 1루수 뒤로 명백하게 빠지는 비율
  infieldGroundThrowingErrorClear: 0.4,
  // 송구 실책 중 1루수 뒤로 애매하게 빠지는 비율
  infieldGroundThrowingErrorAmbiguous: 0.6,

  // 주루 시도 성공률
  // 내야 땅볼 송구 순간 2루 주자의 3루 진루 또는 3루 주자의 홈 쇄도 성공률
  advanceOnGroundBallToThird: 0.7,
  // 애매한 외야 플라이에서 태그업 성공률
  advanceOnAmbiguousSacrificeFly: 0.6,
  // 외야 플라이가 애매한 깊이로 잡힐 가중치
  outfieldFlyDepthAmbiguous: 0.5,
  // 외야 플라이가 명백하게 깊게 잡힐 가중치
  outfieldFlyDepthDeep: 0.5,
  // 애매하게 빠진 외야수 실책/송구 실책을 보고 추가 진루할 성공률
  advanceOnAmbiguousDrop: 0.7,

  // 폭투
  // 포수가 공을 명백하게 완전히 뒤로 빠뜨리는 폭투 확률
  wildPitchClear: 0.1,
  // 포수가 공을 애매하게 뒤로 빠뜨리는 폭투 확률
  wildPitchAmbiguous: 0.15,
  // 애매한 폭투를 이용한 추가 진루 성공률
  advanceOnAmbiguousWildPitch: 0.7,

  // 낫아웃
  // 삼진 후 포수가 공을 명백하게 완전히 뒤로 빠뜨릴 확률
  droppedThirdStrikeClear: 0.08,
  // 삼진 후 포수가 공을 애매하게 뒤로 빠뜨릴 확률
  droppedThirdStrikeAmbiguous: 0.12,
  // 명백한 낫아웃 상황에서 전력 질주 시 1루 진루 성공률
  runHardOnClearDroppedStrike: 1,
  // 명백한 낫아웃 상황에서 천천히 뛸 때 1루 진루 성공률
  runSlowOnClearDroppedStrike: 0.5,
  // 애매한 낫아웃 상황에서 전력 질주 시 1루 진루 성공률
  runHardOnAmbiguousDroppedStrike: 0.8,
  // 애매한 낫아웃 상황에서 천천히 뛸 때 1루 진루 성공률
  runSlowOnAmbiguousDroppedStrike: 0,

  // 도루와 일반 진루
  // 1루 주자의 2루 도루 성공률
  stealSecond: 0.72,
  // 2루 주자의 3루 도루 성공률
  stealThird: 0.68,
  // 보수적인 추가 진루 성공률
  safeAdvance: 0.94,
  // 공격적인 추가 진루 성공률
  aggressiveAdvance: 0.7,

  // 후속 내야 땅볼 송구 실책 후 추가 진루
  // 명백하게 빠진 송구를 보고 한 베이스 더 진루할 성공률
  followUpGroundThrowClearExtraAdvance: 0.5,
  // 애매하게 빠진 송구를 보고 한 베이스 더 진루할 성공률
  followUpGroundThrowAmbiguousExtraAdvance: 0.3,
} as const

export const BATTING_EVENT_RANDOM_WEIGHTS = {
  // 후속 타자 랜덤 결과 선택에 쓰는 상대 가중치다. 확률은 전체 가중치 합계 대비 비율로 계산된다.
  // 1루타 발생 가중치
  single: 20,
  // 2루타 발생 가중치
  double: 8,
  // 3루타 발생 가중치
  triple: 2,
  // 홈런 발생 가중치
  homeRun: 5,
  // 내야안타 발생 가중치
  infieldHit: 6,
  // 내야수 땅볼 실책 발생 가중치
  infieldError: 3,
  // 볼넷 발생 가중치
  walk: 9,
  // 사구 발생 가중치
  hitByPitch: 2,
  // 삼진 발생 가중치
  strikeout: 20,
  // 내야 땅볼 발생 가중치
  groundOut: 14,
  // 내야 뜬공 발생 가중치
  infieldFly: 8,
  // 외야 뜬공 발생 가중치
  flyOut: 11,
} as const