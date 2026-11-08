import { analysisAspects, type PracticeAssessment, type PracticeFeedback } from '$lib/practice'

export function progressionAssessment(total = 23, consideration = 5): PracticeAssessment {
  const remainder = Math.round((total - consideration) * 10)
  let index = 0
  return {
    provider: 'jev',
    model: 'fixture-only',
    rubric: { version: 3, profile: 'interests' },
    aspects: analysisAspects.map(({ id }) => {
      const i = index++
      return {
        id,
        score:
          id === 'consideration'
            ? consideration
            : (Math.floor(remainder / 4) + (i < remainder % 4 ? 1 : 0)) / 10,
        maxScore: 5,
        confidence: 1,
        observable: 1
      }
    })
  }
}

export function assessedFeedback(text: string, total = 23, consideration = 5): PracticeFeedback {
  return {
    strength: 'テスト用の受け止め',
    improvement: 'テスト用の次の目標',
    quote: text,
    rewrite: text,
    analysis: {
      version: 3,
      summary: '進行・保存を検証するための架空の分析。',
      strengths: [],
      improvements: [],
      aspects: analysisAspects.map(({ id }) => ({
        id,
        observation: '検証用の観察',
        evidence: [{ turn: 1, quote: text }]
      })),
      turns: [
        { turn: 1, observation: '検証用の観察', quote: text, rewrite: text, reason: '検証用の理由' }
      ],
      nextPractice: { goal: '検証用の目標', example: text },
      assessment: progressionAssessment(total, consideration)
    }
  }
}
