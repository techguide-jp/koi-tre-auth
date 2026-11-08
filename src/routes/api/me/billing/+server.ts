import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson } from '$lib/server/practice-request'
import { getBillingOverview } from '$lib/server/db/repositories/credits'
export const GET: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await getBillingOverview(actor.uid))
}
