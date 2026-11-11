import { createHmac } from 'node:crypto'
import { error } from '@sveltejs/kit'
import { CONTACT_TOPICS, SUPPORT_EMAIL } from '$lib/contact'
import { getDb } from './db/client'
import { consumeRateLimit, pruneRateLimits } from './db/repositories/rate-limits'

export type ContactMessage = {
  requestId: string
  name: string
  email: string
  questionType: keyof typeof CONTACT_TOPICS
  message: string
}

const ONE_HOUR = 60 * 60 * 1000
const UNAVAILABLE = 'フォームから送信できませんでした。直接メールでお問い合わせいただけます。'

export async function sendContactMail(input: ContactMessage, address: string, send = fetch) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.CONTACT_MAIL_FROM?.trim()
  if (!apiKey || !from || !address) throw error(503, UNAVAILABLE)

  const now = new Date()
  const hour = Math.floor(now.getTime() / ONE_HOUR)
  const expiresAt = new Date((hour + 1) * ONE_HOUR)
  // 問い合わせとゲスト練習の上限は別に数え、台帳にはIPを直接保存しない。
  const hashedAddress = createHmac('sha256', apiKey)
    .update(`contact:${hour}:${address}`)
    .digest('hex')
  const db = getDb()
  await pruneRateLimits(db, now)
  await db.transaction(async (tx) => {
    if (
      !(await consumeRateLimit(tx, `contact:global:${hour}`, 30, expiresAt)) ||
      !(await consumeRateLimit(tx, `contact:${hour}:${hashedAddress}`, 5, expiresAt))
    ) {
      throw error(
        429,
        'フォームの送信上限に達しました。時間をおくか、直接メールでお問い合わせください。'
      )
    }
  })

  const topic = CONTACT_TOPICS[input.questionType]
  try {
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `koitre-contact/${input.requestId}`
      },
      body: JSON.stringify({
        from,
        to: [SUPPORT_EMAIL],
        reply_to: input.email,
        subject: `[Koi-Tre] ${topic}`,
        text: `名前: ${input.name}\nメールアドレス: ${input.email}\n質問の種類: ${topic}\n\n${input.message}`
      }),
      signal: AbortSignal.timeout(10_000)
    })
    if (response.ok && typeof (await response.json())?.id === 'string') return
  } catch {
    // 通信障害時も同じ入力の再試行に同じIdempotency-Keyを使う。
  }
  throw error(503, UNAVAILABLE)
}
