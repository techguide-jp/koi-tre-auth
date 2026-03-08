import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createDifyAccessKey } from '$lib/server/dify-access-key'
import { requireFirebaseUser } from '$lib/server/request-auth'

export const GET: RequestHandler = async ({ request }) => {
  const decodedToken = await requireFirebaseUser(request)
  const accessKey = createDifyAccessKey(decodedToken.uid)

  return json(accessKey, {
    headers: {
      'cache-control': 'no-store'
    }
  })
}
