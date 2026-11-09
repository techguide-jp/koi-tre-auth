import { describe, expect, it } from 'vitest'
import { characters } from './adventure-catalog'
import { parseCharacterContent, parseCharacterSection } from './character-policy'
import {
  characterContentHash,
  characterDescription,
  characterStage,
  defaultCharacterContent
} from './server/character-content'

describe('人物設定の形式と場面の選択', () => {
  it.each(characters)('$name の初期設定は全フォームが有効で、生成入力が小さい', (c) => {
    const content = defaultCharacterContent(c.id)
    expect(parseCharacterContent(content)).toEqual(content)
    expect(content.reactions.negative).toBeTruthy()
    const description = characterDescription(
      {
        releaseId: null,
        version: null,
        characterId: c.id,
        contentHash: characterContentHash(content),
        content
      },
      'first_meeting',
      { version: 1, chapter: 1, relationship: '知り合ったばかり', revisit: false, memories: [] }
    )
    expect(description.length).toBeLessThan(1500)
    expect(description).toContain(content.stages.meeting)
    expect(description).not.toContain(content.stages.feelings)
  })
  it('6フォームを個別に検証し、余分な値や未知の項目を保存しない', () => {
    const original = defaultCharacterContent('rin')
    const updated = parseCharacterSection(
      'speech',
      { ...original.speech, tone: '短く率直に、少し照れながら。', admin: true },
      original
    )
    expect(updated.profile).toEqual(original.profile)
    expect(updated.speech).not.toHaveProperty('admin')
    expect(() => parseCharacterSection('unknown', {}, original)).toThrow()
    expect(() =>
      parseCharacterSection('speech', { ...original.speech, tone: '' }, original)
    ).toThrow()
    expect(() =>
      parseCharacterSection(
        'profile',
        { ...original.profile, personality: 'あ'.repeat(151) },
        original
      )
    ).toThrow()
    expect(() =>
      parseCharacterSection('values', { ...original.values, priorities: '\0' }, original)
    ).toThrow()
  })
  it('過去の話は当時の段階を使い、共通場面を本編後と誤認しない', () => {
    expect([1, 3, 4, 6, 7, 9, 10, 12].map((n) => characterStage(n))).toEqual([
      'meeting',
      'meeting',
      'date',
      'date',
      'honesty',
      'honesty',
      'feelings',
      'feelings'
    ])
    expect(characterStage(null, '互いを知り始めた二人')).toBe('meeting')
    expect(characterStage(null, '本編で、急がず知り合うと決めた二人')).toBe('life')
  })
})
