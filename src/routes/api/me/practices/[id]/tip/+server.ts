import { error } from '@sveltejs/kit'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson, readPracticeBody, validId } from '$lib/server/practice-request'
import { offerPracticeTip } from '$lib/server/db/repositories/practice-tips'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  const body = await readPracticeBody(request)
  if (!validId(params.id) || !validId(body.requestId))
    throw error(400, '送信した返答を確認してください。')
  return privateJson(await offerPracticeTip(actor.uid, params.id, body.requestId))
}
