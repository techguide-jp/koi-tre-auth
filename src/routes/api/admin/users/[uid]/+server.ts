import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import { adminUid } from '$lib/server/admin-operations-request'
import { getAdminUserDetail } from '$lib/server/db/repositories/admin-users'
import { privateJson } from '$lib/server/practice-request'

export const GET: RequestHandler = async ({ request, params }) => {
  await requireKnowledgeAdmin(request)
  const uid = adminUid(params.uid)
  let detail
  try {
    detail = await getAdminUserDetail(uid)
  } catch {
    throw error(503, '利用者の詳細を読み込めませんでした。時間をおいて再度お試しください。')
  }
  if (!detail) throw error(404, '利用者が見つかりません。')
  return privateJson(detail)
}
