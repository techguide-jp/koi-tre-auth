import { randomUUID } from 'node:crypto'
import { error } from '@sveltejs/kit'
import cases from '../../../docs/evaluations/scene-coaching-cases.json'
import { normalizeCustomScene, type PracticeFeedback, type SceneId } from '$lib/practice'
import type { KnowledgeContext } from '$lib/knowledge-policy'
import { gradeConversation } from '$lib/adventure-progression'
import { generatePracticeReply } from './dify-practice'
import { contentHash, restoreKnowledgeContext } from './knowledge-content'
import { getKnowledgeOverview, saveKnowledgePreview } from './db/repositories/knowledge'
const caseTitles: Record<string, string> = {
  'hobbies-short': '趣味：短い答えと好きな理由',
  'invitation-settled': '誘い：次の約束が決まった',
  'invitation-respect-no': '誘い：相手の断りを受け入れる',
  'own-boundary': '断り：自分の意思を保つ',
  'conflict-notification': 'すれ違い：気持ちと希望を伝える',
  'positive-event': '嬉しい知らせ：一緒に喜ぶ',
  'comfortable-silence': '沈黙：静かな時間を楽しむ',
  'first-meeting': '初対面：軽い自己開示'
}

export const knowledgePreviewCases = cases.map((item) => ({
  id: item.id,
  title: caseTitles[item.id],
  check: item.check
}))
export interface KnowledgePreviewResult {
  passed: boolean
  reply: string
  feedback: PracticeFeedback | null
  context: KnowledgeContext
  check: string
}
export async function previewKnowledge(
  actor: string,
  revision: number,
  caseId: string
): Promise<KnowledgePreviewResult> {
  const overview = await getKnowledgeOverview()
  if (!revision || overview.revision !== revision)
    throw error(409, '下書きを保存し、最新の状態で確認してください。')
  const sample = cases.find((item) => item.id === caseId)
  if (!sample) throw error(400, '確認する会話を選んでください。')
  const hash = contentHash(overview.draft)
  const input = {
    id: `knowledge-preview-${randomUUID()}`,
    sceneId: sample.sceneId as SceneId,
    customScene: 'customScene' in sample ? normalizeCustomScene(sample.customScene) : null,
    turns: sample.turns.slice(0, -1).map((turn, index) => ({
      userText: turn.user,
      assistantText: sample.turns[index + 1].assistant
    })),
    text: sample.turns.at(-1)!.user,
    policyOverride: { content: overview.draft, contentHash: hash }
  }
  try {
    const result = await generatePracticeReply(input)
    const trace = result.policyContext
    if (!trace) throw Error('Preview policy context missing')
    const passed =
      gradeConversation(result.feedback?.analysis?.assessment).score !== null &&
      trace.profile === sample.expectedProfile
    await saveKnowledgePreview({
      revision,
      contentHash: hash,
      caseId,
      passed,
      checkedBy: actor,
      checkedAt: new Date().toISOString()
    })
    // 実行時と同じ取得箇所だけを表示し、再検索した違う文脈を確認結果にしない。
    const restored = restoreKnowledgeContext(
      {
        id: null,
        version: null,
        content: overview.draft,
        contentHash: hash
      },
      trace
    )
    return {
      passed,
      reply: result.reply,
      feedback: result.feedback,
      context: restored,
      check: sample.check
    }
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) throw cause
    await saveKnowledgePreview({
      revision,
      contentHash: hash,
      caseId,
      passed: false,
      checkedBy: actor,
      checkedAt: new Date().toISOString()
    })
    throw error(
      502,
      '動作確認に失敗しました。Difyの方針入力とJevの接続を確認し、もう一度お試しください。'
    )
  }
}
