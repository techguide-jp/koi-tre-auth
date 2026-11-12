import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson } from '$lib/server/practice-request'
import { readTipRating, requireTipId } from '$lib/server/practice-tip-request'
import { listTipRatings, saveTipRating } from '$lib/server/db/repositories/practice-tips'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await listTipRatings(actor.uid, requireTipId(params.tipId)))
}

export const PATCH: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  const tipId = requireTipId(params.tipId)
  const { value, revision } = await readTipRating(request)
  return privateJson(await saveTipRating(actor.uid, tipId, value, revision))
}
