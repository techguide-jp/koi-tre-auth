import { authenticatedFetch } from './stores'
import type { BillingProduct } from './billing'
export async function checkoutProduct(product: BillingProduct, requestId: string) {
  const response = await authenticatedFetch('/api/me/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ ...product, requestId })
  })
  return (await response.json()) as { id: string; url?: string; pending?: boolean }
}
export async function billingPortal() {
  const response = await authenticatedFetch('/api/me/billing/portal', {
    method: 'POST',
    body: '{}'
  })
  return (await response.json()) as { url: string }
}
