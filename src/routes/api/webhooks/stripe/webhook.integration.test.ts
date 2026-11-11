import Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleStripeEvent } from '$lib/server/billing-service'
import { POST } from './+server'

vi.mock('$lib/server/billing-service', () => ({ handleStripeEvent: vi.fn() }))

const secret = 'whsec_fixture'
function notification(type: string, livemode: boolean) {
  return { id: 'evt_fixture', object: 'event', livemode, type, data: { object: {} } }
}

function post(body: string, signature?: string) {
  const request = new Request('https://example.test/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature } : undefined
  })
  return POST({ request } as Parameters<typeof POST>[0])
}

function sign(payload: string, signingSecret = secret) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret })
}

describe('Stripe Webhookの環境分離', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('BILLING_ENABLED', 'false')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    vi.stubEnv('STRIPE_SECRET_KEY', undefined)
    vi.mocked(handleStripeEvent).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('購入停止中も署名付きの本番商品更新を受信する', async () => {
    const body = JSON.stringify(notification('product.updated', true))
    const response = await post(body, sign(body))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(handleStripeEvent).not.toHaveBeenCalled()
  })

  it('本番の決済通知を再送対象にし、決済処理を呼ばない', async () => {
    const body = JSON.stringify(notification('checkout.session.completed', true))
    await expect(post(body, sign(body))).rejects.toMatchObject({ status: 503 })
    expect(handleStripeEvent).not.toHaveBeenCalled()
  })

  it('設定前の本番通知を再送対象にする', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', undefined)
    const body = JSON.stringify(notification('product.updated', true))
    await expect(post(body, sign(body))).rejects.toMatchObject({ status: 503 })
  })

  it('署名なし・異なる配信先・改ざん済みの通知を拒否する', async () => {
    const body = JSON.stringify(notification('product.updated', true))
    await expect(post(body)).rejects.toMatchObject({ status: 400 })
    await expect(post(body, sign(body, 'whsec_other_fixture'))).rejects.toMatchObject({
      status: 400
    })
    await expect(post(body + ' ', sign(body))).rejects.toMatchObject({ status: 400 })
  })

  it('本番ではテスト通知を拒否する', async () => {
    const body = JSON.stringify(notification('product.updated', false))
    await expect(post(body, sign(body))).rejects.toMatchObject({ status: 400 })
  })

  it('上限を超える通知を拒否する', async () => {
    const body = 'x'.repeat(512_001)
    await expect(post(body, sign(body))).rejects.toMatchObject({ status: 413 })
  })

  it('分離環境では有効化したテスト通知だけを決済処理に渡す', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const testEvent = notification('checkout.session.completed', false)
    const body = JSON.stringify(testEvent)
    await expect(post(body, sign(body))).rejects.toMatchObject({ status: 503 })
    vi.stubEnv('BILLING_ENABLED', 'true')
    const liveBody = JSON.stringify(notification('checkout.session.completed', true))
    await expect(post(liveBody, sign(liveBody))).rejects.toMatchObject({ status: 400 })
    expect((await post(body, sign(body))).status).toBe(200)
    expect(handleStripeEvent).toHaveBeenCalledTimes(1)
    expect(handleStripeEvent).toHaveBeenCalledWith(testEvent)
  })
})
