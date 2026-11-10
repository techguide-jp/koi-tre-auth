import { error } from '@sveltejs/kit'
import type {
  AdminAccessFilter,
  AdminDays,
  AdminProductFilter,
  AdminPeriod
} from '$lib/admin-operations'

const hasControl = (value: string) => Array.from(value).some((c) => c.charCodeAt(0) < 32)

export function adminPage(params: URLSearchParams) {
  const value = params.get('page') ?? '1'
  if (!/^\d{1,5}$/.test(value) || Number(value) < 1 || Number(value) > 10000)
    throw error(400, 'ページ番号を確認してください。')
  return Number(value)
}
export function adminDays(params: URLSearchParams): AdminDays {
  const value = params.get('days') ?? '30'
  if (!['7', '30', '90'].includes(value)) throw error(400, '集計期間を確認してください。')
  return Number(value) as AdminDays
}
export function adminUserQuery(params: URLSearchParams) {
  const search = (params.get('q') ?? '').trim()
  if (search.length > 100 || hasControl(search))
    throw error(400, '検索は100文字以内で入力してください。')
  const access = params.get('access') ?? 'all'
  if (!['all', 'free', 'plus', 'route'].includes(access))
    throw error(400, '利用権の絞り込みを確認してください。')
  return { page: adminPage(params), search, access: access as AdminAccessFilter }
}
export function adminBillingQuery(params: URLSearchParams) {
  const kind = params.get('kind') ?? 'all'
  if (!['all', 'plus', 'route', 'topup'].includes(kind))
    throw error(400, '商品を確認してください。')
  return { page: adminPage(params), days: adminDays(params), kind: kind as AdminProductFilter }
}
export function adminUid(uid: string | undefined) {
  if (!uid || uid.length > 255 || hasControl(uid)) throw error(400, '利用者を確認してください。')
  return uid
}
export function adminPeriod(days: AdminDays, now = new Date()): AdminPeriod {
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10)
  const todayStart = new Date(`${today}T00:00:00+09:00`).getTime()
  const start = todayStart - (days - 1) * 86400000
  return {
    days,
    from: new Date(start).toISOString(),
    to: now.toISOString(),
    dates: Array.from({ length: days }, (_, i) =>
      new Date(start + i * 86400000 + 9 * 3600000).toISOString().slice(0, 10)
    )
  }
}
