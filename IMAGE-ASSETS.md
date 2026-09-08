# 장면 이미지 가이드

이미지 파일은 `public/images/scenes/`에 배치한다. Vite의 `public` 폴더 아래 파일은 빌드 결과물의 루트 경로로 제공되므로, 화면 코드에서는 `/images/scenes/<파일명>`으로 참조한다.

```text
EPS_game/
├── public/
│   └── images/
│       └── scenes/
│           ├── default.webp
│           ├── view-batter.webp
│           ├── view-runner-first.webp
│           ├── view-runner-second.webp
│           ├── view-runner-third.webp
│           └── ...
└── IMAGE-ASSETS.md
```

`webp`를 기본 형식으로 사용한다. 투명도가 필요하거나 원본을 유지해야 할 때만 `png`를 사용한다. 한 장면에 두 형식이 있으면 `webp`를 우선한다.

## 파일명 원칙

파일명은 현재 시나리오 노드의 `id`를 기준으로 만든다.

1. 모두 소문자를 사용한다.
2. 노드 ID의 점(`.`)과 콜론(`:`)은 하이픈(`-`)으로 바꾼다.
3. 단어는 기존 ID의 camelCase를 유지한다. 예: `clearDrop`, `wildPitch`.
4. 확장자는 `.webp`를 사용한다.

```text
<node-id의 . 및 :를 -로 치환>.webp
```

예를 들어 노드 ID가 `runner.wildPitch.clear.decide`이면 파일명은 아래와 같다.

```text
runner-wildPitch-clear-decide.webp
```

이 규칙을 쓰면 파일명 하나가 게임의 장면 하나와 정확히 대응한다. 화면 시점만 파일명으로 쓰면 같은 1루 시점이라도 폭투, 외야 실책, 송구 실책을 구분할 수 없다.

## 필수 기본 이미지

이 이미지는 특정 노드 장면 파일이 없을 때 사용한다.

| 파일명 | 쓰임새 | 대응 `view` |
| --- | --- | --- |
| `default.webp` | 모든 장면 이미지가 없을 때 최종 fallback | 전체 |
| `view-batter.webp` | 타석 시점 기본 장면 | `batter` |
| `view-runner-first.webp` | 1루 주자 기본 장면 | `runner:first` |
| `view-runner-second.webp` | 2루 주자 기본 장면 | `runner:second` |
| `view-runner-third.webp` | 3루 주자 기본 장면 | `runner:third` |
| `view-result.webp` | 결과 화면용 기본 장면 | `result` |

이미지 검색 우선순위는 다음으로 구현한다.

```text
1. 현재 node.id를 변환한 장면 이미지
2. 현재 node.view에 대응하는 기본 시점 이미지
3. default.webp
```

예를 들어 `runner.wildPitch.clear.decide`의 전용 이미지가 없으면 `view-runner-first.webp`를 보여 준다.

## 현재 시나리오별 권장 이미지

### 타석

```text
batting-select.webp
strikeout-catcher-check.webp
strikeout-clearDrop-decide.webp
strikeout-ambiguousDrop-decide.webp
ground-infield-check.webp
fly-outfield-check.webp
fly-infield-check.webp
followUp-batting-resolve.webp
followUp-ground-check.webp
followUp-ground-throwingError-check.webp
```

### 1루 시점

```text
hit-single-resolve.webp
hit-single-firstThird.webp
hit-single-generic.webp
walk-resolve.webp
hitByPitch-resolve.webp
strikeout-reachFirst.webp
ground-infield-fieldingError.webp
ground-infield-throwingError.webp
fly-outfield-drop.webp
fly-infield-drop.webp

runner-first-decide.webp
runner-first-stealSecond.webp
single-outfield-check.webp
runner-first-clearDrop-decide.webp
runner-first-ambiguousDrop-decide.webp
runner-first-ambiguousDrop-advance.webp

runner-wildPitch-clear-decide.webp
runner-wildPitch-ambiguous-decide.webp
runner-wildPitch-ambiguous-advance.webp

followUp-ground-fieldingError.webp
followUp-ground-throwingError-clear-decide.webp
followUp-ground-throwingError-ambiguous-decide.webp
followUp-ground-throwingError-ambiguous-advance.webp

runner-battingAdvance-outfield-check.webp
runner-battingAdvance-clearDrop-decide.webp
runner-battingAdvance-ambiguousDrop-decide.webp
runner-battingAdvance-ambiguousDrop-advance.webp
```

### 2루 시점

```text
hit-double-resolve.webp
runner-second-decide.webp
runner-second-stealThird.webp
runner-second-groundOut-decide.webp
runner-second-groundOut-advance.webp
```

### 3루 시점

```text
hit-triple-resolve.webp
runner-third-decide.webp
```

### 돌발 이벤트

아래 노드는 `surprise-event` 태그가 있어 UI에서 돌발 이벤트로 표시된다. 해당 장면은 반드시 전용 이미지를 준비하는 것을 권장한다.

```text
strikeout-clearDrop-decide.webp
strikeout-ambiguousDrop-decide.webp
runner-first-clearDrop-decide.webp
runner-first-ambiguousDrop-decide.webp
runner-wildPitch-clear-decide.webp
runner-wildPitch-ambiguous-decide.webp
followUp-ground-throwingError-clear-decide.webp
followUp-ground-throwingError-ambiguous-decide.webp
runner-battingAdvance-clearDrop-decide.webp
runner-battingAdvance-ambiguousDrop-decide.webp
```

## 후속타자 50:50 장면

후속타자 타격에서 일반 시점 이미지와 돌발 이벤트 이미지를 화면 연출로 정확히 50:50 비율로 선택해야 한다면, 다음 쌍을 준비한다.

```text
followUp-batting-resolve--view.webp
followUp-batting-resolve--surprise.webp
```

두 후보의 가중치를 동일하게 `1`로 두어 선택한다.

```ts
const followUpMedia = [
  { src: '/images/scenes/followUp-batting-resolve--view.webp', weight: 1 },
  { src: '/images/scenes/followUp-batting-resolve--surprise.webp', weight: 1 },
]
```

`--view`, `--surprise`는 같은 노드의 연출 변형임을 나타내는 접미사다. 다른 50:50 장면도 같은 규칙을 쓴다.

```text
<node-id>.webp                    # 단일 장면
<node-id>--view.webp              # 일반 시점 변형
<node-id>--surprise.webp          # 돌발 이벤트 연출 변형
```

단, 화면 연출 50:50과 게임 규칙의 돌발 이벤트 확률은 별개다. 실제 게임 결과를 나타내는 장면은 무작위 이미지로 고르면 안 된다. 예를 들어 `wildPitch.check`의 결과가 `normalPitch`이면 일반 장면을, `clearWildPitch` 또는 `ambiguousWildPitch`이면 해당 폭투 이미지를 표시해야 한다. 그래야 화면이 게임 결과와 일치한다.

## 구현 시 유의점

현재 [`src/App.tsx`](src/App.tsx)의 `MediaStage`는 `videoUrl`만 받으며, 시나리오 노드나 이미지를 아직 전달받지 않는다. 이미지 기능을 추가할 때는 `scenario.nodeId`와 현재 노드의 `view`를 `MediaStage`에 전달해 위 우선순위로 경로를 선택한다.

또한 일반 플레이에서는 `event`, `router`, 자동 `chance` 노드가 즉시 다음 노드로 넘어간다. 사용자가 실제로 보는 장면은 주로 타격 선택 노드와 주루 선택 노드다. 자동 확률의 결과 이미지까지 반드시 보여 주려면, 결과를 표시하는 `event` 노드를 잠시 화면에 유지하는 별도 표시 상태가 필요하다.