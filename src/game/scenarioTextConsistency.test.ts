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
    const source = readFileSync('src/game/packs/emptyBasesSingleNodes.ts', 'utf8')
    const homeDetails = source.match(/homeDetail:\s*'([^']*)'/g) ?? []

    expect(homeDetails.length).toBeGreaterThan(0)
    expect(homeDetails.every((detail) => detail.includes('{destination}'))).toBe(true)
  })
})
