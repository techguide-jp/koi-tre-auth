import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePracticeReply } from './dify-practice'
import { contentHash, defaultKnowledgeContent } from './knowledge-content'
import { exampleFeedback, exampleJevResponse, exampleTexts } from './fixtures/practice-analysis'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('同じ公開方針を生成と評価に適用する', () => {
  it.each([3, 6] as const)(
    '%s往復の最終回に同じ文脈を送り、サーバー側の出典を記録する',
    async (count) => {
      vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture')
      vi.stubEnv('TYPESAFE_API_KEY', 'fixture')
      const content = defaultKnowledgeContent()
      const texts = Array.from({ length: count }, (_, i) => exampleTexts[i % 3])
      const feedback = structuredClone(exampleFeedback)
      feedback.analysis!.version = 3
      feedback.analysis!.turns = texts.map((text, i) => ({
        ...exampleFeedback.analysis!.turns[i % 3],
        turn: i + 1,
        quote: text
      }))
      const fetch = vi.fn(async (url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string)
        return {
          ok: true,
          json: async () =>
            url.includes('typesafe.ai')
              ? exampleJevResponse()
              : {
                  data: {
                    status: 'succeeded',
                    outputs: {
                      policy_hash: body.inputs.policy_hash,
                      result: { reply: '楽しく話せました。', feedback }
                    }
                  }
                }
        }
      })
      vi.stubGlobal('fetch', fetch)
      const result = await generatePracticeReply({
        id: 'fictional-policy-preview',
        sceneId: 'adventure',
        adventure: { version: 1, characterId: 'aoi', episodeId: 'aoi-1', turns: count },
        turns: texts.slice(0, -1).map((userText) => ({ userText, assistantText: 'そうですね。' })),
        text: texts.at(-1)!,
        policyOverride: { content, contentHash: contentHash(content) }
      })
      const jev = JSON.parse(fetch.mock.calls[0][1].body as string),
        dify = JSON.parse(fetch.mock.calls[1][1].body as string)
      expect(JSON.parse(dify.inputs.policy_context)).toEqual(jev.state.policy)
      expect(jev.state.policy.core).toBe(content.core)
      expect(jev.state.policy.passages.length).toBeGreaterThan(0)
      expect(dify.inputs.scene.length).toBeLessThanOrEqual(4000)
      expect(result.policyContext).toEqual(jev.state.policy.trace)
      expect(result.feedback?.analysis?.assessment?.policy).toEqual(result.policyContext)
      expect(result.feedback?.analysis?.policy).toEqual(result.policyContext)
    }
  )
  it('途中にも方針を適用し、旧Workflowの受領不一致では成功扱いにしない', async () => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture')
    const content = defaultKnowledgeContent()
    const fetch = vi.fn(async (_url: string, options: RequestInit) => ({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: {
            policy_hash: JSON.parse(options.body as string).inputs.policy_hash,
            result: { reply: '私も好きです。', feedback: null }
          }
        }
      })
    }))
    vi.stubGlobal('fetch', fetch)
    const input = {
      id: 'fictional',
      sceneId: 'hobbies' as const,
      turns: [],
      text: '漫画が好きです。',
      policyOverride: { content, contentHash: contentHash(content) }
    }
    const result = await generatePracticeReply(input)
    expect(result.policyContext?.profile).toBe('interests')
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: { policy_hash: 'wrong', result: { reply: '返答です。', feedback: null } }
        }
      })
    }))
    await expect(generatePracticeReply(input)).rejects.toThrow('acknowledgement')
  })
})
