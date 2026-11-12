import { describe, expect, it } from 'vitest'
import { episodes, type Adventure } from './adventure'
import type { PracticeTurn } from './practice'
import { isFinalPracticeReply, practiceTipFor } from './practice-tips'
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
      const tip = practiceTipFor({
        id: 'sample-' + episode.id,
        sceneId: 'adventure',
        adventure: {
          version: 1,
          characterId: episode.characterId!,
          episodeId: episode.id,
          turns: 3
        }
      })
      expect(groupsById.get(tip.id), episode.id).toBe(episode.coachingProfile)
    }
  })

  it('同じ練習の再送では同じTipsを選び、別の練習では候補に幅がある', () => {
    const context = { sceneId: 'hobbies' as const, id: 'practice-a' }
    expect(practiceTipFor(context)).toEqual(practiceTipFor({ ...context }))
    const chosen = Array.from({ length: 20 }, (_, i) =>
      practiceTipFor({ ...context, id: 'practice-' + i })
    )
    expect(new Set(chosen.map((tip) => tip.id)).size).toBeGreaterThan(1)
    expect(chosen.every((tip) => tips.find(({ id }) => id === tip.id)?.group === 'interests')).toBe(
      true
    )
  })
})
