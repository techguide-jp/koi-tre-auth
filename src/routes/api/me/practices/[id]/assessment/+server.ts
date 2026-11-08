import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson, requirePracticeAvailable, validId } from '$lib/server/practice-request'
import { reassessPractice } from '$lib/server/practice-assessment-service'

export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  requirePracticeAvailable()
  if (!validId(params.id)) throw error(400, '練習を選び直してください。')
  const result = await reassessPractice(actor.uid, params.id)
  return privateJson(result.session, result.pending ? 202 : 200)
}
