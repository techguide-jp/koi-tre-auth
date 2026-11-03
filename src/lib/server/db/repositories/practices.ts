import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte, gt, isNull, lt, or } from 'drizzle-orm'
import {
  PRACTICE_LIMIT,
  PRACTICE_TURNS,
  type CustomSceneInput,
  type PracticeFeedback,
  type PracticeOverview,
  type PracticeSession,
  type SceneId
} from '$lib/practice'
import { getNextTokyoMonthStart, getTokyoMonthStart } from '$lib/utils/tokyo-month'
import { getDb } from '../client'
import { operations, practices, practiceTurns, users } from '../schema'

// 生成中の枠も確保し、別タブから月上限を超えて開始できないようにする。
const LEASE_MS = 75_000

function chargedThisMonth(uid: string, now: Date) {
  return and(
    eq(practices.uid, uid),
    gte(practices.chargedAt, getTokyoMonthStart(now)),
    lt(practices.chargedAt, getNextTokyoMonthStart(now))
  )
}

export async function getPractice(uid: string, id: string): Promise<PracticeSession | null> {
  // 保存と読み取りが交差して、完了状態と発言数が食い違わないようにする。
  return getDb().transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(practices)
      .where(and(eq(practices.id, id), eq(practices.uid, uid)))
      .for('share')
    if (!session) return null
    const turns = await tx
      .select()
      .from(practiceTurns)
      .where(eq(practiceTurns.practiceId, id))
      .orderBy(practiceTurns.position)
    return {
      id: session.id,
      sceneId: session.sceneId,
      customScene: session.customScene,
      chargedAt: session.chargedAt?.toISOString() ?? null,
      completedAt: session.completedAt?.toISOString() ?? null,
      turns: turns.map(({ requestId, position, userText, assistantText, feedback }) => ({
        requestId,
        position,
        userText,
        assistantText,
        feedback
      })),
      pending:
        session.pendingRequestId && session.pendingText
          ? {
              requestId: session.pendingRequestId,
              text: session.pendingText,
              until: session.pendingUntil?.toISOString() ?? null
            }
          : null
    }
  })
}

export async function getPracticeOverview(
  uid: string,
  now = new Date()
): Promise<PracticeOverview> {
  return getDb().transaction(async (db) => {
    await db
      .select({ uid: users.firebaseUid })
      .from(users)
      .where(eq(users.firebaseUid, uid))
      .for('share')
    const [[used], [reserved], latest, active] = await Promise.all([
      db.select({ count: count() }).from(practices).where(chargedThisMonth(uid, now)),
      db
        .select({ count: count() })
        .from(practices)
        .where(
          and(eq(practices.uid, uid), isNull(practices.chargedAt), gt(practices.pendingUntil, now))
        ),
      db.query.practices.findFirst({
        where: eq(practices.uid, uid),
        orderBy: desc(practices.updatedAt)
      }),
      db.query.practices.findFirst({
        where: and(eq(practices.uid, uid), isNull(practices.completedAt)),
        orderBy: desc(practices.updatedAt)
      })
    ])
    return {
      remaining: Math.max(0, PRACTICE_LIMIT - Number(used.count) - Number(reserved.count)),
      reserved: Number(reserved.count),
      limit: PRACTICE_LIMIT,
      activePracticeId: active?.id ?? null,
      latestPracticeId: latest?.id ?? null,
      resetsAt: getNextTokyoMonthStart(now).toISOString()
    }
  })
}

export async function createPractice(
  uid: string,
  id: string,
  sceneId: SceneId,
  customScene: CustomSceneInput | null = null
) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
    const existing = await tx.query.practices.findFirst({ where: eq(practices.id, id) })
    // 同じ作成IDを別の状況へ流用すると、再送と場面変更を区別できなくなる。
    if (existing)
      return (
        existing.uid === uid &&
        existing.sceneId === sceneId &&
        existing.customScene?.situation === customScene?.situation &&
        existing.customScene?.partnerName === customScene?.partnerName &&
        existing.customScene?.openingLine === customScene?.openingLine
      )
    await tx.insert(practices).values({ id, uid, sceneId, customScene })
    return true
  })
}

export interface MessageInput {
  uid: string
  id: string
  requestId: string
  text: string
  expectedTurn: number
}

export async function reservePracticeTurn(input: MessageInput, now = new Date()) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, input.uid)).for('update')
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, input.id), eq(practices.uid, input.uid))
    })
    if (!session) return { status: 'not_found' as const }
    const turns = await tx
      .select()
      .from(practiceTurns)
      .where(eq(practiceTurns.practiceId, input.id))
      .orderBy(practiceTurns.position)
    const replay = turns.find((turn) => turn.requestId === input.requestId)
    if (replay)
      return {
        status: replay.userText === input.text ? ('replay' as const) : ('conflict' as const)
      }
    if (session.completedAt || turns.length >= PRACTICE_TURNS)
      return { status: 'complete' as const }
    if (session.pendingUntil && session.pendingUntil > now) return { status: 'pending' as const }
    if (turns.length !== input.expectedTurn) return { status: 'conflict' as const }
    if (session.pendingRequestId === input.requestId && session.pendingText !== input.text)
      return { status: 'conflict' as const }
    if (!session.chargedAt) {
      const [used] = await tx
        .select({ count: count() })
        .from(practices)
        .where(
          or(
            chargedThisMonth(input.uid, now),
            and(
              eq(practices.uid, input.uid),
              isNull(practices.chargedAt),
              gt(practices.pendingUntil, now)
            )
          )
        )
      if (Number(used.count) >= PRACTICE_LIMIT) return { status: 'quota' as const }
    }
    const token = randomUUID()
    await tx
      .update(practices)
      .set({
        pendingRequestId: input.requestId,
        pendingText: input.text,
        pendingToken: token,
        pendingUntil: new Date(now.getTime() + LEASE_MS),
        updatedAt: now
      })
      .where(eq(practices.id, input.id))
    return {
      status: 'ready' as const,
      token,
      sceneId: session.sceneId,
      customScene: session.customScene,
      turns
    }
  })
}

export async function releasePracticeTurn(input: MessageInput, token: string) {
  // 失敗した本文は残し、再読み込み後も同じ入力から再試行できるようにする。
  await getDb()
    .update(practices)
    .set({ pendingUntil: null, pendingToken: null })
    .where(
      and(
        eq(practices.id, input.id),
        eq(practices.uid, input.uid),
        eq(practices.pendingToken, token)
      )
    )
}

export async function finishPracticeTurn(
  input: MessageInput,
  token: string,
  output: { reply: string; feedback: PracticeFeedback | null },
  now = new Date()
) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, input.uid)).for('update')
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, input.id), eq(practices.uid, input.uid))
    })
    // 古い生成処理が、期限切れ後に始まった再試行の結果を上書きしない。
    if (!session || session.pendingToken !== token) return false
    if (!session.chargedAt) {
      const [used] = await tx
        .select({ count: count() })
        .from(practices)
        .where(chargedThisMonth(input.uid, now))
      if (Number(used.count) >= PRACTICE_LIMIT) return false
    }
    const position = input.expectedTurn + 1
    await tx.insert(practiceTurns).values({
      id: randomUUID(),
      practiceId: input.id,
      requestId: input.requestId,
      position,
      userText: input.text,
      assistantText: output.reply,
      feedback: output.feedback,
      createdAt: now
    })
    // 新フローの保存主体はアプリのみ。Dify Workflowには旧保存コールバックを置かない。
    await tx.insert(operations).values({
      uid: input.uid,
      conversationId: `practice:${input.id}`,
      query: input.text,
      llmText: output.reply,
      createdAt: now
    })
    await tx
      .update(practices)
      .set({
        chargedAt: session.chargedAt ?? now,
        completedAt: position === PRACTICE_TURNS ? now : null,
        pendingRequestId: null,
        pendingText: null,
        pendingToken: null,
        pendingUntil: null,
        updatedAt: now
      })
      .where(eq(practices.id, input.id))
    return true
  })
}
