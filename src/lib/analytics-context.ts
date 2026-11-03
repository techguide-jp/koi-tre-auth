export interface AnalyticsContext {
  clientId: string
  sessionId?: string
}

export function readAnalyticsContext(value: unknown): AnalyticsContext | null {
  if (!value || typeof value !== 'object') return null

  const { clientId, sessionId } = value as Record<string, unknown>
  if (typeof clientId !== 'string' || !/^\d{1,32}\.\d{1,32}$/.test(clientId)) return null
  if (
    sessionId !== undefined &&
    (typeof sessionId !== 'string' || !/^[1-9]\d{0,19}$/.test(sessionId))
  ) {
    return null
  }

  return { clientId, ...(sessionId ? { sessionId: sessionId as string } : {}) }
}

export async function getAnalyticsUserId(uid: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}
