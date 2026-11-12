import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson } from '$lib/server/practice-request'
import { listCollectedTips } from '$lib/server/db/repositories/practice-tips'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await listCollectedTips(actor.uid))
}
