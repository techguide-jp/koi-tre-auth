import { describe, expect, it } from 'vitest'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { characters, episodes } from './adventure-catalog'
import { dailyEpisodes, eventEpisode } from './adventure-life'
import { earnedSpecialCard, specialCardArtwork, specialCardCollections } from './special-card-art'
import type { Adventure, AdventureProgress } from './adventure'

describe('6往復の場面専用イラスト', () => {
  it('本編72場面・共通と日常60場面・季節144場面に重複しないセルを割り当てる', async () => {
    const cells = new Set<string>(),
      files = new Set<string>()
    for (const character of characters) {
      const scenes = [
        ...episodes.filter(
          (episode) => !episode.characterId || episode.characterId === character.id
        ),
        ...dailyEpisodes,
        ...Array.from(
          { length: 24 },
          (_, index) =>
            eventEpisode(
              `event-2027-${String(Math.floor(index / 2) + 1).padStart(2, '0')}-${(index % 2) + 1}`
            )!
        )
      ]
      for (const scene of scenes) {
        const art = specialCardArtwork(character.id, scene.id)!
        expect(art.title).toBe(scene.title)
        expect(art.row).toBeLessThan(art.rows)
        expect(art.column).toBeLessThan(art.columns)
        expect(art.row).toBeGreaterThanOrEqual(0)
        expect(art.column).toBeGreaterThanOrEqual(0)
        const cell = `${art.src}:${art.column}:${art.row}`
        expect(cells.has(cell), `${character.id}/${scene.id}の専用セル`).toBe(false)
        cells.add(cell)
        files.add(art.src)
      }
    }
    expect(cells.size).toBe(276)
    expect(files.size).toBe(24)
    for (const file of files) {
      const path = join(process.cwd(), 'static', file)
      await expect(access(path)).resolves.toBeUndefined()
      const data = await readFile(path)
      expect(data.subarray(0, 4).toString()).toBe('RIFF')
      expect(data.subarray(8, 12).toString()).toBe('WEBP')
    }
  })
  it('人物と話の対応を守り、無効な指定では他の人物の絵を出さない', () => {
    expect(specialCardArtwork('rin', 'aoi-1')).toBeUndefined()
    expect(specialCardArtwork('unknown', 'aoi-1')).toBeUndefined()
    expect(specialCardArtwork('aoi', '../../secret')).toBeUndefined()
    expect(specialCardArtwork('aoi', 'event-2026-13-1')).toBeUndefined()
    expect(specialCardArtwork('aoi', 'aoi-7')).toMatchObject({
      column: 0,
      row: 2,
      src: '/images/special-cards/aoi-story.webp'
    })
    expect(specialCardArtwork('aoi', 'event-2026-11-1')).toMatchObject({
      column: 2,
      row: 2,
      src: '/images/special-cards/aoi-season-2.webp'
    })
    expect(specialCardArtwork('ren', 'event-2027-01-1')).toMatchObject({
      column: 0,
      row: 0,
      src: '/images/special-cards/ren-season-1.webp'
    })
  })
  it('3往復・未完了6往復では専用絵を解放せず、過去の完了済み6往復にも絵を付ける', () => {
    const adventure: Adventure = { version: 1, characterId: 'aoi', episodeId: 'aoi-7', turns: 6 }
    expect(earnedSpecialCard({ adventure, completedAt: null })).toBeUndefined()
    expect(
      earnedSpecialCard({
        adventure: { ...adventure, turns: 3 },
        completedAt: '2026-11-08T00:00:00Z'
      })
    ).toBeUndefined()
    expect(earnedSpecialCard({ adventure, completedAt: '2026-11-08T00:00:00Z' })?.id).toBe(
      'aoi:aoi-7'
    )
  })
  it('再挑戦や通常カードを本編の専用イラスト収集数へ重複計上しない', () => {
    const memory = (
      episodeId: string,
      variant: 'short' | 'deep'
    ): AdventureProgress['memories'][number] => ({
      characterId: 'aoi',
      episodeId,
      variant,
      practiceId: episodeId + variant,
      completedAt: '2026-11-08T00:00:00Z',
      title: '検証用'
    })
    expect(
      specialCardCollections([
        memory('aoi-1', 'short'),
        memory('aoi-2', 'deep'),
        memory('aoi-2', 'deep'),
        memory('daily-today', 'deep')
      ])
    ).toEqual([{ characterId: 'aoi', name: 'あおい', earned: 1, total: 12 }])
  })
})
