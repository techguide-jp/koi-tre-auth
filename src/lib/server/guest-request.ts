import { createHash, createHmac, randomBytes } from 'node:crypto'
import { error, type RequestEvent } from '@sveltejs/kit'
import { getDb } from './db/client'
import { guestSessions } from './db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { GUEST_RETENTION_DAYS } from '$lib/guest-practice'

export const GUEST_COOKIE = 'koi_guest'
export const guestTokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export function requireGuestOrigin(event: Pick<RequestEvent, 'request' | 'url'>) {
  if (event.request.headers.get('origin') !== event.url.origin)
    throw error(403, '同じサイトの体験画面から操作してください。')
}
export async function readGuestSession(event: Pick<RequestEvent, 'cookies'>, now = new Date()) {
  const token = event.cookies.get(GUEST_COOKIE)
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null
  return (
    (await getDb().query.guestSessions.findFirst({
      where: and(eq(guestSessions.id, guestTokenHash(token)), gt(guestSessions.expiresAt, now))
    })) ?? null
  )
}
export async function requireGuestSession(event: Pick<RequestEvent, 'cookies'>) {
  const session = await readGuestSession(event)
  if (!session) throw error(401, '体験を再開できません。お相手を選んで始めてください。')
  return session
}
export function newGuestSession(now = new Date()) {
  const token = randomBytes(32).toString('hex')
  return {
    token,
    id: guestTokenHash(token),
    expiresAt: new Date(now.getTime() + GUEST_RETENTION_DAYS * 86400_000)
  }
}
export function setGuestCookie(event: Pick<RequestEvent, 'cookies' | 'url'>, token: string) {
  event.cookies.set(GUEST_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: event.url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: GUEST_RETENTION_DAYS * 86400
  })
}
export function guestRateContext(address: string, now = new Date()) {
  const secret = process.env.DIFY_UID_SIGNING_SECRET || process.env.DIFY_PRACTICE_API_KEY
  if (!secret || !address)
    throw error(503, '体験を準備できません。しばらくしてからお試しください。')
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(now)
  // Cookieを消しても生成を繰り返せないよう、IPは日ごとの不可逆な値だけにする。
  const hash = createHmac('sha256', secret).update(`${day}:${address}`).digest('hex')
  return { day, hash }
}
