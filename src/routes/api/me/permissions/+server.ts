import type { RequestHandler } from './$types'
import { requireFirebaseUser } from '$lib/server/request-auth'
import { isKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import { privateJson } from '$lib/server/practice-request'
export const GET: RequestHandler = async ({ request }) => {
  const actor = await requireFirebaseUser(request)
  return privateJson({ knowledgeAdmin: isKnowledgeAdmin(actor.uid, actor) })
}
