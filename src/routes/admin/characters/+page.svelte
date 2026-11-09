<script lang="ts">
  import { onMount } from 'svelte'
  import { beforeNavigate } from '$app/navigation'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { characters, episodes, type CharacterId } from '$lib/adventure-catalog'
  import {
    characterSections,
    type CharacterContent,
    type CharacterOverview,
    type CharacterSection
  } from '$lib/character-policy'
  import AdminNavigation from '$lib/components/AdminNavigation.svelte'
  import CharacterPolicyEditor from '$lib/components/CharacterPolicyEditor.svelte'

  let selected: CharacterId = 'aoi',
    section: CharacterSection = 'profile'
  let view: CharacterOverview | null = null,
    content: CharacterContent | null = null
  let saved = '',
    pending: 'load' | 'save' | 'preview' | 'publish' | 'activate' | null = null
  let message = '',
    success = '',
    loadedUid = '',
    note = '',
    episodeId = 'aoi-1',
    text = '今日お会いできて嬉しいです。散歩すると、私も小さな発見があって楽しくなります。'
  let reviewed = false,
    mounted = false,
    reverting = ''
  let feedbackTarget: 'editor' | 'publication' | 'history' = 'editor'
  let sample: { opener: string; text: string; preview: { reply: string; passed: boolean } } | null =
    null
  $: person = characters.find((c) => c.id === selected)!
  $: ownEpisodes = episodes.filter((e) => e.characterId === selected)
  $: dirty = !!content && JSON.stringify(content) !== saved
  $: checked =
    !!view?.preview?.passed &&
    view.preview.revision === view.revision &&
    view.preview.checkedBy === $user?.uid
  $: if (mounted && $authReady && $user && loadedUid !== $user.uid) {
    loadedUid = $user.uid
    void load(selected)
  }
  $: if (!$user) {
    view = null
    content = null
    loadedUid = ''
    saved = ''
    sample = null
  }
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
    }
  })
  beforeNavigate(({ cancel }) => {
    if (dirty && !confirm('未保存の変更があります。移動しますか？')) cancel()
  })
  function apply(next: CharacterOverview) {
    view = next
    content = structuredClone(next.draft)
    saved = JSON.stringify(content)
    reviewed = false
    sample = null
  }
  function changed() {
    reviewed = false
    sample = null
    success = ''
    message = ''
  }
  function chooseSection(next: CharacterSection) {
    if (pending) return
    if (dirty) {
      feedbackTarget = 'editor'
      message = 'この項目を保存するか、変更を戻してから切り替えてください。'
      return
    }
    section = next
    message = ''
    success = ''
  }
  async function load(id: CharacterId) {
    if (pending) return
    if (dirty) {
      feedbackTarget = 'editor'
      message = '変更を保存するか、戻してから人物を切り替えてください。'
      return
    }
    pending = 'load'
    message = ''
    success = ''
    const uid = $user?.uid
    try {
      const response = await authenticatedFetch(`/api/admin/characters/${id}`)
      const next: CharacterOverview = await response.json()
      if (mounted && $user?.uid === uid) {
        selected = id
        episodeId = `${id}-1`
        apply(next)
      }
    } catch (cause) {
      if (mounted)
        message = cause instanceof Error ? cause.message : '人物設定を読み込めませんでした。'
    } finally {
      if (mounted) pending = null
    }
  }
  function discard() {
    if (view) {
      content = structuredClone(view.draft)
      changed()
    }
  }
  async function mutate(action: 'save' | 'preview' | 'publish' | 'activate', id?: string) {
    if (pending || !view || !content || (action !== 'save' && dirty)) return
    pending = action
    message = ''
    success = ''
    reverting = id ?? ''
    feedbackTarget =
      action === 'save' ? 'editor' : action === 'activate' ? 'history' : 'publication'
    const uid = $user?.uid,
      character = selected
    const payload =
      action === 'save'
        ? { revision: view.revision, section, value: content[section] }
        : action === 'preview'
          ? { action, revision: view.revision, episodeId, text }
          : action === 'publish'
            ? { action, revision: view.revision, reviewed, note }
            : { action, id, expected: view.active?.id ?? null }
    try {
      const response = await authenticatedFetch(`/api/admin/characters/${character}`, {
        method: action === 'save' ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      })
      const next = await response.json()
      if (!mounted || $user?.uid !== uid || selected !== character) return
      if (action === 'preview') {
        sample = next
        view = { ...view, preview: next.preview }
        reviewed = false
        success = '返信を生成しました。人物らしい反応か確認してください。'
      } else {
        apply(next)
        note = ''
        success =
          action === 'save'
            ? 'この項目の下書きを保存しました。'
            : action === 'publish'
              ? '公開しました。新しく始める会話から使います。'
              : '公開版を切り替えました。'
      }
    } catch (cause) {
      if (mounted && $user?.uid === uid)
        message = cause instanceof Error ? cause.message : '操作を完了できませんでした。'
    } finally {
      if (mounted) {
        pending = null
        reverting = ''
      }
    }
  }
  const date = (value: string) =>
    new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
</script>

<svelte:head
  ><title>人物設定の管理 | Koi-Tre</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>
<div class="character-admin">
  <a class="back" href="/account">← マイページ</a>
  <p class="eyebrow">Koi-Tre 運営管理</p>
  <h1>その人らしい会話を育てる</h1>
  <p class="intro">価値観、話すリズム、心を開く瞬間。人物ごとに項目を分けて整えます。</p>
  <AdminNavigation current="characters" />
  {#if !$authReady}<p role="status">ログイン状態を確認しています…</p>
  {:else if !$user}<section class="panel">
      <h2>管理者のログインが必要です</h2>
      <p>指定されたGoogleアカウントでログインしてください。</p>
      <a class="button" href="/login">ログインへ</a>
    </section>
  {:else}
    <nav class="people" aria-label="編集する人物">
      {#each characters as character}<button
          class:chosen="{selected === character.id}"
          disabled="{!!pending}"
          aria-pressed="{selected === character.id}"
          on:click="{() => load(character.id)}"
          ><strong>{character.name}</strong><span>{character.age}歳 · {character.subtitle}</span
          ></button
        >{/each}
    </nav>
    {#if pending === 'load'}<p role="status">人物設定を読み込んでいます…</p>{/if}
    {#if view && content}
      <section class="person-header">
        <div>
          <p class="eyebrow">会話用の人物設定</p>
          <h2>{person.name}<small>{person.age}歳</small></h2>
          <p>{person.detail}</p>
        </div>
        <div>
          <strong>{view.active ? `公開版 v${view.active.version}` : '初期設定を使用中'}</strong>
          <p>
            {view.revision === 0 ? '初期設定 · 下書き未保存' : `下書き r${view.revision}`}{dirty
              ? ' · 未保存の変更あり'
              : view.revision
                ? ' · 保存済み'
                : ''}
          </p>
        </div>
      </section>
      <div class="editor-layout">
        <nav class="sections" aria-label="人物設定の項目">
          {#each characterSections as item}<button
              aria-current="{section === item.id ? 'page' : undefined}"
              disabled="{!!pending}"
              on:click="{() => chooseSection(item.id)}">{item.label}</button
            >{/each}
        </nav>
        <section class="panel editor">
          <h2>{characterSections.find((s) => s.id === section)?.label}</h2>
          <p class="intro">{characterSections.find((s) => s.id === section)?.description}</p>
          {#if feedbackTarget === 'editor'}{#if message}<p class="error" role="alert">
                {message}
              </p>{/if}{#if success}<p class="notice" role="status">{success}</p>{/if}{/if}
          <CharacterPolicyEditor
            bind:content="{content}"
            section="{section}"
            pending="{!!pending}"
            saving="{pending === 'save'}"
            needsInitialSave="{view.revision === 0}"
            dirty="{dirty}"
            onsave="{() => mutate('save')}"
            ondiscard="{discard}"
            onchange="{changed}"
          />
        </section>
      </div>
      <section class="panel">
        <p class="eyebrow">保存した下書きを試す</p>
        <h2>返信を確認して公開する</h2>
        <p class="intro">場面を選んで話しかけ、その人物らしい返信になっているか確認します。</p>
        {#if feedbackTarget === 'publication'}{#if message}<p class="error" role="alert">
              {message}
            </p>{/if}{#if success}<p class="notice" role="status">{success}</p>{/if}{/if}
        <form
          on:submit|preventDefault="{() => mutate('preview')}"
          aria-busy="{pending === 'preview'}"
        >
          <fieldset disabled="{!!pending || dirty || view.revision === 0}">
            <label
              >確認する場面<select bind:value="{episodeId}"
                >{#each ownEpisodes as episode}<option value="{episode.id}"
                    >第{episode.chapter}話 · {episode.title}</option
                  >{/each}</select
              ></label
            >
            <p class="opener">{ownEpisodes.find((e) => e.id === episodeId)?.opener}</p>
            <label
              >話しかける言葉<textarea rows="3" maxlength="500" bind:value="{text}" required
              ></textarea></label
            ><button class="button secondary" type="submit"
              >{pending === 'preview' ? '返信を生成中…' : 'この人物の返信を試す'}</button
            >
          </fieldset>
        </form>
        {#if dirty}<p class="hint">先に編集中の項目を保存してください。</p>{/if}
        {#if view.revision === 0}<p class="hint">
            初期設定のまま試す場合も、先に「初期設定を下書きに保存」を押してください。
          </p>{/if}
        {#if sample}<div class="sample">
            <p>あなた：{sample.text}</p>
            <p><strong>{person.name}</strong></p>
            <blockquote>{sample.preview.reply}</blockquote>
          </div>
        {:else if checked}<div class="sample">
            <p>この下書きで確認した返信</p>
            <blockquote>{view.preview?.reply}</blockquote>
          </div>{/if}
        <form class="publish" on:submit|preventDefault="{() => mutate('publish')}">
          <label
            >公開メモ（任意）<input
              maxlength="200"
              bind:value="{note}"
              disabled="{!!pending}"
            /></label
          >
          <label class="checkbox"
            ><input
              type="checkbox"
              bind:checked="{reviewed}"
              disabled="{!!pending || dirty || !checked}"
            /> 返信の内容を確認しました</label
          >
          <button
            class="button primary"
            type="submit"
            disabled="{!!pending || dirty || !checked || !reviewed}"
            >{pending === 'publish' ? '公開中…' : `${person.name}の設定を公開`}</button
          >
        </form>
        <p class="hint">
          公開した設定は新しい練習から使います。通常の練習枠・XP・好感度は消費・変更しません。
        </p>
      </section>
      <section class="panel">
        <h2>公開の履歴</h2>
        {#if !view.releases.length}<p>まだ公開の履歴はありません。</p>{/if}
        {#if feedbackTarget === 'history'}{#if message}<p class="error" role="alert">
              {message}
            </p>{/if}{#if success}<p class="notice" role="status">{success}</p>{/if}{/if}
        {#each view.releases as release}<div class="history">
            <div>
              <strong>v{release.version}{view.active?.id === release.id ? ' · 公開中' : ''}</strong>
              <p>{date(release.createdAt)} · {release.note || 'メモなし'}</p>
            </div>
            <button
              class="button secondary"
              disabled="{!!pending || dirty || view.active?.id === release.id}"
              on:click="{() => mutate('activate', release.id)}"
              >{pending === 'activate' && reverting === release.id
                ? '切替中…'
                : 'この版に戻す'}</button
            >
          </div>{/each}
      </section>
    {:else if message}<p class="error" role="alert">{message}</p>{/if}
  {/if}
</div>

<style>
  .character-admin {
    max-width: 1100px;
    margin: auto;
    padding: 38px 24px 80px;
    color: #36432f;
  }
  .back {
    font-size: 0.8rem;
    color: #58694d;
  }
  .eyebrow {
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    color: #748167;
    margin-bottom: 8px;
  }
  h1 {
    font-size: clamp(1.5rem, 4vw, 2.1rem);
    margin: 12px 0;
  }
  h2 {
    font-size: 1.25rem;
    margin: 0 0 12px;
  }
  h2 small {
    font-size: 0.8rem;
    margin-left: 14px;
    font-weight: 400;
  }
  .intro,
  .hint {
    color: #6d7763;
    font-size: 0.85rem;
    line-height: 1.9;
  }
  .hint {
    font-size: 0.75rem;
  }
  .people {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 25px 0;
  }
  .people button {
    text-align: left;
    padding: 16px;
    background: #fafbf6;
    border: 1px solid #d9ddcf;
    border-radius: 10px;
    color: inherit;
    cursor: pointer;
  }
  .people .chosen {
    border: 2px solid #58694d;
    padding: 15px;
    background: #eef2e7;
  }
  .people strong {
    font-size: 1rem;
  }
  .people span {
    display: block;
    font-size: 0.7rem;
    line-height: 1.7;
    margin-top: 5px;
  }
  .person-header {
    display: flex;
    gap: 24px;
    justify-content: space-between;
    align-items: center;
    margin: 30px 0;
  }
  .person-header p {
    font-size: 0.8rem;
    line-height: 1.8;
  }
  .person-header > div:last-child {
    text-align: right;
    font-size: 0.85rem;
  }
  .editor-layout {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sections button {
    padding: 13px 12px;
    text-align: left;
    border: 1px solid #d9ddcf;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .sections button[aria-current='page'] {
    background: #58694d;
    color: white;
    border-color: #58694d;
  }
  .panel {
    padding: 28px;
    border: 1px solid #d9ddcf;
    border-radius: 14px;
    background: #fffefa;
    margin-bottom: 26px;
    min-width: 0;
  }
  .error,
  .notice {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
  .error {
    background: #f7eae5;
    color: #943f31;
  }
  .notice {
    background: #edf1e5;
    color: #44553a;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  label {
    display: block;
    margin: 18px 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  select,
  textarea,
  input:not([type='checkbox']) {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    padding: 12px;
    border: 1px solid #bfc7b5;
    border-radius: 8px;
    background: white;
    color: inherit;
    font: inherit;
    font-weight: 400;
    line-height: 1.8;
  }
  textarea {
    resize: vertical;
  }
  .opener,
  .sample {
    padding: 16px;
    border-radius: 10px;
    background: #f3f3eb;
    line-height: 1.9;
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  .sample {
    margin-top: 22px;
  }
  blockquote {
    margin: 10px 0 0;
    padding-left: 16px;
    border-left: 3px solid #9aa88c;
  }
  .publish {
    border-top: 1px solid #d9ddcf;
    margin-top: 24px;
    padding-top: 8px;
  }
  .checkbox {
    display: flex;
    gap: 8px;
    line-height: 1.8;
    align-items: start;
  }
  .checkbox input {
    margin-top: 6px;
  }
  .button {
    min-height: 44px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 10px 18px;
    border-radius: 8px;
    border: 1px solid #b5bea8;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
  }
  .primary {
    background: #58694d;
    color: white;
  }
  .secondary {
    background: #f7f8f1;
    color: #46533d;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .history {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
    padding: 18px 0;
    border-top: 1px solid #e0e1d8;
  }
  .history p {
    font-size: 0.75rem;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
  @media (max-width: 650px) {
    .character-admin {
      padding: 28px 16px 60px;
    }
    .people {
      grid-template-columns: repeat(2, 1fr);
    }
    .person-header {
      align-items: start;
      flex-direction: column;
      gap: 4px;
    }
    .person-header > div:last-child {
      text-align: left;
    }
    .editor-layout {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .sections {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
    }
    .panel {
      padding: 22px 16px;
    }
    .history {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
