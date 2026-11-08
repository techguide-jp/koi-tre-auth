import {
  resolveScene,
  assessmentStatus,
  type CustomSceneInput,
  PRACTICE_TURNS,
  type PracticeTurn,
  type SceneId
} from '$lib/practice'
import { assessPractice, selectPracticeCoaching } from './jev-practice'
import { practiceCoaching } from './practice-coaching'
import { parsePracticeOutput } from './practice-feedback'
export { parsePracticeOutput } from './practice-feedback'

export interface GeneratePracticeInput {
  id: string
  sceneId: SceneId
  customScene?: CustomSceneInput | null
  turns: Pick<PracticeTurn, 'userText' | 'assistantText'>[]
  text: string
}

export async function generatePracticeReply(input: GeneratePracticeInput) {
  const scene = resolveScene(input.sceneId, input.customScene)
  const key = process.env.DIFY_PRACTICE_API_KEY
  if (!key || !scene) throw new Error('Practice is not configured')
  const base = process.env.DIFY_API_BASE_URL ?? 'https://api.dify.ai/v1'
  // Jevと生成で期限を共有し、保存予約・関数実行上限を超えないようにする。
  const signal = AbortSignal.timeout(55_000)
  const final = input.turns.length + 1 === PRACTICE_TURNS
  const transcript = [
    { role: 'assistant', content: scene.opener },
    ...input.turns.flatMap((turn, index) => [
      { role: 'user', content: turn.userText, turn: index + 1 },
      { role: 'assistant', content: turn.assistantText }
    ]),
    { role: 'user', content: input.text, turn: input.turns.length + 1 }
  ]
  // 場面の分類と補助評価を合わせて6秒以内にし、文章生成の時間を確保する。
  const assessmentSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)])
  const coaching = final
    ? await selectPracticeCoaching(scene, assessmentSignal)
    : practiceCoaching(scene)
  const measured = final
    ? await assessPractice(scene, transcript, assessmentSignal, coaching)
    : null
  const assessment = measured
    ? { ...measured, rubric: { version: 2 as const, profile: coaching.id } }
    : null
  const response = await fetch(`${base.replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Dify上の識別には練習IDを使い、Googleのプロフィール情報を送らない。
      user: input.id,
      response_mode: 'blocking',
      inputs: {
        scene: JSON.stringify({
          ...scene,
          coaching: {
            ...coaching,
            replyStyle: final
              ? 'close_naturally'
              : input.turns.length === 0
                ? 'respond_and_share'
                : 'share_or_follow_up'
          },
          assessment: assessment
            ? {
                ...assessment,
                aspects: assessment.aspects.map((aspect) => ({
                  ...aspect,
                  status: assessmentStatus(aspect)
                }))
              }
            : null
        }),
        transcript: JSON.stringify(transcript),
        turn: input.turns.length + 1,
        total_turns: PRACTICE_TURNS
      }
    }),
    signal
  })
  if (!response.ok) throw new Error('Practice generation failed')
  const body = await response.json()
  if (body.data?.status !== 'succeeded') throw new Error('Practice workflow failed')
  return parsePracticeOutput(
    body.data.outputs?.result,
    [...input.turns.map((turn) => turn.userText), input.text],
    final,
    assessment
  )
}
