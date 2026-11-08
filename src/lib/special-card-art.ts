import { characters, episodes, type CharacterId } from './adventure-catalog'
import { dailyEpisodes, eventEpisode } from './adventure-life'
import type { AdventureProgress } from './adventure'
import type { PracticeSession } from './practice'

export interface SpecialCardArtwork {
  id: string
  characterId: CharacterId
  episodeId: string
  title: string
  src: string
  columns: number
  rows: number
  column: number
  row: number
}

const practiceScenes = [...episodes.filter((episode) => !episode.characterId), ...dailyEpisodes]

export function specialCardArtwork(
  characterId: unknown,
  episodeId: unknown
): SpecialCardArtwork | undefined {
  const character = characters.find((person) => person.id === characterId)
  if (!character || typeof episodeId !== 'string') return
  const story = episodes.filter((episode) => episode.characterId === character.id)
  let index = story.findIndex((episode) => episode.id === episodeId)
  let kind = 'story',
    columns = 3,
    rows = 4,
    title = story[index]?.title
  if (index < 0) {
    index = practiceScenes.findIndex((episode) => episode.id === episodeId)
    if (index >= 0) {
      kind = 'practice'
      columns = 2
      rows = 5
      title = practiceScenes[index].title
    } else {
      const event = eventEpisode(episodeId)
      if (!event) return
      const [, , month, slot] = /^event-(20\d{2})-(\d{2})-([12])$/.exec(episodeId)!
      kind = Number(month) <= 6 ? 'season-1' : 'season-2'
      index = ((Number(month) - 1) % 6) * 2 + Number(slot) - 1
      title = event.title
    }
  }
  return {
    id: `${character.id}:${episodeId}`,
    characterId: character.id,
    episodeId,
    title: title!,
    src: `/images/special-cards/${character.id}-${kind}.webp`,
    columns,
    rows,
    column: index % columns,
    row: Math.floor(index / columns)
  }
}

export function earnedSpecialCard(session: Pick<PracticeSession, 'adventure' | 'completedAt'>) {
  // 予約や6往復の選択だけでは絵を解放せず、保存済みの完了履歴を使う。
  return session.completedAt && session.adventure?.turns === 6
    ? specialCardArtwork(session.adventure.characterId, session.adventure.episodeId)
    : undefined
}

export function specialCardCollections(memories: AdventureProgress['memories']) {
  const encountered = new Set(memories.map((memory) => memory.characterId))
  return characters
    .filter((character) => encountered.has(character.id))
    .map((character) => {
      const story = episodes.filter((episode) => episode.characterId === character.id)
      const earned = new Set(
        memories
          .filter((memory) => memory.characterId === character.id && memory.variant === 'deep')
          .map((memory) => memory.episodeId)
      )
      return {
        characterId: character.id,
        name: character.name,
        earned: story.filter((episode) => earned.has(episode.id)).length,
        total: story.length
      }
    })
}
