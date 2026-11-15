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
import { practiceCoaching, withCoachingVariant } from './practice-coaching'
import { parsePracticeOutput } from './practice-feedback'
import { reviewPracticeFeedback, transcriptReviewRepair } from './practice-feedback-review'
import type { KnowledgeContent } from '$lib/knowledge-policy'
import { getKnowledgeRelease } from './db/repositories/knowledge'
import { makeKnowledgeContext } from './knowledge-content'
import type { CharacterSnapshot } from '$lib/character-policy'
import { characterContentHash, characterDescription } from './character-content'
export { parsePracticeOutput } from './practice-feedback'

const trialAnalysisRepair =
  ' 前の出力は形式エラー。feedbackをnullにせず、総評・5観点・実際の1発言に対応する分析と言い換えを必ず返す。引用は1回目の原文のみ。'

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
  const trial = final && input.adventure?.trial === true
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
  const coachingVariant = withCoachingVariant(coaching, policy?.trace.coaching)
  const sceneData = {
    ...scene,
    ...(input.adventure?.trial ? { mission: undefined } : {}),
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
      ...coachingVariant,
      ...(trial
        ? {
            avoid: `${coachingVariant.avoid} 体験ではturn=total_turns=1が最終回。feedbackは必須でnull不可。合計点が不明でも分析を返す。analysis.turnsは1回目のみ1件。形式上3件必須なら同じturn:1を3件複製する。全引用は1回目の原文に限り各項目1件。初対面として自然に返し、別れの挨拶は不要。developmentとmissionはnull。`
          }
        : {}),
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
  const review = final && policy?.trace.feedbackReview === 'transcript-v1'
  const repair = review ? ` ${transcriptReviewRepair}` : ''
  // 再生成でも同じ会話の文脈を渡せるよう、Difyの入力上限内に補足指示の分を確保する。
  const sceneLimit = 4000 - Math.max(repair.length, trial ? trialAnalysisRepair.length : 0)
  while (JSON.stringify(sceneData).length > sceneLimit && sceneData.storyContext?.memories.length)
    sceneData.storyContext.memories.shift()
  if (JSON.stringify(sceneData).length > sceneLimit && persona)
    sceneData.partnerDescription = characterDescription(
      persona,
      coaching.id,
      input.storyContext,
      false
    )
  if (JSON.stringify(sceneData).length > sceneLimit)
    throw Error('Practice scene exceeds workflow input limit')
  const userTexts = [...input.turns.map((turn) => turn.userText), input.text]
  async function requestOutput() {
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
    return body.data.outputs?.result
  }
  function parseResult(output: unknown) {
    const raw = typeof output === 'string' ? JSON.parse(output) : output
    const parsed = parsePracticeOutput(raw, userTexts, final, assessment)
    if (trial && !parsed.feedback?.analysis) throw Error('Missing trial analysis')
    return { raw, parsed }
  }
  const output = await requestOutput()
  let generated: ReturnType<typeof parseResult>
  let retried = false
  try {
    generated = parseResult(output)
  } catch (cause) {
    if (!trial || signal.aborted) throw cause
    // 体験でも評価を省略せず、形式不備は同じ会話・同じ時間制限で一度だけ再生成する。
    retried = true
    sceneData.coaching.avoid += trialAnalysisRepair
    generated = parseResult(await requestOutput())
  }
  if (review) {
    const check = (feedback: typeof generated.parsed.feedback) =>
      feedback ? reviewPracticeFeedback(transcript, feedback, signal) : 'unavailable'
    let decision = await check(generated.parsed.feedback)
    if (decision === 'revise' && !retried && !signal.aborted) {
      sceneData.coaching.avoid += repair
      generated = parseResult(await requestOutput())
      decision = await check(generated.parsed.feedback)
    }
    // 照合できない文章を返すと、会話・報酬と一緒に誤指摘が保存される。
    if (decision !== 'confirmed') throw Error('Practice feedback grounding not confirmed')
  }
  const { raw, parsed } = generated
  if (policy && parsed.feedback?.analysis) parsed.feedback.analysis.policy = policy.trace
  const result = { ...parsed, ...(policy ? { policyContext: policy.trace } : {}) }
  if (!input.adventure) return result
  return {
    ...result,
    presentation: parsePresentation(raw?.presentation),
    mission:
      final && !input.adventure.trial
        ? parseMission(raw?.mission, input.adventure, userTexts)
        : null,
    storyEnding: final
      ? parseStoryEnding(raw?.storyEnding ?? raw?.feedback?.storyEnding, input.adventure, userTexts)
      : null
  }
}
