import { randomInt, randomUUID } from 'node:crypto'
import { and, eq, gt, inArray, lt } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import { guestAdventure, type GuestTurn } from '$lib/guest-practice'
import { applyRelationship, gradeConversation } from '$lib/adventure-progression'
import { type Adventure, parseMission, parsePresentation } from '$lib/adventure'
import type { PracticeSession } from '$lib/practice'
import { drawPracticeTip, type GuestTip, type TipSelfRating } from '$lib/practice-tips'
import type { GeneratePracticeInput } from '$lib/server/dify-practice'
import { getDb } from '../client'
import { guestSessions, guestPractices, knowledgeSettings, practices } from '../schema'
import { snapshotCharacter } from './character-policy'
import type { CreditDb } from './credits'
import { consumeRateLimit, pruneRateLimits } from './rate-limits'
import { requireRatingRevision } from './practice-tips'

type GuestRow = typeof guestPractices.$inferSelect
type RateContext = { day: string; hash: string }
export type GuestMessage = {
  id: string
  sessionId: string
  requestId: string
  expectedTurn: number
  text: string
}
const LEASE_MS = 75_000

function adventureFor(row: GuestRow) {
  const adventure = guestAdventure({
    version: 1,
    characterId: row.characterId,
    episodeId: `${row.characterId}-1`,
    turns: 3
  })
  if (!adventure) throw error(403, 'ログインせず体験できるのは第1話・3往復です。')
  return adventure
}
export function guestPracticeView(row: GuestRow): PracticeSession {
  const adventure = adventureFor(row)
  const last = row.state.turns.at(-1)
  const assessment = last?.feedback?.analysis?.assessment
  const grade = gradeConversation(assessment, 1)
  const relationship = applyRelationship({ earned: 0, strain: 0 }, 0, grade, 3, 1)
  const mission = row.state.completedAt
    ? parseMission(
        last?.mission ? { ...last.mission, achieved: true } : null,
        adventure,
        row.state.turns.map((t) => t.userText)
      )
    : null
  return {
    id: row.id,
    sceneId: 'adventure',
    adventure,
    customScene: null,
    chargedAt: null,
    creditCost: 1,
    completedAt: row.state.completedAt,
    pending: row.state.pending,
    turns: row.state.turns.map((turn) => ({
      requestId: turn.requestId,
      position: turn.position,
      userText: turn.userText,
      assistantText: turn.assistantText,
      feedback: turn.feedback,
      presentation: turn.presentation
    })),
    storyContext: row.storyContext,
    characterReactions: row.characterContext.content.reactions,
    reward: row.state.completedAt ? { version: 1, xp: mission ? 30 : 20, mission } : null,
    evaluation: row.state.completedAt
      ? {
          version: 1,
          status: grade.status,
          score: grade.score,
          consideration: grade.consideration,
          requiredScore: grade.requiredScore,
          requiredConsideration: grade.requiredConsideration,
          affinityBefore: 0,
          affinityAfter: relationship.affinity,
          earnedDelta: relationship.earnedDelta,
          strainDelta: relationship.strainDelta,
          assessment
        }
      : null
  }
}
async function owned(db: CreditDb, sessionId: string, id: string, now: Date, lock = false) {
  const session = await db.query.guestSessions.findFirst({
    where: and(eq(guestSessions.id, sessionId), gt(guestSessions.expiresAt, now))
  })
  if (!session) throw error(401, '体験の保存期間が終了しました。お相手を選んで始めてください。')
  const query = db
    .select()
    .from(guestPractices)
    .where(and(eq(guestPractices.id, id), eq(guestPractices.sessionId, sessionId)))
  const [row] = await (lock ? query.for('update') : query)
  if (!row) throw error(404, '体験の会話が見つかりません。')
  adventureFor(row)
  return row
}
export async function getGuestPractice(sessionId: string, id: string) {
  return guestPracticeView(await owned(getDb(), sessionId, id, new Date()))
}

export async function offerGuestTip(sessionId: string, id: string, requestId: string) {
  return getDb().transaction(async (tx) => {
    const now = new Date()
    await tx
      .select({ id: guestSessions.id })
      .from(guestSessions)
      .where(eq(guestSessions.id, sessionId))
      .for('update')
    const row = await owned(tx, sessionId, id, now, true)
    if (row.claimedUid) throw error(403, 'ログイン後の画面から続けてください。')
    if (row.state.tip) return row.state.tip
    const { turns } = row.state
    if (turns.length !== 2 && (turns.length !== 3 || turns.at(-1)?.requestId !== requestId))
      throw error(409, '最後の返答を送信すると会話のヒントが表示されます。')
    const previous = await tx
      .select({ state: guestPractices.state })
      .from(guestPractices)
      .where(eq(guestPractices.sessionId, sessionId))
    const lastShown = new Map<string, string>()
    for (const { state } of previous) {
      if (state.tip && state.tip.shownAt > (lastShown.get(state.tip.tipId) ?? ''))
        lastShown.set(state.tip.tipId, state.tip.shownAt)
    }
    const tip: GuestTip = {
      tipId: drawPracticeTip(
        { sceneId: 'adventure', adventure: adventureFor(row) },
        lastShown,
        randomInt
      ).id,
      shownAt: now.toISOString(),
      rating: null
    }
    await tx
      .update(guestPractices)
      .set({ state: { ...row.state, tip } })
      .where(eq(guestPractices.id, id))
    return tip
  })
}

export async function saveGuestTipRating(
  sessionId: string,
  id: string,
  value: TipSelfRating,
  revision: number | null
) {
  return getDb().transaction(async (tx) => {
    const now = new Date()
    const row = await owned(tx, sessionId, id, now, true)
    if (row.claimedUid) throw error(403, 'ログイン後の画面から続けてください。')
    const tip = row.state.tip
    if (!tip) throw error(404, '表示したTipsが見つかりません。')
    if (tip.rating?.value === value) return tip.rating
    requireRatingRevision(tip.rating, revision)
    const rating = { id: (tip.rating?.id ?? 0) + 1, value, ratedAt: now.toISOString() }
    await tx
      .update(guestPractices)
      .set({ state: { ...row.state, tip: { ...tip, rating } } })
      .where(eq(guestPractices.id, id))
    return rating
  })
}
async function consumeRate(
  db: CreditDb,
  context: RateContext,
  kind: 'start' | 'generation',
  now: Date
) {
  for (const [scope, limit] of [
    ['global', kind === 'start' ? 300 : 1200],
    [context.hash, kind === 'start' ? 12 : 60]
  ] as const) {
    const key = `${scope}:${kind}:${context.day}`
    if (!(await consumeRateLimit(db, key, limit, new Date(now.getTime() + 2 * 86400_000))))
      throw error(
        429,
        '本日の体験が混み合っています。ログインして練習するか、日を改めてお試しください。'
      )
  }
}
export async function createGuestPractice(
  session: { id: string; expiresAt: Date },
  id: string,
  adventure: Adventure,
  rate: RateContext,
  now = new Date()
) {
  if (!guestAdventure(adventure)) throw error(403, 'ログインせず体験できるのは第1話・3往復です。')
  const db = getDb()
  // 期限切れの体験だけを少しずつ除去し、引き継いだ通常会話には触れない。
  await db
    .delete(guestSessions)
    .where(
      inArray(
        guestSessions.id,
        db
          .select({ id: guestSessions.id })
          .from(guestSessions)
          .where(lt(guestSessions.expiresAt, now))
          .limit(50)
      )
    )
  await pruneRateLimits(db, now)
  return db.transaction(async (tx) => {
    await tx.insert(guestSessions).values(session).onConflictDoNothing()
    await tx.select().from(guestSessions).where(eq(guestSessions.id, session.id)).for('update')
    const existing = await tx.query.guestPractices.findFirst({
      where: and(
        eq(guestPractices.sessionId, session.id),
        eq(guestPractices.characterId, adventure.characterId)
      )
    })
    if (existing) return guestPracticeView(existing)
    if (
      (await tx.query.guestPractices.findFirst({ where: eq(guestPractices.id, id) })) ||
      (await tx.query.practices.findFirst({ where: eq(practices.id, id) }))
    )
      throw error(409, '別の体験として始めてください。')
    await consumeRate(tx, rate, 'start', now)
    const [created] = await tx
      .insert(guestPractices)
      .values({
        id,
        sessionId: session.id,
        characterId: adventure.characterId,
        characterContext: await snapshotCharacter(tx, adventure.characterId),
        policyReleaseId:
          process.env.KNOWLEDGE_POLICY_ENABLED === 'true'
            ? ((
                await tx.query.knowledgeSettings.findFirst({
                  where: eq(knowledgeSettings.id, 'main')
                })
              )?.activeReleaseId ?? null)
            : null,
        storyContext: {
          version: 1,
          chapter: 1,
          relationship: '初めて二人で会い、互いを知り始めた関係。',
          revisit: false,
          memories: [],
          affinity: { value: 0, label: '知り合ったばかり' }
        },
        state: { turns: [], completedAt: null, pending: null },
        createdAt: now
      })
      .returning()
    return guestPracticeView(created)
  })
}
export async function reserveGuestTurn(input: GuestMessage, rate: RateContext, now = new Date()) {
  return getDb().transaction(async (tx) => {
    const row = await owned(tx, input.sessionId, input.id, now, true)
    if (row.claimedUid) throw error(403, 'この会話はログイン後の画面から続けてください。')
    const replay = row.state.turns.find((t) => t.requestId === input.requestId)
    if (replay) {
      if (replay.userText !== input.text || replay.position !== input.expectedTurn + 1)
        throw error(409, '内容を変えた場合は新しい送信としてお試しください。')
      return { status: 'replay' as const, session: guestPracticeView(row) }
    }
    if (row.state.completedAt)
      throw error(409, '体験は完了しています。ログインして続きを練習できます。')
    if (input.expectedTurn !== row.state.turns.length)
      throw error(409, '会話が更新されています。再読み込みしてください。')
    if (row.state.pending?.until && new Date(row.state.pending.until) > now)
      return { status: 'pending' as const, session: guestPracticeView(row) }
    if (row.attempts >= 9)
      throw error(429, '体験の送信回数に達しました。ログインして練習を続けてください。')
    await consumeRate(tx, rate, 'generation', now)
    const token = randomUUID()
    await tx
      .update(guestPractices)
      .set({
        attempts: row.attempts + 1,
        pendingToken: token,
        state: {
          ...row.state,
          pending: {
            requestId: input.requestId,
            text: input.text,
            until: new Date(now.getTime() + LEASE_MS).toISOString()
          }
        }
      })
      .where(eq(guestPractices.id, row.id))
    return {
      status: 'ready' as const,
      token,
      input: {
        id: row.id,
        sceneId: 'adventure',
        adventure: adventureFor(row),
        turns: row.state.turns,
        text: input.text,
        storyContext: row.storyContext,
        characterContext: row.characterContext,
        policyReleaseId: row.policyReleaseId
      } satisfies GeneratePracticeInput
    }
  })
}
export async function finishGuestTurn(
  input: GuestMessage,
  token: string,
  output: GuestTurn,
  now = new Date()
) {
  return getDb().transaction(async (tx) => {
    const row = await owned(tx, input.sessionId, input.id, now, true)
    if (
      row.pendingToken !== token ||
      row.state.turns.length !== input.expectedTurn ||
      row.claimedUid
    )
      return false
    const turns = [
      ...row.state.turns,
      { ...output, presentation: parsePresentation(output.presentation) }
    ]
    await tx
      .update(guestPractices)
      .set({
        pendingToken: null,
        state: {
          ...row.state,
          turns,
          completedAt: turns.length === 3 ? now.toISOString() : null,
          pending: null
        }
      })
      .where(eq(guestPractices.id, row.id))
    return true
  })
}
export async function releaseGuestTurn(input: GuestMessage, token: string) {
  await getDb().transaction(async (tx) => {
    const row = await owned(tx, input.sessionId, input.id, new Date(), true)
    if (row.pendingToken !== token) return
    await tx
      .update(guestPractices)
      .set({
        pendingToken: null,
        state: {
          ...row.state,
          pending: row.state.pending ? { ...row.state.pending, until: null } : null
        }
      })
      .where(eq(guestPractices.id, row.id))
  })
}
export async function reserveGuestClaim(sessionId: string, id: string, uid: string) {
  return getDb().transaction(async (tx) => {
    const row = await owned(tx, sessionId, id, new Date(), true)
    if (row.claimedUid && row.claimedUid !== uid)
      throw error(403, 'この体験は別のアカウントへ引き継ぎ済みです。')
    if (row.state.pending?.until && new Date(row.state.pending.until) > new Date())
      throw error(409, '返信の生成が終わってから、会話を引き継いでください。')
    // 引き継ぎが途中で止まっても同じ本人だけが再開でき、別アカウントへ複製しない。
    await tx.update(guestPractices).set({ claimedUid: uid }).where(eq(guestPractices.id, id))
    return row
  })
}
