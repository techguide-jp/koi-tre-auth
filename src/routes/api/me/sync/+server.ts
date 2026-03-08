import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { upsertUser } from '$lib/server/db/repositories/users'
import { requireFirebaseUser } from '$lib/server/request-auth'

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export const POST: RequestHandler = async ({ request }) => {
  const decodedToken = await requireFirebaseUser(request)
  const body = await request.json().catch(() => null)

  if (body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    throw error(400, 'Request body must be a JSON object')
  }

  const payload = body ?? {}
  const user = await upsertUser({
    firebaseUid: decodedToken.uid,
    email:
      readOptionalString((payload as Record<string, unknown>).email) ?? decodedToken.email ?? null,
    displayName:
      readOptionalString((payload as Record<string, unknown>).displayName) ??
      readOptionalString((payload as Record<string, unknown>).name) ??
      decodedToken.name ??
      null,
    photoUrl:
      readOptionalString((payload as Record<string, unknown>).photoUrl) ??
      readOptionalString((payload as Record<string, unknown>).photoURL) ??
      decodedToken.picture ??
      null
  })

  return json({
    ok: true,
    uid: user.firebaseUid
  })
}
