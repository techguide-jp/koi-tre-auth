import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDashboard } from '$lib/server/db/repositories/operations'
import { requireFirebaseUser } from '$lib/server/request-auth'

export const GET: RequestHandler = async ({ request }) => {
  const decodedToken = await requireFirebaseUser(request)
  const dashboard = await getDashboard(decodedToken.uid)

  return json(dashboard, {
    headers: {
      'cache-control': 'no-store'
    }
  })
}
