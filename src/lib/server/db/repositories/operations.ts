import { and, count, desc, eq, gte } from 'drizzle-orm'
import { MONTHLY_USAGE_LIMIT } from '$lib/constants/usage'
import { getTokyoMonthStart } from '$lib/utils/tokyo-month'
import { getDb } from '../client'
import { operations, users } from '../schema'

export interface CreateOperationInput {
  uid: string
  conversationId: string
  llmText: string
  query: string
}

export async function createOperation(input: CreateOperationInput) {
  const [operation] = await getDb()
    .insert(operations)
    .values({
      uid: input.uid,
      conversationId: input.conversationId,
      llmText: input.llmText,
      query: input.query
    })
    .returning()

  return operation
}

export async function createOperationWithLimitCheck(input: CreateOperationInput) {
  return getDb().transaction(async (tx) => {
    const [existingUser] = await tx
      .select({
        firebaseUid: users.firebaseUid
      })
      .from(users)
      .where(eq(users.firebaseUid, input.uid))
      .for('update')

    if (!existingUser) {
      return {
        status: 'user_not_found' as const
      }
    }

    const [result] = await tx
      .select({
        count: count()
      })
      .from(operations)
      .where(and(eq(operations.uid, input.uid), gte(operations.createdAt, getTokyoMonthStart())))

    if (Number(result?.count ?? 0) >= MONTHLY_USAGE_LIMIT) {
      return {
        status: 'usage_limit_exceeded' as const
      }
    }

    const [operation] = await tx
      .insert(operations)
      .values({
        uid: input.uid,
        conversationId: input.conversationId,
        llmText: input.llmText,
        query: input.query
      })
      .returning()

    return {
      status: 'created' as const,
      operation
    }
  })
}

export async function getLatestOperationByUid(uid: string) {
  return getDb().query.operations.findFirst({
    where: eq(operations.uid, uid),
    orderBy: [desc(operations.createdAt)]
  })
}

export async function getRemainingUsage(uid: string, now = new Date()) {
  const [result] = await getDb()
    .select({
      count: count()
    })
    .from(operations)
    .where(and(eq(operations.uid, uid), gte(operations.createdAt, getTokyoMonthStart(now))))

  return Math.max(MONTHLY_USAGE_LIMIT - Number(result?.count ?? 0), 0)
}

export async function getDashboard(uid: string) {
  const [remainingUsage, latestOperation] = await Promise.all([
    getRemainingUsage(uid),
    getLatestOperationByUid(uid)
  ])

  return {
    uid,
    remainingUsage,
    limit: MONTHLY_USAGE_LIMIT,
    lastLlmText: latestOperation?.llmText ?? null,
    lastOperationAt: latestOperation?.createdAt?.toISOString() ?? null
  }
}
