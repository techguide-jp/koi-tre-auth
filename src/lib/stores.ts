import { browser } from '$app/environment'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { writable } from 'svelte/store'
import { DASHBOARD_POLL_INTERVAL_MS, MONTHLY_USAGE_LIMIT } from '$lib/constants/usage'
import type { DashboardResponse, DifyAccessKeyResponse } from '$lib/types/api'
import { auth } from './firebaseConfig'

interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export const user = writable<User | null>(null)
export const usage = writable(MONTHLY_USAGE_LIMIT)
export const usageLimit = writable(MONTHLY_USAGE_LIMIT)
export const lastLlmText = writable('')
export const lastOperationAt = writable<string | null>(null)
export const dashboardLoaded = writable(false)
export const dashboardError = writable<string | null>(null)

let pollingTimer: number | null = null

function clearDashboardState() {
  usage.set(MONTHLY_USAGE_LIMIT)
  usageLimit.set(MONTHLY_USAGE_LIMIT)
  lastLlmText.set('')
  lastOperationAt.set(null)
  dashboardLoaded.set(false)
  dashboardError.set(null)
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const firebaseUser = auth?.currentUser
  if (!firebaseUser) {
    throw new Error('User is not authenticated')
  }

  const token = await firebaseUser.getIdToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(input, {
    ...init,
    headers
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response
}

function applyDashboardState(dashboard: DashboardResponse) {
  usage.set(dashboard.remainingUsage)
  usageLimit.set(dashboard.limit)
  lastLlmText.set(dashboard.lastLlmText ?? '')
  lastOperationAt.set(dashboard.lastOperationAt)
  dashboardLoaded.set(true)
  dashboardError.set(null)
}

function toAppUser(firebaseUser: FirebaseUser): User {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL
  }
}

export async function syncCurrentUserToApi(
  firebaseUser: FirebaseUser | null = auth?.currentUser ?? null
) {
  if (!firebaseUser) {
    return
  }

  await authenticatedFetch('/api/me/sync', {
    method: 'POST',
    body: JSON.stringify({
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoUrl: firebaseUser.photoURL
    })
  })
}

export async function refreshDashboard() {
  if (!auth?.currentUser) {
    clearDashboardState()
    return
  }

  try {
    const response = await authenticatedFetch('/api/me/dashboard')
    const dashboard = (await response.json()) as DashboardResponse
    applyDashboardState(dashboard)
  } catch (error) {
    console.error('Failed to refresh dashboard', error)
    dashboardLoaded.set(false)
    dashboardError.set('利用状況の同期に失敗しました。しばらくしてから再度お試しください。')
  }
}

export async function fetchDifyAccessKey() {
  const response = await authenticatedFetch('/api/me/dify-access-key')
  return (await response.json()) as DifyAccessKeyResponse
}

export function startDashboardPolling(intervalMs = DASHBOARD_POLL_INTERVAL_MS) {
  if (!browser) {
    return () => {}
  }

  stopDashboardPolling()
  pollingTimer = window.setInterval(() => {
    void refreshDashboard()
  }, intervalMs)

  return stopDashboardPolling
}

export function stopDashboardPolling() {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

async function initializeSession(firebaseUser: FirebaseUser) {
  try {
    await syncCurrentUserToApi(firebaseUser)
    await refreshDashboard()
  } catch (error) {
    console.error('Failed to initialize session', error)
    dashboardLoaded.set(false)
    dashboardError.set('利用状況の初期同期に失敗しました。再読み込みしてもう一度お試しください。')
  }
}

if (browser && auth) {
  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      user.set(toAppUser(firebaseUser))
      void initializeSession(firebaseUser)
      return
    }

    user.set(null)
    clearDashboardState()
    stopDashboardPolling()
  })
}
