import { describe, expect, it } from 'vitest'
import { parseKnowledgeContent, retrieveKnowledge, type KnowledgeContent } from './knowledge-policy'
import { practiceQuestions } from './server/jev-practice'
import { practiceCoaching } from './server/practice-coaching'
import {
  contentHash,
  makeKnowledgeContext,
  restoreKnowledgeContext
} from './server/knowledge-content'

const legacy: KnowledgeContent = {
  core: '本人と相手の意思を尊重し、実際の発言を根拠にする。',
  documents: [
    { id: 'a', title: '誘い', content: 'カフェで土曜日の約束をする。', profiles: ['invitation'] }
  ]
}
const precise = (content: KnowledgeContent): KnowledgeContent => ({
  ...content,
  retrieval: 'scene-bm25-v2'
})
describe('公開版に固定するRAG検索方式', () => {
  it('新方式は場面タグだけで資料を返さず、一致なし・空の検索では0件にする', () => {
    expect(retrieveKnowledge(precise(legacy), 'invitation', 'quasar9981')).toEqual([])
    expect(retrieveKnowledge(precise(legacy), 'invitation', '')).toEqual([])
    expect(retrieveKnowledge(precise(legacy), 'invitation', 'カフェ')).toHaveLength(1)
    expect(retrieveKnowledge(legacy, 'invitation', 'quasar9981')).toHaveLength(1)
  })
  it('異なる文書に枠を使い、旧方式は同じ文書2件の順序を維持する', () => {
    const content: KnowledgeContent = {
      ...legacy,
      documents: [
        {
          id: 'a',
          title: 'カフェ',
          content: 'カフェの約束。\n\nカフェの場所。\n\nカフェの時間。',
          profiles: ['invitation']
        },
        { id: 'b', title: '休日', content: 'カフェで散歩の話をする。', profiles: ['invitation'] },
        {
          id: 'c',
          title: '好み',
          content: 'カフェで好きな飲み物を話す。',
          profiles: ['invitation']
        },
        { id: 'd', title: 'カフェ', content: 'カフェで話す。', profiles: ['conflict'] }
      ]
    }
    const before = retrieveKnowledge(content, 'invitation', 'カフェ')
    expect(before.filter((p) => p.documentId === 'a')).toHaveLength(2)
    const after = retrieveKnowledge(precise(content), 'invitation', 'カフェ')
    expect(after).toHaveLength(3)
    expect(new Set(after.map((p) => p.documentId)).size).toBe(3)
    expect(after.map((p) => p.documentId).sort()).toEqual(['a', 'b', 'c'])
  })
  it('全場面の文書にも話題の一致を求め、長い文書を600字以内・1件に抑える', () => {
    const content = precise({
      ...legacy,
      documents: [
        { id: 'long', title: '予定', content: 'カフェでの会話。'.repeat(180), profiles: [] },
        { id: 'unrelated', title: '資格', content: '試験合格の報告を一緒に喜ぶ。', profiles: [] }
      ]
    })
    const result = retrieveKnowledge(content, 'general', 'カフェ')
    expect(result).toHaveLength(1)
    expect(result[0].documentId).toBe('long')
    expect(result[0].content.length).toBeLessThanOrEqual(600)
  })
  it('検索0件でも基本方針を維持し、使った方式と空の参照を正しく復元する', () => {
    const content = precise(legacy)
    const release = {
      id: 'release-fixture',
      version: 3,
      content,
      contentHash: contentHash(content)
    }
    const context = makeKnowledgeContext(release, 'invitation', 'quasar9981')
    expect(context.core).toBe(legacy.core)
    expect(context.passages).toEqual([])
    expect(context.trace.retriever).toBe('scene-bm25-v2')
    expect(restoreKnowledgeContext(release, context.trace)).toEqual(context)
    expect(() =>
      restoreKnowledgeContext(release, { ...context.trace, retriever: 'scene-bm25-v1' })
    ).toThrow()
  })
  it('旧JSONの形とハッシュを変えず、従来方式の保存済み参照を復元する', () => {
    expect(parseKnowledgeContent(legacy)).toEqual(legacy)
    expect(Object.hasOwn(parseKnowledgeContent(legacy), 'retrieval')).toBe(false)
    const release = {
      id: 'legacy-fixture',
      version: 1,
      content: legacy,
      contentHash: contentHash(legacy)
    }
    const context = makeKnowledgeContext(release, 'invitation', 'カフェ')
    expect(release.contentHash).toBe(
      '2cde7e5d75d7caa4bbfd835598d821c95015246e9c0d2027db471b72b974dc98'
    )
    expect(context.trace.contextHash).toBe(
      '6c2affb0afa064fb1ebcfd26c855b3ba41e8fe57728f8d6043be1c8bc377fb0c'
    )
    expect(context.trace.retriever).toBe('scene-bm25-v1')
    expect(restoreKnowledgeContext(release, context.trace)).toEqual(context)
    const updated = {
      ...release,
      content: precise(legacy),
      contentHash: contentHash(precise(legacy))
    }
    expect(() => restoreKnowledgeContext(updated, context.trace)).toThrow()
  })
  it('方式を保存対象へ含め、不明な方式や省略による新版の偽装を拒否する', () => {
    expect(parseKnowledgeContent(precise(legacy)).retrieval).toBe('scene-bm25-v2')
    expect(contentHash(precise(legacy))).not.toBe(contentHash(legacy))
    expect(() => parseKnowledgeContent({ ...legacy, retrieval: 'unknown' })).toThrow('検索方式')
    const release = {
      id: 'legacy-fixture',
      version: 1,
      content: legacy,
      contentHash: contentHash(legacy)
    }
    const context = makeKnowledgeContext(release, 'invitation', 'カフェ')
    expect(() =>
      restoreKnowledgeContext(release, { ...context.trace, retriever: 'scene-bm25-v2' })
    ).toThrow()
  })
})

describe('雑談の評価方針を公開版と場面で固定する', () => {
  const content = parseKnowledgeContent({ ...legacy, coaching: 'reciprocal-small-talk-v1' })
  const release = { id: 'new-coaching', version: 4, content, contentHash: contentHash(content) }

  it.each(['first_meeting', 'interests'] as const)(
    '%sは新版の指示を渡して同じ文脈を復元し、方式を偽装できない',
    (profile) => {
      const context = makeKnowledgeContext(release, profile, 'カフェ')
      expect(context.trace.coaching).toBe('reciprocal-small-talk-v1')
      expect(context.core).toContain('相手任せの会話を見逃すことではない')
      expect(restoreKnowledgeContext(release, context.trace)).toEqual(context)
      expect(() =>
        restoreKnowledgeContext(release, { ...context.trace, coaching: undefined })
      ).toThrow()
      expect(() => parseKnowledgeContent({ ...legacy, coaching: 'unknown' })).toThrow('雑談')
    }
  )

  it.each([
    'silence',
    'boundary',
    'invitation',
    'conflict',
    'positive_event',
    'feelings',
    'general'
  ] as const)('%sには雑談の基準を適用しない', (profile) => {
    const context = makeKnowledgeContext(release, profile, 'カフェ')
    expect(context.core).toBe(legacy.core)
    expect(context.trace).not.toHaveProperty('coaching')
    expect(practiceQuestions(practiceCoaching(undefined, profile), true, content.coaching)).toEqual(
      practiceQuestions(practiceCoaching(undefined, profile), true)
    )
    expect(restoreKnowledgeContext(release, context.trace)).toEqual(context)
  })
})
