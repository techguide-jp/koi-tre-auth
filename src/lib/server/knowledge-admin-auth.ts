import { error } from '@sveltejs/kit'
import { requireFirebaseUser } from './request-auth'

export function isKnowledgeAdmin(uid: string) {
  return (process.env.KOITRE_ADMIN_UIDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(uid)
}
export async function requireKnowledgeAdmin(request: Request) {
  const actor = await requireFirebaseUser(request)
  if (!isKnowledgeAdmin(actor.uid)) throw error(403, 'この管理画面を利用する権限がありません。')
  return actor
}
