import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createOperationWithLimitCheck } from '$lib/server/db/repositories/operations'
import { requireDifyAccessKey, requireDifyToken } from '$lib/server/request-auth'

function readRequiredString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return null
}

export const POST: RequestHandler = async ({ request }) => {
  requireDifyToken(request)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object')
  }

  const payload = body as Record<string, unknown>
  const accessKey = readRequiredString(payload, ['accessKey', 'access_key', 'uid'])
  const conversationId = readRequiredString(payload, ['conversationId', 'conversation_id'])
  const llmText = readRequiredString(payload, ['llmText', 'llm_text'])
  const query = readRequiredString(payload, ['query'])

  if (!accessKey || !conversationId || !llmText || !query) {
    throw error(400, 'accessKey, conversationId, llmText, and query are required')
  }

  const decodedAccessKey = requireDifyAccessKey(accessKey)
  const result = await createOperationWithLimitCheck({
    uid: decodedAccessKey.uid,
    conversationId,
    llmText,
    query
  })

  if (result.status === 'user_not_found') {
    throw error(404, 'User not found')
  }

  if (result.status === 'usage_limit_exceeded') {
    throw error(429, 'Monthly usage limit exceeded')
  }

  return json({
    ok: true
  })
}
