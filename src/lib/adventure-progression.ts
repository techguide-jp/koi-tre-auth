import {
  assessmentPoints,
  assessmentStatus,
  assessmentTotal,
  type PracticeAssessment
} from './practice'
import type { CharacterId } from './adventure-catalog'
import { stageRules } from './adventure-story'
export { stageRules } from './adventure-story'

export const PROGRESSION_VERSION = 1 as const
export const affinityLabel = (value: number) =>
  value < 20
    ? '知り合ったばかり'
    : value < 40
      ? '話しやすい'
      : value < 60
        ? '打ち解けてきた'
        : value < 80
          ? '信頼が深まる'
          : '大切な相手'
export interface Relationship {
  characterId: CharacterId
  earned: number
  strain: number
  affinity: number
  label: string
}
export interface EpisodeAchievement {
  characterId: CharacterId
  episodeId: string
  bestScore: number | null
  bestPassingScore: number | null
  contribution: number
  cleared: boolean
}
export interface ProgressionView {
  version: 1
  relationships: Relationship[]
  achievements: EpisodeAchievement[]
  clearedEpisodes: string[]
}
export interface PracticeEvaluation {
  version: 1
  status: 'passed' | 'failed' | 'pending'
  score: number | null
  consideration: number | null
  requiredScore: number
  requiredConsideration: number
  affinityBefore: number
  affinityAfter: number
  earnedDelta: number
  strainDelta: number
  assessment?: PracticeAssessment | null
  retryAfter?: string | null
  pending?: boolean
}
export function gradeConversation(
  assessment: PracticeAssessment | null | undefined,
  chapter?: number
) {
  const rule = stageRules.find((r) => r.chapter === chapter),
    requiredScore = rule?.score ?? 12,
    requiredConsideration = rule?.consideration ?? 3
  // 旧0〜3基準を25点へ換算して攻略判定すると、異なるルーブリックが混ざってしまう。
  const aspects = Array.isArray(assessment?.aspects) ? assessment.aspects : []
  const eligible =
    assessment?.rubric?.version === 3 &&
    aspects.length === 5 &&
    aspects.every((a) => a?.maxScore === 5)
  const score = eligible ? assessmentTotal(assessment) : null
  const aspect = aspects.find((a) => a?.id === 'consideration')
  const consideration = score === null ? null : assessmentPoints(aspect)
  return {
    status:
      score === null
        ? ('pending' as const)
        : score >= requiredScore && consideration! >= requiredConsideration
          ? ('passed' as const)
          : ('failed' as const),
    score,
    consideration,
    requiredScore,
    requiredConsideration,
    certainConsideration: score !== null && assessmentStatus(aspect) === 'rated'
  }
}
export function applyRelationship(
  previous: Pick<Relationship, 'earned' | 'strain'>,
  bestContribution: number,
  grade: ReturnType<typeof gradeConversation>,
  turns: 3 | 6,
  chapter?: number
) {
  const before = previous.earned - previous.strain
  if (grade.status === 'pending')
    return {
      ...previous,
      affinity: before,
      contribution: bestContribution,
      earnedDelta: 0,
      strainDelta: 0
    }
  const contribution =
    grade.status === 'passed'
      ? chapter
        ? 8 + (grade.score! >= grade.requiredScore + 2 ? 2 : 0) + (turns === 6 ? 2 : 0)
        : turns === 6
          ? 3
          : 2
      : 0
  const best = Math.max(bestContribution, contribution)
  const earned = Math.min(100, previous.earned + best - bestContribution)
  let strain = previous.strain
  if (grade.certainConsideration && grade.consideration! < 3)
    strain = Math.min(20, earned, strain + (grade.consideration! < 2 ? 8 : 3))
  else if (grade.score! >= 12 && grade.consideration! >= 3)
    strain = Math.max(0, strain - (turns === 6 ? 6 : 4))
  return {
    earned,
    strain,
    affinity: earned - strain,
    contribution: best,
    earnedDelta: earned - previous.earned,
    strainDelta: strain - previous.strain
  }
}
