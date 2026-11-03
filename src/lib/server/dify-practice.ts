import {
  findScene,
  resolveScene,
  CUSTOM_FOLLOW_UP,
  type CustomSceneInput,
  PRACTICE_TURNS,
  type PracticeFeedback,
  type PracticeTurn,
  type SceneId
} from '$lib/practice'

export interface GeneratePracticeInput {
  id: string
  sceneId: SceneId
  customScene?: CustomSceneInput | null
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
  } else if (sceneId === 'custom') {
    // 自由記述の場面では別れ際もあるため、毎回質問を足さず、AIが選ぶ定型句だけを添える。
    const separator = /[。！!]$/u.test(original) ? '' : '。'
    if (
      fields.custom_tip === 'closing' ||
      (!fields.custom_tip &&
        /また(?:来週|来月|今度)|さようなら|おやすみ|失礼します/u.test(original))
    ) {
      rewrite = `今日はお話しできてうれしかったです。${original}`
      improvement =
        '会話を終えるときに、話せてうれしかった気持ちをひと言添える言い方も試してみましょう。'
    } else if (fields.custom_tip === 'interest') {
      rewrite = `${original}${separator}${CUSTOM_FOLLOW_UP}`
      improvement = '相手の話をもう少し聞きたい気持ちを、答えやすいひと言で伝えてみましょう。'
    } else {
      rewrite = `なるほど。${original}`
      improvement = '自分の話の前に、相手の言葉を受け止めるひと言を添えてみましょう。'
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
  const scene = resolveScene(input.sceneId, input.customScene)
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
