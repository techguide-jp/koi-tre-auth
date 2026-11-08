import { describe, expect, it } from 'vitest'
import { affinityReaction } from './affinity-reaction'
import { characters } from './adventure'
import { gradeConversation } from './adventure-progression'
import type { PracticeSession } from './practice'
import { assessedFeedback, progressionAssessment } from './server/fixtures/progression-assessment'

function session(delta = 10, consideration = 4): PracticeSession {
  const text =
    consideration < 3
      ? '疲れているとか関係ないよ。今すぐ僕に合わせて。'
      : '今日は少し疲れたので、静かに過ごしたいです。'
  const feedback = assessedFeedback(text, 20, consideration)
  feedback.analysis!.strengths = [
    {
      title: '希望を伝えた',
      observation: '自分の希望を言葉にした',
      evidence: [{ turn: 1, quote: text }]
    }
  ]
  feedback.analysis!.improvements = [
    {
      title: '相手のペースも確認する',
      observation: '踏み込みが強い',
      suggestion: '相手の意思も聞く',
      evidence: [{ turn: 1, quote: text }]
    }
  ]
  const assessment = feedback.analysis!.assessment!
  return {
    id: 'fixture',
    sceneId: 'adventure',
    customScene: null,
    chargedAt: null,
    completedAt: '2026-11-09T00:00:00Z',
    pending: null,
    adventure: { version: 1, characterId: 'aoi', episodeId: 'aoi-7', turns: 3 },
    turns: [
      {
        position: 1,
        requestId: 'fixture-turn',
        userText: text,
        assistantText: '希望を聞かせてくれてありがとう。',
        feedback
      }
    ],
    evaluation: {
      version: 1,
      ...gradeConversation(assessment, 7),
      affinityBefore: 30,
      affinityAfter: 30 + delta,
      earnedDelta: Math.max(0, delta),
      strainDelta: Math.max(0, -delta),
      assessment
    }
  }
}

describe('好感度の変化へのキャラクターの反応', () => {
  it('実際の上昇に笑顔で反応し、本人の発言を根拠として添える', () => {
    const value = session()
    expect(affinityReaction(value)).toMatchObject({
      direction: 'positive',
      emotion: 'smile',
      evidence: { turn: 1, quote: value.turns[0].userText }
    })
  })
  it('確かな配慮評価で実際に低下した場合に戸惑いを示す', () => {
    expect(affinityReaction(session(-8, 1))).toMatchObject({
      direction: 'negative',
      emotion: 'puzzled'
    })
  })
  it('回復による上昇では、ほっとした反応にする', () => {
    const value = session(4)
    value.evaluation!.earnedDelta = 0
    value.evaluation!.strainDelta = -4
    expect(affinityReaction(value)).toMatchObject({ direction: 'positive', emotion: 'relieved' })
  })
  it('不合格・上限・自己ベスト据え置きを、悲しい反応にしない', () => {
    const value = session(0)
    value.evaluation!.status = 'failed'
    expect(affinityReaction(value)).toBeNull()
    value.evaluation!.status = 'passed'
    value.evaluation!.affinityBefore = value.evaluation!.affinityAfter = 100
    expect(affinityReaction(value)).toBeNull()
  })
  it('丁寧に断ったことや意見の違いだけで、ネガティブな反応を作らない', () => {
    const value = session(-3, 4)
    expect(affinityReaction(value)).toBeNull()
  })
  it('判断待ち・旧採点・評価欠損・未完了では反応を作らない', () => {
    const pending = session(-8, 1)
    pending.evaluation!.status = 'pending'
    const legacy = session()
    legacy.evaluation!.assessment!.rubric!.version = 2
    const missing = session()
    missing.evaluation = null
    const unfinished = session()
    unfinished.completedAt = null
    for (const value of [pending, legacy, missing, unfinished])
      expect(affinityReaction(value)).toBeNull()
  })
  it('確信の低い評価に、ネガティブな演出を付けない', () => {
    const value = session(-8, 1)
    value.evaluation!.assessment!.aspects[4].confidence = 0.3
    expect(affinityReaction(value)).toBeNull()
  })
  it('実在しない引用や相手の発言を、本人の発言として添えない', () => {
    const value = session()
    for (const aspect of value.turns[0].feedback!.analysis!.aspects)
      aspect.evidence = [{ turn: 1, quote: value.turns[0].assistantText }]
    expect(affinityReaction(value)?.evidence).toBeUndefined()
    expect(affinityReaction(value)?.speech).toContain('今日は一緒に話せて')
  })
  it('根拠がある観点でセリフを変え、6人の口調を使い分ける', () => {
    const value = session()
    value.evaluation!.assessment = progressionAssessment(18, 4)
    value.turns[0].feedback!.analysis!.aspects = value.turns[0].feedback!.analysis!.aspects.filter(
      (a) => a.id === 'self_expression'
    )
    const speeches = characters.map((character) => {
      value.adventure!.characterId = character.id
      return affinityReaction(value)!.speech
    })
    expect(new Set(speeches).size).toBe(6)
    expect(speeches[0]).toContain('気持ちを聞かせて')
  })
  it('総合では上昇しても、低い配慮評価を無条件に褒めない', () => {
    const value = session(5, 2)
    const result = affinityReaction(value)
    expect(result).toMatchObject({ direction: 'positive', emotion: 'puzzled', evidence: undefined })
    expect(result!.speech).toContain('私のペースも')
  })
})
