import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { createPractice, getPractice, getPracticeOverview } from './db/repositories/practices'
import {
  getAdventureProgress,
  saveFavoriteTurn,
  reserveRehearsal,
  finishRehearsal
} from './db/repositories/adventures'
import { submitPracticeMessage, submitRehearsal } from './practice-service'
import { generatePracticeReply } from './dify-practice'
import type { Adventure } from '$lib/adventure'
let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>
let migrations: string[]
const uid = 'adventure-test-user'
const adventure: Adventure = { version: 1, characterId: 'aoi', episodeId: 'aoi-1', turns: 6 }
vi.mock('./db/client', () => ({ getDb: () => db }))
vi.mock('./analytics', () => ({
  trackPracticeCompleted: vi.fn().mockResolvedValue('sent'),
  trackQuestionSubmitted: vi.fn().mockResolvedValue('sent')
}))
vi.mock('./dify-practice', () => ({ generatePracticeReply: vi.fn() }))
vi.mock('./firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token !== 'valid-test-token') throw Error('invalid')
      return { uid }
    }
  })
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
  client = new PGlite()
  db = drizzle(client, { schema })
  for (const migration of migrations)
    for (const sql of migration.split('--> statement-breakpoint'))
      if (sql.trim()) await client.exec(sql)
  await db.insert(schema.users).values({ firebaseUid: uid })
  vi.mocked(generatePracticeReply).mockImplementation(async (input) => ({
    reply: 'ゆっくり話しましょう。',
    feedback:
      input.turns.length + 1 === (input.adventure?.turns ?? 3)
        ? {
            strength: '気持ちを伝えた',
            improvement: 'この自然さを次も',
            quote: input.text,
            rewrite: input.text
          }
        : null,
    presentation: { emotion: 'smile', gesture: '手を開いて話す。' },
    mission: { id: 'feeling', evidence: [{ turn: 1, quote: '少し緊張しています。' }] }
  }))
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await client.close()
})
async function create(input = adventure) {
  const id = randomUUID()
  expect(await createPractice(uid, id, 'adventure', null, input)).toBe(true)
  return id
}
const message = (id: string, expectedTurn: number) => ({
  uid,
  id,
  expectedTurn,
  text: expectedTurn === 0 ? '少し緊張しています。' : '一緒に話せてうれしいです。',
  requestId: randomUUID()
})
async function complete(input = adventure) {
  const id = await create(input)
  let last
  for (let i = 0; i < input.turns; i++) {
    last = message(id, i)
    await submitPracticeMessage(last, null)
  }
  return { id, last: last! }
}
describe('物語の進行・報酬・再送', () => {
  it('6回目で完了・30XPを確定し、再送と再読込でも報酬・利用枠を増やさない', async () => {
    const id = await create()
    for (let i = 0; i < 5; i++) await submitPracticeMessage(message(id, i), null)
    expect((await getPractice(uid, id))?.completedAt).toBeNull()
    expect((await getAdventureProgress(uid)).xp).toBe(0)
    const last = message(id, 5)
    await submitPracticeMessage(last, null)
    await submitPracticeMessage(last, null)
    expect(generatePracticeReply).toHaveBeenCalledTimes(6)
    expect((await getPractice(uid, id))?.reward).toMatchObject({
      xp: 30,
      mission: { id: 'feeling' }
    })
    const progress = await getAdventureProgress(uid)
    expect(progress).toMatchObject({ xp: 30, completed: 1, completedEpisodes: ['aoi:aoi-1'] })
    expect(progress.memories).toHaveLength(1)
    expect(progress.badges.find((b) => b.id === 'first')?.earned).toBe(true)
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
    expect((await getPractice(uid, id))?.turns[0].presentation?.emotion).toBe('smile')
  })
  it('3往復モードと不正なミッション根拠では通常の完了20XPを保存する', async () => {
    vi.mocked(generatePracticeReply).mockImplementation(async (input) => ({
      reply: 'ありがとうございます。',
      feedback:
        input.turns.length === 2
          ? {
              strength: '感想を伝えた',
              improvement: '次も自然に',
              quote: input.text,
              rewrite: input.text
            }
          : null,
      mission: { id: 'feeling', evidence: [{ turn: 1, quote: '本人が言っていない気持ち' }] }
    }))
    const { id } = await complete({ ...adventure, turns: 3 })
    expect((await getPractice(uid, id))?.turns).toHaveLength(3)
    expect((await getPractice(uid, id))?.reward).toEqual({ version: 1, xp: 20, mission: null })
  })
  it('解放前の話はサーバーでも拒否し、前の話を終えると作成できる', async () => {
    expect(
      await createPractice(uid, randomUUID(), 'adventure', null, {
        ...adventure,
        episodeId: 'aoi-2'
      })
    ).toBe('locked')
    await complete({ ...adventure, turns: 3 })
    expect(
      await createPractice(uid, randomUUID(), 'adventure', null, {
        ...adventure,
        episodeId: 'aoi-2'
      })
    ).toBe(true)
  })
  it('同じ作成IDの人物・往復数・場面変更を拒否する', async () => {
    const id = await create()
    expect(await createPractice(uid, id, 'adventure', null, adventure)).toBe(true)
    expect(await createPractice(uid, id, 'adventure', null, { ...adventure, turns: 3 })).toBe(false)
    expect(
      await createPractice(uid, id, 'adventure', null, {
        ...adventure,
        characterId: 'yu',
        episodeId: 'yu-1'
      })
    ).toBe(false)
  })
  it('お気に入りは本人の実際の返答だけ保存し、解除できる', async () => {
    const { id } = await complete({ ...adventure, turns: 3 })
    expect(await saveFavoriteTurn(uid, id, 7)).toBe(false)
    expect(await saveFavoriteTurn('other', id, 1)).toBe(false)
    expect(await saveFavoriteTurn(uid, id, 1)).toBe(true)
    expect((await getAdventureProgress(uid)).favorites[0]).toMatchObject({
      practiceId: id,
      text: '少し緊張しています。',
      position: 1
    })
    expect(await saveFavoriteTurn(uid, id, null)).toBe(true)
    expect((await getAdventureProgress(uid)).favorites).toEqual([])
  })
  it('言い直しは成功1回、再送は同じ結果で、会話・XP・利用枠を保つ', async () => {
    const { id } = await complete({ ...adventure, turns: 3 })
    const input = {
      ...message(id, 0),
      position: 1,
      text: '少し緊張していますが、会えてうれしいです。'
    }
    await submitRehearsal(input)
    await submitRehearsal(input)
    expect(generatePracticeReply).toHaveBeenCalledTimes(4)
    expect(generatePracticeReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ rehearsal: true, turns: [] })
    )
    const session = await getPractice(uid, id)
    expect(session?.turns).toHaveLength(3)
    expect(session?.rehearsal).toMatchObject({
      position: 1,
      text: input.text,
      reply: 'ゆっくり話しましょう。'
    })
    expect((await getAdventureProgress(uid)).xp).toBe(30)
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
    await expect(submitRehearsal({ ...input, requestId: randomUUID() })).rejects.toMatchObject({
      status: 409
    })
  })
  it('言い直しの競合を予約し、期限切れの古い保存を拒否する', async () => {
    const { id } = await complete({ ...adventure, turns: 3 })
    const input = { ...message(id, 0), position: 1 }
    const old = await reserveRehearsal(input, new Date('2026-11-08T00:00:00Z'))
    expect(old.status).toBe('ready')
    expect((await reserveRehearsal(input, new Date('2026-11-08T00:00:01Z'))).status).toBe('pending')
    const next = await reserveRehearsal(input, new Date('2026-11-08T00:02:00Z'))
    if (old.status !== 'ready' || next.status !== 'ready') throw Error('reservation')
    expect(await finishRehearsal(input, old.token!, { reply: '古い返答' })).toBe(false)
    expect(await finishRehearsal(input, next.token!, { reply: '新しい返答' })).toBe(true)
  })
  it('進行・保存・言い直しのAPIは認証を必須にする', async () => {
    const progress = await import('../../routes/api/me/adventure/+server')
    const favorite = await import('../../routes/api/me/practices/[id]/favorite/+server')
    const rehearsal = await import('../../routes/api/me/practices/[id]/rehearsal/+server')
    const event = {
      request: new Request('https://example.test/api', { method: 'POST', body: '{}' }),
      params: { id: randomUUID() }
    }
    await expect(progress.GET(event as never)).rejects.toMatchObject({ status: 401 })
    await expect(favorite.POST(event as never)).rejects.toMatchObject({ status: 401 })
    await expect(rehearsal.POST(event as never)).rejects.toMatchObject({ status: 401 })
  })
  it('100XPの境界と3話読了・ミッションのバッジを履歴から復元する', async () => {
    await db.insert(schema.practices).values(
      ['aoi-1', 'aoi-2', 'aoi-3', 'yu-1'].map((episodeId) => ({
        id: randomUUID(),
        uid,
        sceneId: 'adventure' as const,
        adventure: {
          ...adventure,
          characterId: episodeId.startsWith('yu') ? ('yu' as const) : ('aoi' as const),
          episodeId,
          turns: 3 as const
        },
        completedAt: new Date(),
        chargedAt: new Date(),
        reward: {
          version: 1 as const,
          xp: 30 as const,
          mission: { id: 'feeling', evidence: [{ turn: 1, quote: 'うれしいです。' }] }
        }
      }))
    )
    const progress = await getAdventureProgress(uid)
    expect(progress).toMatchObject({ xp: 120, level: 2, xpInLevel: 20, completed: 4 })
    expect(progress.badges.filter((b) => b.earned).map((b) => b.id)).toEqual([
      'first',
      'mission',
      'story'
    ])
    expect((await getAdventureProgress('other-user')).xp).toBe(0)
  })
  it('言い直しに失敗しても元の会話とXPを保ち、同じ内容で再試行できる', async () => {
    const { id } = await complete({ ...adventure, turns: 3 })
    const input = { ...message(id, 0), position: 1, text: '会えてうれしいです。' }
    vi.mocked(generatePracticeReply).mockRejectedValueOnce(Error('unavailable'))
    await expect(submitRehearsal(input)).rejects.toMatchObject({ status: 502 })
    expect((await getPractice(uid, id))?.pending?.until).toBeNull()
    expect((await getAdventureProgress(uid)).xp).toBe(30)
    await submitRehearsal(input)
    expect((await getPractice(uid, id))?.rehearsal?.reply).toBeDefined()
    expect((await getPractice(uid, id))?.turns).toHaveLength(3)
  })
})
