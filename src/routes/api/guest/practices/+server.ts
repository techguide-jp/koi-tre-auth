import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { guestAdventure } from '$lib/guest-practice'
import { createGuestPractice } from '$lib/server/db/repositories/guest-practices'
import {
  guestRateContext,
  newGuestSession,
  readGuestSession,
  requireGuestOrigin,
  setGuestCookie
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
  const body = await readPracticeBody(event.request)
  const adventure = guestAdventure(body.adventure)
  if (!validId(body.id) || !adventure || body.sceneId !== 'adventure')
    throw error(400, 'ログインせず体験できるのは、各人物の第1話・3往復です。')
  const current = await readGuestSession(event)
  const fresh = current ? null : newGuestSession()
  const session = await createGuestPractice(
    current ?? fresh!,
    body.id,
    adventure,
    guestRateContext(event.getClientAddress())
  )
  if (fresh) setGuestCookie(event, fresh.token)
  return privateJson(session)
}
