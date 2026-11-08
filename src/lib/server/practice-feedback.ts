import {
  analysisAspects,
  PRACTICE_TURNS,
  type PracticeAnalysis,
  type PracticeAssessment,
  type PracticeEvidence,
  type PracticeFeedback
} from '$lib/practice'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid practice analysis')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0'))
    throw new Error('Invalid practice analysis text')
  return value.trim()
}
function list(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error('Invalid practice analysis list')
  return value
}
function evidence(value: unknown, userTexts: string[]): PracticeEvidence {
  const item = record(value)
  const turn = item.turn
  const quote = text(item.quote, 1000)
  if (
    typeof turn !== 'number' ||
    !Number.isInteger(turn) ||
    turn < 1 ||
    turn > userTexts.length ||
    !userTexts[turn - 1].includes(quote)
  )
    throw new Error('Analysis quote does not match conversation')
  return { turn, quote }
}
function citations(value: unknown, userTexts: string[], min = 1) {
  return list(value, min, PRACTICE_TURNS).map((item) => evidence(item, userTexts))
}
function parseAnalysis(value: unknown, userTexts: string[]): PracticeAnalysis {
  const item = record(value)
  if (item.version !== 2 || userTexts.length !== PRACTICE_TURNS)
    throw new Error('Invalid practice analysis version')
  const strengths = list(item.strengths, 0, 3).map((value) => {
    const point = record(value)
    return {
      title: text(point.title, 100),
      observation: text(point.observation),
      evidence: citations(point.evidence, userTexts)
    }
  })
  const improvements = list(item.improvements, 0, 3).map((value) => {
    const point = record(value)
    return {
      title: text(point.title, 100),
      observation: text(point.observation),
      suggestion: text(point.suggestion),
      evidence: citations(point.evidence, userTexts)
    }
  })
  const aspects = list(item.aspects, analysisAspects.length, analysisAspects.length).map(
    (value) => {
      const aspect = record(value)
      const definition = analysisAspects.find(({ id }) => id === aspect.id)
      if (!definition) throw new Error('Invalid analysis aspect')
      return {
        id: definition.id,
        observation: text(aspect.observation),
        evidence: citations(aspect.evidence, userTexts, 0)
      }
    }
  )
  if (new Set(aspects.map(({ id }) => id)).size !== analysisAspects.length)
    throw new Error('Duplicate analysis aspect')
  const turns = list(item.turns, PRACTICE_TURNS, PRACTICE_TURNS).map((value) => {
    const turn = record(value)
    const rewrite = text(turn.rewrite)
    const alternative = turn.alternative == null ? undefined : record(turn.alternative)
    const alternate = alternative
      ? {
          purpose: text(alternative.purpose, 80),
          rewrite: text(alternative.rewrite),
          reason: text(alternative.reason)
        }
      : undefined
    return {
      ...evidence(turn, userTexts),
      observation: text(turn.observation),
      rewrite,
      reason: text(turn.reason),
      ...(turn.rewritePurpose === undefined
        ? {}
        : { rewritePurpose: text(turn.rewritePurpose, 80) }),
      // 任意の別案が主案と重複しても、根拠を検証済みの分析全体は失敗させない。
      ...(alternate && alternate.rewrite !== rewrite ? { alternative: alternate } : {})
    }
  })
  if (new Set(turns.map(({ turn }) => turn)).size !== PRACTICE_TURNS)
    throw new Error('Duplicate analysis turn')
  const next = record(item.nextPractice)
  return {
    version: 2,
    summary: text(item.summary),
    strengths,
    improvements,
    aspects: analysisAspects.map(({ id }) => aspects.find((aspect) => aspect.id === id)!),
    turns: turns.sort((a, b) => a.turn - b.turn),
    nextPractice: { goal: text(next.goal), example: text(next.example) }
  }
}

export function parsePracticeOutput(
  value: unknown,
  userTexts: string[],
  final: boolean,
  assessment: PracticeAssessment | null = null
): { reply: string; feedback: PracticeFeedback | null } {
  const output = record(typeof value === 'string' ? JSON.parse(value) : value)
  const reply = text(output.reply)
  if (!final) return { reply, feedback: null }
  const fields = record(output.feedback)
  const quote = text(fields.quote, 1000)
  if (!userTexts.some((original) => original.includes(quote)))
    throw new Error('Feedback quote does not match conversation')
  const feedback: PracticeFeedback = {
    strength: text(fields.strength),
    improvement: text(fields.improvement),
    quote,
    rewrite: text(fields.rewrite)
  }
  // 新形式が壊れていたら旧形式に黙って落とさず、同じ入力から再試行できるようにする。
  if (fields.analysis !== undefined) {
    feedback.analysis = parseAnalysis(fields.analysis, userTexts)
    // LLMが評価モデルや数値を捏造しても、実際のJevレスポンス以外は保存しない。
    if (assessment) feedback.analysis.assessment = assessment
  }
  return { reply, feedback }
}
