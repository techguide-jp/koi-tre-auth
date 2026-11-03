import type { CustomSceneInput } from './practice'

const DRAFT_KEY = 'koi-custom-scene-draft:v1'
type DraftSource = 'custom' | 'preset'
// 既存の自由入力の下書きを、場面カードの相手選択で上書きしない。
const draftKey = (source: DraftSource) =>
  source === 'preset' ? 'koi-preset-scene-draft:v1' : DRAFT_KEY

export function readCustomSceneDraft(source: DraftSource = 'custom'): CustomSceneInput {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey(source)) ?? 'null')
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
export function saveCustomSceneDraft(
  draft: CustomSceneInput,
  source: DraftSource = 'custom'
): boolean {
  try {
    sessionStorage.setItem(draftKey(source), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}
