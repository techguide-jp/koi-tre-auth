import { randomInt } from 'node:crypto'
import { error } from '@sveltejs/kit'
import { and, asc, desc, eq, isNotNull, isNull, max, min } from 'drizzle-orm'
import { practiceTurnLimit } from '$lib/practice'
import {
  drawPracticeTip,
  practiceTipById,
  type CollectedTip,
  type GuestTip,
  type TipOffer,
  type TipRating,
  type TipSelfRating
} from '$lib/practice-tips'
import { getDb } from '../client'
import { practices, practiceTipRatings, practiceTurns, users } from '../schema'
import type { CreditDb } from './credits'

type RatingRow = Pick<typeof practiceTipRatings.$inferSelect, 'id' | 'value' | 'ratedAt'>
const ratingColumns = {
  id: practiceTipRatings.id,
  value: practiceTipRatings.value,
  ratedAt: practiceTipRatings.ratedAt
}

function ratingView(row: RatingRow): TipRating {
  return { id: row.id, value: row.value, ratedAt: row.ratedAt.toISOString() }
}

async function lockUser(db: CreditDb, uid: string) {
  await db
    .select({ uid: users.firebaseUid })
    .from(users)
    .where(eq(users.firebaseUid, uid))
    .for('update')
}

async function latestRating(db: CreditDb, uid: string, tipId: string) {
  const [latest] = await db
    .select(ratingColumns)
    .from(practiceTipRatings)
    .where(and(eq(practiceTipRatings.uid, uid), eq(practiceTipRatings.tipId, tipId)))
    .orderBy(desc(practiceTipRatings.ratedAt), desc(practiceTipRatings.id))
    .limit(1)
  return latest ? ratingView(latest) : null
}

export async function offerPracticeTip(
  uid: string,
  id: string,
  requestId: string
): Promise<TipOffer> {
  return getDb().transaction(async (tx) => {
    // 同じ利用者の同時抽選でも、未収集の候補は先に確定した抽選を反映する。
    await lockUser(tx, uid)
    const [practice] = await tx
      .select({
        sceneId: practices.sceneId,
        adventure: practices.adventure,
        tipId: practices.tipId
      })
      .from(practices)
      .where(and(eq(practices.id, id), eq(practices.uid, uid)))
    if (!practice) throw error(404, '会話が見つかりません。')
    if (practice.tipId)
      return { tipId: practice.tipId, rating: await latestRating(tx, uid, practice.tipId) }

    const [last] = await tx
      .select({ position: practiceTurns.position, requestId: practiceTurns.requestId })
      .from(practiceTurns)
      .where(eq(practiceTurns.practiceId, id))
      .orderBy(desc(practiceTurns.position))
      .limit(1)
    const limit = practiceTurnLimit(practice.adventure)
    // 分析の保存が抽選より先に終わっても、同じ最終送信なら抽選できる。
    if (last?.position !== limit - 1 && (last?.position !== limit || last.requestId !== requestId))
      throw error(409, '最後の返答を送信すると会話のヒントが表示されます。')

    const history = await tx
      .select({ tipId: practices.tipId, shownAt: max(practices.tipShownAt) })
      .from(practices)
      .where(and(eq(practices.uid, uid), isNotNull(practices.tipId)))
      .groupBy(practices.tipId)
    const lastShown = new Map<string, string>()
    for (const row of history) {
      if (row.tipId && row.shownAt) lastShown.set(row.tipId, row.shownAt.toISOString())
    }
    const tipId = drawPracticeTip(practice, lastShown, randomInt).id
    await tx.update(practices).set({ tipId, tipShownAt: new Date() }).where(eq(practices.id, id))
    return { tipId, rating: await latestRating(tx, uid, tipId) }
  })
}

export async function listCollectedTips(uid: string): Promise<CollectedTip[]> {
  const db = getDb()
  const [collected, ratings] = await Promise.all([
    db
      .select({ tipId: practices.tipId, collectedAt: min(practices.tipShownAt) })
      .from(practices)
      .where(and(eq(practices.uid, uid), isNotNull(practices.tipId)))
      .groupBy(practices.tipId)
      .orderBy(desc(min(practices.tipShownAt)), asc(practices.tipId)),
    db
      .selectDistinctOn([practiceTipRatings.tipId], {
        ...ratingColumns,
        tipId: practiceTipRatings.tipId
      })
      .from(practiceTipRatings)
      .where(eq(practiceTipRatings.uid, uid))
      .orderBy(
        practiceTipRatings.tipId,
        desc(practiceTipRatings.ratedAt),
        desc(practiceTipRatings.id)
      )
  ])
  const byTip = new Map(ratings.map((row) => [row.tipId, ratingView(row)]))
  return collected.flatMap(({ tipId, collectedAt }) =>
    tipId && collectedAt && practiceTipById(tipId)
      ? [{ tipId, collectedAt: collectedAt.toISOString(), rating: byTip.get(tipId) ?? null }]
      : []
  )
}

async function requireCollectedTip(db: CreditDb, uid: string, tipId: string) {
  const [collected] = await db
    .select({ id: practices.id })
    .from(practices)
    .where(and(eq(practices.uid, uid), eq(practices.tipId, tipId), isNotNull(practices.tipShownAt)))
    .limit(1)
  if (!collected) throw error(404, 'コレクションにこのTipsが見つかりません。')
}

export async function listTipRatings(uid: string, tipId: string) {
  const db = getDb()
  await requireCollectedTip(db, uid, tipId)
  const rows = await db
    .select(ratingColumns)
    .from(practiceTipRatings)
    .where(and(eq(practiceTipRatings.uid, uid), eq(practiceTipRatings.tipId, tipId)))
    .orderBy(desc(practiceTipRatings.ratedAt), desc(practiceTipRatings.id))
  return rows.map(ratingView)
}

export function requireRatingRevision(rating: TipRating | null, revision: number | null) {
  if ((rating?.id ?? null) !== revision)
    throw error(409, '別の画面で自己評価が更新されました。最新の評価を確認してください。')
}

export async function saveTipRating(
  uid: string,
  tipId: string,
  value: TipSelfRating,
  revision: number | null
) {
  return getDb().transaction(async (tx) => {
    await lockUser(tx, uid)
    await requireCollectedTip(tx, uid, tipId)
    const latest = await latestRating(tx, uid, tipId)
    if (latest?.value === value) return latest
    requireRatingRevision(latest, revision)
    const [saved] = await tx
      .insert(practiceTipRatings)
      .values({ uid, tipId, value })
      .returning(ratingColumns)
    return ratingView(saved)
  })
}

export async function importGuestTip(uid: string, id: string, tip: GuestTip) {
  await getDb().transaction(async (tx) => {
    await lockUser(tx, uid)
    const [imported] = await tx
      .update(practices)
      .set({ tipId: tip.tipId, tipShownAt: new Date(tip.shownAt) })
      .where(and(eq(practices.id, id), eq(practices.uid, uid), isNull(practices.tipId)))
      .returning({ id: practices.id })
    if (imported && tip.rating)
      await tx.insert(practiceTipRatings).values({
        uid,
        tipId: tip.tipId,
        value: tip.rating.value,
        ratedAt: new Date(tip.rating.ratedAt)
      })
  })
}
