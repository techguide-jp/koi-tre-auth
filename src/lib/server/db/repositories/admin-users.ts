import { and, count, desc, eq, exists, gt, ilike, isNull, lte, not, or, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  ADMIN_PAGE_SIZE,
  type AdminAccessFilter,
  type AdminUserDetailView,
  type AdminUsersView
} from '$lib/admin-operations'
import type { CharacterId } from '$lib/adventure-catalog'
import { getDb, type Database } from '../client'
import {
  creditGrants,
  operations,
  practices,
  practiceEvaluations,
  practiceTurns,
  routePurchases,
  users
} from '../schema'
import { readCreditState } from './credits'
import { readProgression } from './progression'

type ReportDb = Pick<Database, 'select' | '$with' | 'with' | 'query'>
export const currentGrant = (now: Date) =>
  and(
    isNull(creditGrants.revokedAt),
    lte(creditGrants.startsAt, now),
    or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))
  )
export const hasCurrentPlus = (db: ReportDb, uid: AnyPgColumn | string, now: Date) =>
  exists(
    db
      .select({ id: creditGrants.id })
      .from(creditGrants)
      .where(and(eq(creditGrants.uid, uid), eq(creditGrants.kind, 'plus'), currentGrant(now)))
  ).mapWith((value) => value === true || value === 't')
function hasRoute(db: ReportDb) {
  return exists(
    db
      .select({ id: routePurchases.id })
      .from(routePurchases)
      .where(and(eq(routePurchases.uid, users.firebaseUid), isNull(routePurchases.revokedAt)))
  )
}
function userReport(db: ReportDb, now: Date) {
  const sessions = db.$with('admin_sessions').as(
    db
      .select({
        uid: practices.uid,
        started: sql<number>`count(*) filter (where ${practices.chargedAt} is not null)::int`.as(
          'started'
        ),
        completed:
          sql<number>`count(*) filter (where ${practices.completedAt} is not null)::int`.as(
            'completed'
          )
      })
      .from(practices)
      .groupBy(practices.uid)
  )
  const replies = db.$with('admin_replies').as(
    db
      .select({
        uid: practices.uid,
        replies: sql<number>`count(*)::int`.as('replies'),
        last: sql<Date | null>`max(${practiceTurns.createdAt})`
          .mapWith(practiceTurns.createdAt)
          .as('last')
      })
      .from(practiceTurns)
      .innerJoin(practices, eq(practices.id, practiceTurns.practiceId))
      .groupBy(practices.uid)
  )
  return db
    .with(sessions, replies)
    .select({
      uid: users.firebaseUid,
      displayName: users.displayName,
      email: users.email,
      createdAt: users.createdAt,
      lastPracticeAt: replies.last,
      started: sql<number>`coalesce(${sessions.started}, 0)::int`,
      completed: sql<number>`coalesce(${sessions.completed}, 0)::int`,
      replies: sql<number>`coalesce(${replies.replies}, 0)::int`,
      plus: hasCurrentPlus(db, users.firebaseUid, now),
      routePacks: sql<number>`(select count(distinct character_id)::int from ${routePurchases} where uid = ${users.firebaseUid} and revoked_at is null)`
    })
    .from(users)
    .leftJoin(sessions, eq(sessions.uid, users.firebaseUid))
    .leftJoin(replies, eq(replies.uid, users.firebaseUid))
}
const userView = (row: Awaited<ReturnType<typeof userReport>>[number]) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  lastPracticeAt: row.lastPracticeAt?.toISOString() ?? null
})
export async function getAdminUsers(
  input: { page: number; search: string; access: AdminAccessFilter },
  now = new Date()
): Promise<AdminUsersView> {
  return getDb().transaction(
    async (db) => {
      const query = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`
      const plus = hasCurrentPlus(db, users.firebaseUid, now),
        route = hasRoute(db)
      const filter = and(
        input.search
          ? or(
              ilike(users.email, query),
              ilike(users.displayName, query),
              ilike(users.firebaseUid, query)
            )
          : undefined,
        input.access === 'plus'
          ? plus
          : input.access === 'route'
            ? route
            : input.access === 'free'
              ? and(not(plus), not(route))
              : undefined
      )
      const [[total], rows] = await Promise.all([
        db.select({ value: count() }).from(users).where(filter),
        userReport(db, now)
          .where(filter)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(ADMIN_PAGE_SIZE)
          .offset((input.page - 1) * ADMIN_PAGE_SIZE)
      ])
      return {
        asOf: now.toISOString(),
        page: input.page,
        pageSize: ADMIN_PAGE_SIZE,
        total: total.value,
        users: rows.map(userView)
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  )
}
export async function getAdminUserDetail(
  uid: string,
  now = new Date()
): Promise<AdminUserDetailView | null> {
  return getDb().transaction(
    async (db) => {
      const [person] = await userReport(db, now).where(eq(users.firebaseUid, uid)).limit(1)
      if (!person) return null
      const [billing, progression, [activity], [legacy], history] = await Promise.all([
        readCreditState(db, uid, now),
        readProgression(db, uid),
        db
          .select({
            total: count(),
            drafts: sql<number>`count(*) filter (where ${practices.chargedAt} is null)::int`,
            xp: sql<number>`coalesce(sum((${practices.reward}->>'xp')::int), 0)::int`
          })
          .from(practices)
          .where(eq(practices.uid, uid)),
        db.select({ count: count() }).from(operations).where(eq(operations.uid, uid)),
        // 管理画面には会話本文や評価の引用を返さず、状態と数値だけを選ぶ。
        db
          .select({
            id: practices.id,
            sceneId: practices.sceneId,
            characterId: sql<CharacterId | null>`${practices.adventure}->>'characterId'`,
            episodeId: sql<string | null>`${practices.adventure}->>'episodeId'`,
            turns: sql<number>`case when ${practices.adventure}->>'turns' = '6' then 6 else 3 end`,
            replied: sql<number>`(select count(*)::int from ${practiceTurns} where practice_id = ${practices.id})`,
            createdAt: practices.createdAt,
            chargedAt: practices.chargedAt,
            completedAt: practices.completedAt,
            creditCost: practices.creditCost,
            xp: sql<number>`coalesce((${practices.reward}->>'xp')::int, 0)`,
            score: sql<number | null>`(${practiceEvaluations.result}->>'score')::double precision`,
            evaluation: sql<
              'passed' | 'failed' | 'pending' | null
            >`${practiceEvaluations.result}->>'status'`
          })
          .from(practices)
          .leftJoin(practiceEvaluations, eq(practiceEvaluations.practiceId, practices.id))
          .where(eq(practices.uid, uid))
          .orderBy(desc(practices.createdAt), desc(practices.id))
          .limit(20)
      ])
      return {
        asOf: now.toISOString(),
        user: userView(person),
        billing,
        progression,
        activity: { drafts: activity.drafts, xp: activity.xp, legacyReplies: legacy.count },
        history: history.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          chargedAt: row.chargedAt?.toISOString() ?? null,
          completedAt: row.completedAt?.toISOString() ?? null
        })),
        historyHasMore: activity.total > history.length
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  )
}
