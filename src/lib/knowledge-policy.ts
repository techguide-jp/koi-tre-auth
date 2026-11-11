export const knowledgeProfiles = [
  'first_meeting',
  'interests',
  'silence',
  'invitation',
  'boundary',
  'conflict',
  'positive_event',
  'feelings',
  'general'
] as const
export type KnowledgeProfile = (typeof knowledgeProfiles)[number]
export type KnowledgeCoaching = 'reciprocal-small-talk-v1'
export interface KnowledgeDocument {
  id: string
  title: string
  content: string
  profiles: KnowledgeProfile[]
}
export interface KnowledgeContent {
  core: string
  documents: KnowledgeDocument[]
  // 未指定の公開版は従来方式に固定し、既存会話の検索とハッシュを変えない。
  retrieval?: 'scene-bm25-v2'
  coaching?: KnowledgeCoaching
}
export type KnowledgeRetriever = 'scene-bm25-v1' | 'scene-bm25-v2'
export interface KnowledgeSource {
  documentId: string
  chunkIndex: number
}
export interface KnowledgeTrace {
  releaseId: string | null
  version: number | null
  contentHash: string
  contextHash: string
  retriever: KnowledgeRetriever
  profile: KnowledgeProfile
  coaching?: KnowledgeCoaching
  sources: KnowledgeSource[]
}
export interface KnowledgePassage extends KnowledgeSource {
  title: string
  content: string
}
export interface KnowledgeContext {
  core: string
  passages: KnowledgePassage[]
  trace: KnowledgeTrace
}
export interface KnowledgeRelease {
  id: string
  version: number
  content: KnowledgeContent
  contentHash: string
  note: string
  createdBy: string
  createdAt: string
}
export interface KnowledgePreview {
  revision: number
  contentHash: string
  checkedBy: string
  checkedAt: string
  caseId: string
  passed: boolean
}
export interface KnowledgeOverview {
  revision: number
  draft: KnowledgeContent
  active: KnowledgeRelease | null
  releases: Omit<KnowledgeRelease, 'content'>[]
  preview: KnowledgePreview | null
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('文書の形式を確認してください。')
  return value as Record<string, unknown>
}
function text(value: unknown, min: number, max: number) {
  if (
    typeof value !== 'string' ||
    value.includes('\0') ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw Error(`文字数を${min}〜${max}字で入力してください。`)
  return value.trim()
}
export function parseKnowledgeContent(value: unknown): KnowledgeContent {
  const input = record(value)
  const core = text(input.core, 20, 3000)
  if (input.retrieval !== undefined && input.retrieval !== 'scene-bm25-v2')
    throw Error('検索方式を確認してください。')
  if (input.coaching !== undefined && input.coaching !== 'reciprocal-small-talk-v1')
    throw Error('雑談の評価方針を確認してください。')
  if (!Array.isArray(input.documents) || input.documents.length > 40)
    throw Error('知識文書は40件までです。')
  const ids = new Set<string>()
  let size = core.length
  const documents = input.documents.map((raw) => {
    const doc = record(raw),
      id = text(doc.id, 1, 64)
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
      throw Error('文書IDが不正、または重複しています。')
    ids.add(id)
    const title = text(doc.title, 1, 80),
      content = text(doc.content, 1, 12000)
    if (
      !Array.isArray(doc.profiles) ||
      doc.profiles.length > knowledgeProfiles.length ||
      doc.profiles.some((p) => !knowledgeProfiles.includes(p as KnowledgeProfile))
    )
      throw Error('文書の対象場面を確認してください。')
    size += content.length + title.length
    return { id, title, content, profiles: [...new Set(doc.profiles)] as KnowledgeProfile[] }
  })
  if (size > 100000) throw Error('方針と知識文書は合計10万字までです。')
  return {
    core,
    documents,
    ...(input.retrieval === 'scene-bm25-v2' ? { retrieval: input.retrieval } : {}),
    ...(input.coaching === 'reciprocal-small-talk-v1' ? { coaching: input.coaching } : {})
  }
}

export function knowledgeChunks(doc: KnowledgeDocument): KnowledgePassage[] {
  const chunks: string[] = []
  for (const paragraph of doc.content
    .split(/\n\s*\n/u)
    .map((p) => p.trim())
    .filter(Boolean)) {
    if (paragraph.length <= 600) chunks.push(paragraph)
    else
      for (let start = 0; start < paragraph.length; start += 520)
        chunks.push(paragraph.slice(start, start + 600))
  }
  return chunks.map((content, chunkIndex) => ({
    documentId: doc.id,
    chunkIndex,
    title: doc.title,
    content
  }))
}
function terms(value: string) {
  const words =
    value
      .normalize('NFKC')
      .toLowerCase()
      .match(/[a-z0-9]+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+/gu) ?? []
  return words.flatMap((word) =>
    /^[a-z0-9]+$/.test(word)
      ? [word]
      : Array.from({ length: Math.max(0, word.length - 1) }, (_, i) => word.slice(i, i + 2))
  )
}

export function retrieveKnowledge(
  content: KnowledgeContent,
  profile: KnowledgeProfile,
  query: string
): KnowledgePassage[] {
  const precise = content.retrieval === 'scene-bm25-v2'
  const docs = content.documents.filter(
    (doc) => !doc.profiles.length || doc.profiles.includes(profile)
  )
  const chunks = docs.flatMap((doc) =>
    knowledgeChunks(doc).map((passage) => ({
      passage,
      tagged: doc.profiles.includes(profile),
      words: terms(`${doc.title} ${passage.content}`)
    }))
  )
  if (!chunks.length) return []
  const wanted = [...new Set(terms(query))].slice(0, 400)
  const average = chunks.reduce((sum, chunk) => sum + chunk.words.length, 0) / chunks.length || 1
  const frequency = new Map(
    wanted.map((term) => [term, chunks.filter((chunk) => chunk.words.includes(term)).length])
  )
  const ranked = chunks
    .map((chunk) => {
      let score = chunk.tagged ? 2 : 0
      let matched = false
      for (const term of wanted) {
        const tf = chunk.words.filter((word) => word === term).length
        if (!tf) continue
        matched = true
        const df = frequency.get(term) ?? 0
        const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5))
        score += (idf * (tf * 2.2)) / (tf + 1.2 * (0.25 + (0.75 * chunk.words.length) / average))
      }
      return { ...chunk, score, matched }
    })
    .filter((chunk) => chunk.score > 0 && (!precise || chunk.matched))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.passage.documentId.localeCompare(b.passage.documentId) ||
        a.passage.chunkIndex - b.passage.chunkIndex
    )
  const result: KnowledgePassage[] = [],
    counts = new Map<string, number>()
  for (const chunk of ranked) {
    const id = chunk.passage.documentId
    if ((counts.get(id) ?? 0) >= (precise ? 1 : 2)) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
    result.push(chunk.passage)
    if (result.length === 3) break
  }
  return result
}
