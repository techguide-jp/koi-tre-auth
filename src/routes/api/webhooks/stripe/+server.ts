import { error, json } from '@sveltejs/kit'
import Stripe from 'stripe'
import type { RequestHandler } from './$types'
import { handleStripeEvent } from '$lib/server/billing-service'
export const POST: RequestHandler = async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const production = process.env.VERCEL_ENV === 'production'
  if (!secret || (!production && process.env.BILLING_ENABLED !== 'true'))
    throw error(503, 'Webhook is not configured')
  const signature = request.headers.get('stripe-signature')
  if (!signature) throw error(400, 'Webhook signature is required')
  const reader = request.body?.getReader(),
    chunks: Uint8Array[] = []
  let size = 0
  if (!reader) throw error(400, 'Webhook body is required')
  let reading = true
  while (reading) {
    const { done, value } = await reader.read()
    if (done) {
      reading = false
      continue
    }
    size += value.byteLength
    if (size > 512_000) {
      await reader.cancel()
      throw error(413, 'Webhook body is too large')
    }
    chunks.push(value)
  }
  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(Buffer.concat(chunks), signature, secret)
  } catch {
    throw error(400, 'Invalid webhook signature')
  }
  if (event?.livemode !== production) throw error(400, 'Invalid webhook mode')
  if (production) {
    // 商品更新で接続を確認する。販売開始まで決済通知は再送対象とし、処理済みにしない。
    if (event.type !== 'product.updated') throw error(503, 'Live billing processing is paused')
    return json({ received: true })
  }
  try {
    await handleStripeEvent(event)
  } catch {
    console.warn('決済通知を処理できませんでした。再送を待ちます。')
    throw error(500, 'Webhook processing failed')
  }
  return json({ received: true })
}
