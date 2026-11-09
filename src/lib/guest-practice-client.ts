import { guestAdventure } from './guest-practice'
import type { Adventure } from './adventure'
import type { PracticeSession } from './practice'

export async function guestFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw Error(body?.message || '体験の通信に失敗しました。もう一度お試しください。')
  }
  return response
}
export async function startGuestPractice(adventure: Adventure) {
  if (!guestAdventure(adventure)) throw Error('未ログインで体験できるのは第1話・3往復です。')
  const response = await guestFetch('/api/guest/practices', {
    method: 'POST',
    body: JSON.stringify({ id: crypto.randomUUID(), sceneId: 'adventure', adventure })
  })
  return (await response.json()) as PracticeSession
}
