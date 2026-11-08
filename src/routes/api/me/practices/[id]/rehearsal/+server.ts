import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { MAX_MESSAGE_LENGTH } from '$lib/practice'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { submitRehearsal } from '$lib/server/practice-service'
import {
  privateJson,
  readPracticeBody,
  requirePracticeAvailable,
  validId
} from '$lib/server/practice-request'
export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  requirePracticeAvailable()
  const body = await readPracticeBody(request)
  if (
    !validId(params.id) ||
    !validId(body.requestId) ||
    typeof body.text !== 'string' ||
    !body.text.trim() ||
    body.text.length > MAX_MESSAGE_LENGTH ||
    typeof body.position !== 'number' ||
    !Number.isInteger(body.position) ||
    body.position < 1 ||
    body.position > 6
  )
    throw error(400, '言い直す返答と1〜1000文字の内容を確認してください。')
  const result = await submitRehearsal({
    uid: actor.uid,
    id: params.id,
    requestId: body.requestId,
    text: body.text.trim(),
    position: body.position,
    expectedTurn: body.position - 1
  })
  return privateJson(result.session, result.pending ? 202 : 200)
}
