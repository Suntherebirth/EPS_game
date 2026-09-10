import { describe, expect, it } from 'vitest'
import { buildAnnouncementImageTrail, resolveAnnouncementDetailView, resolveAnnouncementImageBase, resolveAnnouncementStepMissingImageName, resolveSceneImageFilename, resolveViewImageFilename, shouldUseViewImageForAnnouncementStep } from './sceneMedia'

describe('scene media fallback names', () => {
  it('returns the expected filename for an infield ground ball event', () => {
    expect(resolveSceneImageFilename({ title: '내야 땅볼 발생!', scene: undefined }, 1)).toBe('ball-ground-infield@1.png')
  })

  it('returns the expected filename for the batter view', () => {
    expect(resolveViewImageFilename('batter')).toBe('view-batter.png')
  })

  it('keeps normal hit announcements on event imagery inside a surprise scene', () => {
    expect(shouldUseViewImageForAnnouncementStep({ title: '1루타 성공!', category: 'normal' }, true)).toBe(false)
    expect(resolveAnnouncementStepMissingImageName({ title: '1루타 성공!', category: 'normal' }, 1, true)).toBeUndefined()
  })

  it('uses the view background for the active surprise announcement step', () => {
    expect(shouldUseViewImageForAnnouncementStep({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', category: 'surprise' }, true)).toBe(true)
    expect(resolveAnnouncementStepMissingImageName({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', category: 'surprise' }, 1, true)).toBeUndefined()
  })

  it('returns expected filenames for surprise-only follow-up announcements', () => {
    expect(resolveSceneImageFilename({ title: '폭투가 나왔지만 진루하지 않았습니다.', scene: undefined }, 2)).toBe('wild-pitch-ambiguous@1.png')
    expect(resolveSceneImageFilename({ title: '내야 땅볼 송구 실책 이후 진루하지 않았습니다.', scene: undefined }, 1)).toBe('error-infield-throwing-ambiguous@1.png')
  })

  it('keeps clear and ambiguous event images distinct', () => {
    expect(resolveSceneImageFilename({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-clear' }, 1)).toBe('error-outfield-through-clear@1.png')
    expect(resolveSceneImageFilename({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-ambiguous' }, 1)).toBe('error-outfield-through-ambiguous@1.png')
    expect(resolveSceneImageFilename({ title: '포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-clear' }, null)).toBe('wild-pitch-clear.png')
    expect(resolveSceneImageFilename({ title: '포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-ambiguous' }, null)).toBe('wild-pitch-ambiguous.png')
  })

  it('reuses first-base imagery for dropped third strikes and wild pitches at second base', () => {
    expect(resolveSceneImageFilename({ title: '포수가 공을 뒤로 빠뜨렸습니다!', scene: 'dropped-third-strike-clear' }, 2)).toBe('dropped-third-strike-clear@1.png')
    expect(resolveSceneImageFilename({ title: '포수가 공을 뒤로 빠뜨렸습니다!', scene: 'dropped-third-strike-ambiguous' }, 2)).toBe('dropped-third-strike-ambiguous@1.png')
    expect(resolveSceneImageFilename({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-clear' }, 2)).toBe('error-outfield-through-clear@1.png')
    expect(resolveSceneImageFilename({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', scene: 'error-outfield-through-ambiguous' }, 2)).toBe('error-outfield-through-ambiguous@1.png')
    expect(resolveSceneImageFilename({ title: '포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-clear' }, 2)).toBe('wild-pitch-clear@1.png')
    expect(resolveSceneImageFilename({ title: '포수가 공을 뒤로 빠뜨렸습니다!', scene: 'wild-pitch-ambiguous' }, 2)).toBe('wild-pitch-ambiguous@1.png')
  })

  it('keeps a follow-up hit title at its starting base and shows detail from its destination', () => {
    const announcement = { title: '후속타자의 1루타!', sceneBase: 1 }

    expect(resolveAnnouncementImageBase(announcement, 2)).toBe(1)
    expect(resolveSceneImageFilename(announcement, resolveAnnouncementImageBase(announcement, 2))).toBe('hit-single@1.png')
    expect(buildAnnouncementImageTrail([announcement], 'result', 2)[0]).toContain('hit-single@1')
    expect(resolveAnnouncementDetailView('result', 2)).toBe('runner:second')
  })
})
