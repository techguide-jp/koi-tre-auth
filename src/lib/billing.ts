import { characters, type CharacterId } from './adventure-catalog'

export const ROUTE_PRICE = 1480
export const PLUS_PRICE = 980
export const FREE_CREDITS = 10
export const ROUTE_CREDITS = 24
export const PLUS_CREDITS = 60
export const TOPUP_PRICE = 550
export const TOPUP_CREDITS = 15
export type CreditKind = 'free' | 'plus' | 'route' | 'topup'
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
  adminPlay?: boolean
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
// 管理者のプレイ権は、実際の購入・契約とは別に扱う。
export const hasPaidPracticeAccess = (billing?: BillingOverview | null) =>
  billing?.adminPlay === true || billing?.subscription?.active === true
export type BillingProduct =
  | { kind: 'route'; characterId: CharacterId }
  | { kind: 'plus' }
  | { kind: 'topup' }
export function billingProduct(value: unknown): BillingProduct | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (input.kind === 'plus') return { kind: 'plus' }
  if (input.kind === 'topup') return { kind: 'topup' }
  const person = characters.find((c) => c.id === input.characterId)
  return input.kind === 'route' && person ? { kind: 'route', characterId: person.id } : null
}
export const productKey = (product: BillingProduct) =>
  product.kind === 'route' ? `route:${product.characterId}` : product.kind
export const productPrice = (product: BillingProduct) =>
  product.kind === 'route' ? ROUTE_PRICE : product.kind === 'topup' ? TOPUP_PRICE : PLUS_PRICE
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
      // 期限のある枠と人物専用枠を先に使い、用途の広い購入枠を残す。
      const priority = (g: CreditGrantView) => (g.kind === 'topup' ? 2 : g.kind === 'route' ? 1 : 0)
      if (priority(a) !== priority(b)) return priority(a) - priority(b)
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
