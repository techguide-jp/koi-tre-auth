import type { BillingOverview, CreditKind } from './billing'
import { characters, type CharacterId } from './adventure-catalog'
import type { ProgressionView } from './adventure-progression'

export type AdminDays = 7 | 30 | 90
export type AdminAccessFilter = 'all' | 'free' | 'plus' | 'route'
export type AdminProductFilter = 'all' | 'plus' | 'route' | 'topup'
export const ADMIN_PAGE_SIZE = 25
export interface AdminPeriod {
  days: AdminDays
  from: string
  to: string
  dates: string[]
}
export interface AdminUserSummary {
  uid: string
  displayName: string | null
  email: string | null
  createdAt: string
  lastPracticeAt: string | null
  started: number
  completed: number
  replies: number
  plus: boolean
  routePacks: number
}
export interface AdminUsersView {
  asOf: string
  page: number
  pageSize: number
  total: number
  users: AdminUserSummary[]
}
export interface AdminGrant {
  id: string
  uid: string
  displayName: string | null
  email: string | null
  kind: CreditKind
  characterId: CharacterId | null
  units: number
  startsAt: string
  expiresAt: string | null
  revokedAt: string | null
}
export interface AdminContract {
  id: string
  uid: string
  displayName: string | null
  email: string | null
  status: string
  periodStart: string
  periodEnd: string
  cancelAtPeriodEnd: boolean
  paidAccess: boolean
}
export interface AdminCheckout {
  id: string
  uid: string
  displayName: string | null
  email: string | null
  product: string
  status: string
  createdAt: string
  expiresAt: string
}
export interface AdminBillingView {
  period: AdminPeriod
  enabled: boolean
  testMode: boolean
  page: number
  pageSize: number
  total: number
  current: { plusUsers: number; routeOwners: number; topupOwners: number }
  grants: AdminGrant[]
  contracts: AdminContract[]
  checkouts: AdminCheckout[]
}
export interface AdminHistoryItem {
  id: string
  characterId: CharacterId | null
  episodeId: string | null
  sceneId: string
  turns: number
  replied: number
  createdAt: string
  chargedAt: string | null
  completedAt: string | null
  creditCost: number
  xp: number
  score: number | null
  evaluation: 'passed' | 'failed' | 'pending' | null
}
export interface AdminUserDetailView {
  asOf: string
  user: AdminUserSummary
  billing: BillingOverview
  progression: ProgressionView
  activity: { drafts: number; xp: number; legacyReplies: number }
  history: AdminHistoryItem[]
  historyHasMore: boolean
}
export interface AdminDailyCount {
  date: string
  registered: number
  started: number
  completed: number
  replies: number
}
export interface AdminUsageView {
  period: AdminPeriod
  totals: {
    registered: number
    newUsers: number
    activeUsers: number
    started: number
    completed: number
    replies: number
    credits: number
    cleared: number
    pendingEvaluations: number
  }
  daily: AdminDailyCount[]
  modes: { key: string; started: number; completed: number }[]
  characters: { characterId: string; started: number; completed: number }[]
  topUsers: { uid: string; displayName: string | null; email: string | null; replies: number }[]
  guest: { created: number; completed: number; claimed: number; retentionDays: number }
}

export const adminDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '記録なし'
export const adminNumber = (value: number) => value.toLocaleString('ja-JP')
export const adminPerson = (person: { displayName: string | null; email: string | null }) =>
  person.displayName || person.email || '名前未設定'
export const adminCharacter = (id: string | null) =>
  characters.find((c) => c.id === id)?.name ?? (id ? '不明な人物' : '共通')
export const adminCreditKind = (kind: string) =>
  ({ free: '無料', plus: 'Plus', route: '人物専用', topup: '追加共通' })[kind] ?? kind
export function adminProduct(key: string) {
  return key.startsWith('route:')
    ? `${adminCharacter(key.slice(6))}のルートパック`
    : key === 'plus'
      ? 'Plus'
      : key === 'topup'
        ? '追加共通枠'
        : '不明な商品'
}
export const adminContractStatus = (status: string) =>
  ({
    active: '利用中',
    canceled: '解約済み',
    past_due: '支払遅延',
    incomplete: '手続き未完了',
    incomplete_expired: '未完了で期限終了',
    unpaid: '未払い',
    trialing: 'トライアル',
    paused: '一時停止'
  })[status] ?? status
export function adminGrantStatus(grant: AdminGrant, now: string) {
  if (grant.revokedAt) return '停止'
  if (grant.startsAt > now) return '開始前'
  if (grant.expiresAt && grant.expiresAt <= now) return '期限終了'
  return '有効'
}
