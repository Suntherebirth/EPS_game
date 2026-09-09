# EPS Baseball Sim

선택에 따라 타격과 주루 결과가 달라지는 웹 야구 공격 시뮬레이션입니다.

## 실행

```bash
npm install
npm run dev
```

## 현재 구현

- 매 타석 무작위 아웃 카운트와 주자 상황 생성
- 장타, 사사구, 삼진, 내야안타, 수비 실책 등 타격 결과 직접 선택
- 같은 타격 이벤트 카탈로그로 확정형 및 확률형 판정 지원
- 타구 이후 1루, 2루, 3루 주자 시점의 개별 주루 판단
- 선택별 성공 확률과 득점, 안타, 아웃 집계
- 총 3타석 종료 후 플레이 기록과 최종 결과 제공
- 텍스트 장면을 추후 영상으로 교체할 수 있는 미디어 영역

## 게임 데이터 확장

타격 이벤트와 확률 값은 `src/game/battingEvents.ts`에서 관리합니다. 새 이벤트는 `BATTING_EVENTS`에 추가하고, 확률형 가중치는 각 이벤트의 `randomWeight`, 주루 확률은 `RUNNING_CHANCES`에서 조정합니다.

타격과 주루 분기는 하나의 시나리오 팩으로 연결합니다. 타입 계약은 `src/game/scenario.ts`, 노드 작성 및 통합 규칙은 [통합 시나리오 팩 규칙](docs/scenario-pack-rules.md)을 따릅니다.

단일 실행 팩 `src/game/packs/offenseCorePack.ts`가 전체 공격 흐름을 소유합니다. `emptyBasesSingleNodes.ts`는 주자 없는 1루타 흐름을 제공하는 노드 조각이며 독립 실행되지 않습니다. 공통 실행기는 `src/game/scenarioEngine.ts`, 상태 효과는 `src/game/scenarioEffects.ts`, 초기 상황은 `src/game/gameSetup.ts`에서 관리합니다.

## 아나운스 톤

아나운스의 `tone`은 `src/game/scenario.ts`의 `ScenarioAnnouncement`과 `announce` 계열 효과에서 지정합니다. 디버깅과 문구 검토에서는 아래 한국어 명칭과 의미를 기준으로 사용합니다.

| tone 값 | 한국어 명칭 | 적용 상황 |
| --- | --- | --- |
| `positive` | 긍정 | 성공, 득점, 진루 성공 등 좋은 결과 |
| `negative` | 부정 | 아웃, 실패, 기회 상실 등 나쁜 결과 |
| `caution` | 주의(선택필요) | 위험, 불확실성, 플레이어 판단이 필요한 상황 |
| `neutral` 또는 미지정 | 중립 | 일반 진행 안내와 결과 판단이 없는 상황 |

현재 UI는 긍정을 초록, 부정을 빨강, 주의(선택필요)를 금색 계열로 표현합니다. 돌발 이벤트(`surprise`)는 별도 금색 테마이며 톤과 독립적인 표시 분류입니다.

프로덕션 빌드는 `npm run build`, 코드 검사는 `npm run lint`로 실행합니다.
