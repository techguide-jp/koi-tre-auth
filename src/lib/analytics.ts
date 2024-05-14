// src/lib/analytics.ts
import { logEvent } from 'firebase/analytics'
import { analytics } from './firebaseConfig' // Firebaseの初期化インスタンスをimport

// イベントを記録する一般的な関数
function trackEvent(
  eventName: string,
  /* eslint-disable @typescript-eslint/no-explicit-any */
  params?: { [key: string]: any }
) {
  if (typeof window !== 'undefined' && analytics) {
    // クライアントサイドでのみ実行
    logEvent(analytics, eventName, params)
  }
}

// ページビューのトラッキング
function trackPageView(url: string) {
  trackEvent('page_view', { page_path: url })
}

// ログインのトラッキング
function trackLogin(method: string) {
  trackEvent('login', { method: method })
}
// ユーザー登録
function trackSignup(method: string) {
  trackEvent('signup', { method: method })
}

export { trackEvent, trackPageView, trackLogin, trackSignup }
