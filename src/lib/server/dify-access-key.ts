import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readAnalyticsContext, type AnalyticsContext } from '$lib/analytics-context'

const DIFY_ACCESS_KEY_VERSION = 'v1'
const DIFY_ACCESS_KEY_TTL_MS = 12 * 60 * 60 * 1000

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function getDifyAccessKeySecret() {
  const secret = process.env.DIFY_UID_SIGNING_SECRET ?? process.env.DIFY_API_BEARER_TOKEN

  if (!secret) {
    throw new Error('DIFY_UID_SIGNING_SECRET or DIFY_API_BEARER_TOKEN is not configured')
  }

  return secret
}

function signDifyAccessKeyPayload(payload: string) {
  return createHmac('sha256', getDifyAccessKeySecret()).update(payload).digest('base64url')
}

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function createDifyAccessKey(
  uid: string,
  now = new Date(),
  analyticsContext: AnalyticsContext | null = null
) {
  const expiresAt = new Date(now.getTime() + DIFY_ACCESS_KEY_TTL_MS)
  const context = readAnalyticsContext(analyticsContext)
  const parts = [
    context ? 'v2' : DIFY_ACCESS_KEY_VERSION,
    toBase64Url(uid),
    String(expiresAt.getTime())
  ]
  if (context) parts.push(toBase64Url(JSON.stringify(context)))
  const payload = parts.join('.')
  const signature = signDifyAccessKeyPayload(payload)

  return {
    accessKey: `${payload}.${signature}`,
    expiresAt: expiresAt.toISOString()
  }
}

export function verifyDifyAccessKey(accessKey: string, now = new Date()) {
  const parts = accessKey.trim().split('.')
  const [version, encodedUid, expiresAtMs] = parts
  const signature = parts.at(-1)

  if (!version || !encodedUid || !expiresAtMs || !signature) {
    return null
  }

  // 計測開始前に発行したキーも、有効期限までは同じ認証規則で受け付ける。
  if (
    !(
      (version === DIFY_ACCESS_KEY_VERSION && parts.length === 4) ||
      (version === 'v2' && parts.length === 5)
    )
  ) {
    return null
  }

  const payload = parts.slice(0, -1).join('.')
  const expectedSignature = signDifyAccessKeyPayload(payload)
  if (!signaturesMatch(expectedSignature, signature)) {
    return null
  }

  const expiresAt = Number(expiresAtMs)
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return null
  }

  const uid = fromBase64Url(encodedUid)
  if (!uid) {
    return null
  }

  let analyticsContext: AnalyticsContext | null = null
  if (version === 'v2') {
    try {
      analyticsContext = readAnalyticsContext(JSON.parse(fromBase64Url(parts[3])))
      if (!analyticsContext) return null
    } catch {
      return null
    }
  }

  return {
    uid,
    analyticsContext,
    expiresAt: new Date(expiresAt).toISOString()
  }
}
