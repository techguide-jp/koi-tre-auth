import { afterEach, describe, expect, it, vi } from 'vitest'
import { scenes } from '$lib/practice'
import { assessPractice, parseAssessment } from './jev-practice'
import { generatePracticeReply } from './dify-practice'
import { exampleFeedback, exampleJevResponse, exampleTexts } from './fixtures/practice-analysis'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const transcript = [{ role: 'user', content: exampleTexts[0], turn: 1 }]
describe('Jevの補助評価', () => {
  it('最終回だけJevで評価し、実測した判定をDifyと保存結果へ引き継ぐ', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-jev-key')
    vi.stubEnv('JEV_MODEL', 'jev-test')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-dify-key')
    const fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('typesafe.ai')
          ? exampleJevResponse()
          : {
              data: {
                status: 'succeeded',
                outputs: {
                  result: { reply: '教えてくれてありがとうございます。', feedback: exampleFeedback }
                }
              }
            }
    }))
    vi.stubGlobal('fetch', fetch)
    const result = await generatePracticeReply({
      id: 'test-practice',
      sceneId: 'cafe',
      turns: exampleTexts
        .slice(0, 2)
        .map((userText) => ({ userText, assistantText: 'そうなんですね。' })),
      text: exampleTexts[2]
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    const jevRequest = JSON.parse(fetch.mock.calls[0][1].body)
    expect(jevRequest.model).toBe('jev-test')
    expect(jevRequest.state).not.toHaveProperty('uid')
    expect(jevRequest.state).not.toHaveProperty('user')
    expect(
      jevRequest.state.transcript
        .filter((t: { role: string }) => t.role === 'user')
        .map((t: { turn: number }) => t.turn)
    ).toEqual([1, 2, 3])
    expect(Object.keys(jevRequest.questions)).toHaveLength(10)
    const difyRequest = JSON.parse(fetch.mock.calls[1][1].body)
    expect(JSON.parse(difyRequest.inputs.scene).assessment.aspects).toEqual(
      parseAssessment(exampleJevResponse()).aspects.map((aspect) => ({
        ...aspect,
        status: 'rated'
      }))
    )
    expect(result.feedback?.analysis?.assessment).toEqual(parseAssessment(exampleJevResponse()))
  })
  it('途中の返答ではJevを呼ばない', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-jev-key')
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test-dify-key')
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: { result: { reply: 'そうなんですね。', feedback: null } }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    await generatePracticeReply({
      id: 'test-practice',
      sceneId: 'cafe',
      turns: [],
      text: exampleTexts[0]
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/workflows/run')
  })
  it.each(['unconfigured', 'http-error', 'timeout', 'invalid'] as const)(
    '%sでも生成を継続できるよう補助評価なしを返す',
    async (mode) => {
      vi.stubEnv('TYPESAFE_API_KEY', mode === 'unconfigured' ? '' : 'test-key')
      const fetch = vi.fn().mockImplementation(async () => {
        if (mode === 'timeout') throw new DOMException('timeout', 'TimeoutError')
        return { ok: mode !== 'http-error', json: async () => ({ model: 'test', answers: {} }) }
      })
      vi.stubGlobal('fetch', fetch)
      expect(await assessPractice(scenes[0], transcript, AbortSignal.timeout(10000))).toBeNull()
      if (mode === 'unconfigured') expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('不正なスコア・確信度と欠落した判定を拒否する', () => {
    for (const patch of [{ score: NaN }, { score: 4 }, { confidence: 1.1 }, { confidence: -1 }]) {
      const value = exampleJevResponse()
      Object.assign(value.answers.acknowledgment, patch)
      expect(() => parseAssessment(value)).toThrow()
    }
    expect(() => parseAssessment({ model: 'test', answers: {} })).toThrow()
  })
  it('段階別の分布を保存し、旧形式の分布なしとも互換性を保つ', () => {
    const value = exampleJevResponse()
    Object.assign(value.answers.acknowledgment, {
      probabilities: { '0': 0, '1': 0, '2': 0.8, '3': 0.2 }
    })
    expect(parseAssessment(value).aspects[0].probabilities).toEqual([0, 0, 0.8, 0.2])
    expect(parseAssessment(exampleJevResponse()).aspects[0]).not.toHaveProperty('probabilities')
    for (const probabilities of [{ '0': 0.5 }, { '0': 0, '1': -1, '2': 1, '3': 1 }]) {
      Object.assign(value.answers.acknowledgment, { probabilities })
      expect(() => parseAssessment(value)).toThrow('distribution')
    }
  })
})
