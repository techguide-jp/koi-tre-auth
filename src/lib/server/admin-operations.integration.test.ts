import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { getAdminUsers, getAdminUserDetail } from './db/repositories/admin-users'
import { getAdminUsage } from './db/repositories/admin-usage'
import { getAdminBilling } from './db/repositories/admin-billing'
import { readCreditState } from './db/repositories/credits'
import {
  adminPeriod,
  adminUserQuery,
  adminBillingQuery,
  adminDays,
  adminUid
} from './admin-operations-request'
import { GET as usersGet } from '../../routes/api/admin/users/+server'
import { GET as detailGet } from '../../routes/api/admin/users/[uid]/+server'
import { GET as billingGet } from '../../routes/api/admin/billing/+server'
import { GET as usageGet } from '../../routes/api/admin/usage/+server'
import type { Adventure, AdventureReward } from '$lib/adventure'
import type { PracticeEvaluation } from '$lib/adventure-progression'
import { assessedFeedback } from './fixtures/progression-assessment'

let client: PGlite, db: ReturnType<typeof drizzle<typeof schema>>, migrations: string[]
let unavailable = false,
  reads = 0
const admin = 'admin-insights-fixture',
  customer = 'customer-fixture',
  other = 'other-fixture'
const now = new Date('2026-11-10T03:00:00Z'),
  old = new Date('2026-08-01T00:00:00Z')
const within = new Date('2026-11-09T03:00:00Z'),
  end = new Date('2026-12-09T03:00:00Z')
vi.mock('./db/client', () => ({
  getDb: () => {
    reads++
    if (unavailable) throw Error('__PRIVATE_DB_FAILURE__')
    return db
  }
}))
vi.mock('./firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token === 'admin') return { uid: admin }
      if (token === 'ordinary')
        return {
          uid: customer,
          email: 'operator@example.test',
          email_verified: false,
          firebase: { sign_in_provider: 'password' }
        }
      if (token === 'google')
        return {
          uid: other,
          email: 'operator@example.test',
          email_verified: true,
          firebase: { sign_in_provider: 'google.com' }
        }
      throw Error('invalid fixture token')
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
  client = new PGlite()
  db = drizzle(client, { schema })
  unavailable = false
  reads = 0
  for (const migration of migrations)
    for (const statement of migration.split('--> statement-breakpoint'))
      if (statement.trim()) await client.exec(statement)
  vi.stubEnv('KOITRE_ADMIN_UIDS', admin)
  vi.stubEnv('KOITRE_ADMIN_GOOGLE_EMAILS', 'operator@example.test')
  vi.stubEnv('BILLING_ENABLED', 'false')
  await db.insert(schema.users).values([
    { firebaseUid: admin, displayName: '運営テスト', email: 'admin@example.test', createdAt: old },
    {
      firebaseUid: customer,
      displayName: '利用者テスト',
      email: 'customer@example.test',
      createdAt: old
    },
    { firebaseUid: other, displayName: '別の利用者', email: 'other@example.test', createdAt: old }
  ])
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await client.close()
})
const query = { page: 1, search: '', access: 'all' as const }
function event(path: string, token?: string, uid = customer) {
  const url = new URL(`https://fixture.example${path}`)
  return {
    url,
    params: { uid },
    request: new Request(url, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  } as never
}
async function practice(
  uid = customer,
  options: {
    start?: Date | null
    finish?: Date | null
    turns?: 3 | 6
    cost?: number
    created?: Date
    adventure?: boolean
    xp?: AdventureReward['xp']
    id?: string
  } = {}
) {
  const id = options.id ?? randomUUID(),
    start = options.start === undefined ? within : options.start
  await db.insert(schema.practices).values({
    id,
    uid,
    sceneId: options.adventure === false ? 'custom' : 'adventure',
    adventure:
      options.adventure === false
        ? null
        : ({
            version: 1,
            characterId: 'aoi',
            episodeId: 'aoi-1',
            turns: options.turns ?? 3
          } satisfies Adventure),
    createdAt: options.created ?? start ?? within,
    chargedAt: start,
    completedAt: options.finish ?? null,
    creditCost: options.cost ?? (options.turns === 6 ? 2 : 1),
    pendingText: '__PRIVATE_PENDING__',
    reward: options.xp ? { version: 1, xp: options.xp, mission: null } : null
  })
  return id
}
async function turn(id: string, position: number, createdAt = within) {
  const row = {
    id: randomUUID(),
    practiceId: id,
    requestId: randomUUID(),
    position,
    userText: '__PRIVATE_USER_TEXT__',
    assistantText: '__PRIVATE_ASSISTANT_TEXT__',
    feedback: assessedFeedback('__PRIVATE_ANALYSIS_QUOTE__'),
    createdAt
  }
  await db.insert(schema.practiceTurns).values(row)
  return row
}
async function grant(
  uid: string,
  id: string,
  kind: 'plus' | 'route' | 'topup',
  extra: Partial<typeof schema.creditGrants.$inferInsert> = {}
) {
  await db.insert(schema.creditGrants).values({
    id,
    uid,
    kind,
    units: kind === 'plus' ? 60 : kind === 'route' ? 24 : 15,
    startsAt: within,
    expiresAt: kind === 'plus' ? end : null,
    ...extra
  })
}

describe('管理者の利用者・課金・利用状況', () => {
  it('未認証401・一般利用者403を全APIで拒否し、認可前にDBへアクセスしない', async () => {
    for (const [handler, path] of [
      [usersGet, '/api/admin/users'],
      [detailGet, '/api/admin/users/fixture'],
      [billingGet, '/api/admin/billing'],
      [usageGet, '/api/admin/usage']
    ] as const) {
      await expect(handler(event(path))).rejects.toMatchObject({ status: 401 })
      await expect(handler(event(path, 'ordinary'))).rejects.toMatchObject({ status: 403 })
    }
    expect(reads).toBe(0)
  })
  it('許可されたUIDと検証済みGoogle管理者が閲覧でき、no-storeで返す', async () => {
    for (const token of ['admin', 'google'])
      for (const [handler, path] of [
        [usersGet, '/api/admin/users'],
        [detailGet, '/api/admin/users/fixture'],
        [billingGet, '/api/admin/billing'],
        [usageGet, '/api/admin/usage']
      ] as const) {
        const response = await handler(event(path, token))
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('no-store')
      }
  })
  it('不明利用者404、入力不正400、集計失敗503を正常0件へ置き換えない', async () => {
    await expect(
      detailGet(event('/api/admin/users/unknown', 'admin', 'unknown'))
    ).rejects.toMatchObject({ status: 404 })
    for (const path of [
      '/api/admin/users?page=0',
      '/api/admin/users?access=admin',
      `/api/admin/users?q=${'x'.repeat(101)}`
    ])
      await expect(usersGet(event(path, 'admin'))).rejects.toMatchObject({ status: 400 })
    await expect(usageGet(event('/api/admin/usage?days=8', 'admin'))).rejects.toMatchObject({
      status: 400
    })
    await expect(billingGet(event('/api/admin/billing?kind=live', 'admin'))).rejects.toMatchObject({
      status: 400
    })
    unavailable = true
    for (const [handler, path] of [
      [usersGet, '/api/admin/users'],
      [detailGet, '/api/admin/users/fixture'],
      [billingGet, '/api/admin/billing'],
      [usageGet, '/api/admin/usage']
    ] as const)
      await expect(handler(event(path, 'admin'))).rejects.toMatchObject({ status: 503 })
  })
  it('練習なし・購入なし・ゲストなしの空状態を区別できる', async () => {
    const list = await getAdminUsers(query, now)
    expect(list.total).toBe(3)
    expect(
      list.users.every(
        (u) => !u.plus && !u.routePacks && u.started === 0 && u.lastPracticeAt === null
      )
    ).toBe(true)
    const usage = await getAdminUsage(7, now)
    expect(usage.totals).toMatchObject({
      registered: 3,
      newUsers: 0,
      activeUsers: 0,
      started: 0,
      completed: 0,
      replies: 0,
      credits: 0
    })
    expect(usage.daily).toHaveLength(7)
    expect(usage.guest.created).toBe(0)
    const billing = await getAdminBilling({ days: 30, page: 1, kind: 'all' }, now)
    expect(billing.grants).toHaveLength(0)
    expect(billing.contracts).toHaveLength(0)
    expect(billing.enabled).toBe(false)
  })
  it('複数の会話・返信・付与・購入があっても利用者数や会話数を水増ししない', async () => {
    const first = await practice(customer, { finish: within }),
      second = await practice(customer, { turns: 6 })
    for (let i = 1; i <= 3; i++) await turn(first, i)
    for (let i = 1; i <= 2; i++) await turn(second, i)
    await grant(customer, 'plus:sub:1', 'plus')
    await grant(customer, 'plus:sub:2', 'plus')
    await db.insert(schema.routePurchases).values(
      ['aoi', 'rin'].map((characterId) => ({
        id: randomUUID(),
        uid: customer,
        characterId: characterId as 'aoi' | 'rin',
        paidAt: within
      }))
    )
    const list = await getAdminUsers(query, now)
    expect(list.total).toBe(3)
    expect(list.users.find((u) => u.uid === customer)).toMatchObject({
      started: 2,
      completed: 1,
      replies: 5,
      plus: true,
      routePacks: 2,
      lastPracticeAt: within.toISOString()
    })
  })
  it('大文字小文字を問わず検索し、%、_、SQLに似た文字を文字列として扱う', async () => {
    await db.insert(schema.users).values([
      {
        firebaseUid: 'percent-user',
        displayName: 'percent%name',
        email: 'literal@example.test',
        createdAt: old
      },
      { firebaseUid: 'under-user', displayName: 'under_score', createdAt: old }
    ])
    expect(
      (await getAdminUsers({ ...query, search: 'CUSTOMER@' }, now)).users.map((u) => u.uid)
    ).toEqual([customer])
    expect(
      (await getAdminUsers({ ...query, search: '%name' }, now)).users.map((u) => u.uid)
    ).toEqual(['percent-user'])
    expect((await getAdminUsers({ ...query, search: '_' }, now)).users.map((u) => u.uid)).toEqual([
      'under-user'
    ])
    expect((await getAdminUsers({ ...query, search: "' OR 1=1 --" }, now)).total).toBe(0)
  })
  it('25件ずつのページ分割を安定した順序で返す', async () => {
    await db
      .insert(schema.users)
      .values(
        Array.from({ length: 30 }, (_, i) => ({ firebaseUid: `page-${i}`, createdAt: within }))
      )
    const first = await getAdminUsers(query, now),
      second = await getAdminUsers({ ...query, page: 2 }, now)
    expect(first.total).toBe(33)
    expect(first.users).toHaveLength(25)
    expect(second.users).toHaveLength(8)
    expect(new Set([...first.users, ...second.users].map((u) => u.uid)).size).toBe(33)
  })
  it('Plusは支払確認済みの有効枠で判定し、停止・期限終了・未来の付与や契約状態だけでは有効にしない', async () => {
    await grant(customer, 'plus:paid:1', 'plus')
    await grant(other, 'plus:expired:1', 'plus', { expiresAt: new Date('2026-11-01') })
    await grant(other, 'plus:revoked:1', 'plus', { revokedAt: within })
    await grant(other, 'plus:future:1', 'plus', {
      startsAt: end,
      expiresAt: new Date('2027-01-01')
    })
    await db.insert(schema.billingSubscriptions).values({
      id: 'sub-no-payment',
      uid: other,
      status: 'active',
      periodStart: within,
      periodEnd: end
    })
    expect(
      (await getAdminUsers({ ...query, access: 'plus' }, now)).users.map((u) => u.uid)
    ).toEqual([customer])
    expect(
      (await getAdminUsers({ ...query, access: 'free' }, now)).users.map((u) => u.uid).sort()
    ).toEqual([admin, other].sort())
  })
  it('人物パックは停止済みを除外し、追加枠だけでは有料本編の利用権にしない', async () => {
    await db.insert(schema.routePurchases).values([
      { id: 'route-active', uid: customer, characterId: 'aoi', paidAt: within },
      { id: 'route-stopped', uid: other, characterId: 'rin', paidAt: within, revokedAt: within }
    ])
    await grant(other, 'topup:pi_fixture', 'topup')
    expect(
      (await getAdminUsers({ ...query, access: 'route' }, now)).users.map((u) => u.uid)
    ).toEqual([customer])
    expect(
      (await getAdminUsers({ ...query, access: 'free' }, now)).users.map((u) => u.uid)
    ).toContain(other)
  })
  it('残枠は通常画面と一致し、予約や失効を考慮し、閲覧で台帳を変更しない', async () => {
    const id = await practice(customer),
      reserved = await practice(customer, { start: null })
    await grant(customer, 'route:fixture', 'route', { characterId: 'aoi' })
    await grant(customer, 'topup:fixture', 'topup')
    await db.insert(schema.creditSpends).values({
      id: 'reserve',
      uid: customer,
      practiceId: reserved,
      grantId: 'topup:fixture',
      units: 2,
      state: 'reserved',
      expiresAt: end
    })
    await db.insert(schema.characterRelationships).values({
      id: 'relation',
      uid: customer,
      characterId: 'aoi',
      version: 1,
      earned: 20,
      strain: 3
    })
    const snapshot = async () =>
      Promise.all([
        db.select().from(schema.creditGrants),
        db.select().from(schema.creditSpends),
        db.select().from(schema.users),
        db.select().from(schema.characterRelationships),
        db.select().from(schema.episodeAchievements),
        db.select().from(schema.practiceEvaluations)
      ])
    const before = await snapshot(),
      expected = await readCreditState(db as never, customer, now)
    const detail = await getAdminUserDetail(customer, now)
    expect(detail?.billing).toEqual(expected)
    expect(detail?.billing.reserved).toBe(2)
    expect(detail?.billing.credits.find((g) => g.kind === 'free')?.remaining).toBe(9)
    expect(detail?.billing.credits.find((g) => g.kind === 'topup')?.remaining).toBe(13)
    expect(detail?.progression.relationships.find((r) => r.characterId === 'aoi')?.affinity).toBe(
      17
    )
    await getAdminUsers(query, now)
    await getAdminUsage(30, now)
    await getAdminBilling({ days: 30, page: 1, kind: 'all' }, now)
    expect(await snapshot()).toEqual(before)
    expect(detail?.history.find((p) => p.id === id)?.creditCost).toBe(1)
  })
  it('会話本文・評価の引用・保留中入力・旧形式の本文・Checkout URLを返さない', async () => {
    const id = await practice(customer, { finish: within, xp: 30 })
    await turn(id, 1)
    await db.insert(schema.operations).values({
      uid: customer,
      conversationId: 'legacy',
      query: '__PRIVATE_OLD_QUERY__',
      llmText: '__PRIVATE_OLD_REPLY__',
      createdAt: within
    })
    await db.insert(schema.billingCheckouts).values({
      id: randomUUID(),
      uid: customer,
      product: 'plus',
      url: 'https://checkout.stripe.com/__PRIVATE_LINK__',
      requestParams: { client_reference_id: '__PRIVATE_PARAMS__' },
      status: 'open',
      expiresAt: end,
      createdAt: within
    })
    const detail = await getAdminUserDetail(customer, now),
      billing = await getAdminBilling({ days: 30, page: 1, kind: 'all' }, now)
    expect(JSON.stringify([detail, billing])).not.toContain('__PRIVATE_')
    expect(detail?.activity).toMatchObject({ xp: 30, legacyReplies: 1 })
    expect(detail?.history[0]).toMatchObject({ replied: 1, score: null, evaluation: null })
    expect(billing.checkouts[0]).not.toHaveProperty('url')
    expect(billing.checkouts[0]).not.toHaveProperty('requestParams')
  })
  it('利用者詳細の会話は最新20件までで、他人の会話やカードを混ぜない', async () => {
    for (let i = 0; i < 22; i++) await practice(customer)
    await practice(other, { finish: within, xp: 70 })
    const detail = await getAdminUserDetail(customer, now)
    expect(detail?.history).toHaveLength(20)
    expect(detail?.historyHasMore).toBe(true)
    expect(detail?.user.started).toBe(22)
    expect(detail?.activity.xp).toBe(0)
  })
  it('開始・完了を別の日時で計上し、未送信や管理者の無料会話を消費へ混ぜない', async () => {
    await practice(customer, { start: old, finish: within })
    await practice(customer, { start: within })
    await practice(admin, { start: within, finish: within, turns: 6, cost: 0, xp: 70 })
    await practice(other, { start: null })
    const view = await getAdminUsage(7, now)
    expect(view.totals).toMatchObject({
      started: 2,
      completed: 2,
      credits: 1,
      cleared: 0,
      pendingEvaluations: 2
    })
    expect(view.modes.find((m) => m.key === 'adventure:6')).toMatchObject({
      started: 1,
      completed: 1
    })
  })
  it('JSTの午前0時と期間の開始・終了を正しく扱う', async () => {
    expect(adminPeriod(7, now)).toMatchObject({
      from: '2026-11-03T15:00:00.000Z',
      to: now.toISOString()
    })
    const a = await practice(customer, {
      start: new Date('2026-11-09T14:59:59Z'),
      finish: new Date('2026-11-09T15:00:00Z')
    })
    await turn(a, 1, new Date('2026-11-09T14:59:59Z'))
    await turn(a, 2, new Date('2026-11-09T15:00:00Z'))
    await practice(customer, { start: new Date('2026-11-03T15:00:00Z') })
    await practice(customer, { start: new Date('2026-11-03T14:59:59.999Z') })
    await practice(customer, { start: now })
    const view = await getAdminUsage(7, now)
    expect(view.totals.started).toBe(2)
    expect(view.daily.find((d) => d.date === '2026-11-09')).toMatchObject({
      started: 1,
      completed: 0,
      replies: 1
    })
    expect(view.daily.find((d) => d.date === '2026-11-10')).toMatchObject({
      started: 0,
      completed: 1,
      replies: 1
    })
    expect(view.daily.reduce((n, d) => n + d.started, 0)).toBe(view.totals.started)
    expect(view.daily.reduce((n, d) => n + d.completed, 0)).toBe(view.totals.completed)
  })
  it('新規登録・返信した利用者・返信数・攻略評価待ち・ステージクリアを分離する', async () => {
    await db.insert(schema.users).values({ firebaseUid: 'new-user', createdAt: within })
    const id = await practice(customer, { finish: within })
    await turn(id, 1)
    await turn(id, 2)
    const otherId = await practice(customer)
    await turn(otherId, 1)
    await db.insert(schema.episodeAchievements).values({
      id: 'cleared',
      uid: customer,
      characterId: 'aoi',
      episodeId: 'aoi-1',
      version: 1,
      clearedAt: within
    })
    const result: PracticeEvaluation = {
      version: 1,
      status: 'failed',
      score: 9,
      consideration: 3,
      requiredScore: 10,
      requiredConsideration: 2,
      affinityBefore: 0,
      affinityAfter: 0,
      earnedDelta: 0,
      strainDelta: 0
    }
    await db.insert(schema.practiceEvaluations).values({
      practiceId: id,
      uid: customer,
      characterId: 'aoi',
      version: 1,
      result,
      settledAt: within
    })
    const view = await getAdminUsage(30, now)
    expect(view.totals).toMatchObject({
      registered: 4,
      newUsers: 1,
      activeUsers: 1,
      replies: 3,
      completed: 1,
      cleared: 1,
      pendingEvaluations: 0
    })
    expect(view.topUsers).toHaveLength(1)
    expect(view.topUsers[0]).toMatchObject({ uid: customer, replies: 3 })
  })
  it('ゲストは期限内の保存分を別集計し、引き継ぎや削除済み相当を合算しない', async () => {
    const imported = await practice(customer, { finish: within })
    const importedTurns = []
    for (let i = 1; i <= 3; i++) importedTurns.push(await turn(imported, i))
    for (const expired of [false, true]) {
      const sessionId = randomUUID()
      await db
        .insert(schema.guestSessions)
        .values({ id: sessionId, expiresAt: expired ? old : end, createdAt: within })
      await db.insert(schema.guestPractices).values({
        id: expired ? randomUUID() : imported,
        sessionId,
        characterId: 'aoi',
        characterContext: {} as never,
        storyContext: {} as never,
        state: { turns: importedTurns, completedAt: within.toISOString(), pending: null },
        claimedUid: customer,
        createdAt: within
      })
    }
    const view = await getAdminUsage(90, now)
    expect(view.guest).toEqual({ created: 1, completed: 1, claimed: 1, retentionDays: 30 })
    expect(view.totals).toMatchObject({ started: 1, completed: 1, replies: 3, activeUsers: 1 })
  })
  it('引き継ぎ予約・下書き・一部保存を成功へ数えず、全返答の保存後だけ数える', async () => {
    const id = randomUUID(),
      sessionId = randomUUID()
    const guestTurns = Array.from({ length: 3 }, (_, i) => ({
      requestId: randomUUID(),
      position: i + 1,
      userText: '架空の発言',
      assistantText: '架空の返答',
      feedback: null
    }))
    await db
      .insert(schema.guestSessions)
      .values({ id: sessionId, expiresAt: end, createdAt: within })
    await db.insert(schema.guestPractices).values({
      id,
      sessionId,
      characterId: 'aoi',
      characterContext: {} as never,
      storyContext: {} as never,
      state: { turns: guestTurns, completedAt: within.toISOString(), pending: null },
      claimedUid: customer,
      createdAt: within
    })
    expect((await getAdminUsage(30, now)).guest.claimed).toBe(0)
    await practice(customer, { id, start: null })
    expect((await getAdminUsage(30, now)).guest.claimed).toBe(0)
    for (const item of guestTurns) {
      await db
        .insert(schema.practiceTurns)
        .values({ id: randomUUID(), practiceId: id, ...item, createdAt: within })
      expect((await getAdminUsage(30, now)).guest.claimed).toBe(item.position === 3 ? 1 : 0)
    }
    expect((await getAdminUsage(30, now)).guest.claimed).toBe(1)
  })
  it('同じIDに別利用者の返答があっても引き継ぎ済みへ数えない', async () => {
    const id = await practice(other, { finish: within }),
      sessionId = randomUUID(),
      saved = await turn(id, 1)
    await db
      .insert(schema.guestSessions)
      .values({ id: sessionId, expiresAt: end, createdAt: within })
    await db.insert(schema.guestPractices).values({
      id,
      sessionId,
      characterId: 'aoi',
      characterContext: {} as never,
      storyContext: {} as never,
      state: { turns: [saved], completedAt: null, pending: null },
      claimedUid: customer,
      createdAt: within
    })
    expect((await getAdminUsage(30, now)).guest.claimed).toBe(0)
    await db
      .update(schema.guestPractices)
      .set({ claimedUid: other })
      .where(eq(schema.guestPractices.id, id))
    expect((await getAdminUsage(30, now)).guest.claimed).toBe(1)
  })
  it('未発言の体験は本人の下書きが保存されてから引き継ぎ済みにし、練習開始とは分ける', async () => {
    const id = randomUUID(),
      sessionId = randomUUID()
    await db
      .insert(schema.guestSessions)
      .values({ id: sessionId, expiresAt: end, createdAt: within })
    await db.insert(schema.guestPractices).values({
      id,
      sessionId,
      characterId: 'aoi',
      characterContext: {} as never,
      storyContext: {} as never,
      state: { turns: [], completedAt: null, pending: null },
      claimedUid: customer,
      createdAt: within
    })
    expect((await getAdminUsage(30, now)).guest.claimed).toBe(0)
    await practice(customer, { id, start: null })
    const view = await getAdminUsage(30, now)
    expect(view.guest).toMatchObject({ created: 1, completed: 0, claimed: 1 })
    expect(view.totals).toMatchObject({ started: 0, completed: 0, replies: 0 })
  })
  it('契約状態・Checkout完了と支払確認後の付与を区別し、停止や期限終了も表示する', async () => {
    await grant(customer, 'plus:sub-active:1', 'plus')
    await grant(customer, 'plus:sub-old:1', 'plus', {
      startsAt: new Date('2026-11-01'),
      expiresAt: new Date('2026-11-02')
    })
    await grant(other, 'topup:stopped', 'topup', { revokedAt: within })
    await db.insert(schema.billingSubscriptions).values([
      {
        id: 'sub-active',
        uid: customer,
        status: 'active',
        periodStart: within,
        periodEnd: end,
        cancelAtPeriodEnd: true
      },
      { id: 'sub-unpaid', uid: other, status: 'active', periodStart: within, periodEnd: end }
    ])
    await db.insert(schema.billingCheckouts).values({
      id: randomUUID(),
      uid: other,
      product: 'plus',
      status: 'completed',
      expiresAt: end,
      createdAt: within
    })
    const view = await getAdminBilling({ days: 30, page: 1, kind: 'all' }, now)
    expect(view.current).toEqual({ plusUsers: 1, routeOwners: 0, topupOwners: 0 })
    expect(view.grants).toHaveLength(3)
    expect(view.checkouts).toHaveLength(1)
    expect(view.contracts.find((c) => c.id === 'sub-active')).toMatchObject({
      paidAccess: true,
      cancelAtPeriodEnd: true
    })
    expect(view.contracts.find((c) => c.id === 'sub-unpaid')?.paidAccess).toBe(false)
    expect(view).not.toHaveProperty('revenue')
    expect((await getAdminBilling({ days: 7, page: 1, kind: 'plus' }, now)).grants).toHaveLength(1)
  })
  it('付与履歴を期間・商品で絞り込み、25件ずつ表示する', async () => {
    for (let i = 0; i < 27; i++) await grant(customer, `topup:page-${i}`, 'topup')
    await grant(other, 'old-topup', 'topup', { startsAt: old })
    await grant(other, 'plus:excluded', 'plus')
    const one = await getAdminBilling({ days: 30, page: 1, kind: 'topup' }, now),
      two = await getAdminBilling({ days: 30, page: 2, kind: 'topup' }, now)
    expect(one.total).toBe(27)
    expect(one.grants).toHaveLength(25)
    expect(two.grants).toHaveLength(2)
    expect(new Set([...one.grants, ...two.grants].map((g) => g.id)).size).toBe(27)
  })
})

describe('集計リクエストの境界', () => {
  it('範囲・ページ・文字数を検証し、集計日数は7/30/90に限定する', () => {
    expect(adminUserQuery(new URLSearchParams('q=%20aoi%20'))).toEqual({
      search: 'aoi',
      page: 1,
      access: 'all'
    })
    expect(adminBillingQuery(new URLSearchParams())).toEqual({ days: 30, page: 1, kind: 'all' })
    for (const bad of ['0', '-1', 'Infinity', '7.5', '10001'])
      expect(() => adminUserQuery(new URLSearchParams({ page: bad }))).toThrow()
    for (const bad of ['1', '31', '91'])
      expect(() => adminDays(new URLSearchParams({ days: bad }))).toThrow()
    expect(() => adminUid('x'.repeat(256))).toThrow()
  })
})
