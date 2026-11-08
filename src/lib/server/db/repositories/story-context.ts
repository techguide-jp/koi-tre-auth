import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { characterEndings, practices, practiceTurns } from '../schema'
import type { CreditDb } from './credits'
import { episodeById, isLifeEpisode, type Adventure, type StoryContext } from '$lib/adventure'
import { readProgression } from './progression'
import { practiceEvaluations } from '../schema'
import { affinityLabel, stageRules } from '$lib/adventure-progression'

export async function buildStoryContext(
  db: CreditDb,
  uid: string,
  adventure: Adventure
): Promise<StoryContext> {
  const episode = episodeById(adventure.episodeId)!
  const progression = await readProgression(db, uid)
  const evaluated = await db
    .select()
    .from(practiceEvaluations)
    .where(eq(practiceEvaluations.uid, uid))
  const completed = await db
    .select()
    .from(practices)
    .where(
      and(eq(practices.uid, uid), isNotNull(practices.completedAt), isNotNull(practices.adventure))
    )
    .orderBy(asc(practices.completedAt))
  const seen = new Set<string>()
  const own = completed.filter((s) => {
    if (s.adventure?.characterId !== adventure.characterId || s.adventure.revisit) return false
    const chapter = episodeById(s.adventure.episodeId)?.chapter
    if (
      chapter &&
      (!progression.clearedEpisodes.includes(`${adventure.characterId}:${s.adventure.episodeId}`) ||
        !evaluated.some((e) => e.practiceId === s.id && e.result.status === 'passed'))
    )
      return false
    if (!chapter) return isLifeEpisode(s.adventure.episodeId)
    if (seen.has(s.adventure.episodeId)) return false
    seen.add(s.adventure.episodeId)
    return true
  })
  let historicalAffinity: number | undefined
  if (adventure.revisit) {
    const original = own.find((s) => s.adventure?.episodeId === adventure.episodeId)
    if (original?.storyContext) return { ...original.storyContext, revisit: true }
    historicalAffinity =
      evaluated.find((e) => e.practiceId === original?.id)?.result.affinityBefore ??
      stageRules.find((r) => r.chapter === episode.chapter)?.affinity ??
      0
  }
  const life = isLifeEpisode(episode.id)
  let relationship =
    (episode.chapter ?? 1) <= 3
      ? '互いを知り始めた二人'
      : (episode.chapter ?? 1) <= 6
        ? '二人で出かけるようになった、まだ交際を確定していない二人'
        : (episode.chapter ?? 1) <= 9
          ? '互いの本音や希望を話し始めた、まだ交際を確定していない二人'
          : '大切な気持ちと、今後の関係を話す二人'
  if (life) {
    const [selected] = await db
      .select()
      .from(characterEndings)
      .where(
        and(eq(characterEndings.uid, uid), eq(characterEndings.characterId, adventure.characterId))
      )
    const ending = selected
      ? (own.find((s) => s.id === selected.practiceId) ??
        completed.find(
          (s) =>
            s.id === selected.practiceId &&
            evaluated.some((e) => e.practiceId === s.id && e.result.status === 'passed')
        ))
      : own.filter((s) => s.storyEnding).at(-1)
    relationship =
      ending?.storyEnding?.kind === 'lovers'
        ? '本編で互いの気持ちを確かめ、交際を始めた二人'
        : '本編で、急がずもう少し時間をかけて知り合うと決めた二人。交際を確定していない'
  }
  // 本音編へ戻るときに、後の告白や交際の記憶を混ぜない。
  const eligible = own.filter(
    (s) => life || (episodeById(s.adventure!.episodeId)?.chapter ?? 999) < (episode.chapter ?? 0)
  )
  const recent = eligible.slice(-6)
  const memories: StoryContext['memories'] = []
  for (const session of recent) {
    const [turn] = await db
      .select()
      .from(practiceTurns)
      .where(eq(practiceTurns.practiceId, session.id))
      .orderBy(desc(practiceTurns.position))
      .limit(1)
    if (turn)
      memories.push({
        episodeId: session.adventure!.episodeId,
        userQuote: turn.userText.slice(0, 100),
        partnerReply: turn.assistantText.slice(0, 100)
      })
  }
  return {
    version: 1,
    relationship,
    chapter: episode.chapter ?? null,
    revisit: !!adventure.revisit,
    memories,
    affinity: (() => {
      const current = progression.relationships.find(
        (r) => r.characterId === adventure.characterId
      )!
      const value = historicalAffinity ?? current.affinity
      return { value, label: affinityLabel(value) }
    })()
  }
}
