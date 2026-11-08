import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { assessmentPoints, assessmentTotal, analysisAspects } from '$lib/practice'
import { episodeById } from '$lib/adventure'
import { getDb } from '../client'
import { practices, practiceTurns } from '../schema'
import { readCreditState } from './credits'
export async function getPracticeHistory(uid: string) {
  const db = getDb()
  const [rows, billing] = await Promise.all([
    db
      .select({
        id: practices.id,
        adventure: practices.adventure,
        completedAt: practices.completedAt,
        feedback: practiceTurns.feedback
      })
      .from(practices)
      .innerJoin(practiceTurns, eq(practices.id, practiceTurns.practiceId))
      .where(
        and(
          eq(practices.uid, uid),
          isNotNull(practices.completedAt),
          isNotNull(practiceTurns.feedback)
        )
      )
      .orderBy(desc(practices.completedAt))
      .limit(80),
    readCreditState(db, uid)
  ])
  const history = rows.flatMap((row) => {
    const assessment = row.feedback?.analysis?.assessment,
      total = assessmentTotal(assessment)
    if (!row.adventure || !assessment || assessment.rubric?.version !== 3 || total === null)
      return []
    const episode = episodeById(row.adventure.episodeId)
    return [
      {
        id: row.id,
        characterId: row.adventure.characterId,
        episodeId: row.adventure.episodeId,
        title: episode?.title ?? '会話の練習',
        profile: assessment.rubric.profile,
        total,
        points: analysisAspects.map((a) => ({
          id: a.id,
          label: a.label,
          value: assessmentPoints(assessment.aspects.find((s) => s.id === a.id))!
        })),
        completedAt: row.completedAt!.toISOString()
      }
    ]
  })
  const latest = history[0]
  const weakest = latest ? [...latest.points].sort((a, b) => a.value - b.value)[0] : undefined
  const prompts: Record<string, { goal: string; example: string; part: string }> = {
    acknowledgment: {
      goal: '相手が大事にしていることを、一つ受け止める',
      example: 'それがうれしかったんだね。聞いていて、私もうれしくなりました。',
      part: 'date'
    },
    self_expression: {
      goal: '自分の気持ちと希望を、短く具体的に伝える',
      example: '私は少しゆっくり話したいです。今日は、座って過ごせたらうれしいな。',
      part: 'honesty'
    },
    questions: {
      goal: '感想や自己開示を添えて、相手に話を渡す',
      example: '私も、落ち着いた場所が好きです。さっき話してくれた店、気になります。',
      part: 'date'
    },
    connection: {
      goal: '直前の話題を一つ取り上げて、自分の言葉をつなぐ',
      example: 'その景色が好きなんだね。私も、少し立ち止まって見ていたくなります。',
      part: 'meeting'
    },
    consideration: {
      goal: '自分の希望と、相手が選べる余地を一緒に伝える',
      example: '私はまた会いたいです。都合が合うときに、一緒に出かけられたらうれしい。',
      part: 'honesty'
    }
  }
  const course =
    billing.subscription?.active && latest && weakest
      ? {
          ...prompts[weakest.id],
          characterId: latest.characterId,
          basedOnId: latest.id,
          basedOnTitle: latest.title,
          aspect: weakest.label
        }
      : null
  return { history, course }
}
