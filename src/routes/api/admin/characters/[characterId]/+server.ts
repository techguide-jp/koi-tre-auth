import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { parseCharacterId } from '$lib/character-policy'
import { requireKnowledgeAdmin } from '$lib/server/knowledge-admin-auth'
import {
  activateCharacter,
  getCharacterOverview,
  publishCharacter,
  saveCharacterSection
} from '$lib/server/db/repositories/character-policy'
import { previewCharacter } from '$lib/server/character-service'
import { privateJson, validId } from '$lib/server/practice-request'

function character(value: unknown) {
  try {
    return parseCharacterId(value)
  } catch {
    throw error(404, '人物が見つかりません。')
  }
}
function revision(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw error(400, '下書きの版を確認してください。')
  return value
}
async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > 40000) throw error(413, '入力が長すぎます。')
  const raw = await request.text()
  if (raw.length > 20000) throw error(413, '入力が長すぎます。')
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error()
    return value as Record<string, unknown>
  } catch {
    throw error(400, '入力内容を確認してください。')
  }
}
export const GET: RequestHandler = async ({ request, params }) => {
  await requireKnowledgeAdmin(request)
  return privateJson(await getCharacterOverview(character(params.characterId)))
}
export const PUT: RequestHandler = async ({ request, params }) => {
  const actor = await requireKnowledgeAdmin(request),
    id = character(params.characterId),
    input = await body(request)
  return privateJson(
    await saveCharacterSection(actor.uid, id, revision(input.revision), input.section, input.value)
  )
}
export const POST: RequestHandler = async ({ request, params }) => {
  const actor = await requireKnowledgeAdmin(request),
    id = character(params.characterId),
    input = await body(request)
  if (input.action === 'preview')
    return privateJson(
      await previewCharacter(actor.uid, id, revision(input.revision), input.episodeId, input.text)
    )
  if (input.action === 'publish') {
    if (typeof input.note !== 'string' || input.note.trim().length > 200)
      throw error(400, '公開メモは200字までです。')
    return privateJson(
      await publishCharacter(
        actor.uid,
        id,
        revision(input.revision),
        input.reviewed === true,
        input.note.trim()
      )
    )
  }
  if (input.action === 'activate') {
    if (!validId(input.id) || (input.expected !== null && !validId(input.expected)))
      throw error(400, '公開版を確認してください。')
    return privateJson(
      await activateCharacter(actor.uid, id, input.id, input.expected as string | null)
    )
  }
  throw error(400, '操作内容を確認してください。')
}
