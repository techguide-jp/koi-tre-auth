import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import {
  parseCharacterContent,
  parseCharacterSection,
  type CharacterOverview,
  type CharacterPreview,
  type CharacterRelease,
  type CharacterSnapshot
} from '$lib/character-policy'
import type { CharacterId } from '$lib/adventure-catalog'
import { characterContentHash, defaultCharacterContent } from '$lib/server/character-content'
import { getDb } from '../client'
import { characterPolicyReleases, characterPolicySettings } from '../schema'
import type { CreditDb } from './credits'

function releaseView(row: typeof characterPolicyReleases.$inferSelect): CharacterRelease {
  const content = parseCharacterContent(row.content)
  if (characterContentHash(content) !== row.contentHash)
    throw error(503, '人物設定を確認できません。')
  return { ...row, content, createdAt: row.createdAt.toISOString() }
}
export async function getCharacterOverview(id: CharacterId): Promise<CharacterOverview> {
  const db = getDb()
  const [settings, rows] = await Promise.all([
    db.query.characterPolicySettings.findFirst({
      where: eq(characterPolicySettings.characterId, id)
    }),
    db
      .select()
      .from(characterPolicyReleases)
      .where(eq(characterPolicyReleases.characterId, id))
      .orderBy(desc(characterPolicyReleases.version))
      .limit(30)
  ])
  const activeRow = settings?.activeReleaseId
    ? await db.query.characterPolicyReleases.findFirst({
        where: and(
          eq(characterPolicyReleases.id, settings.activeReleaseId),
          eq(characterPolicyReleases.characterId, id)
        )
      })
    : null
  if (settings?.activeReleaseId && !activeRow)
    throw error(503, '公開中の人物設定を読み込めません。')
  return {
    characterId: id,
    revision: settings?.draftRevision ?? 0,
    draft: settings ? parseCharacterContent(settings.draft) : defaultCharacterContent(id),
    active: activeRow ? releaseView(activeRow) : null,
    preview: settings?.preview ?? null,
    releases: rows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      version: row.version,
      contentHash: row.contentHash,
      note: row.note,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString()
    }))
  }
}
export async function saveCharacterSection(
  actor: string,
  id: CharacterId,
  revision: number,
  section: unknown,
  value: unknown
) {
  await getDb().transaction(async (tx) => {
    await tx
      .insert(characterPolicySettings)
      .values({ characterId: id, draft: defaultCharacterContent(id), updatedBy: actor })
      .onConflictDoNothing()
    const [current] = await tx
      .select()
      .from(characterPolicySettings)
      .where(eq(characterPolicySettings.characterId, id))
      .for('update')
    if (current.draftRevision !== revision)
      throw error(409, '別の画面で更新されています。最新版を読み直してください。')
    let draft
    try {
      draft = parseCharacterSection(section, value, parseCharacterContent(current.draft))
    } catch (cause) {
      throw error(400, cause instanceof Error ? cause.message : '入力を確認してください。')
    }
    await tx
      .update(characterPolicySettings)
      .set({
        draft,
        draftRevision: revision + 1,
        preview: null,
        updatedBy: actor,
        updatedAt: new Date()
      })
      .where(eq(characterPolicySettings.characterId, id))
  })
  return getCharacterOverview(id)
}
export async function saveCharacterPreview(id: CharacterId, preview: CharacterPreview) {
  const rows = await getDb()
    .update(characterPolicySettings)
    .set({ preview })
    .where(
      and(
        eq(characterPolicySettings.characterId, id),
        eq(characterPolicySettings.draftRevision, preview.revision)
      )
    )
    .returning({ id: characterPolicySettings.characterId })
  if (!rows.length) throw error(409, '確認中に設定が変わりました。もう一度確認してください。')
}
export async function publishCharacter(
  actor: string,
  id: CharacterId,
  revision: number,
  reviewed: boolean,
  note: string
) {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(characterPolicySettings)
      .where(eq(characterPolicySettings.characterId, id))
      .for('update')
    if (!current || current.draftRevision !== revision)
      throw error(409, '下書きが変わりました。最新版を読み直してください。')
    const content = parseCharacterContent(current.draft),
      hash = characterContentHash(content)
    // 別の人物・下書きのプレビューや、クライアントの成功フラグで公開を通さない。
    if (
      !reviewed ||
      !current.preview?.passed ||
      current.preview.revision !== revision ||
      current.preview.contentHash !== hash ||
      current.preview.checkedBy !== actor
    )
      throw error(409, '保存した人物設定で返信を確認し、内容を確認してから公開してください。')
    const active = current.activeReleaseId
      ? await tx.query.characterPolicyReleases.findFirst({
          where: eq(characterPolicyReleases.id, current.activeReleaseId)
        })
      : null
    if (active?.contentHash === hash) return
    const releaseId = randomUUID()
    await tx.insert(characterPolicyReleases).values({
      id: releaseId,
      characterId: id,
      content,
      contentHash: hash,
      note,
      createdBy: actor
    })
    await tx
      .update(characterPolicySettings)
      .set({ activeReleaseId: releaseId, updatedBy: actor, updatedAt: new Date() })
      .where(eq(characterPolicySettings.characterId, id))
  })
  return getCharacterOverview(id)
}
export async function activateCharacter(
  actor: string,
  id: CharacterId,
  releaseId: string,
  expected: string | null
) {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(characterPolicySettings)
      .where(eq(characterPolicySettings.characterId, id))
      .for('update')
    const row = await tx.query.characterPolicyReleases.findFirst({
      where: and(
        eq(characterPolicyReleases.id, releaseId),
        eq(characterPolicyReleases.characterId, id)
      )
    })
    if (!row) throw error(404, 'この人物の公開版が見つかりません。')
    releaseView(row)
    if (!current || current.activeReleaseId !== expected)
      throw error(409, '公開版が変わりました。最新版を読み直してください。')
    await tx
      .update(characterPolicySettings)
      .set({ activeReleaseId: releaseId, updatedBy: actor, updatedAt: new Date() })
      .where(eq(characterPolicySettings.characterId, id))
  })
  return getCharacterOverview(id)
}
export async function snapshotCharacter(db: CreditDb, id: CharacterId): Promise<CharacterSnapshot> {
  const settings = await db.query.characterPolicySettings.findFirst({
    where: eq(characterPolicySettings.characterId, id)
  })
  const row = settings?.activeReleaseId
    ? await db.query.characterPolicyReleases.findFirst({
        where: and(
          eq(characterPolicyReleases.id, settings.activeReleaseId),
          eq(characterPolicyReleases.characterId, id)
        )
      })
    : null
  if (settings?.activeReleaseId && !row) throw error(503, '人物設定を読み込めません。')
  const release = row ? releaseView(row) : null,
    content = release?.content ?? defaultCharacterContent(id)
  return {
    releaseId: release?.id ?? null,
    version: release?.version ?? null,
    characterId: id,
    content,
    contentHash: characterContentHash(content)
  }
}
