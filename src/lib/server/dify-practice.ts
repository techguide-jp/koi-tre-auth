import {
  resolveScene,
  assessmentStatus,
  type CustomSceneInput,
  practiceTurnLimit,
  type PracticeTurn,
  type SceneId
} from '$lib/practice'
import {
  parseMission,
  parsePresentation,
  parseStoryEnding,
  episodeById,
  type Adventure,
  type StoryContext
} from '$lib/adventure'
import { assessPractice, selectPracticeCoaching } from './jev-practice'
import { practiceCoaching } from './practice-coaching'
import { parsePracticeOutput } from './practice-feedback'
import type { KnowledgeContent } from '$lib/knowledge-policy'
import { getKnowledgeRelease } from './db/repositories/knowledge'
import { makeKnowledgeContext } from './knowledge-content'
import type { CharacterSnapshot } from '$lib/character-policy'
import { characterContentHash, characterDescription } from './character-content'
export { parsePracticeOutput } from './practice-feedback'

export interface GeneratePracticeInput {
  id: string
  sceneId: SceneId
  customScene?: CustomSceneInput | null
  turns: Pick<PracticeTurn, 'userText' | 'assistantText'>[]
  text: string
  adventure?: Adventure | null
  rehearsal?: boolean
  storyContext?: StoryContext | null
  characterContext?: CharacterSnapshot | null
  policyReleaseId?: string | null
  policyOverride?: { content: KnowledgeContent; contentHash: string }
}

export async function generatePracticeReply(input: GeneratePracticeInput) {
  const scene = resolveScene(input.sceneId, input.customScene, input.adventure)
  const key = process.env.DIFY_PRACTICE_API_KEY
  if (!key || !scene) throw new Error('Practice is not configured')
  const persona = input.characterContext
  if (
    persona &&
    (!input.adventure ||
      persona.characterId !== input.adventure.characterId ||
      characterContentHash(persona.content) !== persona.contentHash)
  )
    throw Error('Practice character context mismatch')
  const base = process.env.DIFY_API_BASE_URL ?? 'https://api.dify.ai/v1'
  // Jevと生成で期限を共有し、保存予約・関数実行上限を超えないようにする。
  const signal = AbortSignal.timeout(55_000)
  const turnLimit = practiceTurnLimit(input.adventure)
  const final = !input.rehearsal && input.turns.length + 1 === turnLimit
  const transcript = [
    { role: 'assistant', content: scene.opener },
    ...input.turns.flatMap((turn, index) => [
      { role: 'user', content: turn.userText, turn: index + 1 },
      { role: 'assistant', content: turn.assistantText }
    ]),
    { role: 'user', content: input.text, turn: input.turns.length + 1 }
  ]
  // 場面の分類と補助評価を合わせて6秒以内にし、文章生成の時間を確保する。
  const assessmentSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)])
  const release = input.policyOverride
    ? { ...input.policyOverride, id: null, version: null }
    : input.policyReleaseId
      ? await getKnowledgeRelease(input.policyReleaseId)
      : null
  const coaching = final
    ? release
      ? await selectPracticeCoaching(scene, assessmentSignal, release.content.core)
      : await selectPracticeCoaching(scene, assessmentSignal)
    : practiceCoaching(scene)
  const policy = release
    ? makeKnowledgeContext(
        release,
        coaching.id,
        [
          scene.title,
          scene.goal,
          scene.situation ?? '',
          input.text,
          ...input.turns.toReversed().map((turn) => turn.userText)
        ].join(' ')
      )
    : null
  const measured = final
    ? policy
      ? await assessPractice(scene, transcript, assessmentSignal, coaching, policy)
      : await assessPractice(scene, transcript, assessmentSignal, coaching)
    : null
  const assessment = measured
    ? {
        ...measured,
        ...(policy ? { policy: policy.trace } : {}),
        rubric: { version: 3 as const, profile: coaching.id }
      }
    : null
  const sceneData = {
    ...scene,
    // 人物像は相手役の返信だけへ渡し、上で呼ぶJevの採点条件には加えない。
    ...(persona
      ? { partnerDescription: characterDescription(persona, coaching.id, input.storyContext) }
      : {}),
    ...(input.adventure
      ? {
          storyContext: input.storyContext ? structuredClone(input.storyContext) : null,
          chapter: episodeById(input.adventure.episodeId)?.chapter ?? null,
          revisit: !!input.adventure.revisit
        }
      : {}),
    coaching: {
      ...coaching,
      replyStyle: final
        ? 'close_naturally'
        : input.turns.length === 0
          ? 'respond_and_share'
          : 'share_or_follow_up'
    },
    assessment: assessment
      ? {
          ...assessment,
          aspects: assessment.aspects.map((aspect) => ({
            ...aspect,
            status: assessmentStatus(aspect)
          }))
        }
      : null
  }
  // Difyのscene入力上限を超えると会話自体が失敗するため、古い記憶から表示用文脈を縮める。
  while (JSON.stringify(sceneData).length > 4000 && sceneData.storyContext?.memories.length)
    sceneData.storyContext.memories.shift()
  if (JSON.stringify(sceneData).length > 4000 && persona)
    sceneData.partnerDescription = characterDescription(
      persona,
      coaching.id,
      input.storyContext,
      false
    )
  if (JSON.stringify(sceneData).length > 4000)
    throw Error('Practice scene exceeds workflow input limit')
  const response = await fetch(`${base.replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Dify上の識別には練習IDを使い、Googleのプロフィール情報を送らない。
      user: input.id,
      response_mode: 'blocking',
      inputs: {
        scene: JSON.stringify(sceneData),
        transcript: JSON.stringify(transcript),
        turn: input.turns.length + 1,
        total_turns: input.rehearsal ? turnLimit + 1 : turnLimit,
        ...(policy
          ? { policy_context: JSON.stringify(policy), policy_hash: policy.trace.contextHash }
          : {})
      }
    }),
    signal
  })
  if (!response.ok) throw new Error('Practice generation failed')
  const body = await response.json()
  if (body.data?.status !== 'succeeded') throw new Error('Practice workflow failed')
  // 旧Workflowが新しい方針入力を無視した場合は、適用済みとして保存しない。
  if (policy && body.data.outputs?.policy_hash !== policy.trace.contextHash)
    throw Error('Practice policy acknowledgement mismatch')
  const raw =
    typeof body.data.outputs?.result === 'string'
      ? JSON.parse(body.data.outputs.result)
      : body.data.outputs?.result
  const userTexts = [...input.turns.map((turn) => turn.userText), input.text]
  const parsed = parsePracticeOutput(raw, userTexts, final, assessment)
  if (policy && parsed.feedback?.analysis) parsed.feedback.analysis.policy = policy.trace
  const result = { ...parsed, ...(policy ? { policyContext: policy.trace } : {}) }
  if (!input.adventure) return result
  return {
    ...result,
    presentation: parsePresentation(raw?.presentation),
    mission: final ? parseMission(raw?.mission, input.adventure, userTexts) : null,
    storyEnding: final
      ? parseStoryEnding(raw?.storyEnding ?? raw?.feedback?.storyEnding, input.adventure, userTexts)
      : null
  }
}
