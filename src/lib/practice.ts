export const PRACTICE_LIMIT = 10
export const PRACTICE_TURNS = 3
export const MAX_MESSAGE_LENGTH = 1000

export const scenes = [
  {
    id: 'cafe',
    title: '初対面のカフェ',
    subtitle: '最初のひと言から、自然に話し始める。',
    goal: 'あいさつに、自分のことや相手への質問を少し添える',
    opener:
      'はじめまして。お会いできてうれしいです。このカフェ、落ち着きますね。普段もカフェにはよく来ますか？',
    hint: '自分のことをひと言伝えて、相手にも聞いてみましょう。',
    followUp: '普段はどんなふうに過ごすのがお好きですか？'
  },
  {
    id: 'hobbies',
    title: '趣味・休日の話を広げる',
    subtitle: '質問だけで終わらない、話題の広げ方。',
    goal: '相手の話に反応し、自分の経験も交えて話題を広げる',
    opener:
      '最近、休日に少し遠くまで散歩するのにはまっているんです。お休みの日は、どんなふうに過ごすことが多いですか？',
    hint: '相手の話への感想と、自分の話を組み合わせてみましょう。',
    followUp: '最近、楽しみにしていることはありますか？'
  },
  {
    id: 'silence',
    title: 'デート中に会話が途切れたとき',
    subtitle: '沈黙を急いで埋めずに、次の話題へ。',
    goal: '目の前のことをきっかけに、答えやすい話題を出す',
    opener: '（食事がひと段落して、少し静かな時間になりました。）ここの料理、おいしかったですね。',
    hint: '料理やお店のことなど、今共有していることから話してみましょう。',
    followUp: '最近、おいしいと思った料理はありますか？'
  }
] as const

export type SceneId = (typeof scenes)[number]['id']
export function findScene(id: unknown) {
  return scenes.find((scene) => scene.id === id)
}

export interface PracticeFeedback {
  strength: string
  improvement: string
  quote: string
  rewrite: string
}

export interface PracticeTurn {
  requestId: string
  position: number
  userText: string
  assistantText: string
  feedback: PracticeFeedback | null
}

export interface PracticeSession {
  id: string
  sceneId: SceneId
  chargedAt: string | null
  completedAt: string | null
  turns: PracticeTurn[]
  pending: { requestId: string; text: string; until: string | null } | null
}

export interface PracticeOverview {
  remaining: number
  limit: number
  reserved: number
  activePracticeId: string | null
  latestPracticeId: string | null
  resetsAt: string
}
