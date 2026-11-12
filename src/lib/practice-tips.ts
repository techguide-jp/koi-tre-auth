import { episodeById, isLifeEpisode } from './adventure'
import type { CoachingKind } from './adventure-catalog'
import { practiceTurnLimit, type PracticeSession } from './practice'
import tips from './practice-tip-content.json'

export type TipGroup = CoachingKind | 'everyday' | 'custom'
export interface PracticeTip {
  id: string
  group: TipGroup
  title: string
  tip: string
  example: string
  prompt: string
}

export const tipSelfRatings = [
  { id: 'comfortable', label: '自然にできる' },
  { id: 'intentional', label: '意識すればできる' },
  { id: 'difficult', label: 'まだ苦手' }
] as const
export type TipSelfRating = (typeof tipSelfRatings)[number]['id']

export interface TipRating {
  id: number
  value: TipSelfRating
  ratedAt: string
}
export interface TipOffer {
  tipId: string
  rating: TipRating | null
}
export interface CollectedTip extends TipOffer {
  collectedAt: string
}
export interface GuestTip extends TipOffer {
  shownAt: string
}

export const tipGroups: Record<TipGroup, string> = {
  first_meeting: '出会い・第一印象',
  interests: '趣味・会話を広げる',
  silence: '沈黙・話題の切り替え',
  invitation: '誘い方・約束',
  boundary: '距離感・断り方',
  positive_event: 'うれしい出来事を分かち合う',
  conflict: 'すれ違い・仲直り',
  feelings: '本音・気持ちを伝える',
  everyday: '日常・関係を育てる',
  custom: '自分で決めた場面'
}
export const practiceTips = tips as PracticeTip[]
export const practiceTipById = (id: string) => practiceTips.find((tip) => tip.id === id)
export const tipRatingLabel = (value: TipSelfRating) =>
  tipSelfRatings.find((rating) => rating.id === value)?.label ?? ''
type PracticeTipContext = Pick<PracticeSession, 'sceneId' | 'adventure'>
const sceneGroups: Record<Exclude<PracticeSession['sceneId'], 'adventure'>, TipGroup> = {
  cafe: 'first_meeting',
  hobbies: 'interests',
  silence: 'silence',
  custom: 'custom'
}

export function isFinalPracticeReply(
  practice: Pick<PracticeSession, 'completedAt' | 'adventure' | 'turns'>
) {
  return (
    !practice.completedAt && practice.turns.length + 1 === practiceTurnLimit(practice.adventure)
  )
}

function tipGroup({ sceneId, adventure }: PracticeTipContext): TipGroup {
  if (sceneId !== 'adventure') return sceneGroups[sceneId]
  const episode = episodeById(adventure?.episodeId)
  if (!episode) return 'custom'
  const profile = episode.coachingProfile
  if (isLifeEpisode(episode.id) && (profile === 'interests' || profile === 'invitation'))
    return 'everyday'
  return profile
}

export function drawPracticeTip(
  practice: PracticeTipContext,
  lastShown: ReadonlyMap<string, string>,
  randomIndex: (length: number) => number
): PracticeTip {
  const group = tipGroup(practice)
  const candidates = practiceTips.filter((tip) => tip.group === group)
  const unseen = candidates.filter((tip) => !lastShown.has(tip.id))
  const pool = unseen.length
    ? unseen
    : candidates
        .sort((a, b) => (lastShown.get(a.id) ?? '').localeCompare(lastShown.get(b.id) ?? ''))
        .slice(0, 3)
  return pool[randomIndex(pool.length)]
}
