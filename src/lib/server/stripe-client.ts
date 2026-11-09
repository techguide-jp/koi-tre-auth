import Stripe from 'stripe'
import { characters } from '$lib/adventure-catalog'
import { productKey, type BillingProduct } from '$lib/billing'

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  // 今回はテスト決済までの承認。本番用の鍵で課金を開始する経路は開かない。
  if (!key?.startsWith('sk_test_') || process.env.VERCEL_ENV === 'production')
    throw new Error('Stripe test configuration is required')
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
    !!process.env.STRIPE_WEBHOOK_SECRET &&
    !!process.env.STRIPE_PORTAL_CONFIGURATION_ID &&
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') === true &&
    process.env.VERCEL_ENV !== 'production' &&
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
