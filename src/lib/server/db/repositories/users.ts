import { eq } from 'drizzle-orm'
import { getDb } from '../client'
import { users } from '../schema'

export interface UpsertUserInput {
  firebaseUid: string
  email: string | null
  displayName: string | null
  photoUrl: string | null
}

export async function upsertUser(input: UpsertUserInput) {
  const now = new Date()
  const [user] = await getDb()
    .insert(users)
    .values({
      firebaseUid: input.firebaseUid,
      email: input.email,
      displayName: input.displayName,
      photoUrl: input.photoUrl,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: {
        email: input.email,
        displayName: input.displayName,
        photoUrl: input.photoUrl,
        updatedAt: now
      }
    })
    .returning()

  return user
}

export async function findUserByFirebaseUid(firebaseUid: string) {
  return getDb().query.users.findFirst({
    where: eq(users.firebaseUid, firebaseUid)
  })
}

export async function userExists(firebaseUid: string) {
  return Boolean(await findUserByFirebaseUid(firebaseUid))
}
