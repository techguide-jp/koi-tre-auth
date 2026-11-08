import { analysisAspects, type PracticeFeedback } from '$lib/practice'

export const exampleTexts = [
  'ここにはよく仕事に来ます。お気に入りの場所はありますか？',
  '私も本を読むのが好きです。図書館もいいですよね。コーヒーは好きですか？',
  'サピエンス全史や自助論を読みます。知っていますか？どんな本が好きですか？'
]
const evidence = (turn: number) => ({ turn, quote: exampleTexts[turn - 1] })
export const exampleFeedback: PracticeFeedback = {
  strength: '自分の好きな本を具体的に挙げ、相手の好みにも関心を向けています。',
  improvement: '本を知っているかと好みを続けて尋ねるより、質問を一つに絞ると答えやすくなります。',
  quote: exampleTexts[2],
  rewrite: 'サピエンス全史や自助論を読みます。どんな本を読むことが多いですか？',
  analysis: {
    version: 2,
    summary:
      'カフェから本へ共通の話題を見つけ、自分の好みも伝えています。後半は質問が重なるため、一つの話題を少し掘り下げると相手が話しやすくなります。',
    strengths: [
      {
        title: '自分の過ごし方を伝えた',
        observation: '仕事で訪れる場所だと話し、相手があなたの日常を想像できる入口を作っています。',
        evidence: [evidence(1)]
      },
      {
        title: '共通の趣味に反応した',
        observation: '相手の読書の話に、自分も好きだと返しています。',
        evidence: [evidence(2)]
      }
    ],
    improvements: [
      {
        title: '質問を一つに絞る',
        observation: '最後の返答は知識の確認と好みの質問が続いています。',
        suggestion: 'まず好みを一つ聞き、答えが返ってから次の質問を考えてみましょう。',
        evidence: [evidence(3)]
      },
      {
        title: '共通の話題を少し広げる',
        observation: '読書の共通点を見つけたあと、すぐコーヒーへ移っています。',
        suggestion: '本を読む場所や最近読んだ本へつなげると、共通の話題を深められます。',
        evidence: [evidence(2)]
      }
    ],
    aspects: analysisAspects.map(({ id }) => ({
      id,
      observation:
        id === 'questions'
          ? '最後は質問を一つにすると答えやすくなります。'
          : '具体的な好みや反応が見られますが、3回の返答から観察できる範囲での振り返りです。',
      evidence: [evidence(id === 'questions' ? 3 : 2)]
    })),
    turns: [
      {
        turn: 1,
        quote: exampleTexts[0],
        observation: '日常を伝えながら相手に話を渡しています。',
        rewrite: 'ここにはよく仕事に来ます。普段はどんな場所で過ごすのが好きですか？',
        reason: '場所の話を保ち、相手が自分の過ごし方を話せる質問にしています。'
      },
      {
        turn: 2,
        quote: exampleTexts[1],
        observation: '共通の趣味に反応していますが、すぐ話題が変わっています。',
        rewrite: '私も本を読むのが好きです。図書館もいいですよね。最近はどんな本を読みましたか？',
        reason: '読書の話を続け、相手が自分の体験を話せるようにしています。'
      },
      {
        turn: 3,
        quote: exampleTexts[2],
        observation: '本の名前を挙げているので好みが伝わります。二つの質問は一つにまとめられます。',
        rewrite: 'サピエンス全史や自助論を読みます。どんな本を読むことが多いですか？',
        reason: '作品を知っているかの確認を省き、相手の好みを聞く一問に絞っています。'
      }
    ],
    nextPractice: {
      goal: '相手が話した内容への反応を一つ添えて、同じ話題の質問を一つだけ返してみましょう。',
      example: '私も本を読むのが好きです。最近はどんな本を読みましたか？'
    }
  }
}
export function exampleJevResponse() {
  return {
    model: 'jev-test-version',
    answers: Object.fromEntries(
      analysisAspects.flatMap(({ id }) => [
        [id, { type: 'score', score: 2.2, confidence: 0.9 }],
        [`${id}_observable`, { type: 'noul', noul: 0.95 }]
      ])
    )
  }
}
