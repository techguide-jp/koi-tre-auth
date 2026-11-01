import { error, json } from '@sveltejs/kit'
import { practiceEnabled } from '$lib/server/practice-config'
import type { RequestHandler } from './$types'
import { createDifyAccessKey } from '$lib/server/dify-access-key'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { readAnalyticsContext } from '$lib/analytics-context'

export const GET: RequestHandler = async ({ request }) => {
  const decodedToken = await requireFirebaseUser(request)
  if (practiceEnabled()) throw error(410, 'アプリ内の練習画面をご利用ください。')
  const context = readAnalyticsContext({
    clientId: request.headers.get('x-ga-client-id'),
    sessionId: request.headers.get('x-ga-session-id') ?? undefined
  })
  const accessKey = createDifyAccessKey(decodedToken.uid, new Date(), context)

  return json(accessKey, {
    headers: {
      'cache-control': 'no-store'
    }
  })
}
