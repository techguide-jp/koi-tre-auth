import { error } from '@sveltejs/kit'
import { verifyDifyAccessKey } from './dify-access-key'
import { getFirebaseAdminAuth } from './firebase-admin'

export function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')

  if (!header) {
    return null
  }

  const [scheme, token] = header.split(' ')

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function requireFirebaseUser(request: Request) {
  const token = getBearerToken(request)

  if (!token) {
    throw error(401, 'Authorization header is required')
  }

  try {
    return await getFirebaseAdminAuth().verifyIdToken(token)
  } catch (cause) {
    console.error('Failed to verify Firebase ID token', cause)
    throw error(401, 'Invalid Firebase ID token')
  }
}

export function requireDifyToken(request: Request) {
  if (!process.env.DIFY_API_BEARER_TOKEN) {
    throw error(500, 'Dify API token is not configured')
  }

  const token = getBearerToken(request)
  if (!token || token !== process.env.DIFY_API_BEARER_TOKEN) {
    throw error(401, 'Unauthorized')
  }
}

export function requireDifyAccessKey(accessKey: string | null | undefined) {
  if (!accessKey) {
    throw error(401, 'Dify access key is required')
  }

  const decodedAccessKey = verifyDifyAccessKey(accessKey)
  if (!decodedAccessKey) {
    throw error(401, 'Invalid or expired Dify access key')
  }

  return decodedAccessKey
}
