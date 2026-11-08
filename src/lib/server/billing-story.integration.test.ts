import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import Stripe from 'stripe'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import {
  beginCheckout,
  handleStripeEvent,
  reconcileCheckout,
  openBillingPortal
} from './billing-service'
import { getBillingOverview } from './db/repositories/credits'
import {
  createPractice,
  getPractice,
  getPracticeOverview,
  reservePracticeTurn,
  releasePracticeTurn,
  finishPracticeTurn
} from './db/repositories/practices'
import { getAdventureProgress, selectStoryEnding } from './db/repositories/adventures'
import { submitPracticeMessage } from './practice-service'
import { episodeById, type Adventure } from '$lib/adventure'

let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>
let migrations: string[]
const uid = 'billing-story-test',
  other = 'billing-other-test'
const now = new Date('2026-11-08T12:00:00Z')
const start = Math.floor(new Date('2026-11-08T00:00:00Z').getTime() / 1000),
  end = Math.floor(new Date('2026-12-08T00:00:00Z').getTime() / 1000)
const customer = 'cus_fixture'
const sessions = new Map<string, Record<string, unknown>>()
let subscription: Record<string, unknown>
let invoice: Record<string, unknown>
const sdk = {
  prices: {
    retrieve: vi.fn(async (id: string) => ({
      id,
      active: true,
      currency: 'jpy',
      unit_amount: id === 'price_plus' ? 980 : 1480,
      type: id === 'price_plus' ? 'recurring' : 'one_time',
      recurring: id === 'price_plus' ? { interval: 'month', interval_count: 1 } : null
    }))
  },
  customers: { create: vi.fn(async () => ({ id: customer })) },
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(async (id: string) => {
        const s = sessions.get(id)
        if (!s) throw Error('missing fixture')
        return s
      })
    }
  },
  subscriptions: { retrieve: vi.fn(async () => subscription) },
  invoices: { retrieve: vi.fn(async () => invoice) },
  invoicePayments: { list: vi.fn(async () => ({ data: [] })) },
  charges: { retrieve: vi.fn() },
  disputes: { retrieve: vi.fn() },
  billingPortal: {
    sessions: {
      create: vi.fn(async () => ({ url: 'https://billing.stripe.com/p/session/test_fixture' }))
    }
  },
  webhooks: new Stripe('sk_test_fixture').webhooks
}
vi.mock('./db/client', () => ({ getDb: () => db }))
vi.mock('./stripe-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('./stripe-client')>()
  return { ...original, stripeClient: () => sdk }
})
vi.mock('./analytics', () => ({ trackPracticeCompleted: vi.fn(), trackQuestionSubmitted: vi.fn() }))
vi.mock('./dify-practice', () => ({
  generatePracticeReply: vi.fn(async (input) => {
    const episode = episodeById(input.adventure?.episodeId),
      final = input.turns.length + 1 === (input.adventure?.turns ?? 3)
    return {
      reply: 'あなたの気持ちを聞けてうれしいです。私も一緒に過ごしたいです。',
      feedback: final
        ? {
            strength: '希望を伝えた',
            improvement: 'この伝え方を次の場面でも。',
            quote: input.text,
            rewrite: input.text
          }
        : null,
      mission:
        final && episode
          ? {
              id: episode.missionId,
              evidence: [{ turn: 1, quote: 'あなたと、ゆっくり話したいです。' }]
            }
          : null,
      storyEnding:
        final && episode?.chapter === 12
          ? {
              kind: 'lovers',
              reason: '互いの希望を言葉で確かめました。',
              evidence: [{ turn: 1, quote: 'あなたと、ゆっくり話したいです。' }]
            }
          : null
    }
  })
}))
vi.mock('./firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token !== 'fixture-token') throw Error('invalid')
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
  sessions.clear()
  client = new PGlite()
  db = drizzle(client, { schema })
  for (const migration of migrations)
    for (const statement of migration.split('--> statement-breakpoint'))
      if (statement.trim()) await client.exec(statement)
  await db.insert(schema.users).values([{ firebaseUid: uid }, { firebaseUid: other }])
  await db.insert(schema.billingCustomers).values({ uid, stripeCustomerId: customer })
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture')
  vi.stubEnv('STRIPE_PORTAL_CONFIGURATION_ID', 'bpc_fixture')
  vi.stubEnv('BILLING_ENABLED', 'true')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('VITE_APP_DOMAIN', 'http://127.0.0.1:5194')
  vi.stubEnv('STRIPE_PRICE_PLUS', 'price_plus')
  for (const id of ['aoi', 'rin', 'shiori', 'yu', 'sota', 'ren'])
    vi.stubEnv(`STRIPE_PRICE_ROUTE_${id.toUpperCase()}`, `price_route_${id}`)
  subscription = {
    id: 'sub_fixture',
    object: 'subscription',
    livemode: false,
    customer,
    status: 'active',
    cancel_at_period_end: false,
    metadata: { app: 'koi-tre', uid },
    latest_invoice: 'in_fixture',
    items: {
      data: [
        {
          id: 'si_fixture',
          current_period_start: start,
          current_period_end: end,
          price: {
            id: 'price_plus',
            unit_amount: 980,
            currency: 'jpy',
            recurring: { interval: 'month', interval_count: 1 }
          }
        }
      ]
    }
  }
  invoice = {
    id: 'in_fixture',
    object: 'invoice',
    livemode: false,
    customer,
    status: 'paid',
    currency: 'jpy',
    amount_paid: 980,
    billing_reason: 'subscription_create',
    parent: { subscription_details: { subscription: 'sub_fixture' } },
    lines: {
      data: [
        {
          amount: 980,
          quantity: 1,
          pricing: { price_details: { price: 'price_plus' } },
          period: { start, end }
        }
      ]
    }
  }
  sdk.checkout.sessions.create.mockImplementation(async (params) => {
    const id = `cs_${params.metadata.checkout_id}`
    const result = {
      id,
      livemode: false,
      customer,
      mode: params.mode,
      metadata: params.metadata,
      status: 'open',
      payment_status: 'unpaid',
      amount_total: params.mode === 'payment' ? 1480 : 980,
      currency: 'jpy',
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      url: `https://checkout.stripe.com/c/pay/${id}`,
      line_items: { data: [{ price: { id: params.line_items[0].price }, quantity: 1 }] }
    }
    sessions.set(id, result)
    return result
  })
})
afterEach(async () => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  await client.close()
})
const event = (type: string, object: Record<string, unknown>, id = randomUUID()) =>
  ({
    id: `evt_${id}`,
    type,
    livemode: false,
    data: { object },
    created: Math.floor(Date.now() / 1000)
  }) as unknown as Stripe.Event
async function routePurchase(characterId: 'aoi' | 'yu' | 'rin' = 'aoi') {
  const order = randomUUID()
  await beginCheckout(uid, order, { kind: 'route', characterId })
  const session = [...sessions.values()].find(
    (s) => (s.metadata as { checkout_id: string }).checkout_id === order
  )!
  Object.assign(session, {
    status: 'complete',
    payment_status: 'paid',
    payment_intent: `pi_${order}`
  })
  const notification = event('checkout.session.completed', session)
  await handleStripeEvent(notification)
  return { order, session, notification }
}
async function seedStory(characterId: 'aoi' | 'yu' = 'aoi', through = 12) {
  const result: string[] = []
  for (let chapter = 1; chapter <= through; chapter++) {
    const id = randomUUID()
    result.push(id)
    await db.insert(schema.practices).values({
      id,
      uid,
      sceneId: 'adventure',
      adventure: { version: 1, characterId, episodeId: `${characterId}-${chapter}`, turns: 3 },
      creditCost: 1,
      chargedAt: new Date('2026-10-01T00:00:00Z'),
      completedAt: new Date(now.getTime() + chapter * 1000),
      reward: { version: 1, xp: 20, mission: null },
      storyContext: {
        version: 1,
        chapter,
        relationship: chapter < 10 ? '交際前の二人' : '今後の関係を確かめる二人',
        revisit: false,
        memories: []
      },
      storyEnding:
        chapter === 12
          ? {
              kind: 'lovers',
              reason: '気持ちを確かめた',
              evidence: [{ turn: 1, quote: 'あなたと過ごしたいです。' }]
            }
          : null
    })
    await db.insert(schema.practiceTurns).values({
      id: randomUUID(),
      practiceId: id,
      requestId: randomUUID(),
      position: 1,
      userText: `第${chapter}話の気持ちです。`,
      assistantText: `第${chapter}話の返答です。`
    })
  }
  if (through === 12)
    await db
      .insert(schema.characterEndings)
      .values({ id: `${uid}:${characterId}`, uid, characterId, practiceId: result.at(-1)! })
  return result
}
const adventure = (episodeId = 'aoi-1', turns: 3 | 6 = 6): Adventure => ({
  version: 1,
  characterId: 'aoi',
  episodeId,
  turns
})
const input = (id: string, expectedTurn = 0) => ({
  uid,
  id,
  text: 'あなたと、ゆっくり話したいです。',
  expectedTurn,
  requestId: randomUUID()
})

describe('Stripeの購入・契約・通知', () => {
  it('サーバーの固定価格と本人顧客で購入を作り、未払い・戻りURLだけで権利を付けない', async () => {
    const order = randomUUID()
    const opened = await beginCheckout(uid, order, { kind: 'route', characterId: 'aoi' })
    expect(opened).toHaveProperty('url')
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer,
        line_items: [{ price: 'price_route_aoi', quantity: 1 }],
        allowed_payment_method_types: ['card']
      }),
      expect.objectContaining({ idempotencyKey: `koi-tre:checkout:${order}` })
    )
    expect((await getBillingOverview(uid)).ownedCharacters).toEqual([])
    expect(await reconcileCheckout(uid, order)).toEqual({ pending: true })
    expect((await getBillingOverview(uid)).ownedCharacters).toEqual([])
    expect(await reconcileCheckout(other, order)).toEqual({ pending: false })
  })
  it('同じ購入の再送・別リクエストでも開いているCheckoutを再利用する', async () => {
    const first = await beginCheckout(uid, randomUUID(), { kind: 'route', characterId: 'aoi' })
    const next = await beginCheckout(uid, randomUUID(), { kind: 'route', characterId: 'aoi' })
    expect(next).toEqual(first)
    expect(sdk.checkout.sessions.create).toHaveBeenCalledTimes(1)
    await expect(
      beginCheckout(other, first.id, { kind: 'route', characterId: 'aoi' })
    ).rejects.toMatchObject({ status: 409 })
  })
  it('購入完了通知と再送・再照合で、人物の権利と24枠を一度だけ付与する', async () => {
    const paid = await routePurchase()
    await handleStripeEvent(paid.notification)
    await handleStripeEvent(event('checkout.session.completed', paid.session))
    await reconcileCheckout(uid, paid.order)
    const state = await getBillingOverview(uid)
    expect(state.ownedCharacters).toEqual(['aoi'])
    expect(state.credits.find((g) => g.kind === 'route')?.remaining).toBe(24)
    expect(await db.select().from(schema.routePurchases)).toHaveLength(1)
    await expect(
      beginCheckout(uid, randomUUID(), { kind: 'route', characterId: 'aoi' })
    ).rejects.toMatchObject({ status: 409 })
    expect((await getBillingOverview(other)).ownedCharacters).toEqual([])
  })
  it.each(['amount', 'customer', 'price', 'currency'] as const)(
    '%sが不正な支払いでは購入権を付与しない',
    async (mode) => {
      const order = randomUUID()
      await beginCheckout(uid, order, { kind: 'route', characterId: 'aoi' })
      const session = [...sessions.values()][0]
      Object.assign(session, { status: 'complete', payment_status: 'paid' })
      if (mode === 'amount') session.amount_total = 1
      if (mode === 'customer') session.customer = 'cus_other'
      if (mode === 'price')
        session.line_items = { data: [{ price: { id: 'price_other' }, quantity: 1 }] }
      if (mode === 'currency') session.currency = 'usd'
      if (mode === 'customer')
        await expect(reconcileCheckout(uid, order)).rejects.toMatchObject({ status: 403 })
      else
        await expect(
          handleStripeEvent(event('checkout.session.completed', session))
        ).rejects.toThrow()
      expect((await getBillingOverview(uid)).ownedCharacters).toEqual([])
    }
  )
  it('本編クリア前のPlus購入を拒否し、購入済み人物のクリア後に開始できる', async () => {
    await expect(beginCheckout(uid, randomUUID(), { kind: 'plus' })).rejects.toMatchObject({
      status: 403
    })
    await routePurchase()
    await seedStory()
    expect(await beginCheckout(uid, randomUUID(), { kind: 'plus' })).toHaveProperty('url')
  })
  it('支払い済み請求の期間へ60枠を一度だけ付与し、無料10枠を重複付与しない', async () => {
    await handleStripeEvent(event('invoice.paid', invoice))
    await handleStripeEvent(event('customer.subscription.updated', subscription))
    await handleStripeEvent(event('invoice.paid', invoice))
    const state = await getBillingOverview(uid, now)
    expect(state.subscription?.active).toBe(true)
    expect(state.credits.map((g) => g.kind)).toEqual(['plus'])
    expect(state.remaining).toBe(60)
    expect(state.resetsAt).toBe('2026-12-08T00:00:00.000Z')
  })
  it('更新失敗では60枠を増やさず、支払い済み期間終了後は無料へ戻る', async () => {
    await handleStripeEvent(event('invoice.paid', invoice))
    subscription = { ...subscription, status: 'past_due' }
    invoice = { ...invoice, status: 'open', amount_paid: 0 }
    await handleStripeEvent(event('invoice.payment_failed', invoice))
    expect((await getBillingOverview(uid, now)).remaining).toBe(60)
    const later = await getBillingOverview(uid, new Date('2026-12-08T00:00:01Z'))
    expect(later.subscription?.active).toBe(false)
    expect(later.remaining).toBe(10)
  })
  it('新しい有料期間は別の60枠になり、過去期間の支払い通知で二重加算しない', async () => {
    await handleStripeEvent(event('invoice.paid', invoice))
    const start2 = end,
      end2 = Math.floor(new Date('2027-01-08T00:00:00Z').getTime() / 1000)
    subscription = {
      ...subscription,
      items: {
        data: [
          {
            current_period_start: start2,
            current_period_end: end2,
            price: {
              id: 'price_plus',
              unit_amount: 980,
              currency: 'jpy',
              recurring: { interval: 'month', interval_count: 1 }
            }
          }
        ]
      }
    }
    invoice = {
      ...invoice,
      id: 'in_next',
      billing_reason: 'subscription_cycle',
      lines: {
        data: [
          {
            amount: 980,
            quantity: 1,
            pricing: { price_details: { price: 'price_plus' } },
            period: { start: start2, end: end2 }
          }
        ]
      }
    }
    await handleStripeEvent(event('invoice.paid', invoice))
    await handleStripeEvent(event('invoice.paid', invoice))
    expect((await getBillingOverview(uid, new Date('2026-12-09T00:00:00Z'))).remaining).toBe(60)
    expect(await db.select().from(schema.creditGrants)).toHaveLength(2)
  })
  it('解約の古い通知を後から受けてもStripe最新状態で同期し、購入本編を保持する', async () => {
    await routePurchase()
    await handleStripeEvent(event('invoice.paid', invoice))
    subscription = { ...subscription, status: 'canceled' }
    await handleStripeEvent(event('customer.subscription.deleted', subscription))
    await handleStripeEvent(
      event('customer.subscription.updated', { ...subscription, status: 'active' })
    )
    const state = await getBillingOverview(uid, now)
    expect(state.subscription?.active).toBe(false)
    expect(state.ownedCharacters).toEqual(['aoi'])
    expect(state.credits.some((g) => g.kind === 'plus')).toBe(false)
  })
  it('全額返金後は人物の購入権と未使用枠を止め、完了通知の再送で復活させない', async () => {
    const paid = await routePurchase()
    sdk.charges.retrieve.mockResolvedValue({
      id: 'ch_fixture',
      livemode: false,
      customer,
      amount: 1480,
      amount_refunded: 1480,
      payment_intent: paid.session.payment_intent,
      disputed: false
    })
    await handleStripeEvent(event('charge.refunded', { id: 'ch_fixture', customer }))
    sdk.disputes.retrieve.mockResolvedValue({ status: 'won', charge: 'ch_fixture' })
    await handleStripeEvent(
      event('charge.dispute.closed', { id: 'dp_fixture', charge: 'ch_fixture' })
    )
    await handleStripeEvent(event('checkout.session.completed', paid.session))
    const state = await getBillingOverview(uid, now)
    expect(state.ownedCharacters).toEqual([])
    expect(state.credits.some((g) => g.kind === 'route')).toBe(false)
  })
  it('契約管理は本人の顧客と固定の戻り先で開く', async () => {
    expect(await openBillingPortal(uid)).toHaveProperty('url')
    expect(sdk.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer, return_url: 'http://127.0.0.1:5194/account' })
    )
    await expect(openBillingPortal(other)).rejects.toMatchObject({ status: 404 })
  })
  it('Portalのcancel_atによる期間末解約も予約として同期し、支払い済み枠を維持する', async () => {
    subscription = { ...subscription, cancel_at: end, cancel_at_period_end: false }
    await handleStripeEvent(event('customer.subscription.updated', subscription))
    const state = await getBillingOverview(uid, now)
    expect(state.subscription?.cancelAtPeriodEnd).toBe(true)
    expect(state.subscription?.active).toBe(true)
    expect(state.credits.find((g) => g.kind === 'plus')?.remaining).toBe(60)
  })
})
describe('枠の消費とパート別再練習', () => {
  it('6往復の最初に2枠を予約・確定し、再送・再開・完了で追加消費しない', async () => {
    const id = randomUUID()
    expect(await createPractice(uid, id, 'adventure', null, adventure())).toBe(true)
    const first = input(id)
    await submitPracticeMessage(first, null)
    await submitPracticeMessage(first, null)
    expect((await getPracticeOverview(uid)).remaining).toBe(8)
    for (let i = 1; i < 6; i++) await submitPracticeMessage(input(id, i), null)
    expect((await getPracticeOverview(uid)).remaining).toBe(8)
    expect((await getPractice(uid, id))?.reward?.xp).toBe(70)
  })
  it('最後の1枠で6往復を開始せず、3往復なら開始できる', async () => {
    await db.insert(schema.practices).values(
      Array.from({ length: 9 }, () => ({
        id: randomUUID(),
        uid,
        sceneId: 'cafe' as const,
        chargedAt: new Date()
      }))
    )
    const id = randomUUID()
    await createPractice(uid, id, 'adventure', null, adventure())
    expect((await reservePracticeTurn(input(id))).status).toBe('quota')
    const short = randomUUID()
    await createPractice(uid, short, 'adventure', null, adventure('aoi-1', 3))
    expect((await reservePracticeTurn(input(short))).status).toBe('ready')
  })
  it('有効期限のある共通枠を先に使い、不足分を対象人物のパック枠へ配分する', async () => {
    await routePurchase()
    await db.insert(schema.practices).values(
      Array.from({ length: 9 }, () => ({
        id: randomUUID(),
        uid,
        sceneId: 'cafe' as const,
        chargedAt: new Date()
      }))
    )
    const id = randomUUID()
    await createPractice(uid, id, 'adventure', null, adventure())
    await submitPracticeMessage(input(id), null)
    const spends = await db
      .select()
      .from(schema.creditSpends)
      .where(eq(schema.creditSpends.practiceId, id))
    expect(spends.map((s) => s.units)).toEqual([1, 1])
    expect((await getBillingOverview(uid)).credits.find((g) => g.kind === 'route')?.remaining).toBe(
      23
    )
    const yu = randomUUID()
    await createPractice(uid, yu, 'adventure', null, {
      ...adventure(),
      characterId: 'yu',
      episodeId: 'yu-1'
    })
    expect((await reservePracticeTurn(input(yu))).status).toBe('quota')
  })
  it('失敗した予約を解除し、期限切れ後の古い保存・解除で新しい予約を壊さない', async () => {
    const id = randomUUID()
    await createPractice(uid, id, 'adventure', null, adventure())
    const first = input(id)
    const old = await reservePracticeTurn(first, new Date('2026-11-08T12:00:00Z'))
    if (old.status !== 'ready') throw Error('reservation')
    const fresh = await reservePracticeTurn(first, new Date('2026-11-08T12:02:00Z'))
    if (fresh.status !== 'ready') throw Error('reservation')
    expect(
      await finishPracticeTurn(
        first,
        old.token,
        { reply: '古い返答', feedback: null },
        new Date('2026-11-08T12:02:01Z')
      )
    ).toBe(false)
    await releasePracticeTurn(first, old.token)
    expect(
      await finishPracticeTurn(
        first,
        fresh.token,
        { reply: '新しい返答', feedback: null },
        new Date('2026-11-08T12:02:02Z')
      )
    ).toBe(true)
    expect((await getPracticeOverview(uid, new Date('2026-11-08T12:02:03Z'))).remaining).toBe(8)
  })
  it('本音編の再練習はその話の開始時点へ戻り、進行・結末・将来の記憶を変えない', async () => {
    await routePurchase()
    const original = await seedStory()
    const selectedBefore = (await getAdventureProgress(uid)).endings?.find(
      (e) => e.selected
    )?.practiceId
    const id = randomUUID()
    expect(
      await createPractice(uid, id, 'adventure', null, { ...adventure('aoi-7', 3), revisit: true })
    ).toBe(true)
    const session = await getPractice(uid, id)
    expect(session?.storyContext).toMatchObject({
      chapter: 7,
      revisit: true,
      relationship: '交際前の二人'
    })
    expect(session?.storyContext?.memories).toEqual([])
    for (let i = 0; i < 3; i++) await submitPracticeMessage(input(id, i), null)
    expect((await getAdventureProgress(uid)).endings?.find((e) => e.selected)?.practiceId).toBe(
      selectedBefore
    )
    expect((await getPractice(uid, original[6]))?.turns[0].userText).toBe('第7話の気持ちです。')
    const daily = randomUUID()
    await handleStripeEvent(event('invoice.paid', invoice))
    expect(await createPractice(uid, daily, 'adventure', null, adventure('daily-today', 3))).toBe(
      true
    )
    expect((await getPractice(uid, daily))?.storyContext?.relationship).toContain('交際を始めた')
  })
  it('読了済みの話は直接POSTでも再練習になり、同じ作成IDの再送も成功する', async () => {
    await routePurchase()
    await seedStory('aoi', 9)
    const id = randomUUID(),
      selection = adventure('aoi-7', 3)
    expect(await createPractice(uid, id, 'adventure', null, selection)).toBe(true)
    expect((await getPractice(uid, id))?.adventure?.revisit).toBe(true)
    expect(await createPractice(uid, id, 'adventure', null, selection)).toBe(true)
  })
  it('購入権・前話の完了を検査し、未読のパート再練習を拒否する', async () => {
    await seedStory('aoi', 3)
    expect(await createPractice(uid, randomUUID(), 'adventure', null, adventure('aoi-4', 3))).toBe(
      'purchase'
    )
    await routePurchase()
    expect(await createPractice(uid, randomUUID(), 'adventure', null, adventure('aoi-4', 3))).toBe(
      true
    )
    expect(
      await createPractice(uid, randomUUID(), 'adventure', null, {
        ...adventure('aoi-7', 3),
        revisit: true
      })
    ).toBe('locked')
  })
  it('日常交流はPlusと本編の結末を要求し、選択した別エンドを次の交流へ引き継ぐ', async () => {
    await routePurchase()
    const originals = await seedStory()
    expect(
      await createPractice(uid, randomUUID(), 'adventure', null, adventure('daily-today', 3))
    ).toBe('plus')
    const id = randomUUID()
    await db.insert(schema.practices).values({
      id,
      uid,
      sceneId: 'adventure',
      adventure: { ...adventure('aoi-12', 3), revisit: true },
      completedAt: new Date(),
      reward: { version: 1, xp: 20, mission: null },
      storyEnding: {
        kind: 'slow',
        reason: '時間をかけて知り合う',
        evidence: [{ turn: 1, quote: 'ゆっくり知り合いたいです。' }]
      }
    })
    expect(await selectStoryEnding(other, id)).toBe(false)
    expect(await selectStoryEnding(uid, id)).toBe(true)
    await handleStripeEvent(event('invoice.paid', invoice))
    const daily = randomUUID()
    expect(await createPractice(uid, daily, 'adventure', null, adventure('daily-today', 3))).toBe(
      true
    )
    expect((await getPractice(uid, daily))?.storyContext?.relationship).toContain(
      '交際を確定していない'
    )
    expect((await getPractice(uid, originals[11]))?.storyEnding?.kind).toBe('lovers')
  })
})
describe('決済APIの境界', () => {
  it('購入・契約・状態同期・結末選択は本人認証を必須とする', async () => {
    const billing = await import('../../routes/api/me/billing/+server')
    const checkout = await import('../../routes/api/me/billing/checkout/+server')
    const portal = await import('../../routes/api/me/billing/portal/+server')
    const ending = await import('../../routes/api/me/practices/[id]/ending/+server')
    const e = {
      request: new Request('https://example.test/api', { method: 'POST', body: '{}' }),
      params: { id: randomUUID() }
    }
    for (const handler of [billing.GET, checkout.POST, portal.POST, ending.POST])
      await expect(handler(e as never)).rejects.toMatchObject({ status: 401 })
  })
  it('署名のない・改ざんしたWebhookを拒否し、有効な署名のテスト通知だけを処理する', async () => {
    const webhook = await import('../../routes/api/webhooks/stripe/+server')
    const object = { id: 'ignored-fixture', object: 'customer', livemode: false },
      body = JSON.stringify(event('customer.created', object))
    await expect(
      webhook.POST({
        request: new Request('https://example.test/api', { method: 'POST', body })
      } as never)
    ).rejects.toMatchObject({ status: 400 })
    const signature = sdk.webhooks.generateTestHeaderString({
      payload: body,
      secret: 'whsec_fixture'
    })
    await expect(
      webhook.POST({
        request: new Request('https://example.test/api', {
          method: 'POST',
          body: body + ' ',
          headers: { 'stripe-signature': signature }
        })
      } as never)
    ).rejects.toMatchObject({ status: 400 })
    const response = await webhook.POST({
      request: new Request('https://example.test/api', {
        method: 'POST',
        body,
        headers: { 'stripe-signature': signature }
      })
    } as never)
    expect(response.status).toBe(200)
  })
})
