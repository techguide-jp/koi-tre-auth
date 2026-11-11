import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({
  // 公開用の番号は本番の設定で管理し、公開リポジトリの履歴に残さない。
  phone: process.env.BILLING_SELLER_PHONE?.trim() || null
})
