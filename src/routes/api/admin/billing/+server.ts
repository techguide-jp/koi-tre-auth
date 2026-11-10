import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import { adminBillingQuery } from '$lib/server/admin-operations-request'
import { getAdminBilling } from '$lib/server/db/repositories/admin-billing'
import { privateJson } from '$lib/server/practice-request'

export const GET: RequestHandler = async ({ request, url }) => {
  await requireKnowledgeAdmin(request)
  const input = adminBillingQuery(url.searchParams)
  try {
    return privateJson(await getAdminBilling(input))
  } catch {
    throw error(503, '課金情報を読み込めませんでした。時間をおいて再度お試しください。')
  }
}
