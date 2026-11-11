import Stripe from 'stripe'
import { characters } from '$lib/adventure-catalog'
import { productKey, type BillingProduct } from '$lib/billing'

export const stripeTestMode = () => process.env.VERCEL_ENV !== 'production'

function stripeBillingKey() {
  if (stripeTestMode()) {
    const key = process.env.STRIPE_SECRET_KEY
    return key?.startsWith('sk_test_') ? key : null
  }
  const key = process.env.STRIPE_LIVE_BILLING_API_KEY
  return key?.startsWith('rk_live_') ? key : null
}

export function stripeClient() {
  const key = stripeBillingKey()
  if (!key) throw new Error('Stripe billing configuration is required')
  return new Stripe(key, { timeout: 12_000, maxNetworkRetries: 1, appInfo: { name: 'Koi-Tre' } })
}

function liveStripeWebhookKey() {
  const key = process.env.STRIPE_LIVE_WEBHOOK_API_KEY
  // 新規購入を止めている間も、既存の契約・返金を照合できるようにする。
  if (
    stripeTestMode() ||
    process.env.STRIPE_LIVE_WEBHOOK_ENABLED !== 'true' ||
    !key?.startsWith('rk_live_')
  )
    return null
  return key
}

export function liveStripeWebhookClient() {
  const key = liveStripeWebhookKey()
  if (!key) return null
  return new Stripe(key, { timeout: 12_000, maxNetworkRetries: 1, appInfo: { name: 'Koi-Tre' } })
}

export function stripePrice(product: BillingProduct) {
  const variable =
    product.kind === 'plus'
      ? 'STRIPE_PRICE_PLUS'
      : product.kind === 'topup'
        ? 'STRIPE_PRICE_TOPUP'
        : `STRIPE_PRICE_ROUTE_${product.characterId.toUpperCase()}`
  const id = process.env[variable]
  if (!id?.startsWith('price_')) throw new Error('Stripe price is not configured')
  return id
}
export function stripeReady() {
  return (
    process.env.BILLING_ENABLED === 'true' &&
    !!stripeBillingKey() &&
    process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') === true &&
    process.env.STRIPE_PORTAL_CONFIGURATION_ID?.startsWith('bpc_') === true &&
    (stripeTestMode() || !!liveStripeWebhookKey()) &&
    [
      { kind: 'plus' } as const,
      { kind: 'topup' } as const,
      ...characters.map((c) => ({ kind: 'route' as const, characterId: c.id }))
    ].every((p) => {
      try {
        stripePrice(p)
        return true
      } catch {
        return false
      }
    })
  )
}

export function stripePortalReady() {
  if (stripeTestMode()) return stripeReady()
  // 販売を止めた後も、既存の契約者は解約や支払い方法の変更を行える。
  return (
    !!stripeBillingKey() && process.env.STRIPE_PORTAL_CONFIGURATION_ID?.startsWith('bpc_') === true
  )
}

export function billingBaseUrl() {
  const url = new URL(process.env.VITE_APP_DOMAIN ?? 'https://app.koi-tre.com')
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
  )
    throw new Error('Invalid billing origin')
  return url.origin
}
export const stripeReference = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : value?.id
export const stripeMetadata = (uid: string, id: string, product: BillingProduct) => ({
  app: 'koi-tre',
  uid,
  checkout_id: id,
  product: productKey(product)
})
