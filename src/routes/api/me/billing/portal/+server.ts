import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson } from '$lib/server/practice-request'
import { openBillingPortal } from '$lib/server/billing-service'
export const POST: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await openBillingPortal(actor.uid))
}
