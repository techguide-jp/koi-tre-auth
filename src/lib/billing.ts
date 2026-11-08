import { characters, type CharacterId } from './adventure-catalog'

export const ROUTE_PRICE = 1480
export const PLUS_PRICE = 980
export const FREE_CREDITS = 10
export const ROUTE_CREDITS = 24
export const PLUS_CREDITS = 60
export type CreditKind = 'free' | 'plus' | 'route'
export interface CreditAllocation {
  grantId: string
  units: number
}
export interface CreditGrantView {
  id: string
  kind: CreditKind
  characterId: CharacterId | null
  units: number
  remaining: number
  expiresAt: string | null
}
export interface BillingOverview {
  enabled: boolean
  testMode: boolean
  ownedCharacters: CharacterId[]
  subscription: {
    active: boolean
    status: string
    periodStart: string
    periodEnd: string
    cancelAtPeriodEnd: boolean
  } | null
  credits: CreditGrantView[]
  remaining: number
  reserved: number
  resetsAt: string
}
export type BillingProduct = { kind: 'route'; characterId: CharacterId } | { kind: 'plus' }
export function billingProduct(value: unknown): BillingProduct | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (input.kind === 'plus') return { kind: 'plus' }
  const person = characters.find((c) => c.id === input.characterId)
  return input.kind === 'route' && person ? { kind: 'route', characterId: person.id } : null
}
export const productKey = (product: BillingProduct) =>
  product.kind === 'plus' ? 'plus' : `route:${product.characterId}`
export const practiceCreditCost = (turns: number) => (turns === 6 ? 2 : 1)
export function availableCredits(
  grants: CreditGrantView[],
  characterId?: CharacterId,
  routeEligible = false
) {
  return grants
    .filter((g) => g.kind !== 'route' || (routeEligible && g.characterId === characterId))
    .reduce((sum, g) => sum + g.remaining, 0)
}
export function allocateCredits(
  grants: CreditGrantView[],
  units: number,
  characterId?: CharacterId,
  routeEligible = false
): CreditAllocation[] | null {
  const eligible = grants
    .filter(
      (g) =>
        g.remaining > 0 && (g.kind !== 'route' || (routeEligible && g.characterId === characterId))
    )
    .sort((a, b) => {
      if (a.kind === 'route' && b.kind !== 'route') return 1
      if (b.kind === 'route' && a.kind !== 'route') return -1
      return (
        (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999') || a.id.localeCompare(b.id)
      )
    })
  const allocations: CreditAllocation[] = []
  let needed = units
  for (const grant of eligible) {
    const used = Math.min(needed, grant.remaining)
    if (used) allocations.push({ grantId: grant.id, units: used })
    needed -= used
    if (!needed) return allocations
  }
  return null
}
