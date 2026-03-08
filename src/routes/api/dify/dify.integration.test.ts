import { readFile } from 'node:fs/promises'
import { count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MONTHLY_USAGE_LIMIT } from '$lib/constants/usage'
import { createDifyAccessKey } from '$lib/server/dify-access-key'
import * as schema from '$lib/server/db/schema'

type TestDb = ReturnType<typeof drizzle<typeof schema>>

let testDb: TestDb
let client: PGlite
let usersExistsGet: typeof import('./users/exists/+server').GET
let operationsPost: typeof import('./operations/+server').POST
let migrationStatements: string[] = []
const FIXED_NOW = new Date('2026-03-08T12:00:00+09:00')

type UsersExistsEvent = Parameters<typeof usersExistsGet>[0]
type OperationsEvent = Parameters<typeof operationsPost>[0]

vi.mock('$lib/server/db/client', () => ({
  getDb: () => testDb
}))

function buildDifyEvent<T>(input: {
  path: string
  method: 'GET' | 'POST'
  token?: string
  body?: Record<string, unknown>
}) {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${input.token ?? process.env.DIFY_API_BEARER_TOKEN}`)

  let body: string | undefined
  if (input.body) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(input.body)
  }

  const url = new URL(input.path, 'https://www.koi-tre.com')
  const request = new Request(url, {
    method: input.method,
    headers,
    body
  })

  return {
    request,
    url,
    params: {},
    route: { id: input.path },
    locals: {},
    platform: undefined,
    fetch,
    setHeaders: () => undefined,
    getClientAddress: () => '127.0.0.1',
    depends: () => undefined,
    isDataRequest: false,
    isSubRequest: false,
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => undefined,
      delete: () => undefined,
      serialize: () => ''
    }
  } as unknown as T
}

function buildUsersExistsEvent(input: Parameters<typeof buildDifyEvent>[0]) {
  return buildDifyEvent<UsersExistsEvent>(input)
}

function buildOperationsEvent(input: Parameters<typeof buildDifyEvent>[0]) {
  return buildDifyEvent<OperationsEvent>(input)
}

async function expectHttpError(
  factory: () => Response | Promise<Response>,
  status: number,
  message: string
) {
  try {
    await factory()
    throw new Error('Expected handler to throw')
  } catch (error) {
    expect(error).toMatchObject({
      status,
      body: {
        message
      }
    })
  }
}

async function seedUser(firebaseUid: string) {
  const now = new Date(FIXED_NOW)

  await testDb.insert(schema.users).values({
    firebaseUid,
    email: `${firebaseUid}@example.com`,
    displayName: 'Integration Test User',
    photoUrl: null,
    createdAt: now,
    updatedAt: now
  })
}

async function seedMonthlyOperations(firebaseUid: string, total: number) {
  const operations = Array.from({ length: total }, (_, index) => ({
    uid: firebaseUid,
    conversationId: `conversation-${index + 1}`,
    llmText: `response-${index + 1}`,
    query: `query-${index + 1}`,
    createdAt: new Date(`2026-03-${String(index + 1).padStart(2, '0')}T12:00:00+09:00`)
  }))

  await testDb.insert(schema.operations).values(operations)
}

function tamperAccessKey(accessKey: string) {
  const lastChar = accessKey.slice(-1)
  const replacement = lastChar === 'a' ? 'b' : 'a'
  return `${accessKey.slice(0, -1)}${replacement}`
}

beforeAll(async () => {
  const migrationSql = await readFile(
    new URL('../../../../drizzle/0000_closed_namorita.sql', import.meta.url),
    'utf8'
  )
  migrationStatements = migrationSql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
  ;({ GET: usersExistsGet } = await import('./users/exists/+server'))
  ;({ POST: operationsPost } = await import('./operations/+server'))
})

beforeEach(async () => {
  process.env.DIFY_API_BEARER_TOKEN = 'test-dify-token'
  process.env.DIFY_UID_SIGNING_SECRET = 'test-dify-signing-secret'
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)

  client = new PGlite()
  testDb = drizzle(client, { schema })

  for (const statement of migrationStatements) {
    await client.exec(statement)
  }
})

afterEach(async () => {
  vi.useRealTimers()
  await client.close()
})

describe('Dify API integration', () => {
  it('Dify の存在確認から履歴保存までを同じアクセスキーで通せる', async () => {
    const firebaseUid = 'firebase-user-1'
    await seedUser(firebaseUid)
    const { accessKey } = createDifyAccessKey(firebaseUid)

    const existsResponse = await usersExistsGet(
      buildUsersExistsEvent({
        method: 'GET',
        path: `/api/dify/users/exists?accessKey=${encodeURIComponent(accessKey)}`
      })
    )
    expect(await existsResponse.json()).toEqual({ exists: true })

    const saveResponse = await operationsPost(
      buildOperationsEvent({
        method: 'POST',
        path: '/api/dify/operations',
        body: {
          accessKey,
          conversationId: 'conversation-1',
          llmText: 'bot response',
          query: 'user input'
        }
      })
    )
    expect(await saveResponse.json()).toEqual({ ok: true })

    const [operationCount] = await testDb.select({ count: count() }).from(schema.operations)
    expect(Number(operationCount?.count ?? 0)).toBe(1)

    const operations = await testDb.query.operations.findMany()
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: firebaseUid,
          conversationId: 'conversation-1',
          llmText: 'bot response',
          query: 'user input'
        })
      ])
    )
  })

  it('改ざんされたアクセスキーでは存在確認を通さない', async () => {
    const firebaseUid = 'firebase-user-2'
    await seedUser(firebaseUid)
    const { accessKey } = createDifyAccessKey(firebaseUid)

    const response = await usersExistsGet(
      buildUsersExistsEvent({
        method: 'GET',
        path: `/api/dify/users/exists?accessKey=${encodeURIComponent(tamperAccessKey(accessKey))}`
      })
    )

    expect(await response.json()).toEqual({ exists: false })
  })

  it('今月の利用枠を使い切っているユーザーへの履歴保存を拒否する', async () => {
    const firebaseUid = 'firebase-user-3'
    await seedUser(firebaseUid)
    await seedMonthlyOperations(firebaseUid, MONTHLY_USAGE_LIMIT)
    const { accessKey } = createDifyAccessKey(firebaseUid)

    await expectHttpError(
      () =>
        operationsPost(
          buildOperationsEvent({
            method: 'POST',
            path: '/api/dify/operations',
            body: {
              accessKey,
              conversationId: 'conversation-limit',
              llmText: 'blocked response',
              query: 'blocked query'
            }
          })
        ),
      429,
      'Monthly usage limit exceeded'
    )

    const [operationCount] = await testDb.select({ count: count() }).from(schema.operations)
    expect(Number(operationCount?.count ?? 0)).toBe(MONTHLY_USAGE_LIMIT)
  })
})
