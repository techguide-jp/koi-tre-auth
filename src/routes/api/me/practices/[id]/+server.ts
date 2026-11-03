import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { getPractice } from '$lib/server/db/repositories/practices'
import { privateJson, validId } from '$lib/server/practice-request'

export const GET: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  if (!validId(params.id)) throw error(404, '練習が見つかりません。')
  const session = await getPractice(actor.uid, params.id)
  if (!session) throw error(404, '練習が見つかりません。')
  return privateJson(session)
}
