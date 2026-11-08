import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveScene, scenes } from '$lib/practice'
import {
  coachingProfiles,
  parseCoachingChoice,
  practiceCoaching,
  type CoachingProfileId
} from './practice-coaching'
import { generatePracticeReply } from './dify-practice'
import { selectPracticeCoaching } from './jev-practice'
import { exampleFeedback, exampleJevResponse, exampleTexts } from './fixtures/practice-analysis'

function choice(profile: CoachingProfileId, probability = 0.95) {
  return {
    answers: {
      context: {
        type: 'choice',
        choice: profile,
        confidence: 0.01,
        probabilities: Object.fromEntries(
          Object.keys(coachingProfiles).map((id) => [
            id,
            id === profile ? probability : (1 - probability) / 7
          ])
        )
      }
    }
  }
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})
describe('場面に合う会話と評価', () => {
  it.each(['first_meeting', 'interests', 'silence'] as const)(
    '%sの組み込み場面は分類APIを増やさない',
    async (id) => {
      const scene = scenes.find((s) => practiceCoaching(s).id === id)!
      vi.stubEnv('TYPESAFE_API_KEY', 'test-key')
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      expect((await selectPracticeCoaching(scene, AbortSignal.timeout(6000))).id).toBe(id)
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('分類は確信度ではなく選択肢の確率を読み、未知・不完全・曖昧な結果は採用しない', () => {
    expect(parseCoachingChoice(choice('boundary'))).toBe('boundary')
    expect(parseCoachingChoice(choice('invitation', 0.4))).toBeUndefined()
    for (const value of [
      null,
      {},
      { answers: { context: { type: 'choice', choice: 'unknown', probabilities: {} } } }
    ])
      expect(parseCoachingChoice(value)).toBeUndefined()
    const invalid = choice('boundary')
    invalid.answers.context.probabilities.boundary = NaN
    expect(parseCoachingChoice(invalid)).toBeUndefined()
  })
  it.each(['unconfigured', 'http-error', 'invalid', 'ambiguous', 'timeout'] as const)(
    '%sでは自由入力の元の状況を保って汎用方針へ戻す',
    async (mode) => {
      vi.stubEnv('TYPESAFE_API_KEY', mode === 'unconfigured' ? '' : 'test-key')
      const fetch = vi.fn().mockImplementation(async () => {
        if (mode === 'timeout') throw new DOMException('timeout', 'TimeoutError')
        return {
          ok: mode !== 'http-error',
          json: async () => (mode === 'invalid' ? {} : choice('invitation', 0.4))
        }
      })
      vi.stubGlobal('fetch', fetch)
      const scene = resolveScene('custom', {
        situation: '初対面の相手と話す。誘いを断るときもある。',
        partnerName: 'ゆう',
        openingLine: ''
      })!
      expect((await selectPracticeCoaching(scene, AbortSignal.timeout(6000))).id).toBe('general')
      expect(scene.situation).toBe('初対面の相手と話す。誘いを断るときもある。')
      if (mode === 'unconfigured') expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('自由入力の分類結果をJevの評価、Difyの助言、保存メタデータへ引き継ぐ', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-dify')
    const fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      return {
        ok: true,
        json: async () =>
          url.includes('typesafe.ai')
            ? body.questions.context
              ? choice('boundary')
              : exampleJevResponse()
            : {
                data: {
                  status: 'succeeded',
                  outputs: { result: { reply: 'わかりました。', feedback: exampleFeedback } }
                }
              }
      }
    })
    vi.stubGlobal('fetch', fetch)
    const result = await generatePracticeReply({
      id: 'test-practice',
      sceneId: 'custom',
      customScene: {
        situation: '今日は帰りたいと伝え、誘いを断る。',
        partnerName: 'ゆう',
        openingLine: 'もう少し話しませんか？'
      },
      turns: exampleTexts
        .slice(0, 2)
        .map((userText) => ({ userText, assistantText: 'そうなんですね。' })),
      text: exampleTexts[2]
    })
    expect(fetch).toHaveBeenCalledTimes(3)
    const requests = fetch.mock.calls.map(([, init]) => JSON.parse(init.body))
    expect(requests[0].state).not.toHaveProperty('transcript')
    expect(requests[1].questions.self_expression.instructions).toContain(
      coachingProfiles.boundary.expression
    )
    const context = JSON.parse(requests[2].inputs.scene).coaching
    expect(context.id).toBe('boundary')
    expect(context.replyStyle).toBe('close_naturally')
    expect(result.feedback?.analysis?.assessment?.rubric).toEqual({
      version: 2,
      profile: 'boundary'
    })
  })
  it.each([0, 1])('途中%d回目はJevを呼ばず、会話の応答方針をDifyへ渡す', async (prior) => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-dify')
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: { result: { reply: '私は静かな場所が好きです。', feedback: null } }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    await generatePracticeReply({
      id: 'test',
      sceneId: 'hobbies',
      turns: prior
        ? [{ userText: '読書です。', assistantText: '物語に浸る時間もいいですね。' }]
        : [],
      text: '小説が好きです。'
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(JSON.parse(fetch.mock.calls[0][1].body).inputs.scene).coaching).toMatchObject(
      { id: 'interests', replyStyle: prior ? 'share_or_follow_up' : 'respond_and_share' }
    )
  })
  it('分類が期限切れでも追加の採点をせず、残り時間で文章生成を続ける', async () => {
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), ms)
      return controller.signal
    })
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-dify')
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (url.includes('typesafe.ai'))
        return new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('timeout', 'TimeoutError'))
          )
        )
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            status: 'succeeded',
            outputs: { result: { reply: 'わかりました。', feedback: exampleFeedback } }
          }
        })
      })
    })
    vi.stubGlobal('fetch', fetch)
    const result = generatePracticeReply({
      id: 'test',
      sceneId: 'custom',
      customScene: { situation: '誘いを断る。', partnerName: 'ゆう', openingLine: '' },
      turns: exampleTexts.slice(0, 2).map((userText) => ({ userText, assistantText: 'はい。' })),
      text: exampleTexts[2]
    })
    await vi.advanceTimersByTimeAsync(6000)
    const output = await result
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(false)
    expect(output.feedback?.analysis).not.toHaveProperty('assessment')
  })
})
