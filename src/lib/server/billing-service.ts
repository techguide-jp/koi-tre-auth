import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type Stripe from 'stripe'
import {
  billingProduct,
  PLUS_CREDITS,
  PLUS_PRICE,
  productKey,
  productPrice,
  ROUTE_CREDITS,
  TOPUP_CREDITS,
  type BillingProduct
} from '$lib/billing'
import { getDb } from './db/client'
import {
  billingCheckouts,
  billingCustomers,
  billingEvents,
  billingPaymentStates,
  billingSubscriptions,
  creditGrants,
  routePurchases,
  users
} from './db/schema'
import { readCreditState, type CreditDb } from './db/repositories/credits'
import {
  billingBaseUrl,
  stripeClient,
  stripeMetadata,
  stripePrice,
  stripeReady,
  stripeReference
} from './stripe-client'

async function lockUser(db: CreditDb, uid: string) {
  const rows = await db.select().from(users).where(eq(users.firebaseUid, uid)).for('update')
  if (!rows.length) throw error(404, 'アカウントが見つかりません。ログインし直してください。')
}
export async function beginCheckout(uid: string, id: string, product: BillingProduct) {
  if (!stripeReady())
    throw error(503, '購入は準備中です。現在の練習と保存済みの内容は引き続き利用できます。')
  const key = productKey(product),
    now = new Date()
  const reservation = await getDb().transaction(async (tx) => {
    await lockUser(tx, uid)
    const state = await readCreditState(tx, uid, now)
    if (product.kind === 'route' && state.ownedCharacters.includes(product.characterId))
      throw error(409, 'このルートパックは購入済みです。')
    if (product.kind === 'plus') {
      const existing = await tx
        .select()
        .from(billingSubscriptions)
        .where(and(eq(billingSubscriptions.uid, uid), gt(billingSubscriptions.periodEnd, now)))
      if (existing.some((s) => !['canceled', 'incomplete_expired'].includes(s.status)))
        throw error(409, '契約があります。「契約を管理する」からご確認ください。')
    }
    const same = await tx.query.billingCheckouts.findFirst({ where: eq(billingCheckouts.id, id) })
    if (same && (same.uid !== uid || same.product !== key))
      throw error(409, '購入内容を確認して、もう一度お試しください。')
    if (
      same &&
      ((same.requestParams?.expires_at && same.requestParams.expires_at * 1000 <= now.getTime()) ||
        (!same.requestParams &&
          !same.stripeSessionId &&
          (same.status === 'failed' || same.expiresAt <= now)))
    )
      throw error(409, '購入画面の有効期限が切れました。ページを再読み込みして開き直してください。')
    const [open] = await tx
      .select()
      .from(billingCheckouts)
      .where(
        and(
          eq(billingCheckouts.uid, uid),
          eq(billingCheckouts.product, key),
          gt(billingCheckouts.expiresAt, now)
        )
      )
      .orderBy(desc(billingCheckouts.createdAt))
      .limit(1)
    if (open?.status === 'open' && open.url) return { id: open.id, url: open.url }
    if (open?.status === 'creating') return { id: open.id, pending: true }
    await tx
      .insert(billingCheckouts)
      .values({
        id,
        uid,
        product: key,
        status: 'creating',
        expiresAt: new Date(now.getTime() + 90_000)
      })
      .onConflictDoUpdate({
        target: billingCheckouts.id,
        set: { status: 'creating', expiresAt: new Date(now.getTime() + 90_000) }
      })
    return { id, requestParams: same?.requestParams ?? null }
  })
  if ('url' in reservation || 'pending' in reservation) return reservation
  const stripe = stripeClient()
  try {
    let params = reservation.requestParams
    if (!params) {
      const price = await stripe.prices.retrieve(stripePrice(product))
      if (
        price.currency !== 'jpy' ||
        price.unit_amount !== productPrice(product) ||
        !price.active ||
        (product.kind === 'plus'
          ? price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1
          : price.type !== 'one_time')
      )
        throw Error('Configured price mismatch')
      let account = await getDb().query.billingCustomers.findFirst({
        where: eq(billingCustomers.uid, uid)
      })
      if (!account) {
        const customer = await stripe.customers.create(
          { metadata: { app: 'koi-tre', uid } },
          { idempotencyKey: `koi-tre:customer:${uid}` }
        )
        await getDb()
          .insert(billingCustomers)
          .values({ uid, stripeCustomerId: customer.id })
          .onConflictDoNothing()
        account = await getDb().query.billingCustomers.findFirst({
          where: eq(billingCustomers.uid, uid)
        })
      }
      if (!account) throw Error('Customer association failed')
      const metadata = stripeMetadata(uid, id, product),
        base = billingBaseUrl()
      const requestParams: Stripe.Checkout.SessionCreateParams = {
        mode: product.kind === 'plus' ? 'subscription' : 'payment',
        customer: account.stripeCustomerId,
        client_reference_id: uid,
        metadata,
        line_items: [{ price: stripePrice(product), quantity: 1 }],
        allowed_payment_method_types: ['card'],
        success_url: `${base}/account?checkout=${id}`,
        cancel_url: `${base}/pricing?cancelled=1`,
        locale: 'ja',
        adaptive_pricing: { enabled: false },
        automatic_tax: { enabled: false },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        ...(product.kind === 'plus'
          ? { subscription_data: { metadata } }
          : { payment_intent_data: { metadata } })
      }
      // 同じStripeキーでは価格・戻り先・期限も同じ値が必要。応答喪失や保存失敗でも消さない。
      params = await getDb().transaction(async (tx) => {
        await lockUser(tx, uid)
        const order = await tx.query.billingCheckouts.findFirst({
          where: and(eq(billingCheckouts.id, id), eq(billingCheckouts.uid, uid))
        })
        if (!order) throw Error('Checkout reservation missing')
        if (order.requestParams) return order.requestParams
        await tx.update(billingCheckouts).set({ requestParams }).where(eq(billingCheckouts.id, id))
        return requestParams
      })
    }
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `koi-tre:checkout:${id}`
    })
    if (!session.url || !session.url.startsWith('https://checkout.stripe.com/'))
      throw Error('Checkout URL unavailable')
    await getDb()
      .update(billingCheckouts)
      .set({
        stripeSessionId: session.id,
        url: session.url,
        status: 'open',
        expiresAt: new Date(session.expires_at * 1000)
      })
      .where(and(eq(billingCheckouts.id, id), eq(billingCheckouts.uid, uid)))
    return { id, url: session.url }
  } catch {
    await getDb()
      .update(billingCheckouts)
      .set({ status: 'failed', expiresAt: new Date() })
      .where(
        and(
          eq(billingCheckouts.id, id),
          eq(billingCheckouts.uid, uid),
          eq(billingCheckouts.status, 'creating')
        )
      )
    throw error(
      502,
      '購入画面を準備できませんでした。課金状態を確認してから、同じ内容でもう一度お試しください。'
    )
  }
}
export async function openBillingPortal(uid: string) {
  if (!stripeReady()) throw error(503, '契約管理は準備中です。')
  const account = await getDb().query.billingCustomers.findFirst({
    where: eq(billingCustomers.uid, uid)
  })
  if (!account) throw error(404, '管理する契約がありません。')
  const session = await stripeClient().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${billingBaseUrl()}/account`,
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID
  })
  if (!session.url.startsWith('https://billing.stripe.com/'))
    throw error(502, '契約管理を開けませんでした。')
  return { url: session.url }
}
function assertTest(object: { livemode: boolean }) {
  if (object.livemode) throw Error('Live billing is not enabled')
}
async function verifyCustomer(db: CreditDb, uid: string, customerId: string | undefined) {
  const account = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.uid, uid)
  })
  if (!account || account.stripeCustomerId !== customerId) throw Error('Customer mismatch')
}
async function paymentRevokedAt(db: CreditDb, uid: string, intents: string[]) {
  if (!intents.length) throw Error('Payment intent missing')
  const states = await db
    .select()
    .from(billingPaymentStates)
    .where(inArray(billingPaymentStates.paymentIntentId, intents))
  if (states.some((state) => state.uid !== uid)) throw Error('Payment owner mismatch')
  return states.find((state) => state.revokedAt)?.revokedAt ?? null
}
async function fulfillPayment(db: CreditDb, stripe: Stripe, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] })
  assertTest(session)
  const uid = session.metadata?.uid,
    orderId = session.metadata?.checkout_id
  if (session.metadata?.app !== 'koi-tre' || !uid || !orderId) return
  const order = await db.query.billingCheckouts.findFirst({
    where: eq(billingCheckouts.id, orderId)
  })
  if (
    !order ||
    order.uid !== uid ||
    order.stripeSessionId !== session.id ||
    order.product !== session.metadata.product
  )
    throw Error('Checkout association mismatch')
  const product = billingProduct(
    order.product === 'topup'
      ? { kind: 'topup' }
      : { kind: 'route', characterId: order.product.split(':')[1] }
  )
  if (!product || product.kind === 'plus') return
  if (session.status !== 'complete' || session.payment_status !== 'paid') return
  await verifyCustomer(db, uid, stripeReference(session.customer))
  const lines = session.line_items?.data ?? []
  if (
    session.mode !== 'payment' ||
    session.currency !== 'jpy' ||
    session.amount_total !== productPrice(product) ||
    lines.length !== 1 ||
    stripeReference(lines[0].price) !==
      (order.requestParams?.line_items?.[0]?.price ?? stripePrice(product)) ||
    lines[0].quantity !== 1
  )
    throw Error('Payment amount mismatch')
  // 返金通知が購入完了通知より先でも、支払い単位の失効を購入権と枠へ引き継ぐ。
  const paymentIntentId = stripeReference(session.payment_intent),
    revokedAt = await paymentRevokedAt(db, uid, paymentIntentId ? [paymentIntentId] : [])
  if (product.kind === 'topup') {
    // PaymentIntentに対応させ、再照合と通知の重複でも15枠を二重付与しない。
    await db
      .insert(creditGrants)
      .values({
        id: `topup:${paymentIntentId}`,
        uid,
        kind: 'topup',
        units: TOPUP_CREDITS,
        startsAt: new Date(session.created * 1000),
        revokedAt
      })
      .onConflictDoNothing()
    await db
      .update(billingCheckouts)
      .set({ status: 'completed' })
      .where(eq(billingCheckouts.id, order.id))
    return
  }
  const prior = await db
    .select()
    .from(routePurchases)
    .where(
      and(
        eq(routePurchases.uid, uid),
        eq(routePurchases.characterId, product.characterId),
        isNull(routePurchases.revokedAt)
      )
    )
  if (!prior.length) {
    await db
      .insert(routePurchases)
      .values({
        id: session.id,
        uid,
        characterId: product.characterId,
        paymentIntentId,
        revokedAt,
        paidAt: new Date(session.created * 1000)
      })
      .onConflictDoNothing()
    await db
      .insert(creditGrants)
      .values({
        id: `route:${session.id}`,
        uid,
        kind: 'route',
        characterId: product.characterId,
        units: ROUTE_CREDITS,
        revokedAt,
        startsAt: new Date(session.created * 1000)
      })
      .onConflictDoNothing()
  }
  await db
    .update(billingCheckouts)
    .set({ status: 'completed' })
    .where(eq(billingCheckouts.id, order.id))
}
function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  if (
    !item ||
    subscription.items.data.length !== 1 ||
    item.price.id !== stripePrice({ kind: 'plus' }) ||
    item.price.unit_amount !== PLUS_PRICE ||
    item.price.currency !== 'jpy' ||
    item.price.recurring?.interval !== 'month' ||
    item.price.recurring.interval_count !== 1
  )
    throw Error('Plus product mismatch')
  return { start: item.current_period_start, end: item.current_period_end }
}
async function syncSubscription(db: CreditDb, stripe: Stripe, id: string, invoiceId?: string) {
  // 通知順には依存せず、ユーザー行をロックした後のStripe最新状態で同期する。
  const subscription = await stripe.subscriptions.retrieve(id)
  assertTest(subscription)
  const uid = subscription.metadata.uid
  if (subscription.metadata.app !== 'koi-tre' || !uid) return
  await verifyCustomer(db, uid, stripeReference(subscription.customer))
  const period = subscriptionPeriod(subscription)
  const values = {
    uid,
    status: subscription.status,
    periodStart: new Date(period.start * 1000),
    periodEnd: new Date(period.end * 1000),
    // Portalはcancel_atで期間末を指定する場合もある。
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at != null,
    updatedAt: new Date()
  }
  await db
    .insert(billingSubscriptions)
    .values({ id, ...values })
    .onConflictDoUpdate({ target: billingSubscriptions.id, set: values })
  if (['canceled', 'incomplete_expired'].includes(subscription.status)) {
    const prefix = `plus:${id}:`
    await db
      .update(creditGrants)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(creditGrants.uid, uid), sql`left(${creditGrants.id}, ${prefix.length}) = ${prefix}`)
      )
    return
  }
  const paidInvoiceId = invoiceId ?? stripeReference(subscription.latest_invoice)
  if (!paidInvoiceId) return
  const invoice = await stripe.invoices.retrieve(paidInvoiceId)
  assertTest(invoice)
  if (invoice.status !== 'paid' || invoice.amount_paid !== PLUS_PRICE || invoice.currency !== 'jpy')
    return
  if (
    stripeReference(invoice.customer) !== stripeReference(subscription.customer) ||
    stripeReference(invoice.parent?.subscription_details?.subscription) !== id
  )
    throw Error('Invoice association mismatch')
  const line = invoice.lines.data.find(
    (l) => stripeReference(l.pricing?.price_details?.price) === stripePrice({ kind: 'plus' })
  )
  if (
    !line ||
    invoice.lines.data.length !== 1 ||
    line.amount !== PLUS_PRICE ||
    line.quantity !== 1 ||
    !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '')
  )
    throw Error('Invoice product mismatch')
  const payments = await stripe.invoicePayments.list({
    invoice: invoice.id,
    status: 'paid',
    limit: 100
  })
  if (payments.has_more) throw Error('Invoice payments incomplete')
  const intents = payments.data.map((payment) => stripeReference(payment.payment.payment_intent))
  if (intents.some((intent) => !intent)) throw Error('Invoice payment type unsupported')
  const revokedAt = await paymentRevokedAt(db, uid, intents as string[])
  // 毎月の枠は支払い済み請求書の期間に一度だけ付与し、契約状態の通知だけでは増やさない。
  await db
    .insert(creditGrants)
    .values({
      id: `plus:${id}:${line.period.start}`,
      uid,
      kind: 'plus',
      units: PLUS_CREDITS,
      revokedAt,
      startsAt: new Date(line.period.start * 1000),
      expiresAt: new Date(line.period.end * 1000)
    })
    .onConflictDoNothing()
}
async function revokeCharge(
  db: CreditDb,
  stripe: Stripe,
  uid: string,
  chargeId: string,
  restore = false,
  disputed = false
) {
  const charge = await stripe.charges.retrieve(chargeId)
  assertTest(charge)
  await verifyCustomer(db, uid, stripeReference(charge.customer))
  // 紛争に勝っても、全額返金済みの購入権は復活させない。
  if (charge.amount_refunded >= charge.amount) restore = false
  else if (!restore && !disputed && !charge.disputed) return
  const intent = stripeReference(charge.payment_intent)
  if (!intent) return
  const revokedAt = restore ? null : new Date()
  // 付与対象がまだなくても保存し、通知を処理済みにした後の遅延付与を防ぐ。
  await db
    .insert(billingPaymentStates)
    .values({ paymentIntentId: intent, uid, revokedAt })
    .onConflictDoUpdate({
      target: billingPaymentStates.paymentIntentId,
      set: { revokedAt, updatedAt: new Date() }
    })
  await db
    .update(creditGrants)
    .set({ revokedAt })
    .where(
      and(
        eq(creditGrants.uid, uid),
        eq(creditGrants.kind, 'topup'),
        eq(creditGrants.id, `topup:${intent}`)
      )
    )
  const routes = await db
    .select()
    .from(routePurchases)
    .where(eq(routePurchases.paymentIntentId, intent))
  for (const route of routes) {
    await db.update(routePurchases).set({ revokedAt }).where(eq(routePurchases.id, route.id))
    await db
      .update(creditGrants)
      .set({ revokedAt })
      .where(eq(creditGrants.id, `route:${route.id}`))
  }
  const payments = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: intent },
    limit: 10
  })
  for (const payment of payments.data) {
    const invoice = await stripe.invoices.retrieve(stripeReference(payment.invoice)!)
    const subId = stripeReference(invoice.parent?.subscription_details?.subscription)
    const line = invoice.lines.data.find(
      (l) => stripeReference(l.pricing?.price_details?.price) === stripePrice({ kind: 'plus' })
    )
    if (subId && line)
      await db
        .update(creditGrants)
        .set({ revokedAt })
        .where(eq(creditGrants.id, `plus:${subId}:${line.period.start}`))
  }
}
export async function handleStripeEvent(event: Stripe.Event) {
  assertTest(event)
  const stripe = stripeClient()
  const object = event.data.object
  let customerId: string | undefined
  if ('customer' in object)
    customerId = stripeReference(object.customer as string | { id: string } | null)
  if (event.type.startsWith('charge.dispute.')) {
    const dispute = object as Stripe.Dispute
    const charge = await stripe.charges.retrieve(stripeReference(dispute.charge)!)
    customerId = stripeReference(charge.customer)
  }
  if (!customerId) return
  const account = await getDb().query.billingCustomers.findFirst({
    where: eq(billingCustomers.stripeCustomerId, customerId)
  })
  if (!account) return
  await getDb().transaction(async (tx) => {
    await lockUser(tx, account.uid)
    if (await tx.query.billingEvents.findFirst({ where: eq(billingEvents.id, event.id) })) return
    if (
      ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
        event.type
      )
    ) {
      const session = await stripe.checkout.sessions.retrieve(
        (object as Stripe.Checkout.Session).id
      )
      if (session.mode === 'payment') await fulfillPayment(tx, stripe, session.id)
      else if (session.mode === 'subscription' && stripeReference(session.subscription)) {
        await syncSubscription(tx, stripe, stripeReference(session.subscription)!)
        if (session.metadata?.checkout_id)
          await tx
            .update(billingCheckouts)
            .set({ status: 'completed' })
            .where(
              and(
                eq(billingCheckouts.id, session.metadata.checkout_id),
                eq(billingCheckouts.uid, account.uid)
              )
            )
      }
    } else if (event.type.startsWith('customer.subscription.'))
      await syncSubscription(tx, stripe, (object as Stripe.Subscription).id)
    else if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
      const invoice = await stripe.invoices.retrieve((object as Stripe.Invoice).id)
      const subId = stripeReference(invoice.parent?.subscription_details?.subscription)
      if (subId)
        await syncSubscription(
          tx,
          stripe,
          subId,
          event.type === 'invoice.paid' ? invoice.id : undefined
        )
    } else if (event.type === 'charge.refunded')
      await revokeCharge(tx, stripe, account.uid, (object as Stripe.Charge).id)
    else if (event.type === 'charge.dispute.created')
      await revokeCharge(
        tx,
        stripe,
        account.uid,
        stripeReference((object as Stripe.Dispute).charge)!,
        false,
        true
      )
    else if (event.type === 'charge.dispute.closed') {
      const dispute = await stripe.disputes.retrieve((object as Stripe.Dispute).id)
      await revokeCharge(
        tx,
        stripe,
        account.uid,
        stripeReference(dispute.charge)!,
        dispute.status === 'won',
        true
      )
    }
    await tx.insert(billingEvents).values({ id: event.id, type: event.type }).onConflictDoNothing()
  })
}
export async function reconcileCheckout(uid: string, id: string) {
  const order = await getDb().query.billingCheckouts.findFirst({
    where: and(eq(billingCheckouts.id, id), eq(billingCheckouts.uid, uid))
  })
  if (!order?.stripeSessionId) return { pending: order?.status === 'creating' }
  const session = await stripeClient().checkout.sessions.retrieve(order.stripeSessionId)
  const account = await getDb().query.billingCustomers.findFirst({
    where: eq(billingCustomers.uid, uid)
  })
  if (!account || stripeReference(session.customer) !== account.stripeCustomerId)
    throw error(403, '購入状態を確認できませんでした。')
  await getDb().transaction(async (tx) => {
    await lockUser(tx, uid)
    if (session.mode === 'payment') await fulfillPayment(tx, stripeClient(), session.id)
    else if (session.mode === 'subscription' && stripeReference(session.subscription))
      await syncSubscription(tx, stripeClient(), stripeReference(session.subscription)!)
  })
  return { pending: session.status !== 'complete' || session.payment_status !== 'paid' }
}
