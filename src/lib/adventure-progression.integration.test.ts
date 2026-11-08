import { describe, expect, it } from 'vitest'
import { applyRelationship, gradeConversation, stageRules } from './adventure-progression'
import { progressionAssessment } from './server/fixtures/progression-assessment'
import { adventureAccess, stageProgress } from './adventure'
import type { PracticeAssessment } from './practice'

describe('攻略ルールv1の境界と回復', () => {
  it.each(stageRules)('第$chapter話の必要好感度は$affinityで、直前の値では開かない', (rule) => {
    const progression = {
      version: 1 as const,
      relationships: [
        {
          characterId: 'aoi' as const,
          earned: rule.affinity,
          strain: 0,
          affinity: rule.affinity,
          label: ''
        }
      ],
      achievements: [],
      clearedEpisodes: stageRules
        .filter((r) => r.chapter < rule.chapter)
        .map((r) => `aoi:aoi-${r.chapter}`)
    }
    const selection = {
      version: 1 as const,
      characterId: 'aoi' as const,
      episodeId: `aoi-${rule.chapter}`,
      turns: 3 as const
    }
    expect(adventureAccess(selection, [], ['aoi'], false, new Date(), progression)).toBe(
      'available'
    )
    if (rule.affinity > 0) {
      progression.relationships[0].affinity--
      expect(adventureAccess(selection, [], ['aoi'], false, new Date(), progression)).toBe(
        'affinity'
      )
      const stage = stageProgress(progression, ['aoi']).find(
        (s) => s.episodeId === selection.episodeId
      )!
      expect(stage).toMatchObject({
        requiredScore: rule.score,
        requiredAffinity: rule.affinity,
        affinityGap: 1,
        lockedReasons: ['affinity']
      })
    }
  })
  it.each(stageRules)('第$chapter話は$score点と配慮$consideration点を要求する', (rule) => {
    expect(
      gradeConversation(progressionAssessment(rule.score, rule.consideration), rule.chapter).status
    ).toBe('passed')
    expect(
      gradeConversation(progressionAssessment(rule.score - 0.1, rule.consideration), rule.chapter)
        .status
    ).toBe('failed')
    expect(
      gradeConversation(progressionAssessment(rule.score, rule.consideration - 0.1), rule.chapter)
        .status
    ).toBe('failed')
  })
  it('旧採点・欠損・部分評価を不合格や0点に換算しない', () => {
    const legacy = progressionAssessment()
    legacy.rubric!.version = 2
    const partial = progressionAssessment()
    partial.aspects[0].observable = 0.1
    const malformed = {
      rubric: { version: 3 },
      aspects: undefined
    } as unknown as PracticeAssessment
    for (const assessment of [undefined, legacy, partial, malformed]) {
      const grade = gradeConversation(assessment, 1)
      expect(grade).toMatchObject({ status: 'pending', score: null, consideration: null })
      expect(applyRelationship({ earned: 20, strain: 3 }, 8, grade, 6, 1)).toMatchObject({
        earned: 20,
        strain: 3,
        earnedDelta: 0,
        strainDelta: 0
      })
    }
  })
  it('同じ話の加点は自己最高との差分だけで、6往復にも上積みがある', () => {
    const grade = gradeConversation(progressionAssessment(18, 4), 1)
    const first = applyRelationship({ earned: 0, strain: 0 }, 0, grade, 3, 1)
    expect(first).toMatchObject({ earned: 10, contribution: 10 })
    const repeat = applyRelationship(first, first.contribution, grade, 3, 1)
    expect(repeat.earnedDelta).toBe(0)
    const deep = applyRelationship(repeat, repeat.contribution, grade, 6, 1)
    expect(deep).toMatchObject({ earned: 12, earnedDelta: 2, contribution: 12 })
  })
  it('確信の低い配慮評価では減点しない', () => {
    const assessment = progressionAssessment(12, 1)
    assessment.aspects[4].confidence = 0.3
    expect(
      applyRelationship({ earned: 30, strain: 0 }, 0, gradeConversation(assessment), 3)
    ).toMatchObject({ earned: 30, strain: 0 })
  })
  it('すれ違いを20までに留め、同じ場面でも回復できる', () => {
    const bad = gradeConversation(progressionAssessment(12, 1))
    let state = { earned: 50, strain: 0 }
    for (let i = 0; i < 10; i++) state = applyRelationship(state, 3, bad, 3)
    expect(state.strain).toBe(20)
    const good = gradeConversation(progressionAssessment(18, 4))
    const short = applyRelationship(state, 3, good, 3)
    const deep = applyRelationship(state, 3, good, 6)
    expect(short).toMatchObject({ earned: 50, strain: 16, earnedDelta: 0 })
    expect(deep).toMatchObject({ earned: 50, strain: 14, earnedDelta: 0 })
    expect(applyRelationship({ earned: 0, strain: 0 }, 0, bad, 6).strain).toBe(0)
  })
  it('3往復だけでも共通場面と自己ベスト改善で全12話へ到達できる', () => {
    let state = { earned: 0, strain: 0 }
    const contributions = new Map<string, number>()
    for (const rule of stageRules) {
      let attempts = 0
      while (state.earned - state.strain < rule.affinity) {
        const key = `common-${attempts}`
        const result = applyRelationship(
          state,
          contributions.get(key) ?? 0,
          gradeConversation(progressionAssessment(18, 4)),
          3
        )
        state = result
        contributions.set(key, result.contribution)
        if (++attempts > 6) throw Error('3往復で到達できない条件')
      }
      expect(state.earned - state.strain).toBeGreaterThanOrEqual(rule.affinity)
      state = applyRelationship(
        state,
        0,
        gradeConversation(
          progressionAssessment(rule.score, Math.max(3, rule.consideration)),
          rule.chapter
        ),
        3,
        rule.chapter
      )
    }
    expect(state.earned).toBe(100)
  })
})
