type Announcement = {
  slug: string
  date: string
  category: string
  title: string
  summary: string
  image: { src: string; alt: string; width: number; height: number }
  sections: { title: string; body: string }[]
  action?: { href: string; label: string }
}

export const announcements: readonly Announcement[] = [
  {
    slug: 'koi-tre-launch',
    date: '2026-11-01',
    category: 'リリース',
    title: '会話練習サービス「コイトレ」をリリースしました',
    summary: '初対面やデートの会話を、AIキャラクターを相手に自分の言葉で練習できます。',
    image: {
      src: '/images/cafe-conversation.jpg',
      alt: '木漏れ日の差すカフェで、向かい合って話す二人',
      width: 1448,
      height: 1086
    },
    sections: [
      {
        title: '6人のAIキャラクターから、話したい相手を選ぶ',
        body: 'カフェでの出会いなど、場面に合わせた相手のひと言から会話が始まります。あなたの言葉で返しながら、少しずつ相手を知っていけます。最初の1往復はログインせずに試せます。'
      },
      {
        title: '話したあとは、次の会話に活かせる振り返り',
        body: '練習を終えると、あなたの発言のよかった点や、次に試せる言い換えが届きます。実際に会う前に、伝えたいことを自分の言葉で練習してみてください。'
      }
    ],
    action: { href: '/#scenes', label: 'お相手を選んで試す' }
  },
  {
    slug: 'conversation-topics',
    date: '2026-11-23',
    category: '使い方',
    title: '会話のきっかけを探すなら、会話ネタ帳へ',
    summary: '初対面やデートで使える18枚の話題カードを、気になる場面からめくってみませんか。',
    image: {
      src: '/images/cafe-conversation.jpg',
      alt: '木漏れ日の差すカフェで、向かい合って話す二人',
      width: 1448,
      height: 1086
    },
    sections: [
      {
        title: '話したい場面を選ぶ',
        body: '会話の始め方や、話が途切れたときなど、今の自分に近い場面を選んでみてください。カードには質問の例、自分の話の添え方、相手の答えから会話を広げるヒントが載っています。'
      },
      {
        title: 'ひと言だけ、自分の言葉に',
        body: '次に会う相手を思い浮かべながら、使ってみたい質問を一つ選びます。例文を自分の経験や好きなものに置き換えると、質問に続けて自分の話も添えやすくなります。'
      }
    ],
    action: { href: '/topics', label: '会話ネタ帳を開く' }
  }
].sort((a, b) => b.date.localeCompare(a.date))

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'long',
  timeZone: 'Asia/Tokyo'
})

export function formatAnnouncementDate(date: string) {
  return dateFormatter.format(new Date(date))
}
