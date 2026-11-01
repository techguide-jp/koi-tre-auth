import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeCustomScene, resolveScene, scenes, sceneWithPartner } from './practice'
import { readCustomSceneDraft, saveCustomSceneDraft } from './custom-scene-client'

afterEach(() => vi.unstubAllGlobals())

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

describe('練習相手の選択', () => {
  it('相手を選んでログインしても、自由入力の下書きを上書きしない', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })
    const manual = {
      situation: '帰り道で次の約束をしたい',
      partnerName: 'まこと',
      openingLine: '今日はありがとう'
    }
    const preset = sceneWithPartner('cafe', 'male')!
    expect(saveCustomSceneDraft(manual)).toBe(true)
    expect(saveCustomSceneDraft(preset, 'preset')).toBe(true)
    expect(readCustomSceneDraft()).toEqual(manual)
    expect(readCustomSceneDraft('preset')).toEqual(preset)
  })
  it.each(scenes)('$title で指定しない場合は従来の場面を使う', (scene) => {
    expect(sceneWithPartner(scene.id, 'unspecified')).toBeUndefined()
    expect(resolveScene(scene.id)).toBe(scene)
  })

  it.each(
    scenes.flatMap((scene) =>
      (['male', 'female'] as const).map((preference) => ({ scene, preference }))
    )
  )('$scene.title の $preference の相手を既存形式で保存・再開できる', ({ scene, preference }) => {
    const setting = sceneWithPartner(scene.id, preference)!
    const saved = normalizeCustomScene(JSON.parse(JSON.stringify(setting)))!
    expect(saved).toEqual(setting)
    expect(saved.situation).toContain(
      `練習相手は成人の${preference === 'male' ? '男性' : '女性'}です`
    )
    expect(saved.situation).toContain(scene.title)
    expect(saved.situation).toContain(scene.goal)
    const reopened = resolveScene('custom', saved)!
    expect(reopened.partnerName).toBe(saved.partnerName)
    expect(reopened.opener).toBe(saved.openingLine)
    expect(reopened.opener).toContain(saved.partnerName)
    expect(reopened.situation).toBe(saved.situation)
  })
})
