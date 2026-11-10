import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  or,
  sql
} from 'drizzle-orm'
import { characters } from '$lib/adventure-catalog'
import { GUEST_RETENTION_DAYS } from '$lib/guest-practice'
import { PROGRESSION_VERSION } from '$lib/adventure-progression'
import type { AdminDays, AdminUsageView } from '$lib/admin-operations'
import { adminPeriod } from '$lib/server/admin-operations-request'
import { getDb } from '../client'
import {
  episodeAchievements,
  guestPractices,
  guestSessions,
  practices,
  practiceEvaluations,
  practiceTurns,
  users
} from '../schema'

export async function getAdminUsage(days: AdminDays, now = new Date()): Promise<AdminUsageView> {
  const period = adminPeriod(days, now),
    start = new Date(period.from)
  return getDb().transaction(
    async (db) => {
      const began = and(gte(practices.chargedAt, start), lt(practices.chargedAt, now))!
      const finished = and(gte(practices.completedAt, start), lt(practices.completedAt, now))!
      const replyTime = and(gte(practiceTurns.createdAt, start), lt(practiceTurns.createdAt, now))!
      const joinTime = and(gte(users.createdAt, start), lt(users.createdAt, now))!
      const startDay = sql<string>`to_char(${practices.chargedAt} at time zone 'Asia/Tokyo', 'YYYY-MM-DD')`
      const finishDay = sql<string>`to_char(${practices.completedAt} at time zone 'Asia/Tokyo', 'YYYY-MM-DD')`
      const replyDay = sql<string>`to_char(${practiceTurns.createdAt} at time zone 'Asia/Tokyo', 'YYYY-MM-DD')`
      const joinDay = sql<string>`to_char(${users.createdAt} at time zone 'Asia/Tokyo', 'YYYY-MM-DD')`
      const mode = sql<string>`case when ${practices.adventure} is not null then 'adventure' when ${practices.sceneId} = 'custom' then 'custom' else 'common' end || ':' || case when ${practices.adventure}->>'turns' = '6' then '6' else '3' end`
      const person = sql<string>`coalesce(${practices.adventure}->>'characterId', 'unknown')`
      const [
        [registered],
        [newUsers],
        [sessions],
        [replies],
        [cleared],
        [pending],
        dailyStart,
        dailyFinish,
        dailyReply,
        dailyJoin,
        modes,
        byCharacter,
        topUsers,
        [guest]
      ] = await Promise.all([
        db.select({ count: count() }).from(users).where(lt(users.createdAt, now)),
        db.select({ count: count() }).from(users).where(joinTime),
        db
          .select({
            started: sql<number>`count(*) filter (where ${began})::int`,
            completed: sql<number>`count(*) filter (where ${finished})::int`,
            credits: sql<number>`coalesce(sum(${practices.creditCost}) filter (where ${began}), 0)::int`
          })
          .from(practices)
          .where(or(began, finished)),
        db
          .select({ count: count(), users: countDistinct(practices.uid) })
          .from(practiceTurns)
          .innerJoin(practices, eq(practices.id, practiceTurns.practiceId))
          .where(replyTime),
        db
          .select({ count: count() })
          .from(episodeAchievements)
          .where(
            and(
              eq(episodeAchievements.version, PROGRESSION_VERSION),
              gte(episodeAchievements.clearedAt, start),
              lt(episodeAchievements.clearedAt, now)
            )
          ),
        db
          .select({ count: count() })
          .from(practices)
          .leftJoin(practiceEvaluations, eq(practiceEvaluations.practiceId, practices.id))
          .where(
            and(
              finished,
              isNotNull(practices.adventure),
              or(
                isNull(practiceEvaluations.practiceId),
                sql`${practiceEvaluations.result}->>'status' = 'pending'`
              )
            )
          ),
        db
          .select({ date: startDay, count: count() })
          .from(practices)
          .where(began)
          .groupBy(startDay),
        db
          .select({ date: finishDay, count: count() })
          .from(practices)
          .where(finished)
          .groupBy(finishDay),
        db
          .select({ date: replyDay, count: count() })
          .from(practiceTurns)
          .where(replyTime)
          .groupBy(replyDay),
        db.select({ date: joinDay, count: count() }).from(users).where(joinTime).groupBy(joinDay),
        db
          .select({
            key: mode,
            started: sql<number>`count(*) filter (where ${began})::int`,
            completed: sql<number>`count(*) filter (where ${finished})::int`
          })
          .from(practices)
          .where(or(began, finished))
          .groupBy(mode),
        db
          .select({
            characterId: person,
            started: sql<number>`count(*) filter (where ${began})::int`,
            completed: sql<number>`count(*) filter (where ${finished})::int`
          })
          .from(practices)
          .where(and(isNotNull(practices.adventure), or(began, finished)))
          .groupBy(person),
        db
          .select({
            uid: users.firebaseUid,
            displayName: users.displayName,
            email: users.email,
            replies: count()
          })
          .from(practiceTurns)
          .innerJoin(practices, eq(practices.id, practiceTurns.practiceId))
          .innerJoin(users, eq(users.firebaseUid, practices.uid))
          .where(replyTime)
          .groupBy(users.firebaseUid, users.displayName, users.email)
          .orderBy(desc(count()), users.firebaseUid)
          .limit(10),
        // 未ログイン体験は保持期限内の作成コホート。引き継ぎ後のログイン練習と合算しない。
        db
          .select({
            created: count(),
            completed: sql<number>`count(*) filter (where ${guestPractices.state}->>'completedAt' is not null)::int`,
            // claimed_uid は再開する本人の予約。全返答の保存まで終わったものだけを引き継ぎ済みにする。
            claimed: sql<number>`count(*) filter (where ${guestPractices.claimedUid} is not null and exists (
              select 1 from ${practices}
              where ${practices.id} = ${guestPractices.id} and ${practices.uid} = ${guestPractices.claimedUid}
              and not exists (
                select 1 from jsonb_array_elements(${guestPractices.state}->'turns') as guest_turn
                where not exists (
                  select 1 from ${practiceTurns}
                  where ${practiceTurns.practiceId} = ${guestPractices.id}
                  and ${practiceTurns.requestId} = guest_turn->>'requestId'
                  and ${practiceTurns.position}::text = guest_turn->>'position'
                )
              )
            ))::int`
          })
          .from(guestPractices)
          .innerJoin(guestSessions, eq(guestSessions.id, guestPractices.sessionId))
          .where(
            and(
              gte(guestPractices.createdAt, start),
              lt(guestPractices.createdAt, now),
              gt(guestSessions.expiresAt, now)
            )
          )
      ])
      const lookup = (rows: { date: string; count: number }[]) =>
        new Map(rows.map((r) => [r.date, r.count]))
      const starts = lookup(dailyStart),
        ends = lookup(dailyFinish),
        messages = lookup(dailyReply),
        joins = lookup(dailyJoin)
      return {
        period,
        totals: {
          registered: registered.count,
          newUsers: newUsers.count,
          activeUsers: replies.users,
          started: sessions.started,
          completed: sessions.completed,
          replies: replies.count,
          credits: sessions.credits,
          cleared: cleared.count,
          pendingEvaluations: pending.count
        },
        daily: period.dates.map((date) => ({
          date,
          registered: joins.get(date) ?? 0,
          started: starts.get(date) ?? 0,
          completed: ends.get(date) ?? 0,
          replies: messages.get(date) ?? 0
        })),
        modes,
        characters: [
          ...characters.map(
            (c) =>
              byCharacter.find((row) => row.characterId === c.id) ?? {
                characterId: c.id,
                started: 0,
                completed: 0
              }
          ),
          ...byCharacter.filter((row) => !characters.some((c) => c.id === row.characterId))
        ],
        topUsers,
        guest: { ...guest, retentionDays: GUEST_RETENTION_DAYS }
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  )
}
