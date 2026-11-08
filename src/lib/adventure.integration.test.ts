import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  characters,
  episodes,
  normalizeAdventure,
  resolveAdventure,
  episodeUnlocked,
  parseMission,
  parsePresentation
} from './adventure'
import { parsePracticeOutput } from './server/practice-feedback'
import { generatePracticeReply } from './server/dify-practice'
import { exampleFeedback, exampleTexts } from './server/fixtures/practice-analysis'
const adventure = {
  version: 1 as const,
  characterId: 'aoi' as const,
  episodeId: 'aoi-1',
  turns: 6 as const
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('キャラクター・物語・補助情報の検証', () => {
  it('男女各3人と24場面を定義し、各人物に3話と6つの単発場面を用意する', () => {
    expect(characters.filter((c) => c.gender === 'male')).toHaveLength(3)
    expect(characters.filter((c) => c.gender === 'female')).toHaveLength(3)
    expect(characters.every((c) => c.age >= 20)).toBe(true)
    expect(episodes).toHaveLength(24)
    expect(new Set(episodes.map((e) => e.id)).size).toBe(24)
    for (const c of characters)
      expect(episodes.filter((e) => e.characterId === c.id).map((e) => e.chapter)).toEqual([
        1, 2, 3
      ])
    expect(episodes.filter((e) => !e.characterId)).toHaveLength(6)
  })
  it('人物・場面・往復数を検証し、報酬などのクライアント指定を採用しない', () => {
    expect(normalizeAdventure({ ...adventure, xp: 9999 })).toEqual(adventure)
    for (const patch of [
      { characterId: 'unknown' },
      { episodeId: 'yu-1' },
      { turns: 4 },
      { turns: '6' }
    ])
      expect(normalizeAdventure({ ...adventure, ...patch })).toBeNull()
    expect(episodeUnlocked({ ...adventure, episodeId: 'aoi-2' }, [])).toBe(false)
    expect(episodeUnlocked({ ...adventure, episodeId: 'aoi-2' }, ['aoi:aoi-1'])).toBe(true)
    expect(resolveAdventure(adventure)).toMatchObject({
      partnerName: 'あおい',
      coachingProfile: 'first_meeting',
      mission: { id: 'feeling' }
    })
  })
  it('ミッションには本人の実際の発言の引用と正しいIDが必要', () => {
    const value = {
      id: 'feeling',
      achieved: true,
      evidence: [{ turn: 1, quote: '緊張しています。' }]
    }
    expect(parseMission(value, adventure, ['少し緊張しています。'])).toEqual({
      id: 'feeling',
      evidence: value.evidence
    })
    for (const patch of [
      { id: 'invite' },
      { achieved: false },
      { evidence: [] },
      { evidence: [{ turn: 0, quote: '緊張しています。' }] },
      { evidence: [{ turn: 1, quote: 'うれしいです。' }] }
    ])
      expect(parseMission({ ...value, ...patch }, adventure, ['少し緊張しています。'])).toBeNull()
  })
  it('未知の表情や長いしぐさを安全な表示へ戻す', () => {
    expect(parsePresentation({ emotion: 'shy', gesture: '胸元に手を添えて、少し笑う。' })).toEqual({
      emotion: 'shy',
      gesture: '胸元に手を添えて、少し笑う。'
    })
    expect(parsePresentation({ emotion: 'angry', gesture: 'x'.repeat(101) })).toEqual({
      emotion: 'neutral',
      gesture: ''
    })
  })
  it('6往復は実際の番号を保った代表3返答を分析し、範囲外の引用を拒否する', () => {
    const texts = [...exampleTexts, ...exampleTexts]
    const feedback = structuredClone(exampleFeedback)
    feedback.analysis!.turns[1].turn = 5
    feedback.analysis!.turns[2].turn = 6
    const parsed = parsePracticeOutput({ reply: 'ありがとうございます。', feedback }, texts, true)
    expect(parsed.feedback?.analysis?.turns.map((t) => t.turn)).toEqual([1, 5, 6])
    feedback.analysis!.turns[2].turn = 7
    expect(() =>
      parsePracticeOutput({ reply: 'ありがとうございます。', feedback }, texts, true)
    ).toThrow('quote')
  })
  it('Difyへ人物・ミッション・6往復を渡し、実測以外の報酬値を採用しない', async () => {
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'test')
    vi.stubEnv('TYPESAFE_API_KEY', '')
    const texts = [...exampleTexts, ...exampleTexts]
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: {
            result: {
              reply: '話せてよかったです。',
              feedback: exampleFeedback,
              presentation: { emotion: 'relieved', gesture: '胸に手を添えてほっとする。' },
              mission: {
                id: 'feeling',
                achieved: true,
                evidence: [{ turn: 1, quote: exampleTexts[0] }]
              },
              xp: 9999
            }
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    const result = await generatePracticeReply({
      id: 'test',
      sceneId: 'adventure',
      adventure,
      turns: texts.slice(0, 5).map((userText) => ({ userText, assistantText: 'そうなんですね。' })),
      text: texts[5]
    })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.inputs.total_turns).toBe(6)
    expect(JSON.parse(body.inputs.scene)).toMatchObject({
      character: { id: 'aoi' },
      mission: { id: 'feeling' }
    })
    expect(result).toMatchObject({
      presentation: { emotion: 'relieved' },
      mission: { id: 'feeling' }
    })
    expect(result).not.toHaveProperty('xp')
  })
})
