import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { privateJson, validId } from '$lib/server/practice-request'
import { reconcileCheckout } from '$lib/server/billing-service'
export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireFirebaseUser(request)
  if (!validId(params.id)) throw error(400, '購入状態を確認してください。')
  return privateJson(await reconcileCheckout(actor.uid, params.id))
}
