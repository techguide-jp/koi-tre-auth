import { createHash } from 'node:crypto'
import {
  knowledgeChunks,
  retrieveKnowledge,
  parseKnowledgeContent,
  type KnowledgeContent,
  type KnowledgeContext,
  type KnowledgeProfile,
  type KnowledgeTrace,
  type KnowledgeRetriever
} from '$lib/knowledge-policy'
import { coachingProfiles } from './practice-coaching'

type ContextRelease = {
  id: string | null
  version: number | null
  content: KnowledgeContent
  contentHash: string
}

export const defaultKnowledgeContent = (): KnowledgeContent => ({
  core: '本人と相手の双方の意思を尊重する。自分を抑えて同意し続けることを正解にしない。誘う・断る・保留する・終える意思を認め、謝罪・理由・代案を必須にしない。\n\n今回の場面と実際の本人の発言を根拠にする。質問数・文字数・敬語だけで評価せず、相互性と自然な受け渡しを見る。本人が話していない経験・感情・好みを作らず、元の意思を保った具体的な言い換えを提案する。\n\n強み・改善点は根拠がある件数だけを出し、0件も認める。既にできていることを不足扱いしない。不確実さを示し、人格・相手の本心・恋愛の成功率を判定しない。点数や好感度だけで交際・同意を確定せず、支払い・好感度を理由に採点を甘くしない。',
  documents: Object.entries(coachingProfiles).map(([id, profile]) => ({
    id: `scene-${id}`,
    title: profile.label,
    content: [profile.purpose, profile.focus, profile.avoid, profile.expression].join(' '),
    profiles: [id as KnowledgeProfile]
  })),
  retrieval: 'scene-bm25-v2'
})
export const contentHash = (content: KnowledgeContent) =>
  createHash('sha256')
    .update(JSON.stringify(parseKnowledgeContent(content)))
    .digest('hex')
function contextHash(
  core: string,
  passages: KnowledgeContext['passages'],
  profile: KnowledgeProfile,
  hash: string,
  retriever: KnowledgeRetriever
) {
  return createHash('sha256')
    .update(JSON.stringify({ core, passages, profile, contentHash: hash, retriever }))
    .digest('hex')
}
export function makeKnowledgeContext(
  release: ContextRelease,
  profile: KnowledgeProfile,
  query: string
): KnowledgeContext {
  const passages = retrieveKnowledge(release.content, profile, query)
  const retriever = release.content.retrieval ?? 'scene-bm25-v1'
  return {
    core: release.content.core,
    passages,
    trace: {
      releaseId: release.id,
      version: release.version,
      contentHash: release.contentHash,
      contextHash: contextHash(
        release.content.core,
        passages,
        profile,
        release.contentHash,
        retriever
      ),
      retriever,
      profile,
      sources: passages.map(({ documentId, chunkIndex }) => ({ documentId, chunkIndex }))
    }
  }
}
export function restoreKnowledgeContext(
  release: ContextRelease,
  trace: KnowledgeTrace
): KnowledgeContext {
  if (
    trace.releaseId !== release.id ||
    trace.version !== release.version ||
    trace.contentHash !== release.contentHash ||
    trace.retriever !== (release.content.retrieval ?? 'scene-bm25-v1')
  )
    throw Error('保存された評価方針の版が一致しません。')
  const chunks = release.content.documents.flatMap(knowledgeChunks)
  const passages = trace.sources.map((source) => {
    const passage = chunks.find(
      (p) => p.documentId === source.documentId && p.chunkIndex === source.chunkIndex
    )
    if (!passage) throw Error('保存された参照箇所が見つかりません。')
    return passage
  })
  if (
    contextHash(
      release.content.core,
      passages,
      trace.profile,
      release.contentHash,
      trace.retriever
    ) !== trace.contextHash
  )
    throw Error('保存された評価方針の内容が一致しません。')
  return { core: release.content.core, passages, trace }
}
