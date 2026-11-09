import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { MAX_MESSAGE_LENGTH } from '$lib/practice'
import { submitGuestMessage } from '$lib/server/guest-practice-service'
import {
  guestRateContext,
  requireGuestOrigin,
  requireGuestSession
} from '$lib/server/guest-request'
import {
  privateJson,
  readPracticeBody,
  requirePracticeAvailable,
  validId
} from '$lib/server/practice-request'

export const POST: RequestHandler = async (event) => {
  requireGuestOrigin(event)
  requirePracticeAvailable()
  const session = await requireGuestSession(event)
  const body = await readPracticeBody(event.request)
  if (
    !validId(event.params.id) ||
    !validId(body.requestId) ||
    typeof body.text !== 'string' ||
    !body.text.trim() ||
    body.text.includes('\0') ||
    body.text.length > MAX_MESSAGE_LENGTH ||
    !Number.isInteger(body.expectedTurn) ||
    Number(body.expectedTurn) < 0 ||
    Number(body.expectedTurn) >= 3
  )
    throw error(400, '1〜1000文字で返答を入力してください。体験は3往復です。')
  const result = await submitGuestMessage(
    {
      sessionId: session.id,
      id: event.params.id,
      requestId: body.requestId,
      expectedTurn: Number(body.expectedTurn),
      text: body.text.trim()
    },
    guestRateContext(event.getClientAddress())
  )
  return privateJson(result.session, result.pending ? 202 : 200)
}
