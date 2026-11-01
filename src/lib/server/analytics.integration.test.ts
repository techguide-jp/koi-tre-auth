import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAnalyticsUserId, readAnalyticsContext } from '$lib/analytics-context'
import { createDifyAccessKey, verifyDifyAccessKey } from './dify-access-key'
import { trackQuestionSubmitted } from './analytics'

const context = { clientId: '123456789.1793510000', sessionId: '1793510000' }

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST123')
  vi.stubEnv('GA4_API_SECRET', 'test-secret')
  vi.stubEnv('DIFY_UID_SIGNING_SECRET', 'test-signing-secret')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('計測情報付きアクセスキー', () => {
  it('旧 v1 キーの互換性を保ち、v2 では計測情報も署名で保護する', () => {
    const oldKey = createDifyAccessKey('test-user')
    expect(verifyDifyAccessKey(oldKey.accessKey)).toMatchObject({
      uid: 'test-user',
      analyticsContext: null
    })

    const key = createDifyAccessKey('test-user', new Date(), context)
    expect(verifyDifyAccessKey(key.accessKey)).toMatchObject({ analyticsContext: context })
    const parts = key.accessKey.split('.')
    parts[3] = Buffer.from(JSON.stringify({ ...context, clientId: '999.999' })).toString(
      'base64url'
    )
    expect(verifyDifyAccessKey(parts.join('.'))).toBeNull()
    expect(verifyDifyAccessKey(`${key.accessKey}.extra`)).toBeNull()
    expect(verifyDifyAccessKey(`${oldKey.accessKey}.extra`)).toBeNull()
  })

  it('期限切れキーを拒否する', () => {
    const key = createDifyAccessKey('test-user', new Date('2026-01-01T00:00:00Z'), context)
    expect(verifyDifyAccessKey(key.accessKey, new Date('2026-01-02T00:00:00Z'))).toBeNull()
  })

  it('メール等を計測 ID として受け付けず、User-ID は不可逆な値にする', async () => {
    expect(readAnalyticsContext({ clientId: 'person@example.com' })).toBeNull()
    expect(readAnalyticsContext({ ...context, sessionId: 'not-a-session' })).toBeNull()
    const userId = await getAnalyticsUserId('test-user')
    expect(userId).toMatch(/^[a-f0-9]{64}$/)
    expect(userId).toBe(await getAnalyticsUserId('test-user'))
    expect(userId).not.toContain('test-user')
  })
})

describe('質問保存後の GA4 送信', () => {
  it('同じ client ID / session ID と匿名化 User-ID だけで質問成功を送る', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await trackQuestionSubmitted('test-user', context)).toBe('sent')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.origin).toBe('https://www.google-analytics.com')
    expect(url.searchParams.get('api_secret')).toBe('test-secret')
    expect(JSON.parse(options.body)).toEqual({
      client_id: context.clientId,
      user_id: await getAnalyticsUserId('test-user'),
      events: [
        { name: 'question_submitted', params: { session_id: context.sessionId, source: 'dify' } }
      ]
    })
    expect(options.body).not.toContain('test-user')
    expect(options.body).not.toContain('test-secret')
  })

  it('旧キー、未設定、プレビューでは代替 ID を作らず送信しない', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await trackQuestionSubmitted('test-user', null)).toBe('skipped')
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(await trackQuestionSubmitted('test-user', context)).toBe('skipped')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('GA4_API_SECRET', '')
    expect(await trackQuestionSubmitted('test-user', context)).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('通信失敗やエラー応答を上位へ投げず、シークレット入りエラーをログに出さない', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('https://example.com/?api_secret=test-secret'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await trackQuestionSubmitted('test-user', context)).toBe('failed')
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    expect(await trackQuestionSubmitted('test-user', context)).toBe('failed')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('test-secret')
  })
})
