import { describe, expect, it } from 'vitest'
import { episodes, type Adventure } from './adventure'
import type { PracticeTurn } from './practice'
import { drawPracticeTip, isFinalPracticeReply } from './practice-tips'
import tips from './practice-tip-content.json'

function turns(count: number): PracticeTurn[] {
  return Array.from({ length: count }, (_, index) => ({
    requestId: String(index),
    position: index + 1,
    userText: '架空の発言',
    assistantText: '架空の返答',
    feedback: null
  }))
}

describe('最終返答の待ち時間に表示するTips', () => {
  it.each([3, 6] as const)('%i往復の最後の返答だけが対象になる', (limit) => {
    const adventure: Adventure = {
      version: 1,
      characterId: 'aoi',
      episodeId: 'aoi-1',
      turns: limit
    }
    expect(isFinalPracticeReply({ adventure, completedAt: null, turns: turns(limit - 2) })).toBe(
      false
    )
    expect(isFinalPracticeReply({ adventure, completedAt: null, turns: turns(limit - 1) })).toBe(
      true
    )
    expect(
      isFinalPracticeReply({ adventure, completedAt: '2026-11-12', turns: turns(limit) })
    ).toBe(false)
  })

  it('本編72話で場面のテーマに対応するTipsを選べる', () => {
    const mainEpisodes = episodes.filter((episode) => episode.chapter)
    expect(mainEpisodes).toHaveLength(72)
    const groupsById = new Map(tips.map((tip) => [tip.id, tip.group]))
    for (const episode of mainEpisodes) {
      const tip = drawPracticeTip(
        {
          sceneId: 'adventure',
          adventure: {
            version: 1,
            characterId: episode.characterId!,
            episodeId: episode.id,
            turns: 3
          }
        },
        new Map(),
        () => 0
      )
      expect(groupsById.get(tip.id), episode.id).toBe(episode.coachingProfile)
    }
  })

  it('未収集の場面内候補から選び、収集後は最近見ていない候補を優先する', () => {
    const practice = { sceneId: 'hobbies' as const }
    const group = tips.filter(({ group }) => group === 'interests')
    const seen = new Map<string, string>()
    for (const [i, tip] of group.entries()) {
      expect(drawPracticeTip(practice, seen, () => 0).id).toBe(tip.id)
      seen.set(tip.id, new Date(2026, 0, i + 1).toISOString())
    }
    expect(drawPracticeTip(practice, seen, (length) => length - 1).id).toBe(group[2].id)
  })
})
