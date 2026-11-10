import { adminPracticeAccess, practiceForActor } from '$lib/server/practice-access'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { claimGuestPractice } from '$lib/server/guest-practice-service'
import { requireGuestOrigin, requireGuestSession } from '$lib/server/guest-request'
import { privateJson, validId } from '$lib/server/practice-request'
import { findUserByFirebaseUid, upsertUser } from '$lib/server/db/repositories/users'

export const POST: RequestHandler = async (event) => {
  requireGuestOrigin(event)
  const actor = await requireFirebaseUser(event.request)
  const session = await requireGuestSession(event)
  if (!validId(event.params.id)) throw error(404, '体験の会話が見つかりません。')
  if (!(await findUserByFirebaseUid(actor.uid)))
    await upsertUser({
      firebaseUid: actor.uid,
      email: actor.email ?? null,
      displayName: actor.name ?? null,
      photoUrl: actor.picture ?? null
    })
  const result = await claimGuestPractice(
    session.id,
    event.params.id,
    actor.uid,
    adminPracticeAccess(actor)
  )
  return privateJson(practiceForActor(result.session, actor), result.pending ? 202 : 200)
}
