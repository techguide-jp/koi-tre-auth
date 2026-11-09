import { error } from '@sveltejs/kit'
import type { AnalyticsContext } from '$lib/analytics-context'
import { practiceTurnLimit } from '$lib/practice'
import {
  finishRehearsal,
  reserveRehearsal,
  type RehearsalInput
} from './db/repositories/adventures'
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
    throw error(
      429,
      'この練習に使える枠が足りません。3往復は1枠、6往復は2枠です。途中の練習は再開できます。'
    )
  if (reservation.status === 'access')
    throw error(403, 'この場面の購入権・進行・Plusの利用期間を確認してください。')
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
      adventure: reservation.adventure,
      storyContext: reservation.storyContext,
      characterContext: reservation.characterContext,
      policyReleaseId: reservation.policyReleaseId,
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
  if (input.expectedTurn + 1 === practiceTurnLimit(reservation.adventure))
    await trackPracticeCompleted(input.uid, context)
  return { session: await getPractice(input.uid, input.id), pending: false }
}

export async function submitRehearsal(input: RehearsalInput) {
  const reservation = await reserveRehearsal(input)
  if (reservation.status === 'not_found') throw error(404, '言い直す会話が見つかりません。')
  if (reservation.status === 'complete') throw error(409, 'この練習の言い直しは完了しています。')
  if (reservation.status === 'conflict')
    throw error(409, '内容を変えた場合は新しい送信としてお試しください。')
  if (reservation.status === 'pending' || reservation.status === 'replay')
    return {
      session: await getPractice(input.uid, input.id),
      pending: reservation.status === 'pending'
    }
  if (reservation.status !== 'ready') throw error(409, '会話を再読み込みしてください。')
  try {
    const output = await generatePracticeReply({
      id: input.id,
      sceneId: reservation.sceneId,
      customScene: reservation.customScene,
      adventure: reservation.adventure,
      turns: reservation.turns,
      text: input.text,
      storyContext: reservation.storyContext,
      characterContext: reservation.characterContext,
      policyReleaseId: reservation.policyReleaseId,
      rehearsal: true
    })
    if (!(await finishRehearsal(input, reservation.token, output)))
      throw new Error('Reservation changed')
  } catch {
    await releasePracticeTurn(input, reservation.token)
    throw error(
      502,
      '返答を作成できませんでした。入力を残しています。同じ内容でもう一度お試しください。'
    )
  }
  return { session: await getPractice(input.uid, input.id), pending: false }
}
