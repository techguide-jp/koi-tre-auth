import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { billingProduct } from '$lib/billing'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson, readPracticeBody, validId } from '$lib/server/practice-request'
import { beginCheckout } from '$lib/server/billing-service'
import { findUserByFirebaseUid, upsertUser } from '$lib/server/db/repositories/users'
export const POST: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request),
    body = await readPracticeBody(request),
    product = billingProduct(body)
  if (!product || !validId(body.requestId)) throw error(400, '購入するプランを確認してください。')
  if (!(await findUserByFirebaseUid(actor.uid)))
    await upsertUser({
      firebaseUid: actor.uid,
      email: actor.email ?? null,
      displayName: actor.name ?? null,
      photoUrl: actor.picture ?? null
    })
  const result = await beginCheckout(actor.uid, body.requestId, product)
  return privateJson(result, 'pending' in result ? 202 : 200)
}
