import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import {
  practiceTurnLimit,
  type CustomSceneInput,
  type PracticeFeedback,
  type PracticeOverview,
  type PracticeSession,
  type SceneId
} from '$lib/practice'
import {
  episodeKey,
  adventureAccess,
  episodeById,
  normalizeAdventure,
  parseMission,
  parsePresentation,
  parseStoryEnding,
  type Adventure,
  type MissionResult,
  type Presentation,
  type StoryEnding
} from '$lib/adventure'
import { practiceCreditCost } from '$lib/billing'
import { getDb } from '../client'
import {
  characterEndings,
  operations,
  practices,
  practiceTurns,
  practiceEvaluations,
  users
} from '../schema'
import { readProgression, settleProgression } from './progression'
import {
  commitCredits,
  commonCreditLimit,
  readCreditState,
  releaseCredits,
  reserveCredits
} from './credits'
import { buildStoryContext } from './story-context'

// 生成中の枠も確保し、別タブから月上限を超えて開始できないようにする。
const LEASE_MS = 75_000

export async function getPractice(uid: string, id: string): Promise<PracticeSession | null> {
  // 保存と読み取りが交差して、完了状態と発言数が食い違わないようにする。
  return getDb().transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(practices)
      .where(and(eq(practices.id, id), eq(practices.uid, uid)))
      .for('share')
    if (!session) return null
    const evaluation = await tx.query.practiceEvaluations.findFirst({
      where: eq(practiceEvaluations.practiceId, id)
    })
    const turns = await tx
      .select()
      .from(practiceTurns)
      .where(eq(practiceTurns.practiceId, id))
      .orderBy(practiceTurns.position)
    return {
      id: session.id,
      evaluation: evaluation
        ? {
            ...evaluation.result,
            retryAfter: evaluation.retryAfter?.toISOString() ?? null,
            pending: !!evaluation.pendingUntil && evaluation.pendingUntil > new Date()
          }
        : null,
      sceneId: session.sceneId,
      customScene: session.customScene,
      adventure: session.adventure,
      reward: session.reward,
      favoriteTurn: session.favoriteTurn,
      rehearsal: session.rehearsal,
      creditCost: session.creditCost,
      storyContext: session.storyContext,
      storyEnding: session.storyEnding,
      chargedAt: session.chargedAt?.toISOString() ?? null,
      completedAt: session.completedAt?.toISOString() ?? null,
      turns: turns.map(
        ({ requestId, position, userText, assistantText, feedback, presentation }) => ({
          requestId,
          position,
          userText,
          assistantText,
          feedback,
          presentation
        })
      ),
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
    const [billing, latest, active] = await Promise.all([
      readCreditState(db, uid, now),
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
      remaining: billing.remaining,
      reserved: billing.reserved,
      limit:
        commonCreditLimit(billing) +
        billing.credits.filter((g) => g.kind === 'route').reduce((sum, g) => sum + g.units, 0),
      activePracticeId: active?.id ?? null,
      latestPracticeId: latest?.id ?? null,
      resetsAt: billing.resetsAt,
      billing
    }
  })
}

export async function createPractice(
  uid: string,
  id: string,
  sceneId: SceneId,
  customScene: CustomSceneInput | null = null,
  adventure: Adventure | null = null
) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
    const existing = await tx.query.practices.findFirst({ where: eq(practices.id, id) })
    // 同じ作成IDを別の状況へ流用すると、再送と場面変更を区別できなくなる。
    // jsonbはキー順を保持しないため、双方を正規化してから同一性を比べる。
    if (existing)
      return (
        existing.uid === uid &&
        existing.sceneId === sceneId &&
        existing.customScene?.situation === customScene?.situation &&
        existing.customScene?.partnerName === customScene?.partnerName &&
        existing.customScene?.openingLine === customScene?.openingLine &&
        JSON.stringify(normalizeAdventure(existing.adventure)) ===
          JSON.stringify(
            normalizeAdventure(
              adventure && existing.adventure?.revisit ? { ...adventure, revisit: true } : adventure
            )
          )
      )
    if (sceneId === 'adventure') {
      if (!normalizeAdventure(adventure)) return false
      await settleProgression(tx, uid)
      const progression = await readProgression(tx, uid),
        keys = progression.clearedEpisodes
      // 読了済みの本編は直接POSTや旧画面から始めても再練習として保存する。
      if (
        episodeById(adventure!.episodeId)?.chapter &&
        keys.includes(episodeKey(adventure!.characterId, adventure!.episodeId))
      )
        adventure = { ...adventure!, revisit: true }
      // 解放を画面だけに任せると、直接POSTで先の話へ進めてしまう。
      const billing = await readCreditState(tx, uid)
      const access = adventureAccess(
        adventure!,
        keys,
        billing.ownedCharacters,
        !!billing.subscription?.active,
        new Date(),
        progression
      )
      if (access !== 'available') return access
    } else if (adventure) return false
    await tx.insert(practices).values({
      id,
      uid,
      sceneId,
      customScene,
      adventure,
      creditCost: practiceCreditCost(practiceTurnLimit(adventure)),
      storyContext: adventure ? await buildStoryContext(tx, uid, adventure) : null
    })
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
    if (session.completedAt || turns.length >= practiceTurnLimit(session.adventure))
      return { status: 'complete' as const }
    if (session.pendingUntil && session.pendingUntil > now) return { status: 'pending' as const }
    if (turns.length !== input.expectedTurn) return { status: 'conflict' as const }
    if (session.pendingRequestId === input.requestId && session.pendingText !== input.text)
      return { status: 'conflict' as const }
    const until = new Date(now.getTime() + LEASE_MS)
    if (!session.chargedAt) {
      // 作成後に返金・期限切れになった場合も、最初の生成前に購入権を確かめる。
      if (session.adventure) {
        await settleProgression(tx, input.uid, now)
        const progression = await readProgression(tx, input.uid)
        const billing = await readCreditState(tx, input.uid, now)
        const keys = progression.clearedEpisodes
        const access = adventureAccess(
          session.adventure,
          keys,
          billing.ownedCharacters,
          !!billing.subscription?.active,
          now,
          progression
        )
        if (access !== 'available') return { status: 'access' as const, access }
      }
      const reserved = await reserveCredits(
        tx,
        input.uid,
        input.id,
        session.creditCost,
        session.adventure?.characterId,
        !!session.adventure && !!episodeById(session.adventure.episodeId)?.chapter,
        until,
        now
      )
      if (!reserved) return { status: 'quota' as const }
    }
    const token = randomUUID()
    await tx
      .update(practices)
      .set({
        pendingRequestId: input.requestId,
        pendingText: input.text,
        pendingToken: token,
        pendingUntil: until,
        updatedAt: now
      })
      .where(eq(practices.id, input.id))
    return {
      status: 'ready' as const,
      token,
      sceneId: session.sceneId,
      customScene: session.customScene,
      adventure: session.adventure,
      storyContext: session.storyContext,
      turns
    }
  })
}

export async function releasePracticeTurn(input: MessageInput, token: string) {
  // 失敗した本文は残し、再読み込み後も同じ入力から再試行できるようにする。
  await getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, input.uid)).for('update')
    const changed = await tx
      .update(practices)
      .set({ pendingUntil: null, pendingToken: null })
      .where(
        and(
          eq(practices.id, input.id),
          eq(practices.uid, input.uid),
          eq(practices.pendingToken, token)
        )
      )
      .returning({ id: practices.id })
    if (changed.length) await releaseCredits(tx, input.id)
  })
}

export async function finishPracticeTurn(
  input: MessageInput,
  token: string,
  output: {
    reply: string
    feedback: PracticeFeedback | null
    presentation?: Presentation
    mission?: MissionResult | null
    storyEnding?: StoryEnding | null
  },
  now = new Date()
) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, input.uid)).for('update')
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, input.id), eq(practices.uid, input.uid))
    })
    // 古い生成処理が、期限切れ後に始まった再試行の結果を上書きしない。
    if (!session || session.pendingToken !== token) return false
    if (
      !session.chargedAt &&
      !(await commitCredits(
        tx,
        input.uid,
        input.id,
        session.creditCost,
        session.adventure?.characterId,
        !!session.adventure && !!episodeById(session.adventure.episodeId)?.chapter,
        now
      ))
    )
      return false
    const position = input.expectedTurn + 1
    await tx.insert(practiceTurns).values({
      id: randomUUID(),
      practiceId: input.id,
      requestId: input.requestId,
      position,
      userText: input.text,
      assistantText: output.reply,
      feedback: output.feedback,
      presentation: session.adventure ? parsePresentation(output.presentation) : null,
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
    const final = position === practiceTurnLimit(session.adventure)
    let reward = session.reward
    let storyEnding = session.storyEnding
    if (final && session.adventure) {
      const prior = await tx
        .select({ text: practiceTurns.userText })
        .from(practiceTurns)
        .where(eq(practiceTurns.practiceId, input.id))
        .orderBy(practiceTurns.position)
      const mission = parseMission(
        output.mission ? { ...output.mission, achieved: true } : null,
        session.adventure,
        prior.map((row) => row.text)
      )
      // 完了と報酬を同じトランザクションに保存し、再送で経験値を増やさない。
      reward = {
        version: 1,
        xp: practiceTurnLimit(session.adventure) === 6 ? (mission ? 70 : 50) : mission ? 30 : 20,
        mission
      }
      storyEnding = parseStoryEnding(
        output.storyEnding,
        session.adventure,
        prior.map((row) => row.text)
      )
      if (episodeById(session.adventure.episodeId)?.chapter === 12 && !storyEnding) {
        throw Error('The story ending requires conversation evidence')
      }
    }
    await tx
      .update(practices)
      .set({
        chargedAt: session.chargedAt ?? now,
        completedAt: final ? now : null,
        reward,
        storyEnding,
        pendingRequestId: null,
        pendingText: null,
        pendingToken: null,
        pendingUntil: null,
        updatedAt: now
      })
      .where(eq(practices.id, input.id))
    if (final && session.adventure) {
      await settleProgression(tx, input.uid, now)
      const evaluation = await tx.query.practiceEvaluations.findFirst({
        where: eq(practiceEvaluations.practiceId, input.id)
      })
      const progression = await readProgression(tx, input.uid)
      if (
        storyEnding &&
        !session.adventure.revisit &&
        evaluation?.result.status === 'passed' &&
        progression.clearedEpisodes.includes(
          episodeKey(session.adventure.characterId, session.adventure.episodeId)
        )
      )
        await tx
          .insert(characterEndings)
          .values({
            id: `${input.uid}:${session.adventure.characterId}`,
            uid: input.uid,
            characterId: session.adventure.characterId,
            practiceId: input.id
          })
          .onConflictDoNothing()
    }
    return true
  })
}
