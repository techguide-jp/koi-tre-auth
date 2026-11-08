import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { characters, episodeById, episodeKey, normalizeAdventure } from '$lib/adventure'
import {
  affinityLabel,
  applyRelationship,
  gradeConversation,
  PROGRESSION_VERSION,
  stageRules,
  type PracticeEvaluation,
  type ProgressionView
} from '$lib/adventure-progression'
import type { PracticeAssessment } from '$lib/practice'
import {
  characterRelationships,
  episodeAchievements,
  practiceEvaluations,
  practices,
  practiceTurns
} from '../schema'
import type { CreditDb } from './credits'

export async function readProgression(db: CreditDb, uid: string): Promise<ProgressionView> {
  const [relationships, achievements] = await Promise.all([
    db.select().from(characterRelationships).where(eq(characterRelationships.uid, uid)),
    db.select().from(episodeAchievements).where(eq(episodeAchievements.uid, uid))
  ])
  return {
    version: PROGRESSION_VERSION,
    relationships: characters.map((character) => {
      const saved = relationships.find((row) => row.characterId === character.id)
      const earned = saved?.earned ?? 0,
        strain = saved?.strain ?? 0,
        affinity = earned - strain
      return { characterId: character.id, earned, strain, affinity, label: affinityLabel(affinity) }
    }),
    achievements: achievements.map((row) => ({
      characterId: row.characterId,
      episodeId: row.episodeId,
      bestScore: row.bestScore === null ? null : row.bestScore / 10,
      bestPassingScore: row.bestPassingScore === null ? null : row.bestPassingScore / 10,
      contribution: row.contribution,
      cleared: !!row.clearedAt
    })),
    clearedEpisodes: achievements
      .filter((row) => row.clearedAt)
      .map((row) => episodeKey(row.characterId, row.episodeId))
  }
}

// 呼び出し側は必ず本人のusers行をFOR UPDATEしてから実行する。履歴を残したまま新規分だけ精算する。
export async function settleProgression(db: CreditDb, uid: string, now = new Date()) {
  const completed = await db
    .select()
    .from(practices)
    .where(
      and(eq(practices.uid, uid), isNotNull(practices.completedAt), isNotNull(practices.adventure))
    )
    .orderBy(asc(practices.completedAt), asc(practices.createdAt), asc(practices.id))
  for (const session of completed) {
    const adventure = normalizeAdventure(session.adventure)
    if (!adventure) continue
    const prior = await db.query.practiceEvaluations.findFirst({
      where: eq(practiceEvaluations.practiceId, session.id)
    })
    if (prior) continue
    const [last] = await db
      .select()
      .from(practiceTurns)
      .where(
        and(eq(practiceTurns.practiceId, session.id), eq(practiceTurns.position, adventure.turns))
      )
    await settleEvaluation(db, uid, session.id, last?.feedback?.analysis?.assessment, now)
    // 履歴を時系列に再生し、合格後にすれ違いが起きても、その時点のクリアは保持する。
    await clearEligibleStages(db, uid, now)
  }
  await clearEligibleStages(db, uid, now)
}

export async function settleEvaluation(
  db: CreditDb,
  uid: string,
  practiceId: string,
  assessment?: PracticeAssessment | null,
  now = new Date()
) {
  const session = await db.query.practices.findFirst({
    where: and(eq(practices.id, practiceId), eq(practices.uid, uid))
  })
  const adventure = normalizeAdventure(session?.adventure)
  if (!session?.completedAt || !adventure) return
  const prior = await db.query.practiceEvaluations.findFirst({
    where: eq(practiceEvaluations.practiceId, practiceId)
  })
  if (prior?.settledAt) return prior.result
  const chapter = episodeById(adventure.episodeId)?.chapter
  const relationId = `${uid}:${adventure.characterId}`,
    achievementId = `${relationId}:${adventure.episodeId}`
  const relation = await db.query.characterRelationships.findFirst({
    where: eq(characterRelationships.id, relationId)
  })
  const achievement = await db.query.episodeAchievements.findFirst({
    where: eq(episodeAchievements.id, achievementId)
  })
  const previous = { earned: relation?.earned ?? 0, strain: relation?.strain ?? 0 }
  const grade = gradeConversation(assessment, chapter)
  const next = applyRelationship(
    previous,
    achievement?.contribution ?? 0,
    grade,
    adventure.turns,
    chapter
  )
  const result: PracticeEvaluation = {
    version: PROGRESSION_VERSION,
    status: grade.status,
    score: grade.score,
    consideration: grade.consideration,
    requiredScore: grade.requiredScore,
    requiredConsideration: grade.requiredConsideration,
    affinityBefore: previous.earned - previous.strain,
    affinityAfter: next.affinity,
    earnedDelta: next.earnedDelta,
    strainDelta: next.strainDelta,
    assessment: assessment ?? null
  }
  if (grade.status === 'pending') {
    await db
      .insert(practiceEvaluations)
      .values({
        practiceId,
        uid,
        characterId: adventure.characterId,
        version: PROGRESSION_VERSION,
        result
      })
      .onConflictDoNothing()
    return result
  }
  await db
    .insert(characterRelationships)
    .values({
      id: relationId,
      uid,
      characterId: adventure.characterId,
      version: PROGRESSION_VERSION,
      earned: next.earned,
      strain: next.strain
    })
    .onConflictDoUpdate({
      target: characterRelationships.id,
      set: { earned: next.earned, strain: next.strain, updatedAt: now }
    })
  const score = Math.round(grade.score! * 10)
  const bestScore = Math.max(achievement?.bestScore ?? 0, score)
  const bestPassingScore =
    grade.status === 'passed'
      ? Math.max(achievement?.bestPassingScore ?? 0, score)
      : (achievement?.bestPassingScore ?? null)
  await db
    .insert(episodeAchievements)
    .values({
      id: achievementId,
      uid,
      characterId: adventure.characterId,
      episodeId: adventure.episodeId,
      version: PROGRESSION_VERSION,
      bestScore,
      bestPassingScore,
      contribution: next.contribution,
      clearedAt: achievement?.clearedAt ?? (!chapter && grade.status === 'passed' ? now : null)
    })
    .onConflictDoUpdate({
      target: episodeAchievements.id,
      set: {
        bestScore,
        bestPassingScore,
        contribution: next.contribution,
        clearedAt: achievement?.clearedAt ?? (!chapter && grade.status === 'passed' ? now : null)
      }
    })
  await db
    .insert(practiceEvaluations)
    .values({
      practiceId,
      uid,
      characterId: adventure.characterId,
      version: PROGRESSION_VERSION,
      result,
      settledAt: now
    })
    .onConflictDoUpdate({
      target: practiceEvaluations.practiceId,
      set: { result, settledAt: now, pendingToken: null, pendingUntil: null }
    })
  return result
}

export async function clearEligibleStages(db: CreditDb, uid: string, now = new Date()) {
  const view = await readProgression(db, uid)
  for (const relationship of view.relationships) {
    for (const rule of stageRules) {
      const achievement = view.achievements.find(
        (row) =>
          row.characterId === relationship.characterId &&
          row.episodeId === `${relationship.characterId}-${rule.chapter}`
      )
      if (achievement?.cleared) continue
      // 最高点だけで先の話を解放せず、前のクリアと好感度もサーバーで満たす。
      if (
        !achievement ||
        achievement.bestPassingScore === null ||
        relationship.affinity < rule.affinity
      )
        break
      await db
        .update(episodeAchievements)
        .set({ clearedAt: now })
        .where(
          eq(episodeAchievements.id, `${uid}:${relationship.characterId}:${achievement.episodeId}`)
        )
    }
  }
}
