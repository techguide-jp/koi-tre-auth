import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import {
  createPractice,
  finishPracticeTurn,
  getPractice,
  getPracticeOverview,
  releasePracticeTurn,
  reservePracticeTurn
} from './db/repositories/practices'
import { submitPracticeMessage } from './practice-service'
import { generatePracticeReply, parsePracticeOutput } from './dify-practice'
import { trackPracticeCompleted, trackQuestionSubmitted } from './analytics'
import { sceneWithPartner } from '$lib/practice'
import { exampleFeedback, exampleTexts } from './fixtures/practice-analysis'
import {
  listCollectedTips,
  listTipRatings,
  offerPracticeTip,
  saveTipRating
} from './db/repositories/practice-tips'
import { practiceTipById } from '$lib/practice-tips'
import { GET as tipCollectionApi } from '../../routes/api/me/tips/+server'
import { PATCH as rateTipApi } from '../../routes/api/me/tips/[tipId]/+server'

let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>
let migrations: string[]
const uid = 'practice-test-user'
const now = new Date('2026-11-01T03:00:00Z')
const feedback = {
  strength: '自分の過ごし方を伝えられています。',
  improvement: '相手にも聞いてみましょう。',
  quote: '映画が好きです',
  rewrite: '映画が好きです。お好きな映画はありますか？'
}
vi.mock('./db/client', () => ({ getDb: () => db }))
vi.mock('./firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token !== 'valid-test-token') throw new Error('invalid')
      return { uid }
    }
  })
}))
vi.mock('./analytics', () => ({
  trackPracticeCompleted: vi.fn().mockResolvedValue('sent'),
  trackQuestionSubmitted: vi.fn().mockResolvedValue('sent')
}))
vi.mock('./dify-practice', async (original) => ({
  ...(await original<typeof import('./dify-practice')>()),
  generatePracticeReply: vi.fn()
}))

beforeAll(async () => {
  const dir = new URL('../../../drizzle/', import.meta.url)
  migrations = await Promise.all(
    (await readdir(dir))
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => readFile(new URL(file, dir), 'utf8'))
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
    reply: 'なるほど、最近観た映画はありますか？',
    feedback: input.turns.length === 2 ? feedback : null
  }))
})
afterEach(async () => {
  vi.useRealTimers()
  await client.close()
})

async function session() {
  const id = randomUUID()
  await createPractice(uid, id, 'cafe')
  return id
}
function message(id: string, expectedTurn = 0, text = '映画が好きです') {
  return { uid, id, requestId: randomUUID(), text, expectedTurn }
}

async function addTipTestTurns(id: string, count: number) {
  const turns = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    practiceId: id,
    requestId: randomUUID(),
    position: index + 1,
    userText: '架空の会話',
    assistantText: 'そうなんですね。'
  }))
  await db.insert(schema.practiceTurns).values(turns)
  return turns.at(-1)!.requestId
}

describe('Tipsコレクション', () => {
  it('最終返答の時だけ抽選でき、同時抽選・再送でも既出や同じ練習を二重に数えない', async () => {
    const first = await session()
    const second = await session()
    const requestId = randomUUID()
    await expect(offerPracticeTip(uid, first, requestId)).rejects.toMatchObject({ status: 409 })
    await Promise.all([addTipTestTurns(first, 2), addTipTestTurns(second, 2)])
    const [a, replay, b] = await Promise.all([
      offerPracticeTip(uid, first, requestId),
      offerPracticeTip(uid, first, randomUUID()),
      offerPracticeTip(uid, second, randomUUID())
    ])
    expect(replay.tipId).toBe(a.tipId)
    expect(b.tipId).not.toBe(a.tipId)
    expect(practiceTipById(a.tipId)?.group).toBe('first_meeting')
    expect(await listCollectedTips(uid)).toHaveLength(2)
    await expect(offerPracticeTip('other', first, requestId)).rejects.toMatchObject({ status: 404 })
    expect(await listCollectedTips('other')).toEqual([])
  })

  it('最終返答が先に保存された場合も、送信が一致するときだけ新しく抽選できる', async () => {
    const id = await session()
    const finalRequest = await addTipTestTurns(id, 3)
    await expect(offerPracticeTip(uid, id, randomUUID())).rejects.toMatchObject({ status: 409 })
    expect(await offerPracticeTip(uid, id, finalRequest)).toMatchObject({ rating: null })
  })

  it('現在の自己評価と推移を分け、再送・古い更新・別ユーザーの更新を区別する', async () => {
    const id = await session()
    await addTipTestTurns(id, 2)
    const { tipId } = await offerPracticeTip(uid, id, randomUUID())
    const initial = await saveTipRating(uid, tipId, 'difficult', null)
    expect(await saveTipRating(uid, tipId, 'difficult', null)).toEqual(initial)
    const improved = await saveTipRating(uid, tipId, 'intentional', initial.id)
    await expect(saveTipRating(uid, tipId, 'comfortable', initial.id)).rejects.toMatchObject({
      status: 409
    })
    await expect(saveTipRating('other', tipId, 'comfortable', null)).rejects.toMatchObject({
      status: 404
    })
    expect(await listTipRatings(uid, tipId)).toEqual([improved, initial])
    expect(await listCollectedTips(uid)).toMatchObject([{ tipId, rating: improved }])
  })

  it('APIが認証と3択を検証し、非公開の応答を返す', async () => {
    const url = 'https://koitre.example/api/me/tips'
    const unauthenticated = { request: new Request(url) } as Parameters<typeof tipCollectionApi>[0]
    await expect(tipCollectionApi(unauthenticated)).rejects.toMatchObject({ status: 401 })
    const headers = { Authorization: 'Bearer valid-test-token' }
    const request = new Request(url, { headers })
    const collection = await tipCollectionApi({ request } as Parameters<typeof tipCollectionApi>[0])
    expect(collection.headers.get('cache-control')).toBe('no-store')
    expect(await collection.json()).toEqual([])
    const invalid = new Request(url + '/T001', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ value: 'not_used', revision: null })
    })
    await expect(
      rateTipApi({ request: invalid, params: { tipId: 'T001' } } as Parameters<
        typeof rateTipApi
      >[0])
    ).rejects.toMatchObject({ status: 400 })
  })
})
async function charged(total: number, at = now) {
  await db.insert(schema.practices).values(
    Array.from({ length: total }, () => ({
      id: randomUUID(),
      uid,
      sceneId: 'cafe' as const,
      chargedAt: at
    }))
  )
}

describe('練習・保存・利用枠', () => {
  it.each(['male', 'female'] as const)(
    '選んだ%sの相手を再開・完了・再練習まで保持する',
    async (preference) => {
      const customScene = sceneWithPartner('cafe', preference)!
      const id = randomUUID()
      expect(await createPractice(uid, id, 'custom', customScene)).toBe(true)
      await submitPracticeMessage(message(id), null)
      const reopened = await getPractice(uid, id)
      expect(reopened).toMatchObject({ sceneId: 'custom', customScene, turns: [{ position: 1 }] })
      expect((await getPracticeOverview(uid)).remaining).toBe(9)
      for (let turn = 1; turn < 3; turn++) await submitPracticeMessage(message(id, turn), null)
      expect(generatePracticeReply).toHaveBeenLastCalledWith(
        expect.objectContaining({ sceneId: 'custom', customScene })
      )
      expect((await getPractice(uid, id))?.completedAt).not.toBeNull()
      const repeat = randomUUID()
      expect(await createPractice(uid, repeat, 'custom', reopened!.customScene)).toBe(true)
      expect((await getPractice(uid, repeat))?.customScene).toEqual(customScene)
      expect((await getPracticeOverview(uid)).remaining).toBe(9)
    }
  )
  it('3回の返答を保存して1練習だけ消費し、再送でもイベントを重複送信しない', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    const id = await session()
    expect((await getPracticeOverview(uid)).remaining).toBe(10)
    let last
    for (let turn = 0; turn < 3; turn++) {
      last = message(id, turn)
      await submitPracticeMessage(last, null)
    }
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
    expect(await getPractice(uid, id)).toMatchObject({
      completedAt: now.toISOString(),
      turns: [{ position: 1 }, { position: 2 }, { position: 3, feedback }]
    })
    await submitPracticeMessage(last!, null)
    expect(generatePracticeReply).toHaveBeenCalledTimes(3)
    expect(trackQuestionSubmitted).toHaveBeenCalledTimes(3)
    expect(trackPracticeCompleted).toHaveBeenCalledTimes(1)
    expect(await db.select().from(schema.operations)).toHaveLength(3)
  })
  it('拡充した分析を最終回のJSONに保存し、再開・再送でも内容を保持する', async () => {
    const id = await session()
    vi.mocked(generatePracticeReply).mockImplementation(async (input) => ({
      reply: '教えてくれてありがとうございます。',
      feedback: input.turns.length === 2 ? exampleFeedback : null
    }))
    let last
    for (let turn = 0; turn < 3; turn++) {
      last = message(id, turn, exampleTexts[turn])
      await submitPracticeMessage(last, null)
    }
    expect((await getPractice(uid, id))?.turns[2].feedback).toEqual(exampleFeedback)
    await submitPracticeMessage(last!, null)
    expect((await getPractice(uid, id))?.turns[2].feedback?.analysis).toEqual(
      exampleFeedback.analysis
    )
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
    expect(generatePracticeReply).toHaveBeenCalledTimes(3)
  })
  it('生成失敗は回数を減らさず、本文を保持して同じIDで再試行できる', async () => {
    const id = await session()
    const input = message(id)
    vi.mocked(generatePracticeReply).mockRejectedValueOnce(new Error('private upstream error'))
    await expect(submitPracticeMessage(input, null)).rejects.toMatchObject({ status: 502 })
    expect((await getPracticeOverview(uid)).remaining).toBe(10)
    expect((await getPractice(uid, id))?.pending).toEqual({
      requestId: input.requestId,
      text: input.text,
      until: null
    })
    await submitPracticeMessage(input, null)
    expect((await getPractice(uid, id))?.turns).toHaveLength(1)
    expect(trackQuestionSubmitted).toHaveBeenCalledTimes(1)
  })
  it('最後の1枠を予約し、別の練習からの開始を拒否する', async () => {
    await charged(9)
    const a = message(await session())
    const b = message(await session())
    expect((await reservePracticeTurn(a, now)).status).toBe('ready')
    expect((await reservePracticeTurn(b, now)).status).toBe('quota')
    expect(await getPracticeOverview(uid, now)).toMatchObject({ remaining: 0, reserved: 1 })
  })
  it('別タブの送信中と古いターン番号を拒否する', async () => {
    const input = message(await session())
    const first = await reservePracticeTurn(input, now)
    expect(first.status).toBe('ready')
    expect((await reservePracticeTurn(message(input.id), now)).status).toBe('pending')
    if (first.status !== 'ready') throw new Error('reservation failed')
    await finishPracticeTurn(input, first.token, { reply: 'こんにちは', feedback: null }, now)
    expect((await reservePracticeTurn(message(input.id), now)).status).toBe('conflict')
    expect((await reservePracticeTurn({ ...input, text: '別の内容' }, now)).status).toBe('conflict')
  })
  it('期限切れの予約を再取得し、古い処理の保存・解除が新しい処理に干渉しない', async () => {
    const input = message(await session())
    const old = await reservePracticeTurn(input, now)
    const fresh = await reservePracticeTurn(input, new Date(now.getTime() + 80_000))
    if (old.status !== 'ready' || fresh.status !== 'ready') throw new Error('reservation failed')
    expect(
      await finishPracticeTurn(input, old.token, { reply: '古い応答', feedback: null }, now)
    ).toBe(false)
    await releasePracticeTurn(input, old.token)
    expect((await getPractice(uid, input.id))?.pending?.until).not.toBeNull()
    expect(
      await finishPracticeTurn(
        input,
        fresh.token,
        { reply: '新しい応答', feedback: null },
        new Date(now.getTime() + 81_000)
      )
    ).toBe(true)
  })
  it('枠を使い切っても、消費済みの途中の練習は続けられる', async () => {
    const input = message(await session())
    const reserved = await reservePracticeTurn(input, now)
    if (reserved.status !== 'ready') throw new Error('reservation failed')
    await finishPracticeTurn(input, reserved.token, { reply: 'こんにちは', feedback: null }, now)
    await charged(9)
    expect((await reservePracticeTurn(message(input.id, 1), now)).status).toBe('ready')
    expect((await reservePracticeTurn(message(await session()), now)).status).toBe('quota')
  })
  it('日本時間の月境界で更新し、先月の途中の練習は再消費しない', async () => {
    const before = new Date('2026-10-31T14:59:59Z')
    const after = new Date('2026-10-31T15:00:00Z')
    await charged(10, before)
    expect((await getPracticeOverview(uid, before)).remaining).toBe(0)
    expect((await getPracticeOverview(uid, after)).remaining).toBe(10)
    const old = (await db.select().from(schema.practices))[0]
    expect((await reservePracticeTurn(message(old.id), after)).status).toBe('ready')
    expect((await getPracticeOverview(uid, after)).remaining).toBe(10)
  })
  it('月をまたいだ最初の生成は、保存成功した月の1回として数える', async () => {
    const input = message(await session())
    const start = new Date('2026-11-30T14:59:59Z')
    const end = new Date('2026-11-30T15:00:01Z')
    const reserved = await reservePracticeTurn(input, start)
    if (reserved.status !== 'ready') throw new Error('reservation failed')
    await finishPracticeTurn(input, reserved.token, { reply: 'こんにちは', feedback: null }, end)
    expect((await getPracticeOverview(uid, start)).remaining).toBe(10)
    expect((await getPracticeOverview(uid, end)).remaining).toBe(9)
  })
  it('他人の練習を読み取り・送信・作成IDの衝突で参照できない', async () => {
    const id = await session()
    await db.insert(schema.users).values({ firebaseUid: 'other-user' })
    expect(await getPractice('other-user', id)).toBeNull()
    expect((await reservePracticeTurn({ ...message(id), uid: 'other-user' })).status).toBe(
      'not_found'
    )
    expect(await createPractice('other-user', id, 'cafe')).toBe(false)
  })
  it('旧操作履歴を新しい月10練習へ換算せず、そのまま保持する', async () => {
    await db
      .insert(schema.operations)
      .values({ uid, conversationId: 'legacy', query: '旧発言', llmText: '旧返答' })
    expect((await getPracticeOverview(uid)).remaining).toBe(10)
    expect(
      await db.select().from(schema.operations).where(eq(schema.operations.uid, uid))
    ).toHaveLength(1)
  })
})

describe('Difyからの振り返り', () => {
  it('生成された改善点と言い換えを定型文で上書きしない', () => {
    const text = '最近は小説を読んでいます。どんな本を読みますか？'
    const generated = {
      ...feedback,
      quote: 'どんな本を読みますか？',
      improvement: '相手が話していた小説の話題を拾って具体的に聞いてみましょう。',
      rewrite: 'さっきの小説は、どんなところが面白かったですか？'
    }
    expect(
      parsePracticeOutput({ reply: 'ありがとうございます。', feedback: generated }, [text], true)
        .feedback
    ).toEqual(generated)
  })
  it('最終回の引用と具体的な言い換えを必須にし、途中の分析は表示しない', () => {
    expect(
      parsePracticeOutput(
        JSON.stringify({ reply: 'ありがとうございます。', feedback }),
        ['映画が好きです'],
        true
      ).feedback
    ).toEqual(feedback)
    expect(() =>
      parsePracticeOutput(
        { reply: 'ありがとうございます。', feedback: { ...feedback, quote: '言っていないこと' } },
        ['映画が好きです'],
        true
      )
    ).toThrow()
    expect(() =>
      parsePracticeOutput({ reply: 'ありがとうございます。' }, ['映画が好きです'], true)
    ).toThrow()
    expect(
      parsePracticeOutput({ reply: 'いいですね。', feedback }, ['映画が好きです'], false).feedback
    ).toBeNull()
  })
})

describe('練習APIの境界', () => {
  function event(request: Request, id = randomUUID()) {
    return { request, params: { id } } as unknown as Parameters<
      typeof import('../../routes/api/me/practices/[id]/messages/+server').POST
    >[0]
  }
  function request(body?: unknown, token?: string) {
    return new Request('https://example.com/api/me/practices', {
      method: 'POST',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'content-type': 'application/json'
      },
      body: JSON.stringify(body ?? {})
    })
  }
  it('カスタム設定を保存・再開し、同じ作成IDの設定変更を拒否する', async () => {
    vi.stubEnv('PRACTICE_ENABLED', 'true')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-only-key')
    try {
      const create = await import('../../routes/api/me/practices/+server')
      const id = randomUUID()
      const customScene = {
        situation: '2回目のデートの帰りに、来週も会う約束をしたい。',
        partnerName: 'ゆう',
        openingLine: '今日は楽しかったですね。'
      }
      const post = (settings: unknown, sceneId = 'custom') =>
        create.POST(
          event(request({ id, sceneId, customScene: settings }, 'valid-test-token')) as never
        )
      expect((await (await post(customScene)).json()).customScene).toEqual(customScene)
      expect(
        (
          await post({
            openingLine: customScene.openingLine,
            situation: customScene.situation,
            partnerName: customScene.partnerName
          })
        ).status
      ).toBe(200)
      await expect(post({ ...customScene, situation: '別の状況' })).rejects.toMatchObject({
        status: 409
      })
      await expect(post(null, 'cafe')).rejects.toMatchObject({ status: 409 })
      expect(await getPractice('other-user', id)).toBeNull()
      for (let turn = 0; turn < 3; turn++) await submitPracticeMessage(message(id, turn), null)
      expect(generatePracticeReply).toHaveBeenLastCalledWith(
        expect.objectContaining({ customScene, sceneId: 'custom' })
      )
      expect(await getPractice(uid, id)).toMatchObject({
        customScene,
        completedAt: expect.any(String),
        turns: [{ position: 1 }, { position: 2 }, { position: 3 }]
      })
      expect((await getPracticeOverview(uid)).remaining).toBe(9)
      const repeat = randomUUID()
      expect(await createPractice(uid, repeat, 'custom', customScene)).toBe(true)
      expect((await getPractice(uid, repeat))?.customScene).toEqual(customScene)
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('カスタム場面の必須情報・上限をAPIでも検証する', async () => {
    vi.stubEnv('PRACTICE_ENABLED', 'true')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-only-key')
    try {
      const create = await import('../../routes/api/me/practices/+server')
      for (const customScene of [null, { situation: '' }, { situation: 'あ'.repeat(501) }])
        await expect(
          create.POST(
            event(
              request({ id: randomUUID(), sceneId: 'custom', customScene }, 'valid-test-token')
            ) as never
          )
        ).rejects.toMatchObject({ status: 400 })
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('未認証で練習の作成・読取・発言送信をできない', async () => {
    const create = await import('../../routes/api/me/practices/+server')
    const read = await import('../../routes/api/me/practices/[id]/+server')
    const send = await import('../../routes/api/me/practices/[id]/messages/+server')
    for (const handler of [create.POST, read.GET, send.POST])
      await expect(handler(event(request()) as never)).rejects.toMatchObject({ status: 401 })
  })
  it('クライアントのUIDを使わず、認証ユーザーの練習を作り、長文・空文字を拒否する', async () => {
    vi.stubEnv('PRACTICE_ENABLED', 'true')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-only-key')
    try {
      const create = await import('../../routes/api/me/practices/+server')
      const send = await import('../../routes/api/me/practices/[id]/messages/+server')
      const id = randomUUID()
      const response = await create.POST(
        event(request({ id, sceneId: 'cafe', uid: 'other-user' }, 'valid-test-token')) as never
      )
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect((await response.json()).id).toBe(id)
      expect(await getPractice('other-user', id)).toBeNull()
      for (const text of ['', ' '.repeat(10), 'a'.repeat(1001)])
        await expect(
          send.POST(
            event(
              request({ text, requestId: randomUUID(), expectedTurn: 0 }, 'valid-test-token'),
              id
            )
          )
        ).rejects.toMatchObject({ status: 400 })
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('切り戻し時は新規送信を止め、保存済み練習の読取を維持する', async () => {
    vi.stubEnv('PRACTICE_ENABLED', 'false')
    try {
      const id = await session()
      const read = await import('../../routes/api/me/practices/[id]/+server')
      const send = await import('../../routes/api/me/practices/[id]/messages/+server')
      expect((await read.GET(event(request({}, 'valid-test-token'), id) as never)).status).toBe(200)
      await expect(send.POST(event(request({}, 'valid-test-token'), id))).rejects.toMatchObject({
        status: 503
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
