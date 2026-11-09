import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from './db/schema'
import { defaultCharacterContent, characterContentHash } from './character-content'
import {
  activateCharacter,
  getCharacterOverview,
  publishCharacter,
  saveCharacterPreview,
  saveCharacterSection
} from './db/repositories/character-policy'
import {
  createPractice,
  getPractice,
  reservePracticeTurn,
  finishPracticeTurn
} from './db/repositories/practices'
import { reserveRehearsal } from './db/repositories/adventures'
import { GET, PUT, POST } from '../../routes/api/admin/characters/[characterId]/+server'
import { previewCharacter } from './character-service'
import type { CharacterId } from '$lib/adventure-catalog'

let client: PGlite, db: ReturnType<typeof drizzle<typeof schema>>, migrations: string[]
const uid = 'character-admin-fixture'
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
  vi.unstubAllGlobals()
  await client.close()
})
async function checked(id: CharacterId, revision: number, actor = uid) {
  const overview = await getCharacterOverview(id)
  await saveCharacterPreview(id, {
    revision,
    contentHash: characterContentHash(overview.draft),
    checkedBy: actor,
    checkedAt: new Date().toISOString(),
    episodeId: `${id}-1`,
    reply: '人物らしい返信です。',
    passed: true
  })
}
async function release(id: CharacterId = 'aoi') {
  const content = defaultCharacterContent(id)
  await saveCharacterSection(uid, id, 0, 'profile', content.profile)
  await checked(id, 1)
  return (await publishCharacter(uid, id, 1, true, '初期公開')).active!
}
describe('人物設定の管理と公開', () => {
  it('全APIが401/403、未知の人物と操作・長文を拒否する', async () => {
    for (const handler of [GET, PUT, POST]) {
      await expect(
        handler({ request: new Request('http://local'), params: { characterId: 'aoi' } } as never)
      ).rejects.toMatchObject({ status: 401 })
      await expect(
        handler({
          request: new Request('http://local', { headers: { authorization: 'other' } }),
          params: { characterId: 'aoi' }
        } as never)
      ).rejects.toMatchObject({ status: 403 })
    }
    await expect(
      GET({
        request: new Request('http://local', { headers: { authorization: uid } }),
        params: { characterId: 'unknown' }
      } as never)
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      PUT({
        request: new Request('http://local', {
          method: 'PUT',
          headers: { authorization: uid },
          body: 'あ'.repeat(20001)
        }),
        params: { characterId: 'aoi' }
      } as never)
    ).rejects.toMatchObject({ status: 413 })
    expect(await db.select().from(schema.characterPolicySettings)).toHaveLength(0)
  })
  it('各フォームを独立保存し、別人物・別項目を変えず、保存競合を拒否する', async () => {
    const original = defaultCharacterContent('aoi')
    await saveCharacterSection(uid, 'aoi', 0, 'speech', {
      ...original.speech,
      tone: '落ち着いて、短く話す。'
    })
    const first = await getCharacterOverview('aoi')
    expect(first.draft.speech.tone).toBe('落ち着いて、短く話す。')
    expect(first.draft.profile).toEqual(original.profile)
    expect((await getCharacterOverview('rin')).revision).toBe(0)
    await expect(
      saveCharacterSection(uid, 'aoi', 0, 'profile', original.profile)
    ).rejects.toMatchObject({ status: 409 })
    await expect(saveCharacterSection(uid, 'aoi', 1, 'bogus', {})).rejects.toMatchObject({
      status: 400
    })
    await expect(publishCharacter(uid, 'aoi', 1, true, '')).rejects.toMatchObject({ status: 409 })
    await checked('aoi', 1, 'other')
    await expect(publishCharacter(uid, 'aoi', 1, true, '')).rejects.toMatchObject({ status: 409 })
    await checked('aoi', 1)
    await saveCharacterSection(uid, 'aoi', 1, 'profile', original.profile)
    expect((await getCharacterOverview('aoi')).preview).toBeNull()
    await expect(
      saveCharacterPreview('aoi', { ...first.preview!, revision: 1 })
    ).rejects.toMatchObject({ status: 409 })
  })
  it('公開・復帰は人物単位で、他人物の版や古い公開状態を拒否し再送を重複公開しない', async () => {
    const first = await release(),
      rin = await release('rin')
    await publishCharacter(uid, 'aoi', 1, true, '再送')
    expect((await getCharacterOverview('aoi')).releases).toHaveLength(1)
    await expect(activateCharacter(uid, 'aoi', rin.id, first.id)).rejects.toMatchObject({
      status: 404
    })
    const content = defaultCharacterContent('aoi')
    await saveCharacterSection(uid, 'aoi', 1, 'values', {
      ...content.values,
      welcomes: '小さな工夫を認めてもらえること。'
    })
    await checked('aoi', 2)
    const second = (await publishCharacter(uid, 'aoi', 2, true, '変更')).active!
    await expect(activateCharacter(uid, 'aoi', first.id, first.id)).rejects.toMatchObject({
      status: 409
    })
    await activateCharacter(uid, 'aoi', first.id, second.id)
    expect((await getCharacterOverview('aoi')).active?.content).toEqual(first.content)
    expect((await getCharacterOverview('rin')).active?.id).toBe(rin.id)
    expect(
      (
        await db
          .select()
          .from(schema.characterPolicyReleases)
          .where(eq(schema.characterPolicyReleases.id, second.id))
      )[0].content.values.welcomes
    ).toContain('小さな工夫')
  })
  it('3/6往復の開始・再開は開始時の版に固定し、ブラウザへ設定全文を返さない', async () => {
    const builtIn = randomUUID()
    await createPractice(uid, builtIn, 'adventure', null, {
      version: 1,
      characterId: 'aoi',
      episodeId: 'aoi-1',
      turns: 3
    })
    const first = await release(),
      ids = [randomUUID(), randomUUID()]
    for (const [i, id] of ids.entries())
      await createPractice(uid, id, 'adventure', null, {
        version: 1,
        characterId: 'aoi',
        episodeId: 'aoi-1',
        turns: i === 0 ? 3 : 6
      })
    await saveCharacterSection(uid, 'aoi', 1, 'speech', {
      ...first.content.speech,
      tone: 'もっと短く話す。'
    })
    await checked('aoi', 2)
    await publishCharacter(uid, 'aoi', 2, true, '更新')
    for (const [i, id] of ids.entries()) {
      await createPractice(uid, id, 'adventure', null, {
        version: 1,
        characterId: 'aoi',
        episodeId: 'aoi-1',
        turns: i === 0 ? 3 : 6
      })
      const count = i === 0 ? 3 : 6
      for (let position = 0; position < count; position++) {
        const input = {
          uid,
          id,
          requestId: randomUUID(),
          expectedTurn: position,
          text: '今日はよろしくお願いします。'
        }
        const reserved = await reservePracticeTurn(input)
        expect(reserved.status).toBe('ready')
        if (reserved.status !== 'ready') throw Error('Unexpected reservation')
        expect(reserved.characterContext?.releaseId).toBe(first.id)
        await finishPracticeTurn(input, reserved.token, {
          reply: '私も、話せて嬉しいです。',
          feedback: null
        })
        expect((await reservePracticeTurn(input)).status).toBe('replay')
      }
      const rehearsal = await reserveRehearsal({
        uid,
        id,
        position: 1,
        expectedTurn: count,
        requestId: randomUUID(),
        text: '一緒に歩けて嬉しいです。'
      })
      expect(rehearsal.status).toBe('ready')
      if (rehearsal.status === 'ready') expect(rehearsal.characterContext?.releaseId).toBe(first.id)
      const session = await getPractice(uid, id)
      expect(session?.characterReactions).toEqual(first.content.reactions)
      expect(session).not.toHaveProperty('characterContext')
    }
    const old = (
      await db.select().from(schema.practices).where(eq(schema.practices.id, builtIn))
    )[0]
    expect(old.characterContext?.releaseId).toBeNull()
    expect(old.characterContext?.content.speech.tone).toBe(
      defaultCharacterContent('aoi').speech.tone
    )
  })
  it('返信確認は保存した版を使い、練習・利用枠・好感度を変更しない', async () => {
    await saveCharacterSection(uid, 'aoi', 0, 'speech', defaultCharacterContent('aoi').speech)
    vi.stubEnv('DIFY_PRACTICE_API_KEY', 'fixture')
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'succeeded',
          outputs: {
            result: { reply: '道の花を見つけると、少し嬉しくなりますね。', feedback: null }
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetch)
    const result = await previewCharacter(uid, 'aoi', 1, 'aoi-1', 'お会いできて嬉しいです。')
    expect(result.preview.passed).toBe(true)
    expect((await getCharacterOverview('aoi')).preview?.revision).toBe(1)
    const input = JSON.parse(fetch.mock.calls[0][1].body)
    expect(JSON.parse(input.inputs.scene).partnerDescription).toContain('人物像：')
    expect(await db.select().from(schema.practices)).toHaveLength(0)
    expect(await db.select().from(schema.creditSpends)).toHaveLength(0)
    expect(await db.select().from(schema.characterRelationships)).toHaveLength(0)
    await expect(previewCharacter(uid, 'aoi', 1, 'rin-1', 'こんにちは')).rejects.toMatchObject({
      status: 400
    })
  })
})
