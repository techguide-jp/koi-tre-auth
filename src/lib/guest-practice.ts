import { normalizeAdventure, type Adventure, type MissionResult } from './adventure'
import type { PracticeTurn } from './practice'
import type { KnowledgeTrace } from './knowledge-policy'

export const GUEST_RETENTION_DAYS = 30
export function guestAdventure(value: unknown): Adventure | null {
  const adventure = normalizeAdventure(value)
  return adventure &&
    adventure.turns === 3 &&
    adventure.episodeId === `${adventure.characterId}-1` &&
    !adventure.revisit
    ? adventure
    : null
}
export const guestLoginUrl = (id: string) => `/login?practice=${encodeURIComponent(id)}&guest=1`
export interface GuestTurn extends PracticeTurn {
  mission?: MissionResult | null
  policyContext?: KnowledgeTrace | null
}
export interface GuestPracticeState {
  turns: GuestTurn[]
  completedAt: string | null
  pending: { requestId: string; text: string; until: string | null } | null
}
