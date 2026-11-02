import data from './content/promotion-data.json'

export const promotionCampaign = data.campaign
export const promotionChannels = data.channels
export const promotionCards = data.cards
export type PromotionChannel = keyof typeof promotionChannels
const contents = [...promotionCards.map((card) => card.id), 'flyer', 'quick_try']

export function promotionUrl(channel: PromotionChannel, content: string) {
  const { source, medium } = promotionChannels[channel]
  const url = new URL(content === 'quick_try' ? '/try' : '/topics', 'https://app.koi-tre.com')
  url.search = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: promotionCampaign,
    utm_content: contents.includes(content) ? content : 'questions'
  }).toString()
  return url.href
}

export function readPromotionQuery(query: URLSearchParams) {
  const source = query.get('utm_source')
  const medium = query.get('utm_medium')
  const content = query.get('utm_content')
  // 紹介元の計測に任意の文字列を混ぜず、会話・個人情報のURL除外を維持する。
  if (
    query.get('utm_campaign') !== promotionCampaign ||
    !Object.values(promotionChannels).some(
      (channel) => channel.source === source && channel.medium === medium
    ) ||
    !content ||
    !contents.includes(content)
  )
    return ''
  return new URLSearchParams({
    utm_source: source!,
    utm_medium: medium!,
    utm_campaign: promotionCampaign,
    utm_content: content
  }).toString()
}
