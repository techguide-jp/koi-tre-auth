import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import {
  parseKnowledgeContent,
  type KnowledgeContent,
  type KnowledgeOverview,
  type KnowledgePreview,
  type KnowledgeRelease
} from '$lib/knowledge-policy'
import { getDb } from '../client'
import { knowledgeReleases, knowledgeSettings, practices, practiceTurns } from '../schema'
import { contentHash, defaultKnowledgeContent } from '$lib/server/knowledge-content'

type Row = typeof knowledgeReleases.$inferSelect
const releaseView = (row: Row): KnowledgeRelease => ({
  ...row,
  content: parseKnowledgeContent(row.content),
  createdAt: row.createdAt.toISOString()
})
export async function getKnowledgeRelease(id: string) {
  const row = await getDb().query.knowledgeReleases.findFirst({
    where: eq(knowledgeReleases.id, id)
  })
  if (!row) throw error(503, 'この練習で使用する評価方針を読み込めません。')
  const release = releaseView(row)
  if (contentHash(release.content) !== release.contentHash)
    throw error(503, '評価方針の内容を確認できません。')
  return release
}
export async function getKnowledgeOverview(): Promise<KnowledgeOverview> {
  const db = getDb()
  const [settings, releases] = await Promise.all([
    db.query.knowledgeSettings.findFirst({ where: eq(knowledgeSettings.id, 'main') }),
    db.select().from(knowledgeReleases).orderBy(desc(knowledgeReleases.version)).limit(30)
  ])
  const active = settings?.activeReleaseId
    ? await getKnowledgeRelease(settings.activeReleaseId)
    : null
  return {
    revision: settings?.draftRevision ?? 0,
    draft: settings ? parseKnowledgeContent(settings.draft) : defaultKnowledgeContent(),
    active,
    preview: settings?.preview ?? null,
    releases: releases.map((row) => ({
      id: row.id,
      version: row.version,
      contentHash: row.contentHash,
      note: row.note,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString()
    }))
  }
}
export async function saveKnowledgeDraft(
  actor: string,
  revision: number,
  content: KnowledgeContent
) {
  const valid = parseKnowledgeContent(content)
  await getDb().transaction(async (tx) => {
    await tx
      .insert(knowledgeSettings)
      .values({ id: 'main', draft: defaultKnowledgeContent(), draftRevision: 0, updatedBy: actor })
      .onConflictDoNothing()
    const [current] = await tx
      .select()
      .from(knowledgeSettings)
      .where(eq(knowledgeSettings.id, 'main'))
      .for('update')
    if (current.draftRevision !== revision)
      throw error(409, '別の画面で更新されています。最新版を読み直してください。')
    await tx
      .update(knowledgeSettings)
      .set({
        draft: valid,
        draftRevision: revision + 1,
        preview: null,
        updatedBy: actor,
        updatedAt: new Date()
      })
      .where(eq(knowledgeSettings.id, 'main'))
  })
  return getKnowledgeOverview()
}
export async function saveKnowledgePreview(preview: KnowledgePreview) {
  const result = await getDb()
    .update(knowledgeSettings)
    .set({ preview })
    .where(
      and(eq(knowledgeSettings.id, 'main'), eq(knowledgeSettings.draftRevision, preview.revision))
    )
    .returning({ id: knowledgeSettings.id })
  if (!result.length)
    throw error(409, '確認中に下書きが変わりました。最新の下書きでもう一度確認してください。')
}
export async function publishKnowledge(
  actor: string,
  revision: number,
  reviewed: boolean,
  note: string
) {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(knowledgeSettings)
      .where(eq(knowledgeSettings.id, 'main'))
      .for('update')
    if (!current || current.draftRevision !== revision)
      throw error(409, '下書きが変わりました。最新版を読み直してください。')
    const valid = parseKnowledgeContent(current.draft),
      hash = contentHash(valid)
    // 古い下書きの確認結果や、画面から送った成功フラグで公開を通さない。
    if (
      !reviewed ||
      !current.preview?.passed ||
      current.preview.revision !== current.draftRevision ||
      current.preview.contentHash !== hash ||
      current.preview.checkedBy !== actor
    )
      throw error(409, 'この下書きで動作確認を実行し、内容を確認してから公開してください。')
    if (current.activeReleaseId) {
      const active = await tx.query.knowledgeReleases.findFirst({
        where: eq(knowledgeReleases.id, current.activeReleaseId)
      })
      // 再送で同じ内容の公開版を重複させない。
      if (active?.contentHash === hash) return
    }
    const id = randomUUID()
    await tx
      .insert(knowledgeReleases)
      .values({ id, content: valid, contentHash: hash, note, createdBy: actor })
    await tx
      .update(knowledgeSettings)
      .set({ activeReleaseId: id, updatedBy: actor, updatedAt: new Date() })
      .where(eq(knowledgeSettings.id, 'main'))
  })
  return getKnowledgeOverview()
}
export async function activateKnowledgeRelease(actor: string, id: string, expected: string | null) {
  await getKnowledgeRelease(id)
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(knowledgeSettings)
      .where(eq(knowledgeSettings.id, 'main'))
      .for('update')
    if (!current || current.activeReleaseId !== expected)
      throw error(409, '公開版が変わりました。最新版を読み直してください。')
    await tx
      .update(knowledgeSettings)
      .set({ activeReleaseId: id, updatedBy: actor, updatedAt: new Date() })
      .where(eq(knowledgeSettings.id, 'main'))
  })
  return getKnowledgeOverview()
}
export async function getSavedPracticePolicy(uid: string, id: string) {
  const db = getDb()
  const practice = await db.query.practices.findFirst({
    where: and(eq(practices.id, id), eq(practices.uid, uid))
  })
  if (!practice?.policyReleaseId) return null
  const last = await db.query.practiceTurns.findFirst({
    where: eq(practiceTurns.practiceId, id),
    orderBy: desc(practiceTurns.position)
  })
  return {
    release: await getKnowledgeRelease(practice.policyReleaseId),
    trace: last?.policyContext ?? null
  }
}
