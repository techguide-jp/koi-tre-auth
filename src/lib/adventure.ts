import { characters, episodes, missions, type CharacterId } from './adventure-catalog'
import type { PracticeEvidence, PracticeScene } from './practice'
import { dailyEpisodes, eventEpisode, eventPublished } from './adventure-life'
import type { BillingOverview } from './billing'
import type { ProgressionView } from './adventure-progression'
import { stageRules } from './adventure-story'
export { characters, episodes, missions } from './adventure-catalog'
export type { Character, CharacterId, Episode, PartnerGender } from './adventure-catalog'

export const emotions = ['neutral', 'smile', 'shy', 'thinking', 'puzzled', 'relieved'] as const
export type Emotion = (typeof emotions)[number]
export const emotionLabels: Record<Emotion, string> = {
  neutral: 'いつもの表情',
  smile: '楽しそうな笑顔',
  shy: '少し照れた表情',
  thinking: '考え中',
  puzzled: '少し戸惑った表情',
  relieved: 'ほっとした表情'
}
export interface Presentation {
  emotion: Emotion
  gesture: string
}
export interface Adventure {
  version: 1
  characterId: CharacterId
  episodeId: string
  turns: 3 | 6
  revisit?: true
}
export interface MissionResult {
  id: string
  evidence: PracticeEvidence[]
}
export interface AdventureReward {
  version: 1
  xp: 20 | 30 | 50 | 70
  mission: MissionResult | null
}
export interface Rehearsal {
  position: number
  requestId: string
  text: string
  reply?: string
  presentation?: Presentation
}
export interface AdventureProgress {
  progression?: ProgressionView
  stages?: StageProgress[]
  xp: number
  level: number
  xpInLevel: number
  completed: number
  completedEpisodes: string[]
  badges: { id: string; label: string; description: string; earned: boolean }[]
  memories: {
    practiceId: string
    characterId: CharacterId
    episodeId: string
    title: string
    completedAt: string
    variant?: 'short' | 'deep'
    quote?: string
    emotion?: Emotion
  }[]
  favorites: { practiceId: string; characterId: CharacterId; position: number; text: string }[]
  billing?: BillingOverview
  endings?: {
    practiceId: string
    characterId: CharacterId
    kind: StoryEndingKind
    selected: boolean
  }[]
}
export interface StageProgress {
  characterId: CharacterId
  episodeId: string
  cleared: boolean
  requiredScore: number
  requiredConsideration: number
  requiredAffinity: number
  bestScore: number | null
  affinity: number
  scoreGap: number
  affinityGap: number
  lockedReasons: ('previous' | 'affinity' | 'purchase')[]
}
export function stageProgress(progression: ProgressionView, owned: CharacterId[]): StageProgress[] {
  return characters.flatMap((character) =>
    stageRules.map((rule) => {
      const episodeId = `${character.id}-${rule.chapter}`
      const cleared = progression.clearedEpisodes.includes(episodeKey(character.id, episodeId))
      const achievement = progression.achievements.find(
        (a) => a.characterId === character.id && a.episodeId === episodeId
      )
      const affinity =
        progression.relationships.find((r) => r.characterId === character.id)?.affinity ?? 0
      const lockedReasons: StageProgress['lockedReasons'] = []
      if (
        !cleared &&
        rule.chapter > 1 &&
        !progression.clearedEpisodes.includes(
          episodeKey(character.id, `${character.id}-${rule.chapter - 1}`)
        )
      )
        lockedReasons.push('previous')
      if (!cleared && affinity < rule.affinity) lockedReasons.push('affinity')
      if (rule.chapter > 3 && !owned.includes(character.id)) lockedReasons.push('purchase')
      return {
        characterId: character.id,
        episodeId,
        cleared,
        requiredScore: rule.score,
        requiredConsideration: rule.consideration,
        requiredAffinity: rule.affinity,
        bestScore: achievement?.bestScore ?? null,
        affinity,
        scoreGap: Math.max(0, rule.score - (achievement?.bestScore ?? 0)),
        affinityGap: cleared ? 0 : Math.max(0, rule.affinity - affinity),
        lockedReasons
      }
    })
  )
}
export type StoryEndingKind = 'lovers' | 'slow'
export interface StoryEnding {
  kind: StoryEndingKind
  reason: string
  evidence: PracticeEvidence[]
}
export interface StoryContext {
  version: 1
  relationship: string
  chapter: number | null
  revisit: boolean
  memories: { episodeId: string; userQuote: string; partnerReply: string }[]
  affinity?: { value: number; label: string }
}
export const characterById = (id: unknown) => characters.find((c) => c.id === id)
export const episodeById = (id: unknown) =>
  episodes.find((e) => e.id === id) ?? dailyEpisodes.find((e) => e.id === id) ?? eventEpisode(id)
export const isLifeEpisode = (id: string) => id.startsWith('daily-') || id.startsWith('event-')
export function normalizeAdventure(value: unknown): Adventure | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const character = characterById(input.characterId),
    episode = episodeById(input.episodeId)
  if (
    !character ||
    !episode ||
    (episode.characterId && episode.characterId !== character.id) ||
    ![3, 6].includes(Number(input.turns)) ||
    typeof input.turns !== 'number'
  )
    return null
  return {
    version: 1,
    characterId: character.id,
    episodeId: episode.id,
    turns: input.turns as 3 | 6,
    ...(input.revisit === true ? { revisit: true as const } : {})
  }
}
export const episodeKey = (characterId: string, episodeId: string) => `${characterId}:${episodeId}`
export function episodeUnlocked(adventure: Adventure, completed: string[]) {
  const episode = episodeById(adventure.episodeId)
  if (!episode || (episode.characterId && episode.characterId !== adventure.characterId))
    return false
  return (
    !episode.chapter ||
    episode.chapter === 1 ||
    completed.includes(
      episodeKey(adventure.characterId, `${adventure.characterId}-${episode.chapter - 1}`)
    )
  )
}
export function adventureAccess(
  adventure: Adventure,
  completed: string[],
  owned: CharacterId[],
  plus: boolean,
  now = new Date(),
  progression?: ProgressionView
): 'available' | 'locked' | 'affinity' | 'purchase' | 'plus' | 'unpublished' {
  const episode = episodeById(adventure.episodeId)
  if (progression) {
    completed = progression.clearedEpisodes
    const cleared = completed.includes(episodeKey(adventure.characterId, adventure.episodeId))
    const affinity =
      progression.relationships.find((r) => r.characterId === adventure.characterId)?.affinity ?? 0
    if (
      episode?.chapter &&
      !cleared &&
      episodeUnlocked(adventure, completed) &&
      affinity < stageRules[episode.chapter - 1].affinity
    )
      return 'affinity'
  }
  if (!episode || !episodeUnlocked(adventure, completed)) return 'locked'
  if (
    adventure.revisit &&
    (!episode.chapter || !completed.includes(episodeKey(adventure.characterId, episode.id)))
  )
    return 'locked'
  if (isLifeEpisode(episode.id)) {
    if (!owned.includes(adventure.characterId)) return 'purchase'
    if (!completed.includes(episodeKey(adventure.characterId, `${adventure.characterId}-12`)))
      return 'locked'
    if (episode.id.startsWith('event-') && !eventPublished(episode.id, now)) return 'unpublished'
    return plus ? 'available' : 'plus'
  }
  return (episode.chapter ?? 0) > 3 && !owned.includes(adventure.characterId)
    ? 'purchase'
    : 'available'
}
export function parseStoryEnding(
  value: unknown,
  adventure: Adventure,
  texts: string[]
): StoryEnding | null {
  if (episodeById(adventure.episodeId)?.chapter !== 12 || !value || typeof value !== 'object')
    return null
  const input = value as Record<string, unknown>
  if (
    !['lovers', 'slow'].includes(String(input.kind)) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 600 ||
    !Array.isArray(input.evidence) ||
    input.evidence.length < 1 ||
    input.evidence.length > 3
  )
    return null
  const evidence: PracticeEvidence[] = []
  for (const item of input.evidence) {
    if (!item || typeof item !== 'object') return null
    const { turn, quote } = item as Record<string, unknown>
    if (
      typeof turn !== 'number' ||
      !Number.isInteger(turn) ||
      typeof quote !== 'string' ||
      !quote.trim() ||
      !texts[turn - 1]?.includes(quote)
    )
      return null
    evidence.push({ turn, quote })
  }
  return { kind: input.kind as StoryEndingKind, reason: input.reason.trim(), evidence }
}
export function nextEpisode(characterId: CharacterId, completed: string[]) {
  const own = episodes.filter((e) => e.characterId === characterId)
  return (
    own.find(
      (e) =>
        !completed.includes(episodeKey(characterId, e.id)) &&
        episodeUnlocked({ version: 1, characterId, episodeId: e.id, turns: 6 }, completed)
    ) ??
    episodes.find(
      (episode) => !episode.characterId && !completed.includes(episodeKey(characterId, episode.id))
    ) ??
    own[0]
  )
}
export function resolveAdventure(
  adventure: Adventure | null | undefined
): PracticeScene | undefined {
  const normalized = normalizeAdventure(adventure)
  if (!normalized) return undefined
  const character = characterById(normalized.characterId)!,
    episode = episodeById(normalized.episodeId)!
  return {
    id: 'adventure',
    title: episode.title,
    subtitle: episode.subtitle,
    partnerName: character.name,
    partnerDescription: character.description,
    goal: missions[episode.missionId].label,
    opener: episode.opener,
    hint: '気の利いた言葉でなくても大丈夫。今の気持ちを、あなたの言葉で。',
    situation: episode.setting,
    coachingProfile: episode.coachingProfile,
    character: {
      id: character.id,
      age: character.age,
      gender: character.gender,
      detail: character.detail
    },
    mission: { id: episode.missionId, ...missions[episode.missionId] }
  }
}
export function parsePresentation(value: unknown): Presentation {
  if (!value || typeof value !== 'object') return { emotion: 'neutral', gesture: '' }
  const fields = value as Record<string, unknown>
  return {
    emotion: emotions.includes(fields.emotion as Emotion) ? (fields.emotion as Emotion) : 'neutral',
    gesture:
      typeof fields.gesture === 'string' &&
      fields.gesture.length <= 100 &&
      !fields.gesture.includes('\0')
        ? fields.gesture.trim()
        : ''
  }
}
export function parseMission(
  value: unknown,
  adventure: Adventure | null | undefined,
  userTexts: string[]
): MissionResult | null {
  if (!adventure || !value || typeof value !== 'object') return null
  const fields = value as Record<string, unknown>,
    episode = episodeById(adventure.episodeId)
  if (
    !episode ||
    fields.id !== episode.missionId ||
    fields.achieved !== true ||
    !Array.isArray(fields.evidence) ||
    fields.evidence.length < 1 ||
    fields.evidence.length > 2
  )
    return null
  const evidence: PracticeEvidence[] = []
  for (const raw of fields.evidence) {
    if (!raw || typeof raw !== 'object') return null
    const { turn, quote } = raw as Record<string, unknown>
    if (
      typeof turn !== 'number' ||
      !Number.isInteger(turn) ||
      typeof quote !== 'string' ||
      !quote.trim() ||
      quote.length > 1000 ||
      !userTexts[turn - 1]?.includes(quote)
    )
      return null
    evidence.push({ turn, quote })
  }
  return { id: episode.missionId, evidence }
}
export function emptyAdventureProgress(): AdventureProgress {
  return {
    xp: 0,
    level: 1,
    xpInLevel: 0,
    completed: 0,
    completedEpisodes: [],
    memories: [],
    favorites: [],
    badges: [
      {
        id: 'first',
        label: 'はじめの一歩',
        description: 'はじめてのエピソードを終える',
        earned: false
      },
      {
        id: 'mission',
        label: 'ひと言の勇気',
        description: 'ミッションを3回達成する',
        earned: false
      },
      {
        id: 'story',
        label: '出会いの3話',
        description: '一人のキャラクターの出会い編を終える',
        earned: false
      },
      {
        id: 'encounters',
        label: '広がる出会い',
        description: '3人のキャラクターと話す',
        earned: false
      }
    ]
  }
}
