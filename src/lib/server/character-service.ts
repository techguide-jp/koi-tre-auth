import { error } from '@sveltejs/kit'
import { randomUUID } from 'node:crypto'
import { episodes, type CharacterId } from '$lib/adventure-catalog'
import { affinityLabel, stageRules } from '$lib/adventure-progression'
import { characterContentHash } from './character-content'
import { generatePracticeReply } from './dify-practice'
import { getCharacterOverview, saveCharacterPreview } from './db/repositories/character-policy'
import { getKnowledgeOverview } from './db/repositories/knowledge'

export async function previewCharacter(
  actor: string,
  id: CharacterId,
  revision: number,
  episodeId: unknown,
  text: unknown
) {
  const overview = await getCharacterOverview(id)
  if (!revision || overview.revision !== revision)
    throw error(409, '下書きを保存し、最新の状態で確認してください。')
  const episode = episodes.find((e) => e.id === episodeId && e.characterId === id)
  if (
    !episode ||
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 500 ||
    text.includes('\0')
  )
    throw error(400, '場面を選び、500字以内で話しかけてください。')
  const content = overview.draft,
    hash = characterContentHash(content),
    chapter = episode.chapter ?? null
  const affinity = stageRules.find((r) => r.chapter === chapter)?.affinity ?? 0
  const policyReleaseId =
    process.env.KNOWLEDGE_POLICY_ENABLED === 'true'
      ? ((await getKnowledgeOverview()).active?.id ?? null)
      : null
  try {
    const output = await generatePracticeReply({
      id: `character-preview-${randomUUID()}`,
      sceneId: 'adventure',
      adventure: { version: 1, characterId: id, episodeId: episode.id, turns: 3 },
      turns: [],
      text: text.trim(),
      rehearsal: true,
      policyReleaseId,
      characterContext: {
        releaseId: null,
        version: null,
        characterId: id,
        contentHash: hash,
        content
      },
      storyContext: {
        version: 1,
        chapter,
        relationship: 'この場面に明記された関係の二人',
        revisit: false,
        memories: [],
        affinity: { value: affinity, label: affinityLabel(affinity) }
      }
    })
    const preview = {
      revision,
      contentHash: hash,
      checkedBy: actor,
      checkedAt: new Date().toISOString(),
      episodeId: episode.id,
      reply: output.reply,
      passed: !!output.reply?.trim()
    }
    await saveCharacterPreview(id, preview)
    return {
      preview,
      opener: episode.opener,
      text: text.trim(),
      presentation: 'presentation' in output ? output.presentation : null
    }
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) throw cause
    await saveCharacterPreview(id, {
      revision,
      contentHash: hash,
      checkedBy: actor,
      checkedAt: new Date().toISOString(),
      episodeId: episode.id,
      reply: '',
      passed: false
    })
    throw error(
      502,
      '返信を確認できませんでした。入力の長さとAIの接続を確認して、もう一度お試しください。'
    )
  }
}
