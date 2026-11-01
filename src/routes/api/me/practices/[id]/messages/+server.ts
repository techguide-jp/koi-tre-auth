import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { readAnalyticsContext } from '$lib/analytics-context'
import { MAX_MESSAGE_LENGTH, PRACTICE_TURNS } from '$lib/practice'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { submitPracticeMessage } from '$lib/server/practice-service'
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
    !Number.isInteger(body.expectedTurn) ||
    Number(body.expectedTurn) < 0 ||
    Number(body.expectedTurn) >= PRACTICE_TURNS
  )
    throw error(400, '1〜1000文字で返答を入力してください。')
  const result = await submitPracticeMessage(
    {
      uid: actor.uid,
      id: params.id,
      requestId: body.requestId,
      text: body.text.trim(),
      expectedTurn: Number(body.expectedTurn)
    },
    readAnalyticsContext(body.analyticsContext)
  )
  return privateJson(result.session, result.pending ? 202 : 200)
}
