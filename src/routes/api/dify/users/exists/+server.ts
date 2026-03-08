import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { userExists } from '$lib/server/db/repositories/users'
import { requireDifyToken } from '$lib/server/request-auth'
import { verifyDifyAccessKey } from '$lib/server/dify-access-key'

export const GET: RequestHandler = async ({ request, url }) => {
  requireDifyToken(request)

  const accessKey =
    url.searchParams.get('accessKey')?.trim() ??
    url.searchParams.get('access_key')?.trim() ??
    url.searchParams.get('uid')?.trim()
  if (!accessKey) {
    return json({ exists: false })
  }

  const decodedAccessKey = verifyDifyAccessKey(accessKey)
  if (!decodedAccessKey) {
    return json({ exists: false })
  }

  return json({
    exists: await userExists(decodedAccessKey.uid)
  })
}
