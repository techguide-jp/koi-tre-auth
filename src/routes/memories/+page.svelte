<script lang="ts">
  import { onMount } from 'svelte'
  import { user, authReady, authenticatedFetch } from '$lib/stores'
  import type { AdventureProgress } from '$lib/adventure'
  import { characterById, episodeById } from '$lib/adventure'
  import AdventureProgressPanel from '$lib/components/adventure/AdventureProgress.svelte'
  import CharacterPortrait from '$lib/components/adventure/CharacterPortrait.svelte'
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
      </section>{:else}<div class="memory-grid">
        {#each progress.memories as memory}{@const character = characterById(
            memory.characterId
          )}{@const episode = episodeById(memory.episodeId)}{#if character && episode}<a
              class="memory {episode.theme}"
              class:deep="{memory.variant === 'deep'}"
              href="{`/practice/${memory.practiceId}`}"
              ><div class="art">
                <CharacterPortrait
                  characterId="{character.id}"
                  emotion="{memory.emotion ?? 'relieved'}"
                />
              </div>
              <div class="caption">
                <span
                  >{character.name} · {new Date(memory.completedAt).toLocaleDateString('ja-JP', {
                    timeZone: 'Asia/Tokyo'
                  })}</span
                >
                <h2>{memory.title}</h2>
                {#if memory.variant === 'deep'}<span class="deep-label">✦ 6往復の、特別な一枚</span
                  >{#if memory.quote}<blockquote>「{memory.quote}」</blockquote>{/if}{/if}
                <p>会話と振り返りを読む ↗</p>
              </div></a
            >{/if}{/each}
      </div>{/if}{#if progress.favorites.length}<section class="favorites">
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
  .memory.deep {
    border: 2px solid #a89366;
  }
  .deep-label {
    display: inline-block;
    color: #735b2d;
    font-size: 0.7rem;
    margin: 6px 0;
  }
  .caption blockquote {
    font-size: 0.78rem;
    line-height: 1.8;
    margin: 12px 0;
    padding: 12px;
    background: #ffffffb3;
    border-radius: 8px;
    overflow-wrap: anywhere;
  }
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
    font-size: 0.9rem;
    color: var(--muted);
  }
  .memory-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-top: 32px;
  }
  .memory {
    display: block;
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    background: var(--surface);
  }
  .memory:hover {
    text-decoration: none;
    border-color: var(--accent);
  }
  .art {
    height: 250px;
    overflow: hidden;
    background: linear-gradient(145deg, #e6e7d9, #f5e5d1);
  }
  .evening .art {
    background: linear-gradient(145deg, #dfd8d4, #f0e1cc);
  }
  .books .art {
    background: linear-gradient(145deg, #dedcd1, #efebe1);
  }
  .art :global(.portrait) {
    height: 100%;
    width: auto;
    max-width: 100%;
    margin: 0 auto;
  }
  .caption {
    padding: 18px;
  }
  .caption span,
  .caption p {
    font-size: 0.72rem;
    color: var(--muted);
  }
  .caption h2 {
    font-size: 1rem;
    line-height: 1.8;
    margin: 8px 0;
  }
  .caption p {
    margin: 12px 0 0;
    color: var(--accent);
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
    font-size: 0.75rem;
    color: var(--muted);
  }
  .favorites blockquote {
    font-size: 0.9rem;
    line-height: 1.9;
    margin: 12px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  @media (max-width: 650px) {
    .memory-grid {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .art {
      height: 200px;
    }
    .caption {
      padding: 12px;
    }
    .caption h2 {
      font-size: 0.9rem;
    }
    .caption span {
      font-size: 0.65rem;
    }
  }
  @media (max-width: 380px) {
    .memory-grid {
      grid-template-columns: 1fr;
    }
    .art {
      height: 270px;
    }
  }
</style>
