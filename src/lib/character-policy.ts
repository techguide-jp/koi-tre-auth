import { characters, type CharacterId } from './adventure-catalog'
import { knowledgeProfiles, type KnowledgeProfile } from './knowledge-policy'

export const characterSections = [
  {
    id: 'profile',
    label: 'プロフィール',
    description: '性格や好きなこと、会話で使う背景を整えます。'
  },
  {
    id: 'values',
    label: '価値観・距離感',
    description: '大切にすることと、心地よい・戸惑う接し方を分けます。'
  },
  { id: 'speech', label: '話し方', description: '言葉遣い、テンポ、その人らしい表現を整えます。' },
  { id: 'stages', label: '関係段階', description: '出会いから親しくなるまでの変化を設定します。' },
  {
    id: 'responses',
    label: '場面別の反応',
    description: '返し方の方針と、参考のセリフを分けて設定します。'
  },
  {
    id: 'reactions',
    label: '好感度のセリフ',
    description: '練習結果で気持ちが動いたときの言葉を設定します。'
  }
] as const
export type CharacterSection = (typeof characterSections)[number]['id']
export const relationshipStages = [
  { id: 'meeting', label: '出会い編' },
  { id: 'date', label: 'デート編' },
  { id: 'honesty', label: '本音編' },
  { id: 'feelings', label: '気持ちを伝える編' },
  { id: 'life', label: '本編後の日常' }
] as const
export const reactionLabels = {
  acknowledgment: '気持ちを受け止めてもらったとき',
  self_expression: '本人の気持ちを聞けたとき',
  questions: '自然なやり取りができたとき',
  connection: '話がつながったとき',
  consideration: '自分のペースを尊重してもらったとき',
  general: '好感度が上がったときの共通の言葉',
  repair: '関係が回復したとき',
  caution: '嬉しさと戸惑いが両方あるとき',
  negative: '好感度が下がったとき'
} as const
export type CharacterReactions = Record<keyof typeof reactionLabels, string>
export interface CharacterContent {
  profile: { personality: string; interests: string; background: string }
  values: { priorities: string; welcomes: string; discomfort: string }
  speech: { tone: string; firstPerson: string; habits: string }
  stages: Record<(typeof relationshipStages)[number]['id'], string>
  responses: Record<KnowledgeProfile, { guidance: string; example: string }>
  reactions: CharacterReactions
}
export interface CharacterPreview {
  revision: number
  contentHash: string
  checkedBy: string
  checkedAt: string
  episodeId: string
  reply: string
  passed: boolean
}
export interface CharacterRelease {
  id: string
  characterId: CharacterId
  version: number
  content: CharacterContent
  contentHash: string
  note: string
  createdBy: string
  createdAt: string
}
export interface CharacterSnapshot {
  releaseId: string | null
  characterId: CharacterId
  version: number | null
  contentHash: string
  content: CharacterContent
}
export interface CharacterOverview {
  characterId: CharacterId
  revision: number
  draft: CharacterContent
  active: CharacterRelease | null
  preview: CharacterPreview | null
  releases: Omit<CharacterRelease, 'content'>[]
}

export function parseCharacterId(value: unknown): CharacterId {
  const found = characters.find((c) => c.id === value)
  if (!found) throw Error('人物を選んでください。')
  return found.id
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('入力形式を確認してください。')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, required = true) {
  if (
    typeof value !== 'string' ||
    value.includes('\0') ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw Error(`必須項目を入力し、${max}字以内にしてください。`)
  return value.trim()
}
export function parseCharacterContent(value: unknown): CharacterContent {
  const v = object(value),
    p = object(v.profile),
    w = object(v.values),
    s = object(v.speech),
    stages = object(v.stages),
    responses = object(v.responses),
    reactions = object(v.reactions)
  const result: CharacterContent = {
    profile: {
      personality: text(p.personality, 150),
      interests: text(p.interests, 100),
      background: text(p.background, 120, false)
    },
    values: {
      priorities: text(w.priorities, 120),
      welcomes: text(w.welcomes, 100),
      discomfort: text(w.discomfort, 100)
    },
    speech: {
      tone: text(s.tone, 100),
      firstPerson: text(s.firstPerson, 12),
      habits: text(s.habits, 80)
    },
    stages: Object.fromEntries(
      relationshipStages.map((stage) => [stage.id, text(stages[stage.id], 140)])
    ) as CharacterContent['stages'],
    responses: Object.fromEntries(
      knowledgeProfiles.map((id) => {
        const response = object(responses[id])
        return [
          id,
          { guidance: text(response.guidance, 120), example: text(response.example, 120, false) }
        ]
      })
    ) as CharacterContent['responses'],
    reactions: Object.fromEntries(
      Object.keys(reactionLabels).map((id) => [id, text(reactions[id], 140)])
    ) as CharacterReactions
  }
  // 基本人物像を毎回欠かさず渡せるよう、個別上限とは別に生成入力の予算を守る。
  const coreLength = JSON.stringify([result.profile, result.values, result.speech]).length
  if (coreLength > 1000)
    throw Error('プロフィール・価値観・話し方は、合わせてもう少し短くしてください。')
  return result
}
export function parseCharacterSection(section: unknown, value: unknown, current: CharacterContent) {
  if (!characterSections.some((s) => s.id === section))
    throw Error('編集する項目を選んでください。')
  return parseCharacterContent({ ...current, [section as CharacterSection]: value })
}
