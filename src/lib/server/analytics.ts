import {
  getAnalyticsUserId,
  readAnalyticsContext,
  type AnalyticsContext
} from '$lib/analytics-context'

async function trackServerEvent(
  eventName: 'question_submitted' | 'practice_completed',
  uid: string,
  analyticsContext: AnalyticsContext | null
) {
  const measurementId = process.env.GA4_MEASUREMENT_ID ?? process.env.VITE_MEASUREMENT_ID
  const apiSecret = process.env.GA4_API_SECRET
  const context = readAnalyticsContext(analyticsContext)

  // 計測を許可しなかったブラウザや古いキーに、代替の client ID を発行しない。
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.VERCEL_ENV !== 'production' ||
    !measurementId ||
    !/^G-[A-Z0-9]+$/.test(measurementId) ||
    !apiSecret ||
    !context
  ) {
    return 'skipped' as const
  }

  try {
    const url = new URL('https://www.google-analytics.com/mp/collect')
    url.searchParams.set('measurement_id', measurementId)
    url.searchParams.set('api_secret', apiSecret)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: context.clientId,
        user_id: await getAnalyticsUserId(uid),
        events: [
          {
            name: eventName,
            params: {
              ...(context.sessionId ? { session_id: context.sessionId } : {}),
              source: 'dify'
            }
          }
        ]
      }),
      signal: AbortSignal.timeout(1500)
    })

    if (!response.ok) throw new Error('GA4 request failed')
    return 'sent' as const
  } catch {
    // DB 保存は既に完了しているため、計測失敗で Dify に再送を要求しない。
    // fetch の例外には API シークレット入りの URL が含まれ得るので出力しない。
    console.warn('GA4 の質問イベント送信に失敗しました。')
    return 'failed' as const
  }
}

export function trackQuestionSubmitted(uid: string, context: AnalyticsContext | null) {
  return trackServerEvent('question_submitted', uid, context)
}

export function trackPracticeCompleted(uid: string, context: AnalyticsContext | null) {
  return trackServerEvent('practice_completed', uid, context)
}
