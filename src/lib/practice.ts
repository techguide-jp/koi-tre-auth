export const PRACTICE_LIMIT = 10
export const PRACTICE_TURNS = 3
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
export type SceneId = BuiltInSceneId | 'custom'
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
  customScene: CustomSceneInput | null = null
): PracticeScene | undefined {
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
  { id: 'questions', label: '質問の答えやすさ' },
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
  aspects: {
    id: AnalysisAspectId
    score: number
    confidence: number
    observable: number
  }[]
}
export interface PracticeAnalysis {
  version: 2
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
  }[]
  nextPractice: { goal: string; example: string }
  assessment?: PracticeAssessment
}
export function assessmentValue(value?: PracticeAssessment['aspects'][number]): number | null {
  // 判断保留の値を0として描くと、評価材料の不足が低評価に見えてしまう。
  if (
    !value ||
    !(value.observable >= 0.7 && value.observable <= 1) ||
    !(value.confidence >= 0.7 && value.confidence <= 1) ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 3
  )
    return null
  return value.score
}
export function assessmentLabel(value: PracticeAssessment['aspects'][number]) {
  const score = assessmentValue(value)
  if (score === null) return '判断保留'
  if (score >= 2.5) return 'よくできている'
  if (score >= 1.5) return 'できている'
  return '工夫の余地あり'
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
}

export interface PracticeSession {
  id: string
  sceneId: SceneId
  customScene: CustomSceneInput | null
  chargedAt: string | null
  completedAt: string | null
  turns: PracticeTurn[]
  pending: { requestId: string; text: string; until: string | null } | null
}

export interface PracticeOverview {
  remaining: number
  limit: number
  reserved: number
  activePracticeId: string | null
  latestPracticeId: string | null
  resetsAt: string
}
