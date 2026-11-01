import { afterEach, describe, expect, it, vi } from 'vitest'
import { scenes, sceneWithPartner } from '$lib/practice'
import { generatePracticeReply } from './dify-practice'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

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
