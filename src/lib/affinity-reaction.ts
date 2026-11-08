import { gradeConversation } from './adventure-progression'
import {
  assessmentPoints,
  assessmentStatus,
  type AnalysisAspectId,
  type PracticeEvidence,
  type PracticeSession
} from './practice'
import type { CharacterId, Emotion } from './adventure'

export interface AffinityReaction {
  characterId: CharacterId
  direction: 'positive' | 'negative'
  emotion: Emotion
  mood: string
  speech: string
  evidence?: PracticeEvidence
}

type PositiveKind = AnalysisAspectId | 'general' | 'repair' | 'caution'
const positive: Record<CharacterId, Record<PositiveKind, string>> = {
  aoi: {
    acknowledgment:
      '私の気持ちまで受け止めてくれて、うれしかったな。もう少し話していたくなっちゃう。',
    self_expression: 'そう感じていたんだね。気持ちを聞かせてもらえて、少し近づけた気がする。',
    questions: '気負わず言葉を返せて、楽しかったな。こういうやりとり、いいね。',
    connection: '私の話から自然に広げてくれて、うれしかった。何気ない話も楽しくなるね。',
    consideration: '無理をしないで話せて、ほっとしたよ。自分のペースでいられるの、うれしいな。',
    general: '今日は一緒に話せて、うれしかったな。少しずつ、お互いのことを知っていけたらいいね。',
    repair: '今日は落ち着いて話せて、ほっとしたよ。こうして少しずつ話せるの、うれしいな。',
    caution:
      '一緒に話せたのはうれしいな。でも、もう少しゆっくり、私のペースも大切にしてもらえたら安心できる。'
  },
  rin: {
    acknowledgment:
      'そこを受け止めてくれるの、うれしい。ちゃんと聞いてもらえると、私も話したくなるね。',
    self_expression:
      '自分の考えを聞かせてくれるの、いいね。違うところも含めて、もっと知りたくなる。',
    questions: 'このテンポ、話しやすかった！ 私も気楽に返せて、楽しかったよ。',
    connection: 'そうやって話をつなげてくれると、楽しいね。私もつい話したくなっちゃった。',
    consideration: 'お互い無理せず話せる感じ、いいね。ちゃんと自分のペースでいられたよ。',
    general: '一緒に話せて楽しかった！ 少しずつ知り合っていくの、いいね。',
    repair: '今日は気楽に話せて、ほっとした。こういうやりとりを重ねられると、うれしいな。',
    caution:
      '一緒に話せたのはうれしいよ。でも、私のペースも大事にしてもらえると、もっと話しやすいな。'
  },
  shiori: {
    acknowledgment:
      '気持ちを丁寧に受け止めてもらえて、うれしかったです。もう少し言葉にしてみたくなりました。',
    self_expression:
      'そう感じていらしたんですね。考えを聞かせてもらえて、少し近くなれた気がします。',
    questions: '急がずに言葉を返せて、心地よかったです。自然にお話しできました。',
    connection:
      '私の話に、ご自身の言葉を重ねてくださるのがうれしかったです。話がゆっくり広がりましたね。',
    consideration:
      '自分のペースを保ったまま話せて、ほっとしました。こういう時間は、うれしいですね。',
    general: '今日はお話しできて、うれしかったです。少しずつ知り合っていけたらと思います。',
    repair: '今日は穏やかに話せて、ほっとしました。こうして少しずつ言葉を交わせるとうれしいです。',
    caution:
      'お話しできたのはうれしいです。ただ、もう少しゆっくり、私のペースも大切にしていただけると安心します。'
  },
  yu: {
    acknowledgment:
      '僕の気持ちも受け止めてくれて、うれしかった。もう少し話してみたいなって思えたよ。',
    self_expression: 'そう思っていたんだね。考えを聞かせてもらえて、少し近づけた気がするよ。',
    questions: '自然に言葉を返せて、楽しかったよ。気負わずに話せる感じ、いいね。',
    connection: '僕の話からつなげてくれて、うれしかったな。何気ない話でも、楽しく広がるんだね。',
    consideration: '無理をせずに話せて、ほっとしたよ。自分のペースでいられるのは、うれしいね。',
    general: '今日は一緒に話せて、うれしかったよ。ゆっくり、お互いのことを知っていけたらいいな。',
    repair: '今日は落ち着いて話せて、ほっとしたよ。こんなふうに少しずつ話せるとうれしいな。',
    caution:
      '一緒に話せたのはうれしいよ。ただ、もう少しゆっくり、僕のペースも大切にしてもらえたら安心する。'
  },
  sota: {
    acknowledgment:
      'そこまで受け止めてくれるの、うれしいな！ 聞いてもらえると、もっと話したくなるね。',
    self_expression: 'そういう考えなんだね！ 聞かせてくれてうれしい。少しずつ知れるの、楽しいな。',
    questions: '気楽に言葉を返せて、楽しかった！ こういうやりとり、いいね。',
    connection: 'そこから話を広げてくれるんだね！ 自然につながって、話していて楽しかったよ。',
    consideration: 'お互い無理せず話せるの、いいね。自分のペースでいられて、ほっとしたよ。',
    general: '今日は話せて楽しかった！ 少しずつ、お互いのことを知っていけたらうれしいな。',
    repair: '今日は気負わず話せて、ほっとしたよ。こうやって言葉を交わせるの、うれしいね。',
    caution:
      '話せたのはうれしかったよ。でも、僕のペースも大事にしてもらえると、もっと気楽に話せるな。'
  },
  ren: {
    acknowledgment: '気持ちを受け止めてもらえて、うれしかった。もう少し、話してみたくなったよ。',
    self_expression: 'そう感じていたんだね。聞かせてくれてうれしい。少し近づけた気がする。',
    questions: '自然に言葉を返せて、心地よかったよ。こういうやりとり、いいね。',
    connection: '僕の話につなげてくれて、うれしかった。無理なく話が広がったね。',
    consideration: '自分のペースで話せて、ほっとしたよ。こういう時間は、うれしいね。',
    general: '今日は話せて、うれしかったよ。少しずつ、知り合っていけたらいいな。',
    repair: '今日は落ち着いて話せて、ほっとした。こうして言葉を交わせるとうれしいよ。',
    caution:
      '話せたのはうれしいよ。ただ、もう少しゆっくり、僕のペースも大切にしてもらえると安心する。'
  }
}
const negative: Record<CharacterId, string> = {
  aoi: '少し戸惑っちゃった。今はゆっくり、私のペースでも話せたらいいな。',
  rin: 'ちょっと戸惑ったな。私の気持ちやペースも、大事にしてもらえるとうれしい。',
  shiori: '少し戸惑ってしまいました。今は急がず、私のペースでも話させていただけると安心します。',
  yu: '少し戸惑ったよ。今はゆっくり、僕のペースでも話せると安心するな。',
  sota: 'ちょっと戸惑っちゃったな。僕の気持ちやペースも、大事にしてもらえると話しやすいよ。',
  ren: '少し戸惑ったよ。今は急がず、僕のペースでも話せると安心する。'
}
const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim()

function evidenceFor(
  session: PracticeSession,
  id: AnalysisAspectId,
  direction: 'positive' | 'negative'
) {
  const analysis = session.turns.at(-1)?.feedback?.analysis
  const observations = direction === 'positive' ? analysis?.strengths : analysis?.improvements
  const evidence = analysis?.aspects.find((aspect) => aspect.id === id)?.evidence ?? []
  return evidence.find((item) => {
    const quote = normalize(item.quote)
    const turn = session.turns.find((turn) => turn.position === item.turn)
    // 評価の観点と長所／改善点の両方で裏付けられた、実際の本人の発言だけを添える。
    return (
      quote &&
      turn &&
      normalize(turn.userText).includes(quote) &&
      observations?.some((observation) =>
        observation.evidence.some(
          (other) => other.turn === item.turn && normalize(other.quote) === quote
        )
      )
    )
  })
}

export function affinityReaction(session: PracticeSession): AffinityReaction | null {
  const evaluation = session.evaluation
  if (!session.completedAt || !session.adventure || !evaluation || evaluation.status === 'pending')
    return null
  const grade = gradeConversation(evaluation.assessment)
  const delta = evaluation.affinityAfter - evaluation.affinityBefore
  if (grade.status === 'pending' || !delta) return null
  const characterId = session.adventure.characterId
  if (delta < 0) {
    // 不合格や丁寧な断りを悲しい反応に変えず、確かな配慮評価による実際の低下だけを扱う。
    if (!grade.certainConsideration || grade.consideration! >= 3) return null
    return {
      characterId,
      direction: 'negative',
      emotion: 'puzzled',
      mood: '少し戸惑っている',
      speech: negative[characterId],
      evidence: evidenceFor(session, 'consideration', 'negative')
    }
  }
  const caution = grade.certainConsideration && grade.consideration! < 3
  const repair = evaluation.strainDelta < 0
  const strongest = evaluation
    .assessment!.aspects.filter(
      (aspect) =>
        assessmentStatus(aspect) === 'rated' &&
        (assessmentPoints(aspect) ?? 0) >= 3 &&
        evidenceFor(session, aspect.id, 'positive')
    )
    .sort((a, b) => b.score - a.score)[0]
  const kind: PositiveKind = caution ? 'caution' : repair ? 'repair' : (strongest?.id ?? 'general')
  return {
    characterId,
    direction: 'positive',
    emotion: caution ? 'puzzled' : repair ? 'relieved' : delta >= 8 ? 'smile' : 'shy',
    mood: caution
      ? 'うれしさと、少しの戸惑い'
      : repair
        ? 'ほっと、笑顔になる'
        : delta >= 8
          ? 'うれしそうに、笑う'
          : '少し照れながら、ほほえむ',
    speech: positive[characterId][kind],
    evidence: !caution && strongest ? evidenceFor(session, strongest.id, 'positive') : undefined
  }
}
