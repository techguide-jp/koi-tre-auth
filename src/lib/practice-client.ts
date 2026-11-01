import { auth } from './firebaseConfig'
import { authenticatedFetch } from './stores'
import type { PracticeSession, SceneId } from './practice'

export async function startPractice(sceneId: SceneId) {
  const key = `koi-practice-start:${auth?.currentUser?.uid}:${sceneId}`
  let id: string | null = null
  try {
    id = sessionStorage.getItem(key)
  } catch {
    /* 保存が禁止されていても練習できる。 */
  }
  if (!id) id = crypto.randomUUID()
  try {
    sessionStorage.setItem(key, id)
  } catch {
    /* 同上 */
  }
  const response = await authenticatedFetch('/api/me/practices', {
    method: 'POST',
    body: JSON.stringify({ id, sceneId })
  })
  const session = (await response.json()) as PracticeSession
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* 同上 */
  }
  return session
}
