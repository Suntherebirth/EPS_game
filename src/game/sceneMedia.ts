import type { SceneId, ScenarioAnnouncement, ScenarioView } from './scenario'
import viewBatter from '../assets/scenes/view-batter.png'
import viewRunnerFirst from '../assets/scenes/view-runner-first.png'
import viewRunnerSecond from '../assets/scenes/view-runner-second.png'
import viewRunnerThird from '../assets/scenes/view-runner-third.png'

type AnnouncementStageMessage = Pick<ScenarioAnnouncement, 'title' | 'scene'> & { category?: 'normal' | 'surprise' }

export const SCENE_FRAME_INTERVAL_MS = 680

const VIEW_IMAGES: Partial<Record<ScenarioView, string>> = {
  batter: viewBatter,
  'runner:first': viewRunnerFirst,
  'runner:second': viewRunnerSecond,
  'runner:third': viewRunnerThird,
}

const VIEW_IMAGE_FILENAMES: Partial<Record<ScenarioView, string>> = {
  batter: 'view-batter.png',
  'runner:first': 'view-runner-first.png',
  'runner:second': 'view-runner-second.png',
  'runner:third': 'view-runner-third.png',
}

/** src/assets/scenes/events/<sceneId>.png 를 넣으면 코드 수정 없이 자동 등록된다. */
const EVENT_IMAGES = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/scenes/events/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }),
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
)

/**
 * 아나운스 문구 → 연출 이미지 ID.
 * 이펙트에 `scene`을 직접 지정하면 이 표보다 우선한다. 같은 문구를 다른 연출로 나눠야 하면 `scene`을 쓴다.
 */
const SCENE_BY_ANNOUNCEMENT_TITLE: Record<string, SceneId> = {
  '1루타 성공!': 'hit-single',
  '2루타 성공!': 'hit-double',
  '3루타 성공!': 'hit-triple',
  '홈런!': 'hit-home-run',
  '후속타자의 1루타!': 'hit-single',
  '후속타자의 2루타!': 'hit-double',
  '후속타자의 3루타!': 'hit-triple',
  '후속타자의 홈런!': 'hit-home-run',
  '내야안타!': 'hit-infield',
  '볼넷!': 'walk',
  '사구!': 'hit-by-pitch',

  '내야 땅볼 발생!': 'ball-ground-infield',
  '후속타자의 내야 땅볼 발생!': 'ball-ground-infield',
  '내야 뜬공 발생!': 'ball-fly-infield',
  '외야 뜬공 발생!': 'ball-fly-outfield',
  '후속타자의 외야 뜬공 발생!': 'ball-fly-outfield',
  '애매한 외야 플라이!': 'ball-fly-outfield-shallow',
  '명백하게 깊은 외야 플라이!': 'ball-fly-outfield-deep',
  '상대 내야수가 땅볼 포구에 성공했습니다!': 'ground-fielded',
  '상대 내야수가 1루 송구에 성공했습니다!': 'ground-first-base-catch',
  '상대 내야수, 1루 송구 준비 완료!': 'ground-throw-ready',

  '삼진 아웃되었습니다.': 'out-strikeout',
  '인필드 플라이 선언!': 'out-infield-fly',
  '땅볼 처리 성공!': 'out-ground',
  '뜬공 처리 성공!': 'out-fly',
  '내야 땅볼 병살!': 'out-ground-double-play',
  '내야 땅볼 포스 아웃!': 'out-ground-force',
  '내야 땅볼 선행 주자 아웃!': 'out-ground-force',

  '상대 내야수가 땅볼 포구에 실패했습니다!': 'error-infield-fielding',
  '내야수 땅볼 실책!': 'error-infield-fielding',
  '내야 땅볼 송구 실책!': 'error-infield-throwing',
  '상대 내야수가 뜬공 포구에 실패했습니다!': 'error-infield-fly-drop',
  '상대 외야수가 뜬공 포구에 실패했습니다!': 'error-outfield-drop',
  '상대 외야수가 타구를 뒤로 빠뜨렸습니다!': 'error-outfield-through',
  '상대 외야수가 타구를 완전히 뒤로 빠뜨렸습니다!': 'error-outfield-through-clear',
  '상대 외야수가 타구를 애매하게 뒤로 빠뜨렸습니다!': 'error-outfield-through-ambiguous',
  '외야수 실책이 나왔지만 진루하지 않았습니다.': 'error-outfield-through-clear',
  '후속 타자 타구 외야수 실책이 나왔지만 진루하지 않았습니다.': 'error-outfield-through-clear',

  '상대 포수가 공을 뒤로 빠뜨렸습니다!': 'dropped-third-strike-clear',
  '폭투가 나왔지만 진루하지 않았습니다.': 'wild-pitch-ambiguous',
  '내야 땅볼 송구 실책 이후 진루하지 않았습니다.': 'error-infield-throwing-ambiguous',
  '애매한 외야 플라이, 3루에 머뭅니다.': 'sacrifice-fly-ambiguous',
  '애매한 외야 플라이, 태그업을 시도합니다.': 'sacrifice-fly-ambiguous',
  '위험을 감수하고 태그업을 시도합니다.': 'sacrifice-fly-ambiguous',
  '홈 쇄도를 시도합니다.': 'ground-home-rush',
  '홈 진루 실패': 'home-advance-failure',
  '명백하게 깊은 외야 플라이, 태그업 실패': 'home-advance-failure',
  '위험을 감수한 태그업 실패': 'home-advance-failure',
  '명백하게 깊은 외야 플라이, 3루에 머뭅니다.': 'sacrifice-fly-clear',
  '명백하게 깊은 외야 플라이, 태그업을 시도합니다.': 'sacrifice-fly-ambiguous',

  '낫아웃 1루 진루 성공!': 'dropped-third-strike-safe',
  '2루 도루 성공!': 'steal-second-safe',
  '2루 도루 실패': 'steal-second-out',
  '3루 도루 성공!': 'steal-third-safe',
  '3루 도루 실패': 'steal-third-out',
  '2루 진루 성공!': 'advance-second-safe',
  '2루 진루 실패': 'advance-second-out',
  '3루 진루 성공!': 'advance-third-safe',
  '3루 진루 실패': 'advance-third-out',
  '폭투 진루 성공!': 'wild-pitch-advance-safe',
  '폭투 진루 실패': 'wild-pitch-advance-out',
  '태그업 성공!': 'sacrifice-fly-safe',
  '위험을 감수한 태그업 성공!': 'sacrifice-fly-safe',

  '플레이 종료': 'play-end',
}

export const resolveSceneId = (announcement: Pick<ScenarioAnnouncement, 'title' | 'scene'>): SceneId | undefined =>
  announcement.scene ?? SCENE_BY_ANNOUNCEMENT_TITLE[announcement.title]

export const resolveAnnouncementImageBase = (announcement: Pick<ScenarioAnnouncement, 'sceneBase'>, playerBase: number | null): number | null =>
  announcement.sceneBase ?? playerBase

export const resolveAnnouncementDetailView = (view: ScenarioView, playerBase: number | null): ScenarioView =>
  playerBase === 1 ? 'runner:first' : playerBase === 2 ? 'runner:second' : playerBase === 3 ? 'runner:third' : view

/** 이벤트 연출 이미지는 `src/assets/scenes/events/<sceneId>.png` 파일을 사용한다. */
export const resolveSceneImage = (announcement: Pick<ScenarioAnnouncement, 'title' | 'scene'>, _playerBase: number | null): string | undefined => {
  const sceneId = resolveSceneId(announcement)
  if (!sceneId) return undefined
  return EVENT_IMAGES[sceneId]
}

export const resolveSceneImageFilename = (announcement: Pick<ScenarioAnnouncement, 'title' | 'scene'>, _playerBase: number | null): string | undefined => {
  const sceneId = resolveSceneId(announcement)
  if (!sceneId) return undefined
  return `${sceneId}.png`
}

export const resolveViewImage = (view: ScenarioView): string | undefined => VIEW_IMAGES[view]

export const resolveViewImageFilename = (view: ScenarioView): string | undefined => VIEW_IMAGE_FILENAMES[view]

const HOME_IN_DETAIL = /홈에 (?:안전하게 )?들어왔습니다/

/** 홈인 detail은 tone에 맞는 전용 이미지를 사용한다. */
export const resolveAnnouncementDetailSceneId = (
  announcement: Pick<ScenarioAnnouncement, 'title' | 'detail' | 'tone' | 'detailScene'> | undefined,
): SceneId | undefined => {
  if (!announcement) return undefined
  if (announcement.detailScene) return announcement.detailScene
  if (!HOME_IN_DETAIL.test(announcement.detail)) return undefined
  return announcement.tone === 'positive' ? 'home-in-positive' : 'home-in-neutral'
}

export const shouldShareDetailSceneForTitle = (
  announcement: Pick<ScenarioAnnouncement, 'titleImageMode' | 'title' | 'detail' | 'tone' | 'detailScene'> | undefined,
): boolean => announcement?.titleImageMode === 'same-as-detail-scene' && Boolean(resolveAnnouncementDetailSceneId(announcement))

/**
 * 아나운스별로 탭 진행 중 배경에 깔릴 이미지를 만든다. 해당 아나운스에 연출 이미지가 없으면
 * 직전 이미지(없으면 시점 이미지)를 그대로 물려받아 화면이 비지 않게 한다.
 */
export const buildAnnouncementImageTrail = (
  announcements: Array<Pick<ScenarioAnnouncement, 'title' | 'scene' | 'sceneBase'>>,
  view: ScenarioView,
  playerBase: number | null,
): string[] => {
  let last = resolveViewImage(view)
  return announcements.map((announcement) => {
    const imageUrl = resolveSceneImage(announcement, resolveAnnouncementImageBase(announcement, playerBase))
    if (imageUrl) last = imageUrl
    return last ?? ''
  })
}

export const shouldUseViewImageForAnnouncementStep = (announcement: AnnouncementStageMessage | undefined, isSurpriseScene: boolean): boolean =>
  isSurpriseScene && announcement?.category === 'surprise'

export const resolveAnnouncementStepMissingImageName = (
  announcement: AnnouncementStageMessage | undefined,
  playerBase: number | null,
  isSurpriseScene: boolean,
): string | undefined => {
  if (!announcement || shouldUseViewImageForAnnouncementStep(announcement, isSurpriseScene)) return undefined
  return resolveSceneImage(announcement, playerBase) ? undefined : resolveSceneImageFilename(announcement, playerBase)
}

/** 다음 베이스 시점 도착 연출의 성격. docs/ux-ui-guide.md의 "베이스 도착 전환 연출" 절 참고. */
export type BaseArrivalEffect = 'safe' | 'normal' | 'bold' | 'blocked'

const SAFE_ARRIVAL_TITLES = new Set(['볼넷!', '사구!'])
const BLOCKED_ARRIVAL_DETAIL = /움직이지 못했습니다/
const BOLD_ARRIVAL_TEXT = /애매|도루|위험을 감수/

/**
 * 마지막 아나운스 문구로 베이스 도착 전환 컨셉을 추론한다(안전/당연/과감/진루불가).
 * 판별 근거가 되는 문구 패턴이 바뀌면 이 매핑도 함께 갱신해야 한다.
 */
export const resolveBaseArrivalEffect = (
  announcement: Pick<ScenarioAnnouncement, 'title' | 'detail'> | undefined,
): BaseArrivalEffect | undefined => {
  if (!announcement) return undefined
  if (BLOCKED_ARRIVAL_DETAIL.test(announcement.detail)) return 'blocked'
  if (SAFE_ARRIVAL_TITLES.has(announcement.title)) return 'safe'
  if (BOLD_ARRIVAL_TEXT.test(`${announcement.title} ${announcement.detail}`)) return 'bold'
  return 'normal'
}
