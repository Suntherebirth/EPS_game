import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const scenarioPackFiles = [
  'src/game/packs/emptyBasesSingleNodes.ts',
  'src/game/packs/offenseCorePack.ts',
]

describe('scenario text consistency', () => {
  it('does not reintroduce abstract base destinations in scenario packs', () => {
    const forbiddenPhrases = ['다음 베이스', '한 베이스 더']

    for (const filePath of scenarioPackFiles) {
      const source = readFileSync(filePath, 'utf8')
      for (const phrase of forbiddenPhrases) expect(source).not.toContain(phrase)
    }
  })

  it('keeps home advance details destination-aware', () => {
    const sources = [
      readFileSync('src/game/packs/emptyBasesSingleNodes.ts', 'utf8'),
      readFileSync('src/game/announcementMessages.ts', 'utf8'),
    ]
    const homeDetails = sources.flatMap((source) => source.match(/homeDetail:\s*'([^']*)'/g) ?? [])

    expect(homeDetails.length).toBeGreaterThan(0)
    expect(homeDetails.every((detail) => detail.includes('{destination}'))).toBe(true)
  })

  it('keeps migrated announcement templates out of scenario packs', () => {
    const packSources = scenarioPackFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n')
    const migratedTemplates = [
      '이미 스타트를 끊은 상태에서',
      '1루수 뒤로 송구가 완전히 빠졌습니다. 추가 진루를 시도할 수 있습니다.',
      '폭투 진루 성공!',
    ]

    for (const template of migratedTemplates) expect(packSources).not.toContain(template)
  })
})
