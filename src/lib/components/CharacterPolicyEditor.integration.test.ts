import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import Editor from './CharacterPolicyEditor.svelte'
import { defaultCharacterContent } from '$lib/server/character-content'

describe('人物設定の最初の保存', () => {
  it('初期値のままでも最初の下書きを保存でき、保存後は未編集の保存を防ぐ', () => {
    const props = {
      content: defaultCharacterContent('aoi'),
      section: 'profile' as const,
      dirty: false,
      pending: false,
      onsave: () => {},
      ondiscard: () => {},
      onchange: () => {}
    }
    const first = render(Editor, { props: { ...props, needsInitialSave: true } }).body
    const saved = render(Editor, { props: { ...props, needsInitialSave: false } }).body
    expect(first).toContain('初期設定を下書きに保存')
    const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0])
    expect(buttons(first)[0]).not.toContain('disabled')
    expect(buttons(saved)[0]).toContain('disabled')
  })
})
