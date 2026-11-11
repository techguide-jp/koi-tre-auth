import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePracticeReply } from './dify-practice'
import { contentHash, defaultKnowledgeContent } from './knowledge-content'
import { exampleFeedback, exampleJevResponse, exampleTexts } from './fixtures/practice-analysis'

const mismatch = '休日の過ごし方としては明示していません。先に、最初に聞かれたことに答えましょう。'
const confirmed = {
  type: 'choice',
  choice: 'grounded',
  probabilities: { grounded: 0.92, misread: 0.08 }
}
const contradicted = {
  type: 'choice',
  choice: 'misread',
  probabilities: { grounded: 0.12, misread: 0.88 }
}
const uncertain = {
  type: 'choice',
  choice: 'grounded',
  probabilities: { grounded: 0.51, misread: 0.49 }
}

function scenario(reviews: (typeof confirmed | null)[], enabled = true, count = 3) {
  vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture')
  vi.stubEnv('TYPESAFE_API_KEY', 'fixture')
  const content = defaultKnowledgeContent()
  if (enabled) content.feedbackReview = 'transcript-v1'
  const texts = [
    '漫画を読みます。',
    ...Array.from({ length: count - 1 }, (_, i) => exampleTexts[i % 3])
  ]
  const good = structuredClone(exampleFeedback)
  good.quote = texts.at(-1)!
  good.analysis!.version = 3
  good.analysis!.summary = '漫画を読むと答えています。好きな理由もひと言添えると広がります。'
  good.analysis!.turns = texts.map((quote, index) => ({
    ...exampleFeedback.analysis!.turns[index % 3],
    quote,
    turn: index + 1
  }))
  for (const item of [
    ...good.analysis!.strengths,
    ...good.analysis!.improvements,
    ...good.analysis!.aspects
  ])
    for (const entry of item.evidence) entry.quote = texts[entry.turn - 1]
  const bad = structuredClone(good)
  bad.analysis!.nextPractice.goal = mismatch
  const calls: { name: string; body: Record<string, unknown> }[] = []
  let attempts = 0
  const fetch = vi.fn(async (url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string)
    if (url.includes('typesafe.ai')) {
      if (body.questions.grounding) {
        calls.push({ name: 'review', body })
        const response = reviews.shift()
        return { ok: !!response, json: async () => ({ answers: { grounding: response } }) }
      }
      calls.push({ name: 'score', body })
      return { ok: true, json: async () => exampleJevResponse() }
    }
    calls.push({ name: 'generate', body })
    attempts++
    return {
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: {
            policy_hash: body.inputs.policy_hash,
            result: {
              reply: '話せてよかったです。',
              feedback: attempts === 1 ? bad : good
            }
          }
        }
      })
    }
  })
  vi.stubGlobal('fetch', fetch)
  return {
    calls,
    input: {
      id: 'grounding-fixture',
      sceneId: count === 3 ? ('hobbies' as const) : ('adventure' as const),
      ...(count === 6
        ? {
            adventure: {
              version: 1 as const,
              characterId: 'aoi' as const,
              episodeId: 'aoi-1',
              turns: 6 as const
            }
          }
        : {}),
      turns: texts
        .slice(0, -1)
        .map((userText) => ({ userText, assistantText: 'そうなんですね。' })),
      text: texts.at(-1)!,
      policyOverride: { content, contentHash: contentHash(content) }
    }
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('回答済みの発言を不足扱いしないための最終分析の照合', () => {
  it.each([3, 6])('%i往復で矛盾した分析を破棄し、照合済みの作り直しだけを返す', async (count) => {
    const { input, calls } = scenario([contradicted, confirmed], true, count)
    const result = await generatePracticeReply(input)
    expect(calls.map((call) => call.name)).toEqual([
      'score',
      'generate',
      'review',
      'generate',
      'review'
    ])
    const first = calls[1].body.inputs as Record<string, string>
    const repair = calls[3].body.inputs as Record<string, string>
    expect(repair).toMatchObject({
      transcript: first.transcript,
      policy_context: first.policy_context,
      policy_hash: first.policy_hash
    })
    expect(repair.scene.length).toBeLessThanOrEqual(4000)
    expect(JSON.parse(repair.scene).coaching.avoid).toContain('すでに答えたことを不足扱いしない')
    expect(calls[2].body.state).toMatchObject({
      transcript: JSON.parse(first.transcript),
      feedback: { analysis: { nextPractice: { goal: mismatch } } }
    })
    expect(JSON.stringify(calls[2].body.state)).not.toContain('jev-test-version')
    expect(result.feedback?.analysis?.summary).toContain('漫画を読むと答えています')
    expect(result.feedback?.analysis?.nextPractice.goal).not.toBe(mismatch)
    expect(result.feedback?.analysis?.assessment?.model).toBe('jev-test-version')
    expect(result.policyContext?.feedbackReview).toBe('transcript-v1')
  })

  it.each([contradicted, uncertain])(
    '矛盾・僅差が続く分析は確定しない: $choice',
    async (verdict) => {
      const { input, calls } = scenario([verdict, verdict])
      await expect(generatePracticeReply(input)).rejects.toThrow('grounding not confirmed')
      expect(calls.filter((call) => call.name === 'generate')).toHaveLength(2)
    }
  )

  it.each([null, { ...confirmed, probabilities: { grounded: 0.92, misread: 0.81 } }])(
    '照合不能を確認済みと見なさず、不要な再生成もしない',
    async (response) => {
      const { input, calls } = scenario([response])
      await expect(generatePracticeReply(input)).rejects.toThrow('grounding not confirmed')
      expect(calls.map((call) => call.name)).toEqual(['score', 'generate', 'review'])
    }
  )

  it('途中の会話・言い直し・従来の公開版では照合を追加しない', async () => {
    const { input, calls } = scenario([])
    const partial = await generatePracticeReply({ ...input, turns: input.turns.slice(0, 1) })
    const rehearsal = await generatePracticeReply({ ...input, rehearsal: true })
    expect([partial.feedback, rehearsal.feedback]).toEqual([null, null])
    expect(calls.map((call) => call.name)).toEqual(['generate', 'generate'])
    const old = scenario([], false)
    const legacy = await generatePracticeReply(old.input)
    expect(legacy.feedback).toBeTruthy()
    expect(old.calls.map((call) => call.name)).toEqual(['score', 'generate'])
  })
})
