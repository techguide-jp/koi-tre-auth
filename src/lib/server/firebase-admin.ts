import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function getRequiredFirebaseEnv(
  name: 'FIREBASE_PROJECT_ID' | 'FIREBASE_CLIENT_EMAIL' | 'FIREBASE_PRIVATE_KEY'
) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function getFirebaseAdminApp() {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (
    emulator &&
    (process.env.NODE_ENV === 'production' || !process.env.FIREBASE_PROJECT_ID?.startsWith('demo-'))
  )
    throw new Error('Auth emulator is restricted to local demo projects')
  const existingApp = getApps()[0]
  if (existingApp) {
    return existingApp
  }

  if (emulator) return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })

  return initializeApp({
    credential: cert({
      projectId: getRequiredFirebaseEnv('FIREBASE_PROJECT_ID'),
      clientEmail: getRequiredFirebaseEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: getRequiredFirebaseEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
    })
  })
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp())
}
