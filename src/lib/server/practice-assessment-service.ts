import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import { resolveScene } from '$lib/practice'
import { getDb } from './db/client'
import { practiceEvaluations, users } from './db/schema'
import { getPractice } from './db/repositories/practices'
import {
  clearEligibleStages,
  settleEvaluation,
  settleProgression
} from './db/repositories/progression'
import { assessPractice } from './jev-practice'
import { practiceCoaching } from './practice-coaching'

export async function reassessPractice(uid: string, id: string) {
  const session = await getPractice(uid, id)
  if (!session) throw error(404, '練習が見つかりません。')
  if (!session.completedAt || !session.adventure)
    throw error(409, '会話を最後まで終えると評価できます。')
  const now = new Date(),
    token = randomUUID()
  const reservation = await getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
    await settleProgression(tx, uid, now)
    const evaluation = await tx.query.practiceEvaluations.findFirst({
      where: eq(practiceEvaluations.practiceId, id)
    })
    if (evaluation?.settledAt) return 'complete'
    if (evaluation?.pendingUntil && evaluation.pendingUntil > now) return 'pending'
    if (evaluation?.retryAfter && evaluation.retryAfter > now)
      throw error(429, '少し待ってから再評価してください。利用枠は消費しません。')
    await tx
      .update(practiceEvaluations)
      .set({
        pendingToken: token,
        pendingUntil: new Date(now.getTime() + 75_000),
        retryAfter: new Date(now.getTime() + 30_000)
      })
      .where(and(eq(practiceEvaluations.practiceId, id), eq(practiceEvaluations.uid, uid)))
    return 'ready'
  })
  if (reservation !== 'ready')
    return { session: await getPractice(uid, id), pending: reservation === 'pending' }
  const scene = resolveScene(session.sceneId, session.customScene, session.adventure)!
  const transcript = [
    { role: 'assistant', content: scene.opener },
    ...session.turns.flatMap((turn, index) => [
      { role: 'user', content: turn.userText, turn: index + 1 },
      { role: 'assistant', content: turn.assistantText }
    ])
  ]
  const coaching = practiceCoaching(scene)
  const measured = await assessPractice(scene, transcript, AbortSignal.timeout(8_000), coaching)
  await getDb().transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
    const evaluation = await tx.query.practiceEvaluations.findFirst({
      where: eq(practiceEvaluations.practiceId, id)
    })
    // 期限切れ後の古い採点が、後から始めた採点を上書きしない。
    if (evaluation?.pendingToken !== token) return
    if (measured) {
      await settleEvaluation(tx, uid, id, {
        ...measured,
        rubric: { version: 3, profile: coaching.id }
      })
      await clearEligibleStages(tx, uid)
    }
    await tx
      .update(practiceEvaluations)
      .set({ pendingToken: null, pendingUntil: null })
      .where(
        and(eq(practiceEvaluations.practiceId, id), eq(practiceEvaluations.pendingToken, token))
      )
  })
  if (!measured)
    throw error(
      502,
      '評価を取得できませんでした。会話と利用枠はそのままです。少し待って再評価できます。'
    )
  return { session: await getPractice(uid, id), pending: false }
}
