import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import {
  emptyAdventureProgress,
  episodeById,
  episodeKey,
  normalizeAdventure,
  parsePresentation,
  stageProgress,
  type AdventureProgress,
  type Presentation
} from '$lib/adventure'
import { getDb } from '../client'
import {
  characterEndings,
  operations,
  practices,
  practiceTurns,
  practiceEvaluations,
  users
} from '../schema'
import { readCreditState } from './credits'
import type { MessageInput } from './practices'
import { readProgression, settleProgression } from './progression'

export async function getAdventureProgress(uid: string): Promise<AdventureProgress> {
  const db = getDb()
  const [completed, favorites, billing, chosenEndings] = await Promise.all([
    db
      .select({
        id: practices.id,
        adventure: practices.adventure,
        reward: practices.reward,
        storyEnding: practices.storyEnding,
        lastReply: practiceTurns.assistantText,
        presentation: practiceTurns.presentation,
        completedAt: practices.completedAt
      })
      .from(practices)
      .leftJoin(
        practiceTurns,
        and(
          eq(practices.id, practiceTurns.practiceId),
          eq(
            practiceTurns.position,
            sql`case when ${practices.adventure}->>'turns' = '6' then 6 else 3 end`
          )
        )
      )
      .where(
        and(
          eq(practices.uid, uid),
          isNotNull(practices.completedAt),
          isNotNull(practices.adventure)
        )
      )
      .orderBy(desc(practices.completedAt)),
    db
      .select({
        practiceId: practices.id,
        adventure: practices.adventure,
        position: practiceTurns.position,
        text: practiceTurns.userText
      })
      .from(practices)
      .innerJoin(
        practiceTurns,
        and(
          eq(practices.id, practiceTurns.practiceId),
          eq(practices.favoriteTurn, practiceTurns.position)
        )
      )
      .where(
        and(
          eq(practices.uid, uid),
          isNotNull(practices.completedAt),
          isNotNull(practices.adventure)
        )
      )
      .orderBy(desc(practices.updatedAt)),
    readCreditState(db, uid),
    db.select().from(characterEndings).where(eq(characterEndings.uid, uid))
  ])
  const progress = emptyAdventureProgress()
  progress.progression = await readProgression(db, uid)
  const valid = completed.filter(
    (row) =>
      normalizeAdventure(row.adventure) &&
      row.reward?.version === 1 &&
      [20, 30, 50, 70].includes(row.reward.xp)
  )
  progress.xp = valid.reduce((sum, row) => sum + row.reward!.xp, 0)
  progress.level = Math.floor(progress.xp / 100) + 1
  progress.xpInLevel = progress.xp % 100
  progress.completed = valid.length
  progress.completedEpisodes = [
    ...new Set(valid.map((row) => episodeKey(row.adventure!.characterId, row.adventure!.episodeId)))
  ]
  const seen = new Set<string>()
  const albumSeen = new Set<string>()
  for (const row of valid) {
    const adventure = row.adventure!,
      key = episodeKey(adventure.characterId, adventure.episodeId)
    seen.add(key)
    const albumKey = `${key}:${adventure.turns}`
    if (albumSeen.has(albumKey)) continue
    albumSeen.add(albumKey)
    progress.memories.push({
      practiceId: row.id,
      characterId: adventure.characterId,
      episodeId: adventure.episodeId,
      title: episodeById(adventure.episodeId)!.title,
      completedAt: row.completedAt!.toISOString(),
      variant: adventure.turns === 6 ? 'deep' : 'short',
      quote: row.lastReply?.slice(0, 240),
      emotion: row.presentation?.emotion ?? 'relieved'
    })
  }
  progress.favorites = favorites.flatMap((row) =>
    row.adventure && normalizeAdventure(row.adventure)
      ? [
          {
            practiceId: row.practiceId,
            characterId: row.adventure.characterId,
            position: row.position,
            text: row.text
          }
        ]
      : []
  )
  const encountered = new Set(valid.map((row) => row.adventure!.characterId))
  const earned: Record<string, boolean> = {
    first: valid.length > 0,
    mission: valid.filter((row) => row.reward?.mission).length >= 3,
    story: [...encountered].some((id) =>
      [1, 2, 3].every((chapter) =>
        progress.progression!.clearedEpisodes.includes(episodeKey(id, `${id}-${chapter}`))
      )
    ),
    encounters: encountered.size >= 3
  }
  progress.badges = progress.badges.map((badge) => ({ ...badge, earned: earned[badge.id] }))
  progress.billing = billing
  progress.stages = stageProgress(progress.progression, billing.ownedCharacters)
  progress.endings = valid.flatMap((row) =>
    row.storyEnding
      ? [
          {
            practiceId: row.id,
            characterId: row.adventure!.characterId,
            kind: row.storyEnding.kind,
            selected: chosenEndings.some((e) => e.practiceId === row.id)
          }
        ]
      : []
  )
  return progress
}

export async function selectStoryEnding(uid: string, id: string) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
    await settleProgression(tx, uid)
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, id), eq(practices.uid, uid))
    })
    if (
      !session?.completedAt ||
      !session.adventure ||
      !session.storyEnding ||
      episodeById(session.adventure.episodeId)?.chapter !== 12
    )
      return false
    const progression = await readProgression(tx, uid)
    const evaluation = await tx.query.practiceEvaluations.findFirst({
      where: eq(practiceEvaluations.practiceId, id)
    })
    if (
      !progression.clearedEpisodes.includes(
        episodeKey(session.adventure.characterId, session.adventure.episodeId)
      ) ||
      evaluation?.result.status !== 'passed'
    )
      return false
    await tx
      .insert(characterEndings)
      .values({
        id: `${uid}:${session.adventure.characterId}`,
        uid,
        characterId: session.adventure.characterId,
        practiceId: id
      })
      .onConflictDoUpdate({
        target: characterEndings.id,
        set: { practiceId: id, updatedAt: new Date() }
      })
    return true
  })
}

export async function saveFavoriteTurn(uid: string, id: string, position: number | null) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, id), eq(practices.uid, uid))
    })
    if (!session?.completedAt || !session.adventure) return false
    if (
      position !== null &&
      !(await tx.query.practiceTurns.findFirst({
        where: and(eq(practiceTurns.practiceId, id), eq(practiceTurns.position, position))
      }))
    )
      return false
    await tx
      .update(practices)
      .set({ favoriteTurn: position, updatedAt: new Date() })
      .where(eq(practices.id, id))
    return true
  })
}

export interface RehearsalInput extends MessageInput {
  position: number
}
export async function reserveRehearsal(input: RehearsalInput, now = new Date()) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, input.uid)).for('update')
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, input.id), eq(practices.uid, input.uid))
    })
    if (!session?.completedAt || !session.adventure) return { status: 'not_found' as const }
    if (session.rehearsal?.reply)
      return {
        status:
          session.rehearsal.requestId === input.requestId &&
          session.rehearsal.text === input.text &&
          session.rehearsal.position === input.position
            ? ('replay' as const)
            : ('complete' as const)
      }
    if (session.pendingUntil && session.pendingUntil > now) return { status: 'pending' as const }
    const turns = await tx
      .select()
      .from(practiceTurns)
      .where(eq(practiceTurns.practiceId, input.id))
      .orderBy(practiceTurns.position)
    if (!turns.some((turn) => turn.position === input.position))
      return { status: 'not_found' as const }
    if (
      session.rehearsal?.requestId === input.requestId &&
      (session.rehearsal.text !== input.text || session.rehearsal.position !== input.position)
    )
      return { status: 'conflict' as const }
    const token = randomUUID()
    await tx
      .update(practices)
      .set({
        rehearsal: { position: input.position, requestId: input.requestId, text: input.text },
        pendingRequestId: input.requestId,
        pendingText: input.text,
        pendingToken: token,
        pendingUntil: new Date(now.getTime() + 75_000),
        updatedAt: now
      })
      .where(eq(practices.id, input.id))
    return {
      status: 'ready' as const,
      token,
      adventure: session.adventure,
      storyContext: session.storyContext,
      policyReleaseId: session.policyReleaseId,
      sceneId: session.sceneId,
      customScene: session.customScene,
      turns: turns.slice(0, input.position - 1)
    }
  })
}
export async function finishRehearsal(
  input: RehearsalInput,
  token: string,
  output: {
    reply: string
    presentation?: Presentation
    policyContext?: import('$lib/knowledge-policy').KnowledgeTrace
  }
) {
  return getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, input.uid)).for('update')
    const session = await tx.query.practices.findFirst({
      where: and(eq(practices.id, input.id), eq(practices.uid, input.uid))
    })
    if (!session || session.pendingToken !== token || session.rehearsal?.reply) return false
    await tx
      .update(practices)
      .set({
        rehearsal: {
          position: input.position,
          requestId: input.requestId,
          text: input.text,
          reply: output.reply,
          ...(output.policyContext ? { policyContext: output.policyContext } : {}),
          presentation: parsePresentation(output.presentation)
        },
        pendingRequestId: null,
        pendingText: null,
        pendingToken: null,
        pendingUntil: null,
        updatedAt: new Date()
      })
      .where(eq(practices.id, input.id))
    // 言い直しは元の会話・分析・完了報酬を変更しない。
    await tx.insert(operations).values({
      uid: input.uid,
      conversationId: `practice:${input.id}:rehearsal`,
      query: input.text,
      llmText: output.reply
    })
    return true
  })
}
