import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import {
  emptyAdventureProgress,
  episodeById,
  episodeKey,
  normalizeAdventure,
  parsePresentation,
  type AdventureProgress,
  type Presentation
} from '$lib/adventure'
import { getDb } from '../client'
import { operations, practices, practiceTurns, users } from '../schema'
import type { MessageInput } from './practices'

export async function getAdventureProgress(uid: string): Promise<AdventureProgress> {
  const db = getDb()
  const [completed, favorites] = await Promise.all([
    db
      .select({
        id: practices.id,
        adventure: practices.adventure,
        reward: practices.reward,
        completedAt: practices.completedAt
      })
      .from(practices)
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
      .orderBy(desc(practices.updatedAt))
  ])
  const progress = emptyAdventureProgress()
  const valid = completed.filter(
    (row) =>
      normalizeAdventure(row.adventure) &&
      row.reward?.version === 1 &&
      [20, 30].includes(row.reward.xp)
  )
  progress.xp = valid.reduce((sum, row) => sum + row.reward!.xp, 0)
  progress.level = Math.floor(progress.xp / 100) + 1
  progress.xpInLevel = progress.xp % 100
  progress.completed = valid.length
  progress.completedEpisodes = [
    ...new Set(valid.map((row) => episodeKey(row.adventure!.characterId, row.adventure!.episodeId)))
  ]
  const seen = new Set<string>()
  for (const row of valid) {
    const adventure = row.adventure!,
      key = episodeKey(adventure.characterId, adventure.episodeId)
    if (seen.has(key)) continue
    seen.add(key)
    progress.memories.push({
      practiceId: row.id,
      characterId: adventure.characterId,
      episodeId: adventure.episodeId,
      title: episodeById(adventure.episodeId)!.title,
      completedAt: row.completedAt!.toISOString()
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
      [1, 2, 3].every((chapter) => seen.has(episodeKey(id, `${id}-${chapter}`)))
    ),
    encounters: encountered.size >= 3
  }
  progress.badges = progress.badges.map((badge) => ({ ...badge, earned: earned[badge.id] }))
  return progress
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
      sceneId: session.sceneId,
      customScene: session.customScene,
      turns: turns.slice(0, input.position - 1)
    }
  })
}
export async function finishRehearsal(
  input: RehearsalInput,
  token: string,
  output: { reply: string; presentation?: Presentation }
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
