import { browser } from '$app/environment'
import { initializeApp } from 'firebase/app'
import { initializeAnalytics, type Analytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)
let analytics: Analytics | undefined

// 開発・プレビューの操作を本番の利用者として数えない。
if (browser && import.meta.env.PROD && /^(app\.|www\.)?koi-tre\.com$/.test(location.hostname)) {
  try {
    analytics = initializeAnalytics(app, { config: { send_page_view: false } })
  } catch {
    console.warn('利用状況の計測を初期化できませんでした。')
  }
}
const auth: Auth | null = browser ? getAuth(app) : null
const provider = browser ? new GoogleAuthProvider() : null

export { auth, provider, analytics }
