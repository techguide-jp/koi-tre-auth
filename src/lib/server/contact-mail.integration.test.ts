import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { POST } from '../../routes/api/contact/+server'
import * as schema from './db/schema'

let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>
const send = vi.fn<typeof fetch>()
const origin = 'https://app.koi-tre.com'

vi.mock('./db/client', () => ({ getDb: () => db }))

beforeAll(async () => {
  client = new PGlite()
  db = drizzle(client, { schema })
  await client.exec(`CREATE TABLE guest_rate_limits (
    key varchar(128) PRIMARY KEY, used integer NOT NULL, expires_at timestamptz NOT NULL
  )`)
})

beforeEach(async () => {
  await db.delete(schema.guestRateLimits)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-12T03:00:00Z'))
  vi.stubEnv('RESEND_API_KEY', 'fixture-key')
  vi.stubEnv('CONTACT_MAIL_FROM', 'Koi-Tre <contact@notifications.example.test>')
  send.mockReset().mockImplementation(async () => Response.json({ id: 'fixture-id' }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await client.close()
})

function submit(fields: Record<string, unknown> = {}, requestOrigin = origin) {
  const url = new URL('/api/contact', origin)
  return POST({
    url,
    request: new Request(url, {
      method: 'POST',
      headers: { origin: requestOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: randomUUID(),
        name: 'テスト利用者',
        email: 'reply@example.test',
        questionType: 'billing',
        message: '購入の確認です。',
        website: '',
        ...fields
      })
    }),
    getClientAddress: () => '192.0.2.1',
    fetch: send
  } as unknown as Parameters<typeof POST>[0])
}

it('通知先を運営メールに固定し、返信先に利用者のメールを設定する', async () => {
  const response = await submit({ to: 'another@example.test' })
  expect(response.status).toBe(200)
  const [url, options] = send.mock.calls[0]
  expect(url).toBe('https://api.resend.com/emails')
  expect(JSON.parse(options?.body as string)).toMatchObject({
    to: ['y.takahashi@techguide.jp'],
    reply_to: 'reply@example.test',
    subject: '[Koi-Tre] 購入・請求・解約について'
  })
})

it('異なるサイト、改行を含むアドレス、ボット用の入力欄からの送信を拒否する', async () => {
  await expect(submit({}, 'https://example.test')).rejects.toMatchObject({ status: 403 })
  await expect(submit({ email: 'reply@example.test\r\ncc: a@example.test' })).rejects.toMatchObject(
    { status: 400 }
  )
  await expect(submit({ website: 'filled' })).rejects.toMatchObject({ status: 400 })
  expect(send).not.toHaveBeenCalled()
})

it('Resendが失敗した場合は送信完了を返さず、同じ送信IDで再試行できる', async () => {
  send.mockResolvedValueOnce(new Response(null, { status: 500 }))
  const requestId = randomUUID()
  await expect(submit({ requestId })).rejects.toMatchObject({ status: 503 })
  expect((await submit({ requestId })).status).toBe(200)
  for (const [, options] of send.mock.calls) {
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe(`koitre-contact/${requestId}`)
  }
})

it('送信上限を超えたリクエストをResendに渡さない', async () => {
  for (let i = 0; i < 5; i++) expect((await submit()).status).toBe(200)
  await expect(submit()).rejects.toMatchObject({ status: 429 })
  expect(send).toHaveBeenCalledTimes(5)
})
