import type { CustomSceneInput } from './practice'

const DRAFT_KEY = 'koi-custom-scene-draft:v1'
export function readCustomSceneDraft(): CustomSceneInput {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null')
    if (
      draft &&
      ['situation', 'partnerName', 'openingLine'].every((key) => typeof draft[key] === 'string')
    )
      return draft
  } catch {
    /* 保存不可・古い下書きでも、設定フォームは利用できる。 */
  }
  return { situation: '', partnerName: '', openingLine: '' }
}
export function saveCustomSceneDraft(draft: CustomSceneInput): boolean {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}
