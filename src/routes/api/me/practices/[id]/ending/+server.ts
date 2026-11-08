import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson, validId } from '$lib/server/practice-request'
import { selectStoryEnding } from '$lib/server/db/repositories/adventures'
export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  if (!validId(params.id) || !(await selectStoryEnding(actor.uid, params.id)))
    throw error(404, '引き継ぐ結末が見つかりません。')
  return privateJson({ selected: true })
}
