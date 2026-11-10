import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import { adminUserQuery } from '$lib/server/admin-operations-request'
import { getAdminUsers } from '$lib/server/db/repositories/admin-users'
import { privateJson } from '$lib/server/practice-request'

export const GET: RequestHandler = async ({ request, url }) => {
  await requireKnowledgeAdmin(request)
  const input = adminUserQuery(url.searchParams)
  try {
    return privateJson(await getAdminUsers(input))
  } catch {
    throw error(503, '利用者情報を読み込めませんでした。時間をおいて再度お試しください。')
  }
}
