import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePracticeReply } from './dify-practice'
import { contentHash, defaultKnowledgeContent } from './knowledge-content'
import { exampleFeedback, exampleJevResponse, exampleTexts } from './fixtures/practice-analysis'
import { defaultCharacterContent, characterContentHash } from './character-content'
import { characters, episodes } from '$lib/adventure-catalog'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('同じ公開方針を生成と評価に適用する', () => {
  it('6人×12話で長い人物設定と過去の記憶があってもDifyの入力上限を守る', async () => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture')
    vi.stubEnv('TYPESAFE_API_KEY', 'fixture')
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      expect(options.method).toBe('POST')
      return {
        ok: true,
        json: async () =>
          url.includes('typesafe.ai')
            ? exampleJevResponse()
            : {
                data: {
                  status: 'succeeded',
                  outputs: {
                    result: { reply: '私も話せて嬉しかったです。', feedback: exampleFeedback }
                  }
                }
              }
      }
    })
    vi.stubGlobal('fetch', fetch)
    for (const c of characters) {
      const content = defaultCharacterContent(c.id)
      content.profile.personality = '穏'.repeat(150)
      content.profile.interests = '歩'.repeat(100)
      content.profile.background = '景'.repeat(120)
      for (const response of Object.values(content.responses)) {
        response.guidance = '返'.repeat(120)
        response.example = '例'.repeat(120)
      }
      for (const e of episodes.filter((e) => e.characterId === c.id)) {
        await generatePracticeReply({
          id: 'limit-fixture',
          sceneId: 'adventure',
          adventure: { version: 1, characterId: c.id, episodeId: e.id, turns: 3 },
          turns: exampleTexts
            .slice(0, 2)
            .map((userText) => ({ userText, assistantText: 'はい。' })),
          text: exampleTexts[2],
          characterContext: {
            releaseId: null,
            version: null,
            characterId: c.id,
            contentHash: characterContentHash(content),
            content
          },
          storyContext: {
            version: 1,
            chapter: e.chapter ?? null,
            relationship: 'この話の関係',
            revisit: false,
            memories: Array.from({ length: 6 }, () => ({
              episodeId: 'past',
              userQuote: 'あ'.repeat(100),
              partnerReply: 'い'.repeat(100)
            }))
          }
        })
        const input = JSON.parse(fetch.mock.calls.at(-1)![1].body as string)
        expect(input.inputs.scene.length).toBeLessThanOrEqual(4000)
        expect(JSON.parse(input.inputs.scene).partnerDescription).toContain('穏'.repeat(150))
      }
    }
  })
  it('人物設定はDifyの相手役に渡し、Jevの採点条件へ混ぜない', async () => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture')
    vi.stubEnv('TYPESAFE_API_KEY', 'fixture')
    const content = defaultCharacterContent('aoi')
    content.profile.background = '青い便箋を集めるのが好き。'
    content.stages.honesty = '本音の段階だけの設定。'
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      expect(options.method).toBe('POST')
      return {
        ok: true,
        json: async () =>
          url.includes('typesafe.ai')
            ? exampleJevResponse()
            : {
                data: {
                  status: 'succeeded',
                  outputs: {
                    result: { reply: '私も、話せて嬉しかったです。', feedback: exampleFeedback }
                  }
                }
              }
      }
    })
    vi.stubGlobal('fetch', fetch)
    await generatePracticeReply({
      id: 'character-final',
      sceneId: 'adventure',
      adventure: { version: 1, characterId: 'aoi', episodeId: 'aoi-1', turns: 3 },
      turns: exampleTexts
        .slice(0, 2)
        .map((userText) => ({ userText, assistantText: 'そうですね。' })),
      text: exampleTexts[2],
      characterContext: {
        releaseId: null,
        version: null,
        characterId: 'aoi',
        contentHash: characterContentHash(content),
        content
      },
      storyContext: { version: 1, chapter: 1, relationship: '初対面', revisit: true, memories: [] }
    })
    const dify = JSON.parse(fetch.mock.calls.at(-1)![1].body as string)
    expect(JSON.parse(dify.inputs.scene).partnerDescription).toContain('青い便箋')
    expect(dify.inputs.scene).not.toContain('本音の段階だけ')
    expect(dify.inputs.scene.length).toBeLessThanOrEqual(4000)
    for (const [url, options] of fetch.mock.calls)
      if (url.includes('typesafe.ai')) expect(options.body).not.toContain('青い便箋')
  })
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
