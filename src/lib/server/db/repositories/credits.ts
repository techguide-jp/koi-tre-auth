import { createHash } from 'node:crypto'
import { and, desc, eq, gt, gte, isNull, lt, lte, ne, notExists, or, sql } from 'drizzle-orm'
import {
  allocateCredits,
  FREE_CREDITS,
  PLUS_CREDITS,
  type BillingOverview,
  type CreditGrantView
} from '$lib/billing'
import type { CharacterId } from '$lib/adventure-catalog'
import { getTokyoMonthStart, getNextTokyoMonthStart } from '$lib/utils/tokyo-month'
import type { Database } from '../client'
import { getDb } from '../client'
import {
  billingSubscriptions,
  creditGrants,
  creditSpends,
  practices,
  routePurchases
} from '../schema'
import { stripeReady } from '$lib/server/stripe-client'

export type CreditDb = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'query'>
export const freeGrantId = (uid: string, now: Date) =>
  `free:${createHash('sha256').update(uid).digest('hex')}:${getTokyoMonthStart(now).toISOString()}`
export function billingEnabled() {
  return stripeReady()
}
export async function readCreditState(
  db: CreditDb,
  uid: string,
  now = new Date(),
  excludePracticeId?: string
): Promise<BillingOverview> {
  const monthStart = getTokyoMonthStart(now),
    monthEnd = getNextTokyoMonthStart(now)
  const [grants, spends, purchases, subscriptions, [legacy], [legacyPending]] = await Promise.all([
    db
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.uid, uid),
          isNull(creditGrants.revokedAt),
          lte(creditGrants.startsAt, now),
          or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))
        )
      ),
    db
      .select()
      .from(creditSpends)
      .where(
        and(
          eq(creditSpends.uid, uid),
          or(
            eq(creditSpends.state, 'spent'),
            and(eq(creditSpends.state, 'reserved'), gt(creditSpends.expiresAt, now))
          )
        )
      ),
    db
      .select()
      .from(routePurchases)
      .where(and(eq(routePurchases.uid, uid), isNull(routePurchases.revokedAt))),
    db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.uid, uid))
      .orderBy(desc(billingSubscriptions.periodEnd))
      .limit(1),
    db
      .select({ units: sql<number>`coalesce(sum(${practices.creditCost}), 0)::int` })
      .from(practices)
      .where(
        and(
          eq(practices.uid, uid),
          gte(practices.chargedAt, monthStart),
          lt(practices.chargedAt, monthEnd),
          notExists(
            db
              .select({ id: creditSpends.id })
              .from(creditSpends)
              .where(eq(creditSpends.practiceId, practices.id))
          )
        )
      ),
    db
      .select({ units: sql<number>`coalesce(sum(${practices.creditCost}), 0)::int` })
      .from(practices)
      .where(
        and(
          eq(practices.uid, uid),
          excludePracticeId ? ne(practices.id, excludePracticeId) : undefined,
          isNull(practices.chargedAt),
          gt(practices.pendingUntil, now),
          notExists(
            db
              .select({ id: creditSpends.id })
              .from(creditSpends)
              .where(eq(creditSpends.practiceId, practices.id))
          )
        )
      )
  ])
  const ownedCharacters = [...new Set(purchases.map((p) => p.characterId))]
  const plusGrant = grants
    .filter((g) => g.kind === 'plus')
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0]
  const plusActive = !!plusGrant
  const active = grants.filter(
    (g) =>
      (g.kind !== 'free' || !plusActive) &&
      (g.kind !== 'route' || ownedCharacters.includes(g.characterId!))
  )
  const freeId = freeGrantId(uid, now)
  if (!plusActive && !active.some((g) => g.id === freeId))
    active.push({
      id: freeId,
      uid,
      kind: 'free',
      characterId: null,
      units: FREE_CREDITS,
      startsAt: monthStart,
      expiresAt: monthEnd,
      revokedAt: null
    })
  const credits: CreditGrantView[] = active.map((grant) => {
    const used = spends.filter((s) => s.grantId === grant.id).reduce((sum, s) => sum + s.units, 0)
    const oldUsed = grant.id === freeId ? Number(legacy.units) + Number(legacyPending.units) : 0
    return {
      id: grant.id,
      kind: grant.kind,
      characterId: grant.characterId,
      units: grant.units,
      remaining: Math.max(0, grant.units - used - oldUsed),
      expiresAt: grant.expiresAt?.toISOString() ?? null
    }
  })
  const current = subscriptions[0]
  return {
    enabled: billingEnabled(),
    testMode: true,
    ownedCharacters,
    subscription: current
      ? {
          active: plusActive,
          status: current.status,
          periodStart: (plusGrant?.startsAt ?? current.periodStart).toISOString(),
          periodEnd: (plusGrant?.expiresAt ?? current.periodEnd).toISOString(),
          cancelAtPeriodEnd: current.cancelAtPeriodEnd
        }
      : null,
    credits,
    remaining: credits.reduce((sum, g) => sum + g.remaining, 0),
    reserved:
      spends
        .filter((s) => s.state === 'reserved' && active.some((g) => g.id === s.grantId))
        .reduce((sum, s) => sum + s.units, 0) + Number(legacyPending.units),
    resetsAt: (plusGrant?.expiresAt ?? monthEnd).toISOString()
  }
}
export async function reserveCredits(
  db: CreditDb,
  uid: string,
  practiceId: string,
  units: number,
  characterId: CharacterId | undefined,
  routeEligible: boolean,
  until: Date,
  now: Date
) {
  await db
    .delete(creditSpends)
    .where(and(eq(creditSpends.practiceId, practiceId), eq(creditSpends.state, 'reserved')))
  const state = await readCreditState(db, uid, now, practiceId)
  const allocations = allocateCredits(state.credits, units, characterId, routeEligible)
  if (!allocations) return false
  const freeId = freeGrantId(uid, now)
  if (allocations.some((a) => a.grantId === freeId))
    await db
      .insert(creditGrants)
      .values({
        id: freeId,
        uid,
        kind: 'free',
        units: FREE_CREDITS,
        startsAt: getTokyoMonthStart(now),
        expiresAt: getNextTokyoMonthStart(now)
      })
      .onConflictDoNothing()
  await db.insert(creditSpends).values(
    allocations.map((a) => ({
      id: `${practiceId}:${a.grantId}`,
      uid,
      practiceId,
      grantId: a.grantId,
      units: a.units,
      state: 'reserved',
      expiresAt: until
    }))
  )
  return true
}
export async function commitCredits(
  db: CreditDb,
  uid: string,
  practiceId: string,
  units: number,
  characterId: CharacterId | undefined,
  routeEligible: boolean,
  now: Date
) {
  const reservations = await db
    .select()
    .from(creditSpends)
    .where(
      and(
        eq(creditSpends.practiceId, practiceId),
        eq(creditSpends.state, 'reserved'),
        gt(creditSpends.expiresAt, now)
      )
    )
  if (reservations.reduce((sum, s) => sum + s.units, 0) !== units) return false
  // 月境界をまたぐ生成も、従来どおり最初の保存成功時点の利用期間へ計上する。
  if (
    !(await reserveCredits(
      db,
      uid,
      practiceId,
      units,
      characterId,
      routeEligible,
      reservations[0].expiresAt!,
      now
    ))
  )
    return false
  await db
    .update(creditSpends)
    .set({ state: 'spent', expiresAt: null })
    .where(and(eq(creditSpends.practiceId, practiceId), eq(creditSpends.state, 'reserved')))
  return true
}
export async function releaseCredits(db: CreditDb, practiceId: string) {
  await db
    .delete(creditSpends)
    .where(and(eq(creditSpends.practiceId, practiceId), eq(creditSpends.state, 'reserved')))
}
export const commonCreditLimit = (overview: BillingOverview) =>
  (overview.subscription?.active ? PLUS_CREDITS : FREE_CREDITS) +
  overview.credits.filter((g) => g.kind === 'topup').reduce((sum, g) => sum + g.units, 0)
export const getBillingOverview = (uid: string, now = new Date()) =>
  readCreditState(getDb(), uid, now)
