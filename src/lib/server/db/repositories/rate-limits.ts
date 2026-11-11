import { inArray, lt, sql } from 'drizzle-orm'
import type { Database } from '../client'
import { guestRateLimits } from '../schema'

export async function pruneRateLimits(db: Pick<Database, 'select' | 'delete'>, now: Date) {
  await db
    .delete(guestRateLimits)
    .where(
      inArray(
        guestRateLimits.key,
        db
          .select({ key: guestRateLimits.key })
          .from(guestRateLimits)
          .where(lt(guestRateLimits.expiresAt, now))
          .limit(100)
      )
    )
}

export async function consumeRateLimit(
  db: Pick<Database, 'insert'>,
  key: string,
  limit: number,
  expiresAt: Date
) {
  const [result] = await db
    .insert(guestRateLimits)
    .values({ key, used: 1, expiresAt })
    .onConflictDoUpdate({
      target: guestRateLimits.key,
      set: { used: sql`${guestRateLimits.used} + 1` },
      setWhere: lt(guestRateLimits.used, limit)
    })
    .returning({ key: guestRateLimits.key })
  return Boolean(result)
}
