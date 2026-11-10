import type { DecodedIdToken } from 'firebase-admin/auth'
import type { BillingOverview } from '$lib/billing'
import { practiceCreditCost } from '$lib/billing'
import { practiceTurnLimit, type PracticeSession } from '$lib/practice'
import { isKnowledgeAdmin } from './knowledge-admin-auth'

export const adminPracticeAccess = (actor: DecodedIdToken) => isKnowledgeAdmin(actor.uid, actor)

export function billingForActor(billing: BillingOverview, actor: DecodedIdToken): BillingOverview {
  return { ...billing, adminPlay: adminPracticeAccess(actor) || undefined }
}
export function practiceForActor(session: PracticeSession | null, actor: DecodedIdToken) {
  if (!session) return null
  const adminPlay = adminPracticeAccess(actor)
  return {
    ...session,
    adminPlay: adminPlay || undefined,
    // 保存済みの消費は変えず、初回保存前だけ現在の権限で表示する。
    creditCost: session.chargedAt
      ? session.creditCost
      : adminPlay
        ? 0
        : practiceCreditCost(practiceTurnLimit(session.adventure))
  }
}
