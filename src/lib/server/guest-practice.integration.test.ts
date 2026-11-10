import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { characters, type Adventure } from '$lib/adventure'
import { guestAdventure } from '$lib/guest-practice'
import { GUEST_COOKIE, guestRateContext, guestTokenHash, newGuestSession } from './guest-request'
import {
  createGuestPractice,
  finishGuestTurn,
  getGuestPractice,
  releaseGuestTurn,
  reserveGuestTurn
} from './db/repositories/guest-practices'
import { claimGuestPractice, submitGuestMessage } from './guest-practice-service'
import { getPractice, getPracticeOverview } from './db/repositories/practices'
import { getAdventureProgress } from './db/repositories/adventures'
import { submitPracticeMessage } from './practice-service'
import { generatePracticeReply } from './dify-practice'
import { assessedFeedback } from './fixtures/progression-assessment'
import { defaultCharacterContent, characterContentHash } from './character-content'
import { POST as startApi } from '../../routes/api/guest/practices/+server'
import { GET as readApi } from '../../routes/api/guest/practices/[id]/+server'
import { POST as messageApi } from '../../routes/api/guest/practices/[id]/messages/+server'
import { POST as claimApi } from '../../routes/api/guest/practices/[id]/claim/+server'
import { POST as privateStartApi } from '../../routes/api/me/practices/+server'

let client: PGlite, db: ReturnType<typeof drizzle<typeof schema>>, migrations: string[]
const uid = 'guest-claim-fixture',
  otherUid = 'other-claim-fixture'
const now = new Date('2026-11-09T03:00:00Z')
const rate = () => guestRateContext('192.0.2.1')
const adventure = (id: (typeof characters)[number]['id'] = 'aoi'): Adventure => ({
  version: 1,
  characterId: id,
  episodeId: `${id}-1`,
  turns: 3
})
vi.mock('./db/client', () => ({ getDb: () => db }))
vi.mock('./dify-practice', () => ({ generatePracticeReply: vi.fn() }))
vi.mock('./analytics', () => ({ trackPracticeCompleted: vi.fn(), trackQuestionSubmitted: vi.fn() }))
vi.mock('./firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (![uid, otherUid].includes(token)) throw Error('invalid')
      return { uid: token }
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
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  vi.stubEnv('PRACTICE_ENABLED', 'true')
  vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture-key')
  client = new PGlite()
  db = drizzle(client, { schema })
  for (const migration of migrations)
    for (const statement of migration.split('--> statement-breakpoint'))
      if (statement.trim()) await client.exec(statement)
  await db.insert(schema.users).values([{ firebaseUid: uid }, { firebaseUid: otherUid }])
  vi.mocked(generatePracticeReply).mockImplementation(async (input) => ({
    reply: 'その気持ちを聞けて、うれしいです。',
    feedback: input.turns.length === 2 ? assessedFeedback(input.text) : null,
    presentation: { emotion: 'smile', gesture: '小さく手を開く。' },
    mission: null
  }))
})
afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await client.close()
})
async function start(
  person: (typeof characters)[number]['id'] = 'aoi',
  session = newGuestSession()
) {
  const view = await createGuestPractice(session, randomUUID(), adventure(person), rate())
  return { session, id: view.id }
}
function message(guest: Awaited<ReturnType<typeof start>>, expectedTurn = 0) {
  return {
    sessionId: guest.session.id,
    id: guest.id,
    requestId: randomUUID(),
    text: '少し緊張していますが、話せてうれしいです。',
    expectedTurn
  }
}
async function complete(input?: Awaited<ReturnType<typeof start>>) {
  const guest = input ?? (await start())
  for (let i = 0; i < 3; i++) await submitGuestMessage(message(guest, i), rate())
  return guest
}
function event(
  method: string,
  body: unknown = {},
  id: string = randomUUID(),
  token?: string,
  actor?: string
) {
  const cookies = new Map<string, string>(token ? [[GUEST_COOKIE, token]] : [])
  const headers = new Headers({
    origin: 'https://koitre.example',
    'content-type': 'application/json'
  })
  if (actor) headers.set('authorization', `Bearer ${actor}`)
  const url = new URL(`https://koitre.example/api/guest/practices/${id}`)
  return {
    url,
    params: { id },
    request: new Request(url, {
      method,
      headers,
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
    }),
    cookies: {
      get: (name: string) => cookies.get(name),
      set: vi.fn((name: string, value: string) => cookies.set(name, value))
    },
    getClientAddress: () => '192.0.2.1'
  }
}

describe('未ログインの第1話と所有権', () => {
  it.each(characters.map((c) => c.id))(
    '%sの第1話だけを3往復で開始し、人物設定全文は返さない',
    async (person) => {
      const e = event('POST', {
        id: randomUUID(),
        sceneId: 'adventure',
        adventure: adventure(person)
      })
      const response = await startApi(e as never)
      expect(response.headers.get('cache-control')).toBe('no-store')
      const view = await response.json()
      expect(view.adventure).toMatchObject(adventure(person))
      expect(view.characterContext).toBeUndefined()
      expect(view.characterReactions.general).toBeTruthy()
      const cookie = e.cookies.set.mock.calls[0]
      expect(cookie[1]).toMatch(/^[0-9a-f]{64}$/)
      expect(e.cookies.set).toHaveBeenCalledWith(
        GUEST_COOKIE,
        cookie[1],
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
      )
      expect((await db.select().from(schema.guestSessions))[0].id).toBe(guestTokenHash(cookie[1]))
      expect(await db.select().from(schema.users)).toHaveLength(2)
    }
  )
  it.each([
    { ...adventure(), episodeId: 'aoi-2' },
    { ...adventure(), episodeId: 'aoi-12' },
    { ...adventure(), turns: 6 },
    { ...adventure(), episodeId: 'shared-invite' },
    { ...adventure(), revisit: true }
  ])('直接POSTで第1話・3往復の制限を越えられない: %j', async (value) => {
    expect(guestAdventure(value)).toBeNull()
    await expect(
      startApi(event('POST', { id: randomUUID(), sceneId: 'adventure', adventure: value }) as never)
    ).rejects.toMatchObject({ status: 400 })
    expect(generatePracticeReply).not.toHaveBeenCalled()
  })
  it('同じブラウザと人物では同じ会話へ戻り、全6人を独立して体験できる', async () => {
    const session = newGuestSession()
    const ids = []
    for (const person of characters) {
      const first = await start(person.id, session)
      const second = await start(person.id, session)
      expect(first.id).toBe(second.id)
      ids.push(first.id)
    }
    expect(new Set(ids).size).toBe(6)
    expect(await db.select().from(schema.guestPractices)).toHaveLength(6)
    expect(await db.select().from(schema.guestRateLimits)).toHaveLength(2)
  })
  it('Cookieなし・別Cookieでは会話を読めず、元の認証必須APIも公開しない', async () => {
    const guest = await start()
    await expect(readApi(event('GET', {}, guest.id) as never)).rejects.toMatchObject({
      status: 401
    })
    const other = await start('rin')
    await expect(
      readApi(event('GET', {}, guest.id, other.session.token) as never)
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      privateStartApi(event('POST', { id: randomUUID(), sceneId: 'cafe' }) as never)
    ).rejects.toMatchObject({ status: 401 })
    await expect(
      claimApi(event('POST', {}, guest.id, guest.session.token) as never)
    ).rejects.toMatchObject({ status: 401 })
  })
  it('異なるOrigin、無効な送信位置、1000文字超過を拒否する', async () => {
    const e = event('POST', { id: randomUUID(), sceneId: 'adventure', adventure: adventure() })
    e.request.headers.set('origin', 'https://other.example')
    await expect(startApi(e as never)).rejects.toMatchObject({ status: 403 })
    const guest = await start()
    for (const changes of [
      { expectedTurn: 3 },
      { expectedTurn: -1 },
      { text: 'あ'.repeat(1001) }
    ]) {
      const e = event('POST', { ...message(guest), ...changes }, guest.id, guest.session.token)
      await expect(messageApi(e as never)).rejects.toMatchObject({ status: 400 })
    }
    expect(generatePracticeReply).not.toHaveBeenCalled()
  })
})
describe('生成・再開・上限', () => {
  it('3往復と25点評価を保存するが、アカウントの枠・好感度・会話は増やさない', async () => {
    const guest = await complete()
    const view = await getGuestPractice(guest.session.id, guest.id)
    expect(view.turns).toHaveLength(3)
    expect(view.completedAt).toBeTruthy()
    expect(view.evaluation).toMatchObject({ status: 'passed', requiredScore: 10 })
    expect(view.reward?.xp).toBe(20)
    expect(await db.select().from(schema.practices)).toHaveLength(0)
    expect(await db.select().from(schema.characterRelationships)).toHaveLength(0)
    expect((await getPracticeOverview(uid)).remaining).toBe(10)
  })
  it('再送は再生成せず、違う本文の流用と完了後の新しい送信は拒否する', async () => {
    const guest = await start(),
      input = message(guest)
    await submitGuestMessage(input, rate())
    await submitGuestMessage(input, rate())
    expect(generatePracticeReply).toHaveBeenCalledTimes(1)
    await expect(submitGuestMessage({ ...input, text: '別の本文' }, rate())).rejects.toMatchObject({
      status: 409
    })
    for (let i = 1; i < 3; i++) await submitGuestMessage(message(guest, i), rate())
    await expect(submitGuestMessage(message(guest, 3), rate())).rejects.toMatchObject({
      status: 409
    })
  })
  it('AI障害で本文を残し、同じ送信を再試行できる', async () => {
    const guest = await start(),
      input = message(guest)
    vi.mocked(generatePracticeReply).mockRejectedValueOnce(Error('fixture failure'))
    await expect(submitGuestMessage(input, rate())).rejects.toMatchObject({ status: 502 })
    expect(await getGuestPractice(guest.session.id, guest.id)).toMatchObject({
      turns: [],
      pending: { text: input.text, until: null }
    })
    await submitGuestMessage(input, rate())
    expect((await getGuestPractice(guest.session.id, guest.id)).turns).toHaveLength(1)
  })
  it('同時送信は1つだけ予約し、期限切れの古い完了や解除は新しい予約に干渉しない', async () => {
    const guest = await start(),
      input = message(guest)
    const first = await reserveGuestTurn(input, rate())
    expect(first.status).toBe('ready')
    expect((await reserveGuestTurn(input, rate())).status).toBe('pending')
    if (first.status !== 'ready') throw Error('not ready')
    vi.setSystemTime(new Date(now.getTime() + 76_000))
    const second = await reserveGuestTurn(input, rate())
    if (second.status !== 'ready') throw Error('not ready')
    const output = {
      requestId: input.requestId,
      position: 1,
      userText: input.text,
      assistantText: '保存する返信',
      feedback: null
    }
    expect(await finishGuestTurn(input, first.token, output)).toBe(false)
    await releaseGuestTurn(input, first.token)
    expect((await getGuestPractice(guest.session.id, guest.id)).pending?.until).toBeTruthy()
    expect(await finishGuestTurn(input, second.token, output)).toBe(true)
  })
  it('障害を繰り返しても会話ごとの9回の生成試行上限を越えない', async () => {
    const guest = await start(),
      input = message(guest)
    for (let i = 0; i < 9; i++) {
      const r = await reserveGuestTurn(input, rate())
      if (r.status !== 'ready') throw Error('not ready')
      await releaseGuestTurn(input, r.token)
    }
    await expect(reserveGuestTurn(input, rate())).rejects.toMatchObject({ status: 429 })
  })
  it('Cookieを作り直してもIPごとの開始数制限が働き、失敗時は全体カウントを増やさない', async () => {
    for (let i = 0; i < 12; i++) await start()
    await expect(start()).rejects.toMatchObject({ status: 429 })
    const limits = await db.select().from(schema.guestRateLimits)
    expect(limits.every((x) => x.used === 12)).toBe(true)
    expect(JSON.stringify(limits)).not.toContain('192.0.2.1')
    expect(await db.select().from(schema.guestSessions)).toHaveLength(12)
  })
  it.each([
    ['global:start', 300],
    ['global:generation', 1200],
    [`ip:generation`, 60]
  ] as const)('全体・IPの上限をDBで拒否する %s', async (kind, used) => {
    const guest = kind.includes('generation') ? await start() : null
    const context = rate(),
      key = kind.startsWith('ip')
        ? `${context.hash}:generation:${context.day}`
        : `${kind}:${context.day}`
    await db
      .insert(schema.guestRateLimits)
      .values({ key, used, expiresAt: new Date(now.getTime() + 86400_000) })
      .onConflictDoUpdate({ target: schema.guestRateLimits.key, set: { used } })
    await expect(guest ? reserveGuestTurn(message(guest), context) : start()).rejects.toMatchObject(
      { status: 429 }
    )
  })
  it('日付が変わるとIPの不可逆な値と利用カウントが変わる', async () => {
    const before = rate()
    vi.setSystemTime(new Date(now.getTime() + 86400_000))
    const after = rate()
    expect(after.day).not.toBe(before.day)
    expect(after.hash).not.toBe(before.hash)
  })
})
describe('ログイン後の引き継ぎ', () => {
  it('並行した引き継ぎも再開でき、枠・返答・好感度の記録を二重に増やさない', async () => {
    const guest = await complete()
    const results = await Promise.all([
      claimGuestPractice(guest.session.id, guest.id, uid),
      claimGuestPractice(guest.session.id, guest.id, uid)
    ])
    expect(results.some((r) => !r.pending)).toBe(true)
    await claimGuestPractice(guest.session.id, guest.id, uid)
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
    expect(await db.select().from(schema.practiceTurns)).toHaveLength(3)
    expect(await db.select().from(schema.creditSpends)).toHaveLength(1)
    expect(await db.select().from(schema.practiceEvaluations)).toHaveLength(1)
    expect(await db.select().from(schema.characterRelationships)).toHaveLength(1)
  })
  it('会話・合否・カード・好感度を引き継ぎ、再送でも1枠・1組の報酬だけ保存する', async () => {
    const guest = await complete(),
      calls = vi.mocked(generatePracticeReply).mock.calls.length
    const first = await claimGuestPractice(guest.session.id, guest.id, uid)
    const second = await claimGuestPractice(guest.session.id, guest.id, uid)
    expect(first.pending).toBe(false)
    expect(second.session?.turns).toHaveLength(3)
    expect(second.session?.evaluation?.status).toBe('passed')
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
    expect((await getAdventureProgress(uid)).memories).toHaveLength(1)
    expect((await getAdventureProgress(uid)).progression?.clearedEpisodes).toContain('aoi:aoi-1')
    expect(
      (await getAdventureProgress(uid)).stages?.find((x) => x.episodeId === 'aoi-2')?.lockedReasons
    ).toEqual([])
    expect(vi.mocked(generatePracticeReply).mock.calls.length).toBe(calls)
    expect(await db.select().from(schema.practiceTurns)).toHaveLength(3)
    expect(await db.select().from(schema.creditSpends)).toHaveLength(1)
    await expect(claimGuestPractice(guest.session.id, guest.id, otherUid)).rejects.toMatchObject({
      status: 403
    })
    await expect(submitGuestMessage(message(guest, 2), rate())).rejects.toMatchObject({
      status: 403
    })
  })
  it('引き継ぎAPIのクライアントが送る偽の評価は使わない', async () => {
    const guest = await complete()
    const response = await claimApi(
      event('POST', { score: 25, reply: '偽の返信' }, guest.id, guest.session.token, uid) as never
    )
    const value = await response.json()
    expect(value.turns[0].assistantText).toBe('その気持ちを聞けて、うれしいです。')
    expect(value.evaluation.score).not.toBe(25)
  })
  it('途中の体験も引き継ぎ、残りの返答を通常画面で続けられる', async () => {
    const guest = await start()
    await submitGuestMessage(message(guest), rate())
    await claimGuestPractice(guest.session.id, guest.id, uid)
    for (let expectedTurn = 1; expectedTurn < 3; expectedTurn++)
      await submitPracticeMessage(
        {
          uid,
          id: guest.id,
          requestId: randomUUID(),
          text: 'またお話ししたいです。',
          expectedTurn
        },
        null
      )
    expect((await getPractice(uid, guest.id))?.completedAt).toBeTruthy()
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
  })
  it('枠不足でも体験を残し、月の更新後に同じ本人が引き継げる', async () => {
    const guest = await complete()
    await db.insert(schema.practices).values(
      Array.from({ length: 10 }, () => ({
        id: randomUUID(),
        uid,
        sceneId: 'cafe' as const,
        chargedAt: now
      }))
    )
    await expect(claimGuestPractice(guest.session.id, guest.id, uid)).rejects.toMatchObject({
      status: 429
    })
    expect((await getGuestPractice(guest.session.id, guest.id)).turns).toHaveLength(3)
    vi.setSystemTime(new Date('2026-12-01T00:00:00+09:00'))
    await claimGuestPractice(guest.session.id, guest.id, uid)
    expect((await getPracticeOverview(uid)).remaining).toBe(9)
  })
  it('開始後に人物設定が公開されても元の設定のまま引き継ぐ', async () => {
    const guest = await complete()
    const content = defaultCharacterContent('aoi')
    content.profile.background = '後から変えた設定。'
    const releaseId = randomUUID()
    await db.insert(schema.characterPolicyReleases).values({
      id: releaseId,
      characterId: 'aoi',
      content,
      contentHash: characterContentHash(content),
      note: 'fixture',
      createdBy: uid
    })
    await db
      .insert(schema.characterPolicySettings)
      .values({ characterId: 'aoi', draft: content, activeReleaseId: releaseId, updatedBy: uid })
    await claimGuestPractice(guest.session.id, guest.id, uid)
    const [saved] = await db
      .select()
      .from(schema.practices)
      .where(eq(schema.practices.id, guest.id))
    expect(saved.characterContext?.content.profile.background).toBe('')
  })
  it('部分評価は評価待ちで引き継ぎ、クリアや好感度を捏造しない', async () => {
    const guest = await start()
    vi.mocked(generatePracticeReply).mockImplementation(async () => ({
      reply: 'ゆっくり話しましょう。',
      feedback: {
        strength: '話せました。',
        improvement: '次も話しましょう。',
        quote: '気持ち',
        rewrite: '話せてうれしいです。'
      }
    }))
    await complete(guest)
    expect((await getGuestPractice(guest.session.id, guest.id)).evaluation?.status).toBe('pending')
    await claimGuestPractice(guest.session.id, guest.id, uid)
    expect((await getPractice(uid, guest.id))?.evaluation?.status).toBe('pending')
    expect((await getAdventureProgress(uid)).progression?.clearedEpisodes).toEqual([])
  })
  it('期限切れは読めず、古い体験の削除でも保存済みの通常会話は残る', async () => {
    const guest = await complete()
    await claimGuestPractice(guest.session.id, guest.id, uid)
    vi.setSystemTime(new Date(now.getTime() + 31 * 86400_000))
    await expect(getGuestPractice(guest.session.id, guest.id)).rejects.toMatchObject({
      status: 401
    })
    await start('rin')
    expect(await db.select().from(schema.guestSessions)).toHaveLength(1)
    expect(await getPractice(uid, guest.id)).not.toBeNull()
  })
})

describe('管理者の体験引き継ぎ', () => {
  it('残枠0でも確認済み管理者は無料で保存し、再送で枠・会話・報酬を増やさない', async () => {
    vi.stubEnv('KOITRE_ADMIN_UIDS', uid)
    await db.insert(schema.practices).values({
      id: randomUUID(),
      uid,
      sceneId: 'cafe',
      creditCost: 10,
      chargedAt: now
    })
    const guest = await complete()
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await claimApi(
        event('POST', { adminPlay: false }, guest.id, guest.session.token, uid) as never
      )
      expect(await response.json()).toMatchObject({
        adminPlay: true,
        creditCost: 0,
        turns: Array.from({ length: 3 }, () => expect.anything())
      })
    }
    expect((await getPracticeOverview(uid)).remaining).toBe(0)
    expect(await db.select().from(schema.creditSpends)).toEqual([])
    expect(await db.select().from(schema.practiceEvaluations)).toHaveLength(1)
    expect((await getAdventureProgress(uid, true)).memories).toHaveLength(1)
  })
})
