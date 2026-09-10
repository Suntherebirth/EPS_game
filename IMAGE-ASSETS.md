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

## 이벤트 연출 이미지 (아나운스 단위)

시점 이미지 사이에 끼워 넣는 **사건 이미지**입니다. 아나운스 하나가 이미지 한 장에 대응하며, 아나운스가 연달아 나오면 이미지도 그 순서대로 재생된 뒤 마지막에 시점 이미지로 정지합니다.

예: 타석 시점 → `hit-single.png` → 1루 주자 시점

### 업로드 방법

`src/assets/scenes/events/<sceneId>.png` 로 저장하면 **코드 수정 없이 자동 등록**됩니다. (`sceneMedia.ts`가 폴더를 통째로 읽습니다.)

- 파일명이 곧 scene ID입니다. 소문자와 하이픈만 사용합니다.
- 이벤트 이미지는 베이스 접미사 없이 `<sceneId>.png` 하나로 관리합니다.
- 아직 없는 scene ID는 자동으로 건너뛰므로, 한 장씩 채워 넣어도 화면이 깨지지 않습니다.

### scene ID 목록

전체 매핑은 [src/game/sceneMedia.ts](src/game/sceneMedia.ts)의 `SCENE_BY_ANNOUNCEMENT_TITLE` 한 곳에서 관리합니다. 대표 ID는 다음과 같습니다.

| 분류 | scene ID |
| --- | --- |
| 타격 | `hit-single`, `hit-double`, `hit-triple`, `hit-home-run`, `hit-infield`, `walk`, `hit-by-pitch` |
| 타구 | `ball-ground-infield`, `ball-fly-infield`, `ball-fly-outfield`, `ball-fly-outfield-fielder-moving`, `ball-fly-outfield-deep`, `ball-fly-outfield-shallow`, `ground-fielded`, `ground-throw-ready` |
| 아웃 | `out-strikeout`, `out-infield-fly`, `out-ground`, `out-fly`, `out-ground-double-play`, `out-ground-force` |
| 실책 | `error-infield-fielding`, `error-infield-throwing`, `error-infield-fly-drop`, `error-outfield-drop`, `error-outfield-through` |
| 주루 | `steal-second-safe`, `steal-second-out`, `steal-third-safe`, `steal-third-out`, `advance-second-safe`, `advance-second-out`, `advance-third-safe`, `advance-third-out`, `wild-pitch-advance-safe`, `wild-pitch-advance-out`, `sacrifice-fly-safe`, `sacrifice-fly-out`, `dropped-third-strike-safe` |
| 기타 | `play-end` |

### 문구가 겹치는 경우

같은 title을 쓰는 아나운스를 서로 다른 이미지로 나누려면, 해당 `announce` 이펙트에 `scene`을 직접 지정합니다. 이 값이 title 매핑보다 우선합니다.

```ts
{ type: 'announce', title: '포수가 공을 뒤로 빠뜨렸습니다!', detail: '...', scene: 'dropped-third-strike' }
```

## 참고: 코드 연결 방식

`MediaStage`(`src/App.tsx`)는 `videoUrl`이 있을 때만 영상을 재생하고, 그 외에는 `src/game/sceneMedia.ts`가 만든 이미지 시퀀스를 순서대로 표시합니다. 시점 이미지·이벤트 이미지 매핑은 모두 `sceneMedia.ts` 한 파일에서 관리하며, `App.tsx`에는 야구 규칙 분기를 두지 않습니다.

## 기존 에셋 현황

| 경로 | 종류 | 상태 |
| --- | --- | --- |
| `src/assets/hero.png` | PNG, 343 x 361 | 사용되지 않음 (참고용) |
| `src/assets/react.svg` | SVG | Vite 스타터 기본 파일, 미사용 |
| `src/assets/vite.svg` | SVG | Vite 스타터 기본 파일, 미사용 |
| `public/favicon.svg` | SVG | 브라우저 파비콘 |
| `public/icons.svg` | SVG | 미사용 |
