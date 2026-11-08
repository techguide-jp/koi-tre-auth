import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { stripeClient } from '$lib/server/stripe-client'
import { handleStripeEvent } from '$lib/server/billing-service'
export const POST: RequestHandler = async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || process.env.BILLING_ENABLED !== 'true' || process.env.VERCEL_ENV === 'production')
    throw error(503, 'Billing is not enabled')
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
  let event
  try {
    event = stripeClient().webhooks.constructEvent(Buffer.concat(chunks), signature, secret)
  } catch {
    throw error(400, 'Invalid webhook signature')
  }
  try {
    await handleStripeEvent(event)
  } catch {
    console.warn('決済通知を処理できませんでした。再送を待ちます。')
    throw error(500, 'Webhook processing failed')
  }
  return json({ received: true })
}
