import { stripeReady } from '$lib/server/stripe-client'
export function load() {
  return { billingReady: stripeReady(), billingTestMode: stripeReady() }
}
