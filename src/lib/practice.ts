import {
  resolveAdventure,
  type Adventure,
  type AdventureReward,
  type Presentation,
  type Rehearsal
} from './adventure'
import type { StoryContext, StoryEnding } from './adventure'
export const PRACTICE_LIMIT = 10
export const PRACTICE_TURNS = 3
export const MAX_PRACTICE_TURNS = 6
export const practiceTurnLimit = (adventure?: Adventure | null) =>
  adventure?.turns ?? PRACTICE_TURNS
export const MAX_MESSAGE_LENGTH = 1000
export const MAX_SITUATION_LENGTH = 500
export const MAX_PARTNER_NAME_LENGTH = 20
export const MAX_OPENING_LINE_LENGTH = 200

export interface CustomSceneInput {
  situation: string
  partnerName: string
  openingLine: string
}

export function normalizeCustomScene(value: unknown): CustomSceneInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const fields = value as Record<string, unknown>
  if (typeof fields.situation !== 'string') return null
  if (fields.partnerName !== undefined && typeof fields.partnerName !== 'string') return null
  if (fields.openingLine !== undefined && typeof fields.openingLine !== 'string') return null
  const situation = fields.situation.trim()
  const partnerName = ((fields.partnerName as string | undefined)?.trim() || 'はる').replace(
    /さん$/u,
    ''
  )
  const openingLine = (fields.openingLine as string | undefined)?.trim() || ''
  if (
    !situation ||
    [situation, partnerName, openingLine].some((text) => text.includes('\0')) ||
    situation.length > MAX_SITUATION_LENGTH ||
    !partnerName ||
    partnerName.length > MAX_PARTNER_NAME_LENGTH ||
    /[\r\n\t]/u.test(partnerName) ||
    openingLine.length > MAX_OPENING_LINE_LENGTH
  )
    return null
  return { situation, partnerName, openingLine }
}

export const scenes = [
  {
    id: 'cafe',
    title: '初対面のカフェ',
    partnerName: 'はる',
    partnerDescription: 'カフェで初めて会う相手。穏やかで、話を聞くのが好き。',
    subtitle: '最初のひと言から、自然に話し始める。',
    goal: 'あいさつに、自分のことや相手への質問を少し添える',
    opener:
      'はじめまして、はるです。お会いできてうれしいです。このカフェ、落ち着きますね。普段もカフェにはよく来ますか？',
    hint: '自分のことをひと言伝えて、相手にも聞いてみましょう。'
  },
  {
    id: 'hobbies',
    title: '趣味・休日の話を広げる',
    partnerName: 'あおい',
    partnerDescription: '休日の過ごし方を話している相手。散歩や新しいお店が好き。',
    subtitle: '質問だけで終わらない、話題の広げ方。',
    goal: '相手の話に反応し、自分の経験も交えて話題を広げる',
    opener:
      'あおいです。最近、休日に少し遠くまで散歩するのにはまっているんです。お休みの日は、どんなふうに過ごすことが多いですか？',
    hint: '相手の話への感想と、自分の話を組み合わせてみましょう。'
  },
  {
    id: 'silence',
    title: 'デート中に会話が途切れたとき',
    partnerName: 'りん',
    partnerDescription: '一緒に食事をしている相手。おいしいものをゆっくり楽しみたい。',
    subtitle: '沈黙を急いで埋めずに、次の話題へ。',
    goal: '目の前のことをきっかけに、答えやすい話題を出す',
    opener:
      '（りんさんとの食事がひと段落して、少し静かな時間になりました。）ここの料理、おいしかったですね。',
    hint: '料理やお店のことなど、今共有していることから話してみましょう。'
  }
] as const

export type BuiltInSceneId = (typeof scenes)[number]['id']
export type SceneId = BuiltInSceneId | 'custom' | 'adventure'
export interface PracticeScene {
  id: SceneId
  title: string
  subtitle: string
  partnerName: string
  partnerDescription: string
  goal: string
  opener: string
  hint: string
  situation?: string
  coachingProfile?: string
  character?: { id: string; age: number; gender: string; detail: string }
  mission?: { id: string; label: string; instructions: string }
}
export function findScene(id: unknown) {
  return scenes.find((scene) => scene.id === id)
}

export type PartnerPreference = 'unspecified' | 'male' | 'female'
const malePartnerNames: Record<BuiltInSceneId, string> = {
  cafe: 'ゆう',
  hobbies: 'そうた',
  silence: 'れん'
}

export function partnerNameForScene(id: BuiltInSceneId, preference: PartnerPreference) {
  return preference === 'male' ? malePartnerNames[id] : findScene(id)!.partnerName
}

export function sceneWithPartner(
  id: BuiltInSceneId,
  preference: PartnerPreference
): CustomSceneInput | undefined {
  if (preference === 'unspecified') return undefined
  const scene = findScene(id)!
  const partnerName = partnerNameForScene(id, preference)
  // 相手の選択は既存の場面設定として保存し、再開時や再練習でも同じ相手を使う。
  // 利用者本人の性別・性的指向の設定や推測には使わない。
  return {
    situation: `${scene.title}。練習相手は成人の${preference === 'male' ? '男性' : '女性'}です。${scene.partnerDescription}練習の目標：${scene.goal}。`,
    partnerName,
    openingLine: scene.opener.replaceAll(scene.partnerName, partnerName)
  }
}

export function resolveScene(
  id: SceneId,
  customScene: CustomSceneInput | null = null,
  adventure?: Adventure | null
): PracticeScene | undefined {
  if (id === 'adventure') return resolveAdventure(adventure)
  if (id !== 'custom') return findScene(id)
  if (!customScene) return undefined
  return {
    id: 'custom',
    title: '自分で決めた場面',
    subtitle: customScene.situation,
    situation: customScene.situation,
    partnerName: customScene.partnerName,
    partnerDescription: 'あなたが指定した場面で会話する相手です。',
    goal: '設定した場面で、いつもの自分の言葉を使って会話する',
    opener:
      customScene.openingLine ||
      `（${customScene.partnerName}さんが、あなたの言葉を待っています。設定した場面に合わせて、最初のひと言から話してみましょう。）`,
    hint: '設定した状況と、相手に伝えたいことを思い浮かべて返してみましょう。'
  }
}

export const analysisAspects = [
  { id: 'acknowledgment', label: '受け止め・共感' },
  { id: 'self_expression', label: '自分の伝え方' },
  { id: 'questions', label: 'キャッチボール' },
  { id: 'connection', label: '話題のつながり' },
  { id: 'consideration', label: '距離感・配慮' }
] as const
export type AnalysisAspectId = (typeof analysisAspects)[number]['id']
export interface PracticeEvidence {
  turn: number
  quote: string
}
export interface PracticeAssessment {
  provider: 'jev'
  model: string
  rubric?: { version: 2 | 3; profile: string }
  policy?: import('./knowledge-policy').KnowledgeTrace
  aspects: {
    id: AnalysisAspectId
    score: number
    confidence: number
    observable: number
    probabilities?: number[]
    maxScore?: 5
  }[]
}
export interface PracticeAnalysis {
  version: 2 | 3
  policy?: import('./knowledge-policy').KnowledgeTrace
  summary: string
  strengths: { title: string; observation: string; evidence: PracticeEvidence[] }[]
  improvements: {
    title: string
    observation: string
    suggestion: string
    evidence: PracticeEvidence[]
  }[]
  aspects: { id: AnalysisAspectId; observation: string; evidence: PracticeEvidence[] }[]
  turns: {
    turn: number
    observation: string
    quote: string
    rewrite: string
    reason: string
    rewritePurpose?: string
    alternative?: { purpose: string; rewrite: string; reason: string }
  }[]
  nextPractice: { goal: string; example: string }
  assessment?: PracticeAssessment
  development?: { observation: string; before: PracticeEvidence; after: PracticeEvidence }
}
export type AssessmentStatus = 'rated' | 'reference' | 'insufficient' | 'uncertain' | 'unavailable'
export function assessmentStatus(value?: PracticeAssessment['aspects'][number]): AssessmentStatus {
  if (
    !value ||
    !(value.observable >= 0 && value.observable <= 1) ||
    !(value.confidence >= 0 && value.confidence <= 1) ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > (value.maxScore ?? 3)
  )
    return 'unavailable'
  if (value.observable < 0.7) return 'insufficient'
  // 隣接段階で迷うだけなら参考値にする。離れた段階へ分散した平均値は描かない。
  if (value.probabilities) {
    const p = value.probabilities
    const total = p.reduce((sum, probability) => sum + probability, 0)
    if (
      p.length !== (value.maxScore ?? 3) + 1 ||
      p.some((probability) => !(probability >= 0 && probability <= 1)) ||
      Math.abs(total - 1) > 0.02
    )
      return 'unavailable'
    const mean = p.reduce((sum, probability, level) => sum + (probability / total) * level, 0)
    const variance = p.reduce(
      (sum, probability, level) => sum + (probability / total) * (level - mean) ** 2,
      0
    )
    if (variance * (3 / (value.maxScore ?? 3)) ** 2 > 1) return 'uncertain'
  }
  // 過去の評価には分布がないため、低確信の保存済みスコアも断定せず参考表示する。
  return value.confidence >= 0.7 ? 'rated' : 'reference'
}
export function assessmentValue(value?: PracticeAssessment['aspects'][number]): number | null {
  const status = assessmentStatus(value)
  return status === 'rated' || status === 'reference' ? value!.score : null
}
export function assessmentLabel(value: PracticeAssessment['aspects'][number]) {
  const status = assessmentStatus(value)
  if (status === 'insufficient') return '材料不足'
  if (status === 'uncertain') return '評価に幅あり'
  const score = assessmentValue(value)
  if (score === null) return '未評価'
  const normalized = (score * 3) / (value.maxScore ?? 3)
  if (normalized >= 2.5) return 'よくできている'
  if (normalized >= 1.5) return 'できている'
  return '工夫の余地あり'
}
export function assessmentPoints(value?: PracticeAssessment['aspects'][number]) {
  const score = assessmentValue(value)
  return score === null ? null : Math.round(((score * 5) / (value?.maxScore ?? 3)) * 10) / 10
}
export function assessmentTotal(assessment?: PracticeAssessment) {
  if (
    !assessment ||
    assessment.aspects.length !== analysisAspects.length ||
    new Set(assessment.aspects.map((a) => a.id)).size !== analysisAspects.length
  )
    return null
  const points = analysisAspects.map(({ id }) =>
    assessmentPoints(assessment.aspects.find((a) => a.id === id))
  )
  return points.some((p) => p === null)
    ? null
    : Math.round(points.reduce<number>((sum, p) => sum + p!, 0) * 10) / 10
}

export interface PracticeFeedback {
  strength: string
  improvement: string
  quote: string
  rewrite: string
  // 過去の振り返りは4項目だけで保存されているため、拡充した分析は任意にする。
  analysis?: PracticeAnalysis
}

export interface PracticeTurn {
  requestId: string
  position: number
  userText: string
  assistantText: string
  feedback: PracticeFeedback | null
  presentation?: Presentation | null
}

export interface PracticeSession {
  evaluation?: import('./adventure-progression').PracticeEvaluation | null
  id: string
  sceneId: SceneId
  customScene: CustomSceneInput | null
  chargedAt: string | null
  completedAt: string | null
  turns: PracticeTurn[]
  pending: { requestId: string; text: string; until: string | null } | null
  adventure?: Adventure | null
  reward?: AdventureReward | null
  favoriteTurn?: number | null
  rehearsal?: Rehearsal | null
  creditCost?: number
  storyContext?: StoryContext | null
  storyEnding?: StoryEnding | null
}

export interface PracticeOverview {
  remaining: number
  limit: number
  reserved: number
  activePracticeId: string | null
  latestPracticeId: string | null
  resetsAt: string
  billing?: import('./billing').BillingOverview
}
