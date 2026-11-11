import { error, json } from '@sveltejs/kit'
import { CONTACT_LIMITS, CONTACT_TOPICS } from '$lib/contact'
import { sendContactMail } from '$lib/server/contact-mail'
import type { RequestHandler } from './$types'

const MAX_BODY = 16_000
const INVALID = '入力内容を確認してください。'

export const POST: RequestHandler = async ({ request, url, getClientAddress, fetch }) => {
  if (request.headers.get('origin') !== url.origin)
    throw error(403, 'お問い合わせ画面から送信してください。')
  if (Number(request.headers.get('content-length')) > MAX_BODY)
    throw error(413, '入力が長すぎます。')
  const raw = await request.text()
  if (raw.length > MAX_BODY) throw error(413, '入力が長すぎます。')
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw error(400, INVALID)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, INVALID)
  const fields = body as Record<string, unknown>
  const { requestId, questionType } = fields
  const name = typeof fields.name === 'string' ? fields.name.trim() : ''
  const email = typeof fields.email === 'string' ? fields.email.trim() : ''
  const message = typeof fields.message === 'string' ? fields.message.trim() : ''
  if (
    typeof requestId !== 'string' ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId) ||
    typeof questionType !== 'string' ||
    !Object.hasOwn(CONTACT_TOPICS, questionType) ||
    !name ||
    name.length > CONTACT_LIMITS.name ||
    !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email) ||
    email.length > CONTACT_LIMITS.email ||
    !message ||
    message.length > CONTACT_LIMITS.message
  )
    throw error(400, INVALID)

  if (fields.website !== '') throw error(400, INVALID)
  await sendContactMail(
    { requestId, name, email, questionType: questionType as keyof typeof CONTACT_TOPICS, message },
    getClientAddress(),
    fetch
  )
  return json({ accepted: true })
}
