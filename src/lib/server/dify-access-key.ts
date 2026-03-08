import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

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

export function createDifyAccessKey(uid: string, now = new Date()) {
  const expiresAt = new Date(now.getTime() + DIFY_ACCESS_KEY_TTL_MS)
  const payload = [
    DIFY_ACCESS_KEY_VERSION,
    toBase64Url(uid),
    String(expiresAt.getTime())
  ].join('.')
  const signature = signDifyAccessKeyPayload(payload)

  return {
    accessKey: `${payload}.${signature}`,
    expiresAt: expiresAt.toISOString()
  }
}

export function verifyDifyAccessKey(accessKey: string, now = new Date()) {
  const [version, encodedUid, expiresAtMs, signature] = accessKey.trim().split('.')

  if (!version || !encodedUid || !expiresAtMs || !signature) {
    return null
  }

  if (version !== DIFY_ACCESS_KEY_VERSION) {
    return null
  }

  const payload = [version, encodedUid, expiresAtMs].join('.')
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

  return {
    uid,
    expiresAt: new Date(expiresAt).toISOString()
  }
}
