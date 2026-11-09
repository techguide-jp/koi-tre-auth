import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { parseKnowledgeContent } from '$lib/knowledge-policy'
import { requireKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import {
  activateKnowledgeRelease,
  getKnowledgeOverview,
  publishKnowledge,
  saveKnowledgeDraft
} from '$lib/server/db/repositories/knowledge'
import { knowledgePreviewCases, previewKnowledge } from '$lib/server/knowledge-service'
import { privateJson, validId } from '$lib/server/practice-request'

async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > 600000) throw error(413, '入力が長すぎます。')
  const raw = await request.text()
  if (raw.length > 300000) throw error(413, '入力が長すぎます。')
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid body')
    return value as Record<string, unknown>
  } catch {
    throw error(400, '入力内容を確認してください。')
  }
}
function revision(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw error(400, '下書きの版を確認してください。')
  return value
}
const view = async () => ({ ...(await getKnowledgeOverview()), cases: knowledgePreviewCases })
export const GET: RequestHandler = async ({ request }) => {
  await requireKnowledgeAdmin(request)
  return privateJson(await view())
}
export const PUT: RequestHandler = async ({ request }) => {
  const actor = await requireKnowledgeAdmin(request),
    input = await body(request)
  let content
  try {
    content = parseKnowledgeContent(input.content)
  } catch (cause) {
    throw error(400, cause instanceof Error ? cause.message : '文書を確認してください。')
  }
  await saveKnowledgeDraft(actor.uid, revision(input.revision), content)
  return privateJson(await view())
}
export const POST: RequestHandler = async ({ request }) => {
  const actor = await requireKnowledgeAdmin(request),
    input = await body(request)
  if (input.action === 'preview') {
    if (typeof input.caseId !== 'string') throw error(400, '確認する会話を選んでください。')
    return privateJson(await previewKnowledge(actor.uid, revision(input.revision), input.caseId))
  }
  if (input.action === 'publish') {
    if (typeof input.note !== 'string' || input.note.trim().length > 200)
      throw error(400, '公開メモは200字までです。')
    await publishKnowledge(
      actor.uid,
      revision(input.revision),
      input.reviewed === true,
      input.note.trim()
    )
    return privateJson(await view())
  }
  if (input.action === 'activate') {
    if (!validId(input.id) || (input.expected !== null && !validId(input.expected)))
      throw error(400, '公開版を確認してください。')
    await activateKnowledgeRelease(actor.uid, input.id, input.expected as string | null)
    return privateJson(await view())
  }
  throw error(400, '操作内容を確認してください。')
}
