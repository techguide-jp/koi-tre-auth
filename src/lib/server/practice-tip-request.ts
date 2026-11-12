import { error } from '@sveltejs/kit'
import { practiceTipById, tipSelfRatings } from '$lib/practice-tips'
import { readPracticeBody } from './practice-request'

export function requireTipId(id: string) {
  if (!practiceTipById(id)) throw error(404, 'Tipsが見つかりません。')
  return id
}

export async function readTipRating(request: Request) {
  const body = await readPracticeBody(request)
  const choice = tipSelfRatings.find(({ id }) => id === body.value)
  const revision = body.revision
  if (
    !choice ||
    (revision !== null &&
      (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1))
  )
    throw error(400, '自己評価の選択を確認してください。')
  return { value: choice.id, revision }
}
