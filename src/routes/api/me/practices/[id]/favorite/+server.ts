import { practiceForActor } from '$lib/server/practice-access'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { saveFavoriteTurn } from '$lib/server/db/repositories/adventures'
import { getPractice } from '$lib/server/db/repositories/practices'
import { privateJson, readPracticeBody, validId } from '$lib/server/practice-request'
export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  const body = await readPracticeBody(request)
  const position = body.position
  if (
    !validId(params.id) ||
    !(
      position === null ||
      (typeof position === 'number' && Number.isInteger(position) && position >= 1 && position <= 6)
    )
  )
    throw error(400, '保存する発言を選んでください。')
  if (!(await saveFavoriteTurn(actor.uid, params.id, position)))
    throw error(404, '保存できる会話が見つかりません。')
  return privateJson(practiceForActor(await getPractice(actor.uid, params.id), actor))
}
