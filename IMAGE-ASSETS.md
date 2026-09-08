# 이미지 에셋 가이드

시나리오 노드의 `view` 값에 맞춰 중계 화면(`MediaStage`)에 표시할 사진을 정리하기 위한 문서입니다. 지금은 **기본 이미지 세트**(시점별 1장)만 준비하고, 이후 아웃 수·주자 상황·돌발 이벤트별 변형 이미지를 추가합니다.

## 시점(view) 종류

`src/game/scenario.ts`의 `ScenarioView` 타입 기준입니다.

| view 값 | 의미 | 노드 예시 |
| --- | --- | --- |
| `batter` | 타석 시점 (타자가 공을 보는 화면) | `batting.select`, `strikeout.catcher.check` |
| `runner:first` | 1루 주자 시점 | `hit.single.firstThird`, `walk.resolve` |
| `runner:second` | 2루 주자 시점 | `hit.double.resolve`, `fly.outfield.runnerSecond.check` |
| `runner:third` | 3루 주자 시점 | `hit.triple.resolve` |
| `result` | 결과 화면 (아웃/득점 확정 등, 주자·타자 시점이 아님) | `plate.complete`, `out.strikeout.generic` |

## 업로드 경로 및 파일명 (기본 세트)

이미지는 `src/assets/scenes/` 폴더에 아래 파일명으로 넣어주세요. (폴더가 없으면 새로 생성합니다.)

| 파일 경로 | 용도 |
| --- | --- |
| `src/assets/scenes/view-batter.png` | 타석 시점 기본 이미지 |
| `src/assets/scenes/view-runner-first.png` | 1루 주자 시점 기본 이미지 |
| `src/assets/scenes/view-runner-second.png` | 2루 주자 시점 기본 이미지 |
| `src/assets/scenes/view-runner-third.png` | 3루 주자 시점 기본 이미지 |
| `src/assets/scenes/view-result.png` | 결과 화면 기본 이미지 |

- 형식: PNG 또는 JPG.
- 권장 비율: 16:9 (가로형 중계 화면 레이아웃과 맞춤). 최소 가로 960px 권장.
- 파일명은 대소문자와 하이픈(-)만 사용하고 소문자로 통일합니다.

## 향후 확장 (기본 세트 다음 단계)

기본 세트로 각 시점을 우선 채운 뒤, 아래 축으로 세분화된 이미지를 추가할 수 있습니다. 이때도 `src/assets/scenes/` 아래에 하위 폴더를 만들어 정리합니다.

- 상황별 변형: 아웃 수(0~2), 주자 베이스 구성(예: 1루만/1·2루/만루)
  - 예: `src/assets/scenes/runner-first/outs-1_bases-1-2.png`
- 돌발 이벤트(`tags: ['surprise-event']`) 전용 이미지
  - 예: `src/assets/scenes/surprise/runner-first-error.png`

세부 규칙은 기본 세트 적용 후 확정합니다.

## 참고: 코드 연결 방식

현재 `MediaStage`(`src/App.tsx`)는 `videoUrl`이 있을 때만 영상을 재생하며, 정적 이미지 렌더링은 아직 연결되어 있지 않습니다. 이미지가 준비되면 `node.view` 값에 따라 위 파일을 매핑하는 로직을 `App.tsx`에 추가할 예정입니다.

## 기존 에셋 현황

| 경로 | 종류 | 상태 |
| --- | --- | --- |
| `src/assets/hero.png` | PNG, 343 x 361 | 사용되지 않음 (참고용) |
| `src/assets/react.svg` | SVG | Vite 스타터 기본 파일, 미사용 |
| `src/assets/vite.svg` | SVG | Vite 스타터 기본 파일, 미사용 |
| `public/favicon.svg` | SVG | 브라우저 파비콘 |
| `public/icons.svg` | SVG | 미사용 |
