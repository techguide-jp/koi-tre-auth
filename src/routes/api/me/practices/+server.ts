import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { findScene, normalizeCustomScene } from '$lib/practice'
import { normalizeAdventure } from '$lib/adventure'
import { requireFirebaseUser } from '$lib/server/request-auth'
import {
  createPractice,
  getPractice,
  getPracticeOverview
} from '$lib/server/db/repositories/practices'
import { findUserByFirebaseUid, upsertUser } from '$lib/server/db/repositories/users'
import {
  privateJson,
  readPracticeBody,
  requirePracticeAvailable,
  validId
} from '$lib/server/practice-request'

export const GET: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson(await getPracticeOverview(actor.uid))
}

export const POST: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  requirePracticeAvailable()
  const body = await readPracticeBody(request)
  const scene = findScene(body.sceneId)
  const customScene = body.sceneId === 'custom' ? normalizeCustomScene(body.customScene) : null
  const adventure = body.sceneId === 'adventure' ? normalizeAdventure(body.adventure) : null
  if ((!scene && !customScene && !adventure) || !validId(body.id))
    throw error(400, '練習する場面と入力内容を確認してください。')
  if (!(await findUserByFirebaseUid(actor.uid))) {
    await upsertUser({
      firebaseUid: actor.uid,
      email: actor.email ?? null,
      displayName: actor.name ?? null,
      photoUrl: actor.picture ?? null
    })
  }
  if (
    !(await getPractice(actor.uid, body.id)) &&
    (await getPracticeOverview(actor.uid)).remaining === 0
  ) {
    throw error(429, 'この練習に使える枠が足りません。途中の練習は再開できます。')
  }
  const created = await createPractice(
    actor.uid,
    body.id,
    adventure ? 'adventure' : customScene ? 'custom' : scene!.id,
    customScene,
    adventure
  )
  if (created === 'locked') throw error(403, '前のエピソードを終えると、この話が開きます。')
  if (created === 'purchase')
    throw error(403, 'この人物のルートパックを購入すると、本編を続けられます。')
  if (created === 'plus') throw error(403, '本編クリア後の交流・イベントはPlusの対象です。')
  if (created === 'unpublished') throw error(403, 'このイベントは公開前です。')
  if (!created) throw error(409, '別の練習として開始してください。')
  return privateJson(await getPractice(actor.uid, body.id))
}
