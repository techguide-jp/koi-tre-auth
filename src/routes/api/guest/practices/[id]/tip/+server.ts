import { error } from '@sveltejs/kit'
import { offerGuestTip, saveGuestTipRating } from '$lib/server/db/repositories/guest-practices'
import { requireGuestOrigin, requireGuestSession } from '$lib/server/guest-request'
import { privateJson, readPracticeBody, validId } from '$lib/server/practice-request'
import { readTipRating } from '$lib/server/practice-tip-request'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async (event) => {
  requireGuestOrigin(event)
  const session = await requireGuestSession(event)
  const body = await readPracticeBody(event.request)
  if (!validId(event.params.id) || !validId(body.requestId))
    throw error(400, '送信した返答を確認してください。')
  return privateJson(await offerGuestTip(session.id, event.params.id, body.requestId))
}

export const PATCH: RequestHandler = async (event) => {
  requireGuestOrigin(event)
  const session = await requireGuestSession(event)
  if (!validId(event.params.id)) throw error(404, '体験の会話が見つかりません。')
  const { value, revision } = await readTipRating(event.request)
  return privateJson(await saveGuestTipRating(session.id, event.params.id, value, revision))
}
