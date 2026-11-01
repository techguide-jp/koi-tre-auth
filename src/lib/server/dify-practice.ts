import {
  findScene,
  PRACTICE_TURNS,
  type PracticeFeedback,
  type PracticeTurn,
  type SceneId
} from '$lib/practice'

export interface GeneratePracticeInput {
  id: string
  sceneId: SceneId
  turns: Pick<PracticeTurn, 'userText' | 'assistantText'>[]
  text: string
}

export function parsePracticeOutput(
  value: unknown,
  userTexts: string[],
  final: boolean,
  sceneId: SceneId = 'cafe'
) {
  const output = typeof value === 'string' ? JSON.parse(value) : value
  if (!output || typeof output !== 'object') throw new Error('Invalid practice output')
  const { reply, feedback } = output as Record<string, unknown>
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 2000)
    throw new Error('Invalid practice reply')
  if (!final) return { reply: reply.trim(), feedback: null }
  if (!feedback || typeof feedback !== 'object') throw new Error('Missing feedback')
  const fields = feedback as Record<string, unknown>
  for (const key of ['strength', 'improvement', 'quote', 'rewrite']) {
    if (
      typeof fields[key] !== 'string' ||
      !(fields[key] as string).trim() ||
      (fields[key] as string).length > 2000
    )
      throw new Error('Invalid feedback')
  }
  const result = fields as unknown as PracticeFeedback
  const original = [...userTexts].reverse().find((text) => text.includes(result.quote))
  if (!original) throw new Error('Feedback quote does not match conversation')
  // LLMが未発言の好みを補うことがあったため、言い換えは本人の原文と定型句だけで組み立てる。
  const questionAt = original.search(/[?？]/u)
  let rewrite: string
  let improvement: string
  if (questionAt >= 0) {
    const boundary =
      Math.max(
        original.lastIndexOf('。', questionAt),
        original.lastIndexOf('！', questionAt),
        original.lastIndexOf('\n', questionAt)
      ) + 1
    const question = original.slice(boundary)
    if (question.includes('よかったら')) {
      rewrite = `なるほど。${original}`
      improvement = '質問の前に、相手の話を受け止めるひと言を添えてみましょう。'
    } else {
      rewrite = `${original.slice(0, boundary)}よかったら、${question}`
      improvement = '質問の前に「よかったら」を添えて、相手が答えやすい聞き方も試してみましょう。'
    }
  } else {
    rewrite = `${original}${/[。！!]$/u.test(original) ? '' : '。'}${findScene(sceneId)!.followUp}`
    improvement = '自分のことを伝えたあと、相手が答えやすい質問を一つ添えてみましょう。'
  }
  return {
    reply: reply.trim(),
    feedback: {
      strength: result.strength,
      improvement,
      quote: original,
      rewrite
    }
  }
}

export async function generatePracticeReply(input: GeneratePracticeInput) {
  const scene = findScene(input.sceneId)
  const key = process.env.DIFY_PRACTICE_API_KEY
  if (!key || !scene) throw new Error('Practice is not configured')
  const base = process.env.DIFY_API_BASE_URL ?? 'https://api.dify.ai/v1'
  const response = await fetch(`${base.replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Dify上の識別には練習IDを使い、Googleのプロフィール情報を送らない。
      user: input.id,
      response_mode: 'blocking',
      inputs: {
        scene: JSON.stringify(scene),
        transcript: JSON.stringify([
          { role: 'assistant', content: scene.opener },
          ...input.turns.flatMap((turn) => [
            { role: 'user', content: turn.userText },
            { role: 'assistant', content: turn.assistantText }
          ]),
          { role: 'user', content: input.text }
        ]),
        turn: input.turns.length + 1,
        total_turns: PRACTICE_TURNS
      }
    }),
    signal: AbortSignal.timeout(55_000)
  })
  if (!response.ok) throw new Error('Practice generation failed')
  const body = await response.json()
  if (body.data?.status !== 'succeeded') throw new Error('Practice workflow failed')
  return parsePracticeOutput(
    body.data.outputs?.result,
    [...input.turns.map((turn) => turn.userText), input.text],
    input.turns.length + 1 === PRACTICE_TURNS,
    input.sceneId
  )
}
