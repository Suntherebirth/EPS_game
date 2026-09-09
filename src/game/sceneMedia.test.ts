import { describe, expect, it } from 'vitest'
import { resolveAnnouncementStepMissingImageName, resolveSceneImageFilename, resolveViewImageFilename, shouldUseViewImageForAnnouncementStep } from './sceneMedia'

describe('scene media fallback names', () => {
  it('returns the expected filename for an infield ground ball event', () => {
    expect(resolveSceneImageFilename({ title: '내야 땅볼 발생!', scene: undefined }, 1)).toBe('ball-ground-infield@1.png')
  })

  it('returns the expected filename for the batter view', () => {
    expect(resolveViewImageFilename('batter')).toBe('view-batter.png')
  })

  it('keeps normal hit announcements on event imagery inside a surprise scene', () => {
    expect(shouldUseViewImageForAnnouncementStep({ title: '1루타 성공!', category: 'normal' }, true)).toBe(false)
    expect(resolveAnnouncementStepMissingImageName({ title: '1루타 성공!', category: 'normal' }, 1, true)).toBe('hit-single@1.png')
  })

  it('uses the view background for the active surprise announcement step', () => {
    expect(shouldUseViewImageForAnnouncementStep({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', category: 'surprise' }, true)).toBe(true)
    expect(resolveAnnouncementStepMissingImageName({ title: '외야수가 타구를 뒤로 빠뜨렸습니다!', category: 'surprise' }, 1, true)).toBeUndefined()
  })
})
