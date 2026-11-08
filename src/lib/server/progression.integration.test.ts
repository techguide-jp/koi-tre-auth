import type { CreditDb } from './db/repositories/credits'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { readProgression, settleProgression } from './db/repositories/progression'
import { createPractice, getPractice } from './db/repositories/practices'
import { reassessPractice } from './practice-assessment-service'
import { assessPractice } from './jev-practice'
import { assessedFeedback, progressionAssessment } from './fixtures/progression-assessment'
import { earnedSpecialCard } from '$lib/special-card-art'
import type { Adventure, CharacterId } from '$lib/adventure'
import { getAdventureProgress } from './db/repositories/adventures'
import { POST as startPractice } from '../../routes/api/me/practices/+server'

let client: PGlite,
  db: ReturnType<typeof drizzle<typeof schema>>,
  migrations: string[],
  sequence = 0
const uid = 'progression-fixture',
  other = 'progression-other'
vi.mock('./db/client', () => ({ getDb: () => db }))
vi.mock('./jev-practice', () => ({ assessPractice: vi.fn() }))
vi.mock('./request-auth', () => ({ requireFirebaseUser: async () => ({ uid }) }))
vi.mock('./practice-config', () => ({
  practiceEnabled: () => true,
  practiceConfigured: () => true
}))
beforeAll(async () => {
  const dir = new URL('../../../drizzle/', import.meta.url)
  migrations = await Promise.all(
    (await readdir(dir))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFile(new URL(f, dir), 'utf8'))
  )
})
beforeEach(async () => {
  vi.clearAllMocks()
  sequence = 0
  client = new PGlite()
  db = drizzle(client, { schema })
  for (const migration of migrations)
    for (const statement of migration.split('--> statement-breakpoint'))
      if (statement.trim()) await client.exec(statement)
  await db.insert(schema.users).values([{ firebaseUid: uid }, { firebaseUid: other }])
  vi.mocked(assessPractice).mockResolvedValue(progressionAssessment())
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await client.close()
})
async function completed(
  episodeId: string,
  total = 20,
  consideration = 4,
  turns: 3 | 6 = 3,
  characterId: CharacterId = 'aoi',
  owner = uid
) {
  const id = randomUUID(),
    date = new Date(Date.now() - 100_000 + sequence++ * 1000)
  await db.insert(schema.practices).values({
    id,
    uid: owner,
    sceneId: 'adventure',
    adventure: { version: 1, characterId, episodeId, turns },
    completedAt: date,
    chargedAt: date,
    reward: { version: 1, xp: turns === 6 ? 50 : 20, mission: null }
  })
  await db.insert(schema.practiceTurns).values(
    Array.from({ length: turns }, (_, i) => ({
      id: randomUUID(),
      practiceId: id,
      requestId: randomUUID(),
      position: i + 1,
      userText: '私は今日は少し休みたいです。',
      assistantText: '希望を話してくれて、ありがとう。',
      feedback:
        i + 1 === turns
          ? assessedFeedback('私は今日は少し休みたいです。', total, consideration)
          : null
    }))
  )
  return id
}
async function settle(owner = uid) {
  await db.transaction(async (tx) => {
    await tx.select().from(schema.users).where(eq(schema.users.firebaseUid, owner)).for('update')
    await settleProgression(tx as unknown as CreditDb, owner)
  })
  return readProgression(db as unknown as CreditDb, owner)
}
const selection = (episodeId: string): Adventure => ({
  version: 1,
  characterId: 'aoi',
  episodeId,
  turns: 3
})

describe('クリアと好感度の永続化・権限', () => {
  it('未解放話への直接POSTを拒否し、採点・利用枠・会話を作らない', async () => {
    const before = await db.select().from(schema.practices)
    const request = new Request('https://example.test/api/me/practices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: randomUUID(),
        sceneId: 'adventure',
        adventure: selection('aoi-12')
      })
    })
    await expect(
      startPractice({ request } as Parameters<typeof startPractice>[0])
    ).rejects.toMatchObject({ status: 403 })
    expect(await db.select().from(schema.practices)).toEqual(before)
    expect(await db.select().from(schema.creditSpends)).toHaveLength(0)
    expect(assessPractice).not.toHaveBeenCalled()
  })
  it('点数・好感度を満たしても第4話以降の購入権が必要で、APIに全条件を返す', async () => {
    for (let chapter = 1; chapter <= 3; chapter++) await completed(`aoi-${chapter}`, 20, 4)
    await settle()
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-4'))).toBe(
      'purchase'
    )
    const view = await getAdventureProgress(uid)
    expect(view.stages?.find((s) => s.episodeId === 'aoi-4')).toMatchObject({
      cleared: false,
      requiredScore: 14,
      requiredConsideration: 2,
      requiredAffinity: 15,
      affinity: 30,
      affinityGap: 0,
      lockedReasons: ['purchase']
    })
  })
  it('会話完了だけでは先へ進めず、合格後に次の話が開く', async () => {
    const failed = await completed('aoi-1', 9, 3, 6)
    let progress = await settle()
    expect(progress.clearedEpisodes).toEqual([])
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-2'))).toBe(
      'locked'
    )
    expect((await getPractice(uid, failed))?.evaluation?.status).toBe('failed')
    expect(earnedSpecialCard((await getPractice(uid, failed))!)).toBeDefined()
    await completed('aoi-1', 12, 3)
    progress = await settle()
    expect(progress.clearedEpisodes).toContain('aoi:aoi-1')
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-2'))).toBe(
      true
    )
  })
  it('再集計・再送・並行精算で貢献を二重計上しない', async () => {
    const id = await completed('aoi-1', 20, 4)
    await Promise.all([settle(), settle()])
    expect((await settle()).relationships[0]).toMatchObject({ earned: 10, affinity: 10 })
    expect(await db.select().from(schema.practiceEvaluations)).toHaveLength(1)
    const before = (await getPractice(uid, id))?.evaluation
    await completed('aoi-1', 20, 4, 6)
    expect((await settle()).relationships[0].affinity).toBe(12)
    expect((await getPractice(uid, id))?.evaluation).toEqual(before)
  })
  it('人物・本人ごとの好感度を独立させる', async () => {
    await completed('aoi-1')
    await completed('yu-1', 20, 4, 3, 'yu')
    await completed('aoi-1', 20, 4, 3, 'aoi', other)
    const progress = await settle()
    expect(progress.relationships.find((r) => r.characterId === 'aoi')?.affinity).toBe(10)
    expect(progress.relationships.find((r) => r.characterId === 'yu')?.affinity).toBe(10)
    expect(progress.relationships.find((r) => r.characterId === 'rin')?.affinity).toBe(0)
    expect(
      (await readProgression(db as unknown as CreditDb, other)).relationships[0].affinity
    ).toBe(0)
  })
  it('好感度が下がっても新基準のクリアは保持し、次の開始は止める', async () => {
    await completed('aoi-1')
    await completed('aoi-2')
    await settle()
    const common = 'shared-respect'
    await completed(common, 12, 1)
    await completed(common, 12, 1)
    const progress = await settle()
    expect(progress.clearedEpisodes).toEqual(['aoi:aoi-1', 'aoi:aoi-2'])
    expect(progress.relationships[0].affinity).toBe(4)
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-3'))).toBe(
      'affinity'
    )
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-1'))).toBe(
      true
    )
    await completed(common, 12, 3)
    expect((await settle()).relationships[0].affinity).toBeGreaterThanOrEqual(8)
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-3'))).toBe(
      true
    )
  })
  it('既存履歴を一括再集計しても、合格後の低下で過去のクリアを取り消さない', async () => {
    await completed('aoi-1')
    await completed('aoi-2')
    for (let i = 0; i < 3; i++) await completed('shared-respect', 12, 1)
    const view = await settle()
    expect(view.relationships[0].affinity).toBe(0)
    expect(view.clearedEpisodes).toEqual(['aoi:aoi-1', 'aoi:aoi-2'])
    expect(await createPractice(uid, randomUUID(), 'adventure', null, selection('aoi-3'))).toBe(
      'affinity'
    )
  })
  it('旧評価を保留にし、再評価しても会話・XP・利用枠を変えない', async () => {
    const id = await completed('aoi-1', 20, 4, 6)
    const last = await db.query.practiceTurns.findFirst({
      where: eq(schema.practiceTurns.practiceId, id)
    })
    const feedback = assessedFeedback('私は今日は少し休みたいです。')
    feedback.analysis!.assessment!.rubric!.version = 2
    await db
      .update(schema.practiceTurns)
      .set({ feedback })
      .where(eq(schema.practiceTurns.practiceId, id))
    await settle()
    expect((await getPractice(uid, id))?.evaluation).toMatchObject({
      status: 'pending',
      score: null
    })
    const before = await getPractice(uid, id)
    await expect(reassessPractice(other, id)).rejects.toMatchObject({ status: 404 })
    const result = await reassessPractice(uid, id)
    expect(result.session?.evaluation?.status).toBe('passed')
    expect(result.session?.reward).toEqual(before?.reward)
    expect(result.session?.turns).toEqual(before?.turns)
    expect(result.session?.chargedAt).toEqual(before?.chargedAt)
    expect(await db.select().from(schema.creditSpends)).toHaveLength(0)
    await reassessPractice(uid, id)
    expect(assessPractice).toHaveBeenCalledTimes(1)
    expect(last).toBeDefined()
  })
  it('Jev障害は失敗や減点にせず、短い再評価の間隔を設ける', async () => {
    const id = await completed('aoi-1')
    await db
      .update(schema.practiceTurns)
      .set({ feedback: null })
      .where(eq(schema.practiceTurns.practiceId, id))
    await settle()
    vi.mocked(assessPractice).mockResolvedValue(null)
    await expect(reassessPractice(uid, id)).rejects.toMatchObject({ status: 502 })
    expect((await getPractice(uid, id))?.evaluation).toMatchObject({
      status: 'pending',
      score: null,
      pending: false
    })
    expect((await readProgression(db as unknown as CreditDb, uid)).relationships[0].affinity).toBe(
      0
    )
    await expect(reassessPractice(uid, id)).rejects.toMatchObject({ status: 429 })
  })
  it('並行再評価はJevを一度だけ呼び、二重加点しない', async () => {
    const id = await completed('aoi-1')
    await db
      .update(schema.practiceTurns)
      .set({ feedback: null })
      .where(eq(schema.practiceTurns.practiceId, id))
    let release!: (value: ReturnType<typeof progressionAssessment>) => void
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.mocked(assessPractice).mockImplementationOnce(async () => {
      started()
      return new Promise((resolve) => {
        release = resolve
      })
    })
    const first = reassessPractice(uid, id)
    await ready
    expect((await reassessPractice(uid, id)).pending).toBe(true)
    release(progressionAssessment())
    await first
    expect(assessPractice).toHaveBeenCalledTimes(1)
    expect((await readProgression(db as unknown as CreditDb, uid)).relationships[0].earned).toBe(10)
  })
  it('期限切れの再評価結果は、新しい予約による結果を上書きしない', async () => {
    const id = await completed('aoi-1')
    await db
      .update(schema.practiceTurns)
      .set({ feedback: null })
      .where(eq(schema.practiceTurns.practiceId, id))
    let release!: (value: ReturnType<typeof progressionAssessment>) => void
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.mocked(assessPractice).mockImplementationOnce(async () => {
      started()
      return new Promise((resolve) => {
        release = resolve
      })
    })
    const first = reassessPractice(uid, id)
    await ready
    await db
      .update(schema.practiceEvaluations)
      .set({ pendingUntil: new Date(0), retryAfter: new Date(0) })
      .where(eq(schema.practiceEvaluations.practiceId, id))
    vi.mocked(assessPractice).mockResolvedValueOnce(progressionAssessment(9, 3))
    await reassessPractice(uid, id)
    release(progressionAssessment(25, 5))
    await first
    expect((await getPractice(uid, id))?.evaluation).toMatchObject({
      status: 'failed',
      score: 9,
      pending: false
    })
    expect((await readProgression(db as unknown as CreditDb, uid)).relationships[0].earned).toBe(0)
  })
  it('部分評価の再評価でも0点・不合格・好感度の増減にせず、保存済みの記録を保つ', async () => {
    const id = await completed('aoi-12', 20, 4, 6)
    await db
      .update(schema.practices)
      .set({
        storyEnding: {
          kind: 'slow',
          reason: '時間をかけたい',
          evidence: [{ turn: 1, quote: '私は今日は少し休みたいです。' }]
        }
      })
      .where(eq(schema.practices.id, id))
    await db
      .update(schema.practiceTurns)
      .set({ feedback: null })
      .where(eq(schema.practiceTurns.practiceId, id))
    const partial = progressionAssessment()
    partial.aspects[0].observable = 0.1
    vi.mocked(assessPractice).mockResolvedValue(partial)
    await reassessPractice(uid, id)
    const session = await getPractice(uid, id)
    expect(session?.evaluation).toMatchObject({ status: 'pending', score: null })
    expect(session?.storyEnding?.kind).toBe('slow')
    expect(earnedSpecialCard(session!)).toBeDefined()
    expect((await readProgression(db as unknown as CreditDb, uid)).clearedEpisodes).toEqual([])
    expect((await readProgression(db as unknown as CreditDb, uid)).relationships[0].affinity).toBe(
      0
    )
  })
})
