import { error } from '@sveltejs/kit'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { requireFirebaseUser } from './request-auth'

type AdminIdentity = Pick<DecodedIdToken, 'email' | 'email_verified'> & {
  firebase?: Pick<DecodedIdToken['firebase'], 'sign_in_provider'>
}

const allowed = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

export function isKnowledgeAdmin(uid: string, identity?: AdminIdentity) {
  if (allowed(process.env.KOITRE_ADMIN_UIDS).includes(uid)) return true
  // 初回ログイン前にも指定できるが、自己申告のメールや別プロバイダーでは権限を与えない。
  if (
    !identity?.email ||
    identity.email_verified !== true ||
    identity.firebase?.sign_in_provider !== 'google.com'
  )
    return false
  return allowed(process.env.KOITRE_ADMIN_GOOGLE_EMAILS)
    .map((email) => email.toLowerCase())
    .includes(identity.email.trim().toLowerCase())
}
export async function requireKnowledgeAdmin(request: Request) {
  const actor = await requireFirebaseUser(request)
  if (!isKnowledgeAdmin(actor.uid, actor))
    throw error(403, 'この管理画面を利用する権限がありません。')
  return actor
}
