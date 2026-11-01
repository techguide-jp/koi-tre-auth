import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  analytics: {} as object | undefined,
  logEvent: vi.fn(),
  setUserId: vi.fn(),
  getClientId: vi.fn()
}))

vi.mock('./firebaseConfig', () => ({
  get analytics() {
    return sdk.analytics
  }
}))
vi.mock('firebase/analytics', () => ({
  logEvent: sdk.logEvent,
  setUserId: sdk.setUserId,
  getGoogleAnalyticsClientId: sdk.getClientId
}))

import {
  getAnalyticsContext,
  setAnalyticsUser,
  trackLogin,
  trackPageView,
  trackSignup
} from './analytics'

beforeEach(() => {
  vi.clearAllMocks()
  sdk.analytics = {}
  sdk.getClientId.mockResolvedValue('123456789.1793510000')
  vi.stubGlobal('window', { location: { origin: 'https://app.koi-tre.com' } })
  vi.stubGlobal('document', { title: 'Koi-Tre' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ブラウザ計測', () => {
  it('初回・SPA 遷移のページビューから検索パラメーターとフラグメントを除外する', () => {
    trackPageView(new URL('https://app.koi-tre.com/?accessKey=private#secret'), '')
    trackPageView(
      new URL('https://app.koi-tre.com/contact?email=private'),
      'https://app.koi-tre.com/?accessKey=private'
    )
    expect(sdk.logEvent).toHaveBeenCalledTimes(2)
    expect(sdk.logEvent.mock.calls[0][2].page_referrer).toBe('')
    expect(sdk.logEvent.mock.calls[1][2]).toMatchObject({
      page_location: 'https://app.koi-tre.com/contact',
      page_referrer: 'https://app.koi-tre.com/'
    })
    expect(JSON.stringify(sdk.logEvent.mock.calls)).not.toContain('private')
  })

  it('ログイン・新規登録を別イベントとし、User-ID を匿名化してログアウトで解除する', async () => {
    await setAnalyticsUser('test-user')
    expect(sdk.setUserId.mock.calls.at(-1)?.[1]).toMatch(/^[a-f0-9]{64}$/)
    trackLogin('google.com')
    trackSignup('google.com')
    expect(sdk.logEvent.mock.calls.map((call) => call[1])).toEqual(['login', 'sign_up'])
    await setAnalyticsUser(null)
    expect(sdk.setUserId).toHaveBeenLastCalledWith(sdk.analytics, null)
  })

  it('ログアウト直前に開始した匿名化の完了で User-ID を復活させない', async () => {
    const pending = setAnalyticsUser('test-user')
    await setAnalyticsUser(null)
    await pending
    expect(sdk.setUserId).toHaveBeenLastCalledWith(sdk.analytics, null)
  })

  it('session ID を取得できなくても実際の client ID を使う', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { gtag: vi.fn() })
    const promise = getAnalyticsContext()
    await vi.advanceTimersByTimeAsync(300)
    expect(await promise).toEqual({ clientId: '123456789.1793510000' })
  })

  it('SDK で取得した client ID と session ID を返す', async () => {
    vi.stubGlobal('window', {
      gtag: (_command: string, _id: string, _field: string, callback: (value: number) => void) =>
        callback(1793510000)
    })
    expect(await getAnalyticsContext()).toEqual({
      clientId: '123456789.1793510000',
      sessionId: '1793510000'
    })
  })

  it('SDK がブロックされてもキーのコピーを待たせ続けず、代替 ID も作らない', async () => {
    vi.useFakeTimers()
    sdk.getClientId.mockReturnValue(new Promise(() => {}))
    const promise = getAnalyticsContext()
    await vi.advanceTimersByTimeAsync(800)
    expect(await promise).toBeNull()
  })

  it('計測が無効なら ID を生成せず、イベントも送らない', async () => {
    sdk.analytics = undefined
    trackLogin('google.com')
    expect(await getAnalyticsContext()).toBeNull()
    expect(sdk.getClientId).not.toHaveBeenCalled()
    expect(sdk.logEvent).not.toHaveBeenCalled()
  })
})
