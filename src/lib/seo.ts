import { guides } from '$lib/content/guides'

export const SITE_ORIGIN = 'https://app.koi-tre.com'
export const SHARE_IMAGE = `${SITE_ORIGIN}/images/cafe-conversation.jpg`

export const publicPages: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Koi-Tre（コイトレ）| 初対面・デートの会話をAIと無料練習',
    description:
      '初対面やデートの会話を、会う前にAIと練習。3回の返答と自分の発言に合わせた振り返りが月10回無料。登録不要の会話ネタ帳と、初デートの会話例も読めます。'
  },
  '/about': {
    title: '使い方とデータの扱い | Koi-Tre',
    description:
      'Koi-TreのAI会話練習の使い方、月10回の無料枠、会話・場面設定・アクセス解析のデータの扱いをご案内します。'
  },
  '/contact': {
    title: 'お問い合わせ | Koi-Tre',
    description: 'Koi-Treの使い方に関するご質問、不具合、ご要望はこちらからお問い合わせください。'
  },
  '/guides': {
    title: '初対面・デートの会話ガイド｜話題と具体的な返し方 | Koi-Tre',
    description:
      '初デート、マッチングアプリの初対面、デート中の沈黙。それぞれの場面で使える話題と会話例を、登録なしで読めます。'
  },
  '/topics': {
    title: 'デート・初対面の会話ネタ帳｜登録不要の話題カード | Koi-Tre',
    description:
      '初デートや初対面で何を話す？場面別の18枚の話題カードで、聞き方・自分の話の添え方・返答からの広げ方が見つかります。登録不要・無料。'
  },
  ...Object.fromEntries(
    guides.map((guide) => [
      `/guides/${guide.slug}`,
      { title: `${guide.title} | Koi-Tre`, description: guide.description }
    ])
  )
}

export function pageMetadata(pathname: string, status = 200) {
  const metadata = status < 400 ? publicPages[pathname] : undefined
  return {
    title: metadata?.title ?? (status === 404 ? 'ページが見つかりません | Koi-Tre' : 'Koi-Tre'),
    description: metadata?.description ?? '',
    indexable: !!metadata,
    // 練習IDやログインのクエリーを検索結果・共有カードへ出さない。
    canonical: metadata ? `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname}` : undefined,
    article: !!guides.find((guide) => pathname === `/guides/${guide.slug}`)
  }
}
