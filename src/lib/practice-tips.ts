import { episodeById, isLifeEpisode } from './adventure'
import type { CoachingKind } from './adventure-catalog'
import { practiceTurnLimit, type PracticeSession } from './practice'
import tips from './practice-tip-content.json'

type TipGroup = CoachingKind | 'everyday' | 'custom'
export interface PracticeTip {
  id: string
  title: string
  tip: string
  example: string
  prompt: string
}

export const tipSelfRatings = [
  { id: 'comfortable', label: '自然にできる' },
  { id: 'intentional', label: '意識すればできる' },
  { id: 'difficult', label: 'まだ苦手' },
  { id: 'not_used', label: '今回は使っていない' }
] as const
export type TipSelfRating = (typeof tipSelfRatings)[number]['id']

type PracticeTipContext = Pick<PracticeSession, 'id' | 'sceneId' | 'adventure'>
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

export function practiceTipFor(practice: PracticeTipContext): PracticeTip {
  const group = tipGroup(practice)
  const candidates = tips.filter((tip) => tip.group === group)
  // 再送や再開で同じ自己評価を復元するため、会話IDから同じヒントを選ぶ。
  let hash = 0
  for (const character of practice.id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  return candidates[hash % candidates.length]
}
