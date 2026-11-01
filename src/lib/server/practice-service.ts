import { error } from '@sveltejs/kit'
import type { AnalyticsContext } from '$lib/analytics-context'
import { PRACTICE_TURNS } from '$lib/practice'
import { trackPracticeCompleted, trackQuestionSubmitted } from './analytics'
import {
  finishPracticeTurn,
  getPractice,
  releasePracticeTurn,
  reservePracticeTurn,
  type MessageInput
} from './db/repositories/practices'
import { generatePracticeReply } from './dify-practice'

export async function submitPracticeMessage(input: MessageInput, context: AnalyticsContext | null) {
  const reservation = await reservePracticeTurn(input)
  if (reservation.status === 'not_found') throw error(404, '練習が見つかりません。')
  if (reservation.status === 'quota')
    throw error(429, '今月の10回の練習枠を使い切りました。途中の練習は再開できます。')
  if (reservation.status === 'complete')
    throw error(409, 'この練習は完了しています。新しい練習を選んでください。')
  if (reservation.status === 'conflict')
    throw error(409, '会話が更新されています。最新の内容を読み込んでください。')
  if (reservation.status === 'pending')
    return { session: await getPractice(input.uid, input.id), pending: true }
  if (reservation.status === 'replay')
    return { session: await getPractice(input.uid, input.id), pending: false }
  if (reservation.status !== 'ready') throw error(409, '会話を再読み込みしてください。')
  let saved = false
  try {
    const output = await generatePracticeReply({
      id: input.id,
      sceneId: reservation.sceneId,
      customScene: reservation.customScene,
      turns: reservation.turns,
      text: input.text
    })
    saved = await finishPracticeTurn(input, reservation.token, output)
    if (!saved) throw new Error('Practice reservation changed')
  } catch {
    await releasePracticeTurn(input, reservation.token)
    // Difyのエラー本文には会話や認証情報が含まれ得るため、ログに展開しない。
    console.warn('練習の返答を保存できませんでした。')
    throw error(
      502,
      '返答を作成できませんでした。入力は保存されています。同じ内容でもう一度お試しください。'
    )
  }
  await trackQuestionSubmitted(input.uid, context)
  if (input.expectedTurn + 1 === PRACTICE_TURNS) await trackPracticeCompleted(input.uid, context)
  return { session: await getPractice(input.uid, input.id), pending: false }
}
