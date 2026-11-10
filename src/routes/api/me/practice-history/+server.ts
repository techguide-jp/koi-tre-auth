import { adminPracticeAccess } from '$lib/server/practice-access'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson } from '$lib/server/practice-request'
import { getPracticeHistory } from '$lib/server/db/repositories/practice-history'
export const GET: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await getPracticeHistory(actor.uid, adminPracticeAccess(actor)))
}
