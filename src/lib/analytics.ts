import { getGoogleAnalyticsClientId, logEvent, setUserId } from 'firebase/analytics'
import { getAnalyticsUserId, readAnalyticsContext } from './analytics-context'
import { analytics } from './firebaseConfig'
import { readPromotionQuery } from './promotion'

let requestedUserUid: string | null = null

export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (!analytics) return
  try {
    logEvent(analytics, eventName, params)
  } catch {
    // 計測に失敗してもログインやアプリの利用を妨げない。
  }
}

function pageUrl(value: string, includeCampaign = false) {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    const campaign = includeCampaign ? readPromotionQuery(url.searchParams) : ''
    return `${url.origin}${url.pathname}${campaign ? `?${campaign}` : ''}`
  } catch {
    return ''
  }
}

export function trackPageView(url: URL, referrer: string) {
  trackEvent('page_view', {
    page_location: pageUrl(url.href, true),
    page_path: url.pathname,
    page_referrer: pageUrl(referrer),
    page_title: document.title
  })
}

export async function setAnalyticsUser(uid: string | null) {
  if (!analytics) return
  requestedUserUid = uid
  try {
    const userId = uid ? await getAnalyticsUserId(uid) : null
    if (requestedUserUid === uid) setUserId(analytics, userId)
  } catch {
    // 個人情報を代替 ID として送信しない。
  }
}

export function trackLogin(method: string) {
  trackEvent('login', { method })
}

export function trackSignup(method: string) {
  trackEvent('sign_up', { method })
}

export async function getAnalyticsContext() {
  if (!analytics) return null

  const timers: ReturnType<typeof setTimeout>[] = []
  function within<T>(promise: Promise<T>, timeoutMs: number) {
    return Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timers.push(setTimeout(() => resolve(undefined), timeoutMs))
      })
    ])
  }

  try {
    const clientId = await within(getGoogleAnalyticsClientId(analytics), 800)
    if (!clientId) return null
    const gtag = (
      window as Window & {
        gtag?: (
          command: 'get',
          id: string,
          field: 'session_id',
          callback: (value: unknown) => void
        ) => void
      }
    ).gtag
    if (!gtag) return readAnalyticsContext({ clientId })

    const sessionId = await within(
      new Promise<unknown>((resolve) => {
        gtag('get', import.meta.env.VITE_MEASUREMENT_ID, 'session_id', resolve)
      }),
      300
    )
    return readAnalyticsContext({ clientId, sessionId: sessionId ? String(sessionId) : undefined })
  } catch {
    return null
  } finally {
    timers.forEach(clearTimeout)
  }
}
