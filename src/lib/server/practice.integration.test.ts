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
  it('カスタム場面の別れ際に新しい質問を足さず、原文と定型句で言い換える', () => {
    const text = 'では土曜の午後2時に駅の改札前で会いましょう。ゆうさん、また来週。'
    const output = parsePracticeOutput(
      {
        reply: 'また来週。',
        feedback: {
          ...feedback,
          quote: text,
          custom_tip: 'closing',
          rewrite: '来週はフレンチを食べましょう。'
        }
      },
      [text],
      true,
      'custom'
    )
    expect(output.feedback?.rewrite).toBe(`今日はお話しできてうれしかったです。${text}`)
    expect(output.feedback?.rewrite).not.toMatch(/[?？]|フレンチ/)
    expect(
      parsePracticeOutput(
        { reply: 'また来週。', feedback: { ...feedback, quote: text } },
        [text],
        true,
        'custom'
      ).feedback?.rewrite
    ).toBe(output.feedback?.rewrite)
  })
  it('未発言の好みや仮名を採用せず、本人の原文から言い換えを作る', () => {
    const output = {
      reply: 'ありがとうございます。',
      feedback: { ...feedback, rewrite: 'ミステリーが好きです。○○さんはどんな映画がお好きですか？' }
    }
    expect(parsePracticeOutput(output, ['映画が好きです'], true).feedback?.rewrite).toBe(
      '映画が好きです。普段はどんなふうに過ごすのがお好きですか？'
    )
    expect(
      parsePracticeOutput(output, ['映画が好きです。○○さんに聞いてみたいです。'], true).feedback
        ?.rewrite
    ).toContain('映画が好きです。○○さんに聞いてみたいです。')
  })
  it('既に質問している発言には質問を追加せず、本人の説明も残す', () => {
    const text = '最近は小説を読んでいます。どんな本を読みますか？'
    const output = parsePracticeOutput(
      {
        reply: 'ありがとうございます。',
        feedback: { ...feedback, quote: 'どんな本を読みますか？' }
      },
      [text],
      true
    )
    expect(output.feedback?.quote).toBe(text)
    expect(output.feedback?.rewrite).toBe(
      '最近は小説を読んでいます。よかったら、どんな本を読みますか？'
    )
  })
  it('最終回では実際の発言の引用と具体的な言い換えを必須にする', () => {
    expect(
      parsePracticeOutput(
        JSON.stringify({ reply: 'ありがとうございます。', feedback }),
        ['映画が好きです'],
        true
      ).feedback
    ).toMatchObject({ strength: feedback.strength, quote: '映画が好きです' })
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
