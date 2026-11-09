import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getGuestPractice } from '$lib/server/db/repositories/guest-practices'
import { requireGuestSession } from '$lib/server/guest-request'
import { privateJson, validId } from '$lib/server/practice-request'

export const GET: RequestHandler = async (event) => {
  const session = await requireGuestSession(event)
  if (!validId(event.params.id)) throw error(404, '体験の会話が見つかりません。')
  return privateJson(await getGuestPractice(session.id, event.params.id))
}
