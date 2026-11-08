import { guides } from '$lib/content/guides'

export const SITE_ORIGIN = 'https://app.koi-tre.com'
export const SHARE_IMAGE = `${SITE_ORIGIN}/images/cafe-conversation.jpg`

export const publicPages: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Koi-Tre（コイトレ）| 初対面・デートの会話をAIと無料練習',
    description:
      '男女6人のAIキャラクターと恋愛・デートの会話を練習。出会い編・デート編・本音編・気持ちを伝える編を進め、クリア済みの場面へ戻れます。5観点25点評価と具体的な言い換え。毎月10枠無料。'
  },
  '/about': {
    title: '使い方とデータの扱い | Koi-Tre',
    description:
      'Koi-TreのAI会話練習の使い方、毎月10枠の無料枠、会話・場面設定・アクセス解析のデータの扱いをご案内します。'
  },
  '/pricing': {
    title: '料金・無料とルートパック・Plus | Koi-Tre',
    description:
      '無料の出会い編、1人1,480円の買い切りルートパック、月980円のPlusをご案内。3往復1枠・6往復2枠。人物との物語と、クリア後の交流を楽しめます。有料プランは準備中。'
  },
  '/contact': {
    title: 'お問い合わせ | Koi-Tre',
    description: 'Koi-Treの使い方に関するご質問、不具合、ご要望はこちらからお問い合わせください。'
  },
  '/guides': {
    title: '初対面・デートの会話ガイド｜話題と具体的な返し方 | Koi-Tre',
    description:
      '初デート、マッチングアプリの初対面や電話、2回目のデート、沈黙。それぞれの場面で使える話題と会話例を、登録なしで読めます。'
  },
  '/topics': {
    title: 'デート・初対面の会話ネタ帳｜登録不要の話題カード | Koi-Tre',
    description:
      '初デートや初対面で何を話す？場面別の18枚の話題カードで、聞き方・自分の話の添え方・返答からの広げ方が見つかります。登録不要・無料。'
  },
  '/share': {
    title: 'Koi-Treの紹介・配布素材｜SNS画像とQR付き案内',
    description:
      '初対面・デートの会話準備を紹介するSNS画像3枚、投稿文、イベントで使えるQR付きA4案内を無料配布。登録不要の会話ネタ帳をご紹介いただけます。'
  },
  '/try': {
    title: 'あなたならどう返す？30秒の会話お試し｜登録不要 | Koi-Tre',
    description:
      '初対面のカフェ、沈黙、デートの帰り際。3つの短い場面で返し方を選び、言葉のヒントを見つける無料のお試し。登録不要・採点なしで、すべての選択に解説があります。'
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
