import { stripeReady, stripeTestMode } from '$lib/server/stripe-client'
export function load() {
  return { billingReady: stripeReady(), billingTestMode: stripeTestMode() }
}
