import { adminPracticeAccess } from '$lib/server/practice-access'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { getAdventureProgress } from '$lib/server/db/repositories/adventures'
import { privateJson } from '$lib/server/practice-request'
export const GET: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await getAdventureProgress(actor.uid, adminPracticeAccess(actor)))
}
