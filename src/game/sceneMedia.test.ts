import { describe, expect, it } from 'vitest'
import { buildAnnouncementImageTrail, resolveAnnouncementDetailSceneId, resolveAnnouncementDetailView, resolveAnnouncementImageBase, resolveAnnouncementStepMissingImageName, resolveSceneImageFilename, resolveViewImageFilename, shouldShareDetailSceneForTitle, shouldUseViewImageForAnnouncementStep } from './sceneMedia'

describe('scene media fallback names', () => {
  it('returns the expected filename for an infield ground ball event', () => {
    expect(resolveSceneImageFilename({ title: '내야 땅볼 발생!', scene: undefined }, 1)).toBe('ball-ground-infield.png')
  })

  it('returns the shared outfield fly ball filename for a follow-up batter', () => {
    expect(resolveSceneImageFilename({ title: '후속타자의 외야 뜬공 발생!', scene: undefined }, 1)).toBe('ball-fly-outfield.png')
  })

  it('returns the dedicated fielder movement filename for an outfield fly ball detail', () => {
    expect(resolveSceneImageFilename({ title: '외야 뜬공 발생!', scene: 'ball-fly-outfield-fielder-moving' }, 1)).toBe('ball-fly-outfield-fielder-moving.png')
  })

  it('returns the dedicated fielder movement filename for an infield ground ball detail', () => {
    expect(resolveSceneImageFilename({ title: '내야 땅볼 발생!', scene: 'ball-ground-infield-fielder-moving' }, 1)).toBe('ball-ground-infield-fielder-moving.png')
  })

  it('returns the expected filename for the batter view', () => {
    expect(resolveViewImageFilename('batter')).toBe('view-batter.png')
  })

  it('keeps normal hit announcements on event imagery inside a surprise scene', () => {
    expect(shouldUseViewImageForAnnouncementStep({ title: '1루타 성공!', category: 'normal' }, true)).toBe(false)
    expect(resolveAnnouncementStepMissingImageName({ title: '1루타 성공!', category: 'normal' }, 1, true)).toBeUndefined()
  })

  it('uses the view background for the active surprise announcement step', () => {
    expect(shouldUseViewImageForAnnouncementStep({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다!', category: 'surprise' }, true)).toBe(true)
    expect(resolveAnnouncementStepMissingImageName({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다!', category: 'surprise' }, 1, true)).toBeUndefined()
  })

  it('returns expected filenames for surprise-only follow-up announcements', () => {
    expect(resolveSceneImageFilename({ title: '폭투가 나왔지만 진루하지 않았습니다.', scene: 'wild-pitch-ambiguous' }, 2)).toBe('wild-pitch-ambiguous.png')
    expect(resolveSceneImageFilename({ title: '내야 땅볼 송구 실책 이후 진루하지 않았습니다.', scene: undefined }, 1)).toBe('error-infield-throwing-ambiguous.png')
  })

  it('keeps clear and ambiguous event images distinct', () => {
    expect(resolveSceneImageFilename({ title: '내야 땅볼 송구 실책!', scene: 'error-first-base-catch-clear' }, 1)).toBe('error-first-base-catch-clear.png')
    expect(resolveSceneImageFilename({ title: '내야 땅볼 송구 실책!', scene: 'error-first-base-catch-ambiguous' }, 1)).toBe('error-first-base-catch-ambiguous.png')
    expect(resolveSceneImageFilename({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-clear' }, 1)).toBe('error-outfield-through-clear.png')
    expect(resolveSceneImageFilename({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-ambiguous' }, 1)).toBe('error-outfield-through-ambiguous.png')
    expect(resolveSceneImageFilename({ title: '상대 포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-clear' }, null)).toBe('wild-pitch-clear.png')
    expect(resolveSceneImageFilename({ title: '상대 포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-ambiguous' }, null)).toBe('wild-pitch-ambiguous.png')
  })

  it('selects home-in imagery from the detail tone', () => {
    expect(resolveAnnouncementDetailSceneId({ title: '홈 쇄도 성공!', detail: '3루 주자가 홈에 들어왔습니다.', tone: 'positive' })).toBe('home-in-positive')
    expect(resolveAnnouncementDetailSceneId({ title: '내야 땅볼 중 홈 추가진루 성공!', detail: '송구를 받은 상대 1루수가 홈에 던졌지만, 3루 주자가 먼저 홈 쇄도에 성공했습니다.', tone: 'positive', detailScene: 'home-in-positive' })).toBe('home-in-positive')
    expect(resolveAnnouncementDetailSceneId({ title: '주자 진루', detail: '홈에 들어왔습니다.', tone: 'neutral' })).toBe('home-in-neutral')
    expect(resolveAnnouncementDetailSceneId({ title: '주자 진루', detail: '홈에 들어왔습니다.' })).toBe('home-in-neutral')
  })

  it('uses the ambiguous sacrifice fly image during a deep fly tag-up attempt', () => {
    expect(resolveSceneImageFilename({ title: '명백하게 깊은 외야 플라이, 태그업을 시도합니다.', scene: undefined }, 3)).toBe('sacrifice-fly-ambiguous.png')
  })

  it('uses the ground-ball home rush image during a home rush attempt', () => {
    expect(resolveSceneImageFilename({ title: '홈 쇄도를 시도합니다.', scene: undefined }, 3)).toBe('ground-home-rush.png')
  })

  it('uses one shared image for failed home advances and tag-ups', () => {
    expect(resolveSceneImageFilename({ title: '후속타자의 내야 땅볼 중 홈 쇄도 실패', scene: 'home-advance-failure' }, 3)).toBe('home-advance-failure.png')
    expect(resolveSceneImageFilename({ title: '홈 진루 실패', scene: 'home-advance-failure' }, 3)).toBe('home-advance-failure.png')
    expect(resolveSceneImageFilename({ title: '위험을 감수한 태그업 실패', scene: undefined }, 3)).toBe('home-advance-failure.png')
    expect(resolveSceneImageFilename({ title: '명백하게 깊은 외야 플라이, 태그업 실패', scene: undefined }, 3)).toBe('home-advance-failure.png')
  })

  it('uses advance-ambiguous-out image for base advance failures', () => {
    expect(resolveSceneImageFilename({ title: '2루 진루 실패', scene: undefined }, 1)).toBe('advance-ambiguous-out.png')
    expect(resolveSceneImageFilename({ title: '3루 진루 실패', scene: undefined }, 2)).toBe('advance-ambiguous-out.png')
    expect(resolveSceneImageFilename({ title: '추가 진루 실패', scene: undefined }, 2)).toBe('advance-ambiguous-out.png')
    expect(resolveSceneImageFilename({ title: '후속 타자 내야 땅볼 3루 진루 실패', scene: undefined }, 2)).toBe('advance-ambiguous-out.png')
  })

  it('uses advance-clear and advance-ambiguous-safe images for base advance successes', () => {
    expect(resolveSceneImageFilename({ title: '2루 진루 성공!', scene: undefined }, 1)).toBe('advance-clear.png')
    expect(resolveSceneImageFilename({ title: '3루 진루 성공!', scene: undefined }, 2)).toBe('advance-clear.png')
    expect(resolveSceneImageFilename({ title: '홈 진루 성공!', scene: undefined }, 3)).toBe('home-in-positive.png')
    expect(resolveSceneImageFilename({ title: '외야수 실책 추가 진루 성공!', scene: undefined }, 2)).toBe('advance-clear.png')
    expect(resolveSceneImageFilename({ title: '내야 땅볼 송구 실책 추가 진루 성공!', scene: undefined }, 1)).toBe('advance-clear.png')
    expect(resolveSceneImageFilename({ title: '2루 도루 성공!', scene: undefined }, 1)).toBe('advance-ambiguous-safe.png')
    expect(resolveSceneImageFilename({ title: '후속 타자 내야 땅볼 3루 진루 성공!', scene: undefined }, 2)).toBe('advance-ambiguous-safe.png')
  })

  it('uses ground-throw-ready for throw title and ground-first-base-catch for ground out completed', () => {
    expect(resolveSceneImageFilename({ title: '상대 내야수가 1루 송구에 성공했습니다!', scene: undefined }, 3)).toBe('ground-throw-ready.png')
    expect(resolveSceneImageFilename({ title: '땅볼 처리 성공!', scene: undefined }, 1)).toBe('ground-first-base-catch.png')
  })

  it('shares a dedicated detail scene only when explicitly requested', () => {
    expect(shouldShareDetailSceneForTitle({ title: '명백하게 깊은 외야 플라이, 태그업을 시도합니다.', detail: '안전하게 태그업할 수 있는 타구입니다.', detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' })).toBe(true)
    expect(resolveAnnouncementDetailSceneId({ title: '태그업 성공!', detail: '3루 주자가 홈에 안전하게 들어왔습니다.', tone: 'neutral' })).toBe('home-in-neutral')
    expect(shouldShareDetailSceneForTitle({ title: '태그업 성공!', detail: '3루 주자가 홈에 안전하게 들어왔습니다.', tone: 'neutral', titleImageMode: 'same-as-detail-scene' })).toBe(true)
    expect(shouldShareDetailSceneForTitle({ title: '위험을 감수하고 태그업을 시도합니다.', detail: '홈 태그업 성공률 60%', detailScene: 'sacrifice-fly-ambiguous', titleImageMode: 'same-as-detail-scene' })).toBe(true)
    expect(shouldShareDetailSceneForTitle({ title: '태그업 성공!', detail: '3루 주자가 홈에 들어왔습니다.', tone: 'positive', detailScene: 'home-in-positive', titleImageMode: 'same-as-detail-scene' })).toBe(true)
    expect(shouldShareDetailSceneForTitle({ title: '2루타 성공!', detail: '2루에 도착했습니다.' })).toBe(false)
  })

  it('shares follow-up ground-ball detail imagery with the title step', () => {
    expect(shouldShareDetailSceneForTitle({ title: '후속타자의 내야 땅볼 발생!', detail: '내야수가 타구를 처리하러 이동합니다.', detailScene: 'ball-ground-infield-fielder-moving' })).toBe(false)
    expect(shouldShareDetailSceneForTitle({ title: '상대 내야수가 땅볼 포구에 성공했습니다!', detail: '송구를 준비합니다.', detailScene: 'ground-fielded', titleImageMode: 'same-as-detail-scene' })).toBe(true)
    expect(shouldShareDetailSceneForTitle({ title: '상대 내야수, 1루 송구 준비 완료!', detail: '3루 주자는 위험을 감수하고 송구 시점에 맞춰 홈 쇄도를 시도할 수 있습니다.', detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' })).toBe(true)
    expect(shouldShareDetailSceneForTitle({ title: '홈 쇄도를 시도합니다.', detail: '상대 내야수가 송구하는 순간 홈으로 쇄도합니다.', detailScene: 'ground-home-rush', titleImageMode: 'same-as-detail-scene' })).toBe(true)
  })

  it('uses shared event imagery regardless of player base', () => {
    expect(resolveSceneImageFilename({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-clear' }, 2)).toBe('error-outfield-through-clear.png')
    expect(resolveSceneImageFilename({ title: '상대 외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-ambiguous' }, 2)).toBe('error-outfield-through-ambiguous.png')
    expect(resolveSceneImageFilename({ title: '상대 포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-clear' }, 2)).toBe('wild-pitch-clear.png')
    expect(resolveSceneImageFilename({ title: '상대 포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-ambiguous' }, 2)).toBe('wild-pitch-ambiguous.png')
  })

  it('keeps a follow-up hit title at its starting base and shows detail from its destination', () => {
    const announcement = { title: '후속타자의 1루타!', sceneBase: 1 }

    expect(resolveAnnouncementImageBase(announcement, 2)).toBe(1)
    expect(resolveSceneImageFilename(announcement, resolveAnnouncementImageBase(announcement, 2))).toBe('hit-single.png')
    expect(buildAnnouncementImageTrail([announcement], 'result', 2)[0]).toContain('hit-single')
    expect(resolveAnnouncementDetailView('result', 2)).toBe('runner:second')
  })
})
