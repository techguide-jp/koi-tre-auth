import { afterEach, describe, expect, it, vi } from 'vitest'
import { scenes, sceneWithPartner } from '$lib/practice'
import { generatePracticeReply } from './dify-practice'
import { assessedFeedback } from './fixtures/progression-assessment'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([1, 3])(
  '体験ではDifyの分析が%i件でも、1件の言い換えと相手のリアクションを返す',
  async (count) => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'local-test-key')
    vi.stubEnv('TYPESAFE_API_KEY', '')
    const text = '窓が大きくて、ゆっくりできそうですね。'
    const feedback = assessedFeedback(text)
    feedback.analysis!.turns = Array.from({ length: count }, () => feedback.analysis!.turns[0])
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: {
            result: {
              reply: 'そうですね。私も窓際が好きです。',
              presentation: { emotion: 'smile', gesture: '窓の方へ手を開く。' },
              feedback
            }
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    const result = await generatePracticeReply({
      id: 'trial-test-id',
      sceneId: 'adventure',
      adventure: { version: 1, characterId: 'aoi', episodeId: 'aoi-1', turns: 3, trial: true },
      turns: [],
      text
    })
    const body = JSON.parse(fetch.mock.calls.at(-1)![1].body)
    expect(body.inputs).toMatchObject({ turn: 1, total_turns: 1 })
    const scene = JSON.parse(body.inputs.scene)
    expect(scene.coaching.avoid).toContain('実際の1回目のみ1件')
    expect(scene.coaching.replyStyle).toBe('respond_and_share')
    expect(JSON.parse(body.inputs.transcript)).toEqual([
      { role: 'assistant', content: scene.opener },
      { role: 'user', content: text, turn: 1 }
    ])
    expect(result).toMatchObject({
      reply: 'そうですね。私も窓際が好きです。',
      presentation: { emotion: 'smile' },
      mission: null,
      feedback: { analysis: { turns: [{ turn: 1, quote: text }] } }
    })
  }
)

describe('会話相手の呼び名', () => {
  it.each(['male', 'female'] as const)(
    '選んだ%sの相手をユーザーの性別と分けてDifyへ渡す',
    async (preference) => {
      vi.stubEnv('DIFY_PRACTICE_API_KEY', 'local-test-key')
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 'succeeded',
            outputs: { result: { reply: 'お会いできてうれしいです。', feedback: null } }
          }
        })
      })
      vi.stubGlobal('fetch', fetch)
      const customScene = sceneWithPartner('cafe', preference)!
      await generatePracticeReply({
        id: 'partner-test-id',
        sceneId: 'custom',
        customScene,
        turns: [],
        text: '今日はよろしくお願いします。'
      })
      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(JSON.parse(body.inputs.scene)).toMatchObject({
        situation: customScene.situation,
        partnerName: customScene.partnerName,
        opener: customScene.openingLine
      })
      expect(body).not.toHaveProperty('gender')
      expect(body.user).toBe('partner-test-id')
    }
  )
  it('カスタム状況と相手名を、保存された設定から生成に渡す', async () => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'local-test-key')
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: { result: { reply: '来週も会えたらうれしいです。', feedback: null } }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    const customScene = {
      situation: 'デートの帰り道。次の約束をしたい。',
      partnerName: 'ゆう',
      openingLine: '今日は楽しかったですね。'
    }
    await generatePracticeReply({
      id: 'custom-practice-id',
      sceneId: 'custom',
      customScene,
      turns: [],
      text: 'ゆうさん、来週も会いませんか？'
    })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(JSON.parse(body.inputs.scene)).toMatchObject({
      situation: customScene.situation,
      partnerName: 'ゆう'
    })
    expect(JSON.parse(body.inputs.transcript)[0].content).toBe(customScene.openingLine)
    expect(body.user).toBe('custom-practice-id')
  })
  it.each(scenes)('$title の表示名と紹介をDifyに引き継ぐ', async (scene) => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'local-test-key')
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: { result: { reply: 'はい、そうです。', feedback: null } }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    await generatePracticeReply({
      id: 'practice-id',
      sceneId: scene.id,
      turns: [],
      text: `${scene.partnerName}さん、よろしくお願いします。`
    })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(JSON.parse(body.inputs.scene)).toMatchObject({
      partnerName: scene.partnerName,
      partnerDescription: scene.partnerDescription
    })
    expect(JSON.parse(body.inputs.transcript)[0]).toEqual({
      role: 'assistant',
      content: scene.opener
    })
    expect(scene.opener).toContain(scene.partnerName)
    expect(body.user).toBe('practice-id')
  })
})
