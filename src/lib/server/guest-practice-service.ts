import { error } from '@sveltejs/kit'
import { generatePracticeReply } from './dify-practice'
import {
  finishGuestTurn,
  getGuestPractice,
  releaseGuestTurn,
  reserveGuestClaim,
  reserveGuestTurn,
  type GuestMessage
} from './db/repositories/guest-practices'
import {
  createPractice,
  finishPracticeTurn,
  getPractice,
  reservePracticeTurn,
  releasePracticeTurn
} from './db/repositories/practices'
import type { GuestTurn } from '$lib/guest-practice'
import type { Adventure } from '$lib/adventure'

export async function submitGuestMessage(input: GuestMessage, rate: { day: string; hash: string }) {
  const reservation = await reserveGuestTurn(input, rate)
  if (reservation.status !== 'ready')
    return { session: reservation.session, pending: reservation.status === 'pending' }
  try {
    const output = await generatePracticeReply(reservation.input)
    const turn: GuestTurn = {
      requestId: input.requestId,
      position: input.expectedTurn + 1,
      userText: input.text,
      assistantText: output.reply,
      feedback: output.feedback,
      presentation: 'presentation' in output ? output.presentation : null,
      mission: 'mission' in output ? output.mission : null,
      policyContext: output.policyContext ?? null
    }
    if (!(await finishGuestTurn(input, reservation.token, turn)))
      throw Error('Guest reservation changed')
  } catch {
    await releaseGuestTurn(input, reservation.token)
    throw error(
      502,
      '返答を作成できませんでした。入力は残っています。同じ内容でもう一度お試しください。'
    )
  }
  return { session: await getGuestPractice(input.sessionId, input.id), pending: false }
}
export async function claimGuestPractice(
  sessionId: string,
  id: string,
  uid: string,
  adminPlay = false
) {
  const guest = await reserveGuestClaim(sessionId, id, uid)
  const adventure: Adventure = {
    version: 1,
    characterId: guest.characterId,
    episodeId: `${guest.characterId}-1`,
    turns: 3
  }
  if (
    (await createPractice(
      uid,
      id,
      'adventure',
      null,
      adventure,
      {
        characterContext: guest.characterContext,
        policyReleaseId: guest.policyReleaseId,
        storyContext: guest.storyContext
      },
      adminPlay
    )) !== true
  )
    throw error(409, '会話を引き継げませんでした。同じアカウントでお試しください。')
  for (const turn of guest.state.turns) {
    const input = {
      uid,
      adminPlay,
      id,
      requestId: turn.requestId,
      text: turn.userText,
      expectedTurn: turn.position - 1
    }
    const reservation = await reservePracticeTurn(input)
    if (reservation.status === 'replay') continue
    if (reservation.status === 'pending')
      return { session: await getPractice(uid, id), pending: true }
    if (reservation.status === 'quota')
      throw error(
        429,
        '保存には通常の練習枠を1枠使います。30日間の保存期間内に、枠のある状態で同じアカウントから引き継げます。'
      )
    if (reservation.status !== 'ready') throw error(409, '引き継ぎ中の会話を確認してください。')
    // 再生成せず、サーバーに保存した体験の返答だけを通常の保存処理へ渡す。
    try {
      if (
        !(await finishPracticeTurn(input, reservation.token, {
          reply: turn.assistantText,
          feedback: turn.feedback,
          presentation: turn.presentation ?? undefined,
          mission: turn.mission,
          policyContext: turn.policyContext
        }))
      )
        throw Error('Guest import reservation changed')
    } catch {
      await releasePracticeTurn(input, reservation.token)
      throw error(
        503,
        '会話を保存できませんでした。体験は残っています。同じアカウントでもう一度お試しください。'
      )
    }
  }
  return { session: await getPractice(uid, id), pending: false }
}
