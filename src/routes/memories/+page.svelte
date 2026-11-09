<script lang="ts">
  import { onMount } from 'svelte'
  import { user, authReady, authenticatedFetch } from '$lib/stores'
  import type { AdventureProgress } from '$lib/adventure'
  import { characterById } from '$lib/adventure'
  import AdventureProgressPanel from '$lib/components/adventure/AdventureProgress.svelte'
  import MemoryGallery from '$lib/components/adventure/MemoryGallery.svelte'
  let progress: AdventureProgress | null = null
  let message = ''
  let loading = false
  let mounted = false
  let uid = ''
  onMount(() => {
    mounted = true
    return () => (mounted = false)
  })
  $: if (mounted && $user && $user.uid !== uid) {
    uid = $user.uid
    void load()
  }
  $: if (!$user) {
    uid = ''
    progress = null
  }
  async function load() {
    const requested = $user?.uid
    loading = true
    message = ''
    try {
      const response = await authenticatedFetch('/api/me/adventure')
      const result = await response.json()
      if (mounted && $user?.uid === requested) progress = result
    } catch (error) {
      if (mounted && $user?.uid === requested)
        message = error instanceof Error ? error.message : 'アルバムを読み込めませんでした。'
    } finally {
      if ($user?.uid === requested) loading = false
    }
  }
</script>

<svelte:head
  ><title>思い出アルバム | Koi-Tre</title><meta name="robots" content="noindex" /></svelte:head
>
<div class="album">
  <a class="text-link" href="/#scenes">← お相手を選ぶ</a>
  <header>
    <p class="eyebrow">話すたびに、ひとつずつ。</p>
    <h1>思い出アルバム</h1>
    <p class="muted">一緒に過ごした場面と、あなたの言葉を。</p>
  </header>
  {#if !$authReady || loading}<p class="notice" role="status">
      アルバムを開いています…
    </p>{:else if !$user}<section class="empty card">
      <h2>同じアカウントで、思い出の続きへ。</h2>
      <p>会話したキャラクターや、保存したひと言を読み返せます。</p>
      <a class="button primary" href="/login?returnTo=memories">Googleでログイン</a>
    </section>{:else if progress}<AdventureProgressPanel
      progress="{progress}"
    />{#if progress.memories.length === 0}<section class="empty">
        <h2>最初の一枚を、ここに。</h2>
        <p>エピソードを終えると、思い出が増えていきます。</p>
        <a class="button primary" href="/#scenes">お相手を選ぶ →</a>
      </section>{:else}<MemoryGallery
        memories="{progress.memories}"
      />{/if}{#if progress.favorites.length}<section class="favorites">
        <p class="eyebrow">あなたの、心に残ったひと言</p>
        <h2>言葉のコレクション</h2>
        {#each progress.favorites as favorite}<a href="{`/practice/${favorite.practiceId}`}"
            ><span
              >{characterById(favorite.characterId)?.name}との会話 · {favorite.position}回目</span
            >
            <blockquote>「{favorite.text}」</blockquote></a
          >{/each}
      </section>{/if}{/if}{#if message}<p class="error" role="alert">{message}</p>
    <button class="button secondary" disabled="{loading}" on:click="{load}"
      >{loading ? '読み込み中…' : 'もう一度開く'}</button
    >{/if}
</div>

<style>
  .album {
    max-width: 960px;
    width: 100%;
    margin: 32px auto 64px;
  }
  .album header {
    margin: 32px 0;
  }
  .album h1 {
    text-align: left;
    font-family: var(--font-editorial);
    font-size: 2rem;
    margin: 12px 0;
  }
  .album header p {
    margin: 8px 0;
  }
  .empty {
    padding: 36px 24px;
    margin: 28px 0;
  }
  .empty h2 {
    font-size: 1.25rem;
  }
  .empty p {
    font-size: var(--text-base);
    color: var(--muted);
  }
  .favorites {
    margin-top: 48px;
  }
  .favorites h2 {
    font-size: 1.5rem;
    margin: 12px 0 24px;
  }
  .favorites > a {
    display: block;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    margin-bottom: 14px;
  }
  .favorites span {
    font-size: var(--text-sm);
    color: var(--muted);
  }
  .favorites blockquote {
    font-size: var(--text-base);
    line-height: 1.9;
    margin: 12px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
