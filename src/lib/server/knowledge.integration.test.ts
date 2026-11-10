import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { parseKnowledgeContent, retrieveKnowledge } from '$lib/knowledge-policy'
import {
  contentHash,
  defaultKnowledgeContent,
  makeKnowledgeContext,
  restoreKnowledgeContext
} from './knowledge-content'
import {
  activateKnowledgeRelease,
  getKnowledgeOverview,
  getKnowledgeRelease,
  publishKnowledge,
  saveKnowledgeDraft,
  saveKnowledgePreview
} from './db/repositories/knowledge'
import {
  createPractice,
  reservePracticeTurn,
  finishPracticeTurn
} from './db/repositories/practices'
import { isKnowledgeAdmin } from './knowledge-admin-auth'
import { GET, PUT, POST } from '../../routes/api/admin/knowledge/+server'
import { reserveRehearsal, finishRehearsal } from './db/repositories/adventures'

let client: PGlite, db: ReturnType<typeof drizzle<typeof schema>>, migrations: string[]
const uid = 'knowledge-admin-fixture'
vi.mock('./db/client', () => ({ getDb: () => db }))
vi.mock('./request-auth', () => ({
  requireFirebaseUser: vi.fn(async (request: Request) => {
    if (!request.headers.get('authorization')) throw { status: 401 }
    return { uid: request.headers.get('authorization') }
  })
}))
beforeAll(async () => {
  const dir = new URL('../../../drizzle/', import.meta.url)
  migrations = await Promise.all(
    (await readdir(dir))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFile(new URL(f, dir), 'utf8'))
  )
})
beforeEach(async () => {
  client = new PGlite()
  db = drizzle(client, { schema })
  for (const migration of migrations)
    for (const statement of migration.split('--> statement-breakpoint'))
      if (statement.trim()) await client.exec(statement)
  await db.insert(schema.users).values({ firebaseUid: uid })
  vi.stubEnv('KOITRE_ADMIN_UIDS', uid)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await client.close()
})
async function checked(revision: number, actor = uid) {
  const overview = await getKnowledgeOverview()
  await saveKnowledgePreview({
    revision,
    contentHash: contentHash(overview.draft),
    checkedBy: actor,
    checkedAt: new Date().toISOString(),
    caseId: 'first-meeting',
    passed: true
  })
}
async function release() {
  const next = await saveKnowledgeDraft(uid, 0, defaultKnowledgeContent())
  await checked(next.revision)
  return (await publishKnowledge(uid, next.revision, true, '初期方針')).active!
}

describe('方針の検索と記録', () => {
  it('日本語の関連箇所を選び、別場面を除き、各文書2箇所・全体3箇所を守る', () => {
    const content = {
      core: '双方の意思を尊重するという基本方針を毎回適用する。',
      documents: [
        {
          id: 'a',
          title: '誘い',
          content: 'カフェに誘う。\n\n土曜日の約束。\n\n予定が決まったら締める。',
          profiles: ['invitation'] as const
        },
        {
          id: 'b',
          title: '共通の知識',
          content: 'カフェの約束が成立したら新しい質問は要らない。',
          profiles: []
        },
        {
          id: 'c',
          title: 'カフェ',
          content: 'カフェの誘いと約束。',
          profiles: ['conflict'] as const
        }
      ].map((doc) => ({ ...doc, profiles: [...doc.profiles] }))
    }
    const passages = retrieveKnowledge(content, 'invitation', 'カフェの約束')
    expect(passages).toHaveLength(3)
    expect(passages.filter((p) => p.documentId === 'a')).toHaveLength(2)
    expect(passages.some((p) => p.documentId === 'c')).toBe(false)
    expect(
      retrieveKnowledge({ ...content, documents: [content.documents[1]] }, 'silence', '宇宙飛行')
    ).toEqual([])
    const selected = makeKnowledgeContext(
      { id: null, version: null, content, contentHash: contentHash(content) },
      'invitation',
      'カフェの約束'
    )
    expect(selected.core).toBe(content.core)
    expect(
      restoreKnowledgeContext(
        { id: null, version: null, content, contentHash: contentHash(content) },
        selected.trace
      )
    ).toEqual(selected)
    expect(() =>
      restoreKnowledgeContext(
        { id: null, version: 2, content, contentHash: contentHash(content) },
        selected.trace
      )
    ).toThrow()
    expect(() =>
      restoreKnowledgeContext(
        { id: null, version: null, content, contentHash: contentHash(content) },
        { ...selected.trace, sources: [] }
      )
    ).toThrow()
  })
  it('重複ID・未知の場面・文字数超過を拒否し、余分な入力を保存しない', () => {
    const content = defaultKnowledgeContent()
    expect(
      contentHash({
        retrieval: content.retrieval,
        documents: content.documents,
        core: content.core
      })
    ).toBe(contentHash(content))
    expect(parseKnowledgeContent({ ...content, admin: true })).toEqual(content)
    expect(() => parseKnowledgeContent({ ...content, core: '短い' })).toThrow()
    expect(() =>
      parseKnowledgeContent({ ...content, documents: [...content.documents, content.documents[0]] })
    ).toThrow()
    expect(() =>
      parseKnowledgeContent({
        ...content,
        documents: [{ ...content.documents[0], profiles: ['unknown'] }]
      })
    ).toThrow()
    expect(() => parseKnowledgeContent({ ...content, core: 'あ'.repeat(3001) })).toThrow()
  })
})
describe('管理権限・公開と版固定', () => {
  it('全管理APIは未認証401、一般UID403。許可リスト未設定も拒否する', async () => {
    for (const handler of [GET, PUT, POST]) {
      await expect(
        handler({ request: new Request('http://local/api/admin/knowledge') } as never)
      ).rejects.toMatchObject({ status: 401 })
      await expect(
        handler({
          request: new Request('http://local/api/admin/knowledge', {
            headers: { authorization: 'other' }
          })
        } as never)
      ).rejects.toMatchObject({ status: 403 })
    }
    vi.stubEnv('KOITRE_ADMIN_UIDS', '')
    expect(isKnowledgeAdmin(uid)).toBe(false)
    expect(await db.select().from(schema.knowledgeSettings)).toEqual([])
  })
  it('保存競合と未確認公開を拒否し、変更した下書きは再確認を必須にする', async () => {
    const original = defaultKnowledgeContent()
    await saveKnowledgeDraft(uid, 0, original)
    await expect(saveKnowledgeDraft(uid, 0, original)).rejects.toMatchObject({ status: 409 })
    await expect(publishKnowledge(uid, 1, true, '')).rejects.toMatchObject({ status: 409 })
    await checked(1, 'other')
    await expect(publishKnowledge(uid, 1, true, '')).rejects.toMatchObject({ status: 409 })
    await checked(1)
    await expect(publishKnowledge(uid, 1, false, '')).rejects.toMatchObject({ status: 409 })
    await saveKnowledgeDraft(uid, 1, { ...original, core: original.core + '\n変更内容。' })
    await expect(
      saveKnowledgePreview({
        revision: 1,
        contentHash: contentHash(original),
        checkedBy: uid,
        checkedAt: '',
        caseId: '',
        passed: true
      })
    ).rejects.toMatchObject({ status: 409 })
    await expect(publishKnowledge(uid, 2, true, '')).rejects.toMatchObject({ status: 409 })
    expect((await getKnowledgeOverview()).preview).toBeNull()
  })
  it('新規・3/6往復の練習を開始時の版に固定し、公開と復帰で履歴を変えない', async () => {
    vi.stubEnv('KNOWLEDGE_POLICY_ENABLED', 'true')
    const legacy = randomUUID()
    await createPractice(uid, legacy, 'cafe')
    const first = await release()
    await publishKnowledge(uid, 1, true, '再送')
    expect((await getKnowledgeOverview()).releases).toHaveLength(1)
    const regular = randomUUID(),
      extended = randomUUID()
    await createPractice(uid, regular, 'cafe')
    await createPractice(uid, extended, 'adventure', null, {
      version: 1,
      characterId: 'aoi',
      episodeId: 'aoi-1',
      turns: 6
    })
    const updated = {
      ...first.content,
      core: first.content.core + '\n日程の成立後は自然に終える。'
    }
    await saveKnowledgeDraft(uid, 1, updated)
    await checked(2)
    const second = (await publishKnowledge(uid, 2, true, '更新')).active!
    expect(second.version).toBeGreaterThan(first.version)
    await expect(activateKnowledgeRelease(uid, first.id, first.id)).rejects.toMatchObject({
      status: 409
    })
    await activateKnowledgeRelease(uid, first.id, second.id)
    expect((await getKnowledgeRelease(second.id)).content).toEqual(updated)
    const sessions = await db.select().from(schema.practices)
    expect(sessions.find((p) => p.id === legacy)?.policyReleaseId).toBeNull()
    for (const id of [regular, extended])
      expect(sessions.find((p) => p.id === id)?.policyReleaseId).toBe(first.id)
    // 同じ練習IDの再開で新しい版へ上書きしない。
    await activateKnowledgeRelease(uid, second.id, first.id)
    await createPractice(uid, regular, 'cafe')
    expect(
      (await db.select().from(schema.practices).where(eq(schema.practices.id, regular)))[0]
        .policyReleaseId
    ).toBe(first.id)
    const context = makeKnowledgeContext(first, 'first_meeting', 'カフェで話す')
    for (const [id, count] of [
      [regular, 3],
      [extended, 6]
    ] as const) {
      for (let position = 0; position < count; position++) {
        const input = {
          uid,
          id,
          requestId: randomUUID(),
          expectedTurn: position,
          text: 'カフェでゆっくり過ごすのが好きです。'
        }
        const reservation = await reservePracticeTurn(input)
        expect(reservation.status).toBe('ready')
        if (reservation.status !== 'ready') throw Error('Unexpected reservation')
        expect(reservation.policyReleaseId).toBe(first.id)
        await finishPracticeTurn(input, reservation.token, {
          reply: '私も落ち着いた場所が好きです。',
          feedback: null,
          policyContext: context.trace
        })
        expect((await reservePracticeTurn(input)).status).toBe('replay')
      }
    }
    const turns = await db.select().from(schema.practiceTurns)
    expect(turns).toHaveLength(9)
    expect(turns.every((turn) => turn.policyContext?.releaseId === first.id)).toBe(true)
    const rehearsalInput = {
      uid,
      id: extended,
      position: 1,
      expectedTurn: 6,
      requestId: randomUUID(),
      text: '落ち着いたカフェが好きです。'
    }
    const rehearsal = await reserveRehearsal(rehearsalInput)
    expect(rehearsal.status).toBe('ready')
    if (rehearsal.status !== 'ready') throw Error('Unexpected rehearsal reservation')
    expect(rehearsal.policyReleaseId).toBe(first.id)
    await finishRehearsal(rehearsalInput, rehearsal.token, {
      reply: '私も落ち着けます。',
      policyContext: context.trace
    })
    expect(
      (await db.query.practices.findFirst({ where: eq(schema.practices.id, extended) }))?.rehearsal
        ?.policyContext
    ).toEqual(context.trace)
    expect((await reserveRehearsal(rehearsalInput)).status).toBe('replay')
    const spends = await db.select().from(schema.creditSpends)
    expect(spends.reduce((sum, row) => sum + (row.state === 'spent' ? row.units : 0), 0)).toBe(3)
  })
})
