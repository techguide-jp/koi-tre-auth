import { auth } from './firebaseConfig'
import { authenticatedFetch } from './stores'
import { normalizeAdventure, type Adventure } from './adventure'
import {
  normalizeCustomScene,
  type CustomSceneInput,
  type PracticeSession,
  type SceneId
} from './practice'

export async function startPractice(
  sceneId: SceneId,
  input?: CustomSceneInput | null,
  adventureInput?: Adventure | null
) {
  const customScene = sceneId === 'custom' ? normalizeCustomScene(input) : null
  if (sceneId === 'custom' && !customScene) throw new Error('練習したい場面を入力してください。')
  const adventure = sceneId === 'adventure' ? normalizeAdventure(adventureInput) : null
  if (sceneId === 'adventure' && !adventure) throw new Error('相手とエピソードを選んでください。')
  // 状況を変えて再試行した時は、古い作成IDを使い回さない。本文はストレージキーに含めない。
  const digest =
    customScene || adventure
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(JSON.stringify(customScene ?? adventure))
            )
          ),
          (n) => n.toString(16).padStart(2, '0')
        ).join('')
      : ''
  const key = `koi-practice-start:${auth?.currentUser?.uid}:${sceneId}:${digest}`
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
    body: JSON.stringify({
      id,
      sceneId,
      ...(customScene ? { customScene } : {}),
      ...(adventure ? { adventure } : {})
    })
  })
  const session = (await response.json()) as PracticeSession
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* 同上 */
  }
  return session
}
