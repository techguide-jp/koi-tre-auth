import { describe, expect, it } from 'vitest'
import { normalizeCustomScene, resolveScene } from './practice'

describe('カスタム場面の入力', () => {
  it('必須の状況だけで作れ、名前と開始案内を補う', () => {
    const input = normalizeCustomScene({ situation: '  帰り道で次の約束をする  ' })!
    expect(input).toEqual({
      situation: '帰り道で次の約束をする',
      partnerName: 'はる',
      openingLine: ''
    })
    expect(resolveScene('custom', input)?.opener).toContain(
      'はるさんが、あなたの言葉を待っています'
    )
    expect(resolveScene('custom', input)?.situation).toBe(input.situation)
    expect(resolveScene('custom')).toBeUndefined()
  })
  it('呼び名の敬称を重ねず、指定の最初のひと言を使う', () => {
    const input = normalizeCustomScene({
      situation: '食事の帰り道',
      partnerName: ' ゆうさん ',
      openingLine: ' 今日は楽しかったですね。 '
    })!
    expect(resolveScene('custom', input)).toMatchObject({
      partnerName: 'ゆう',
      opener: '今日は楽しかったですね。'
    })
  })
  it.each([
    null,
    [],
    {},
    { situation: ' ' },
    { situation: '場面\0' },
    { situation: '場面', partnerName: '名前\0' },
    { situation: '場面', openingLine: 'こんにちは\0' },
    { situation: 'あ'.repeat(501) },
    { situation: 'カフェ', partnerName: 42 },
    { situation: 'カフェ', partnerName: 'あ'.repeat(21) },
    { situation: 'カフェ', partnerName: 'あ\nい' },
    { situation: 'カフェ', openingLine: false },
    { situation: 'カフェ', openingLine: 'あ'.repeat(201) }
  ])('不正な入力を拒否する: %j', (value) => {
    expect(normalizeCustomScene(value)).toBeNull()
  })
})
