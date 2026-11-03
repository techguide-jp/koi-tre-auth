import { error, json } from '@sveltejs/kit'
import { practiceConfigured, practiceEnabled } from './practice-config'

export function requirePracticeAvailable() {
  if (!practiceEnabled() || !practiceConfigured())
    throw error(503, '練習機能はただいま準備中です。しばらくしてからお試しください。')
}

export function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

export async function readPracticeBody(request: Request) {
  if (Number(request.headers.get('content-length')) > 12_000) throw error(413, '入力が長すぎます。')
  const text = await request.text()
  if (text.length > 12_000) throw error(413, '入力が長すぎます。')
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw error(400, '入力内容を確認してください。')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw error(400, '入力内容を確認してください。')
  return body as Record<string, unknown>
}

export function privateJson(value: unknown, status = 200) {
  return json(value, { status, headers: { 'cache-control': 'no-store' } })
}
