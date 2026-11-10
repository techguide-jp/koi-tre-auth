import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import { adminDays } from '$lib/server/admin-operations-request'
import { getAdminUsage } from '$lib/server/db/repositories/admin-usage'
import { privateJson } from '$lib/server/practice-request'

export const GET: RequestHandler = async ({ request, url }) => {
  await requireKnowledgeAdmin(request)
  const days = adminDays(url.searchParams)
  try {
    return privateJson(await getAdminUsage(days))
  } catch {
    throw error(503, '利用状況を集計できませんでした。時間をおいて再度お試しください。')
  }
}
