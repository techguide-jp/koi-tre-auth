import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  isNull,
  like,
  lt,
  ne,
  sql
} from 'drizzle-orm'
import {
  ADMIN_PAGE_SIZE,
  type AdminBillingView,
  type AdminDays,
  type AdminProductFilter
} from '$lib/admin-operations'
import { adminPeriod } from '$lib/server/admin-operations-request'
import { stripeReady } from '$lib/server/stripe-client'
import { getDb } from '../client'
import {
  billingCheckouts,
  billingSubscriptions,
  creditGrants,
  routePurchases,
  users
} from '../schema'
import { currentGrant } from './admin-users'

export async function getAdminBilling(
  input: { days: AdminDays; page: number; kind: AdminProductFilter },
  now = new Date()
): Promise<AdminBillingView> {
  const period = adminPeriod(input.days, now)
  return getDb().transaction(
    async (db) => {
      const grantFilter = and(
        ne(creditGrants.kind, 'free'),
        gte(creditGrants.startsAt, new Date(period.from)),
        lt(creditGrants.startsAt, now),
        input.kind === 'all' ? undefined : eq(creditGrants.kind, input.kind)
      )
      const [[plus], [routes], [topups], [total], grants, contracts, checkouts] = await Promise.all(
        [
          db
            .select({ count: countDistinct(creditGrants.uid) })
            .from(creditGrants)
            .where(and(eq(creditGrants.kind, 'plus'), currentGrant(now))),
          db
            .select({ count: countDistinct(routePurchases.uid) })
            .from(routePurchases)
            .where(isNull(routePurchases.revokedAt)),
          db
            .select({ count: countDistinct(creditGrants.uid) })
            .from(creditGrants)
            .where(and(eq(creditGrants.kind, 'topup'), currentGrant(now))),
          db.select({ count: count() }).from(creditGrants).where(grantFilter),
          db
            .select({
              id: creditGrants.id,
              uid: creditGrants.uid,
              displayName: users.displayName,
              email: users.email,
              kind: creditGrants.kind,
              characterId: creditGrants.characterId,
              units: creditGrants.units,
              startsAt: creditGrants.startsAt,
              expiresAt: creditGrants.expiresAt,
              revokedAt: creditGrants.revokedAt
            })
            .from(creditGrants)
            .innerJoin(users, eq(users.firebaseUid, creditGrants.uid))
            .where(grantFilter)
            .orderBy(desc(creditGrants.startsAt), desc(creditGrants.id))
            .limit(ADMIN_PAGE_SIZE)
            .offset((input.page - 1) * ADMIN_PAGE_SIZE),
          db
            .select({
              id: billingSubscriptions.id,
              uid: billingSubscriptions.uid,
              displayName: users.displayName,
              email: users.email,
              status: billingSubscriptions.status,
              periodStart: billingSubscriptions.periodStart,
              periodEnd: billingSubscriptions.periodEnd,
              cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
              paidAccess: exists(
                db
                  .select({ id: creditGrants.id })
                  .from(creditGrants)
                  .where(
                    and(
                      eq(creditGrants.uid, billingSubscriptions.uid),
                      eq(creditGrants.kind, 'plus'),
                      currentGrant(now),
                      sql`left(${creditGrants.id}, length(${billingSubscriptions.id}) + 6) = 'plus:' || ${billingSubscriptions.id} || ':'`
                    )
                  )
              ).mapWith((value) => value === true || value === 't')
            })
            .from(billingSubscriptions)
            .innerJoin(users, eq(users.firebaseUid, billingSubscriptions.uid))
            .orderBy(desc(billingSubscriptions.updatedAt), desc(billingSubscriptions.id))
            .limit(25),
          db
            .select({
              id: billingCheckouts.id,
              uid: billingCheckouts.uid,
              displayName: users.displayName,
              email: users.email,
              product: billingCheckouts.product,
              status: billingCheckouts.status,
              createdAt: billingCheckouts.createdAt,
              expiresAt: billingCheckouts.expiresAt
            })
            .from(billingCheckouts)
            .innerJoin(users, eq(users.firebaseUid, billingCheckouts.uid))
            .where(
              and(
                gte(billingCheckouts.createdAt, new Date(period.from)),
                lt(billingCheckouts.createdAt, now),
                input.kind === 'all'
                  ? undefined
                  : input.kind === 'route'
                    ? like(billingCheckouts.product, 'route:%')
                    : eq(billingCheckouts.product, input.kind)
              )
            )
            .orderBy(desc(billingCheckouts.createdAt), desc(billingCheckouts.id))
            .limit(25)
        ]
      )
      return {
        period,
        enabled: stripeReady(),
        testMode: true,
        page: input.page,
        pageSize: ADMIN_PAGE_SIZE,
        total: total.count,
        current: { plusUsers: plus.count, routeOwners: routes.count, topupOwners: topups.count },
        grants: grants.map((g) => ({
          ...g,
          startsAt: g.startsAt.toISOString(),
          expiresAt: g.expiresAt?.toISOString() ?? null,
          revokedAt: g.revokedAt?.toISOString() ?? null
        })),
        contracts: contracts.map((c) => ({
          ...c,
          periodStart: c.periodStart.toISOString(),
          periodEnd: c.periodEnd.toISOString()
        })),
        checkouts: checkouts.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          expiresAt: c.expiresAt.toISOString()
        }))
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  )
}
