<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { characters, episodes, type Adventure, type CharacterId } from '$lib/adventure'
  export let characterId: CharacterId
  export let disabled = false
  export let pending = false
  const dispatch = createEventDispatcher<{ start: Adventure }>()
  $: character = characters.find((c) => c.id === characterId)!
  $: episode = episodes.find((e) => e.id === `${characterId}-1`)!
</script>

<section class="guest-intro" aria-label="ログインせずに会話を体験">
  <p class="eyebrow">{character.name}との、はじめの一歩</p>
  <h3>{episode.title}</h3>
  <p>{episode.setting}</p>
  <p class="small muted">
    1回返すと、相手の返事と会話の評価が届きます。ヒントと経験値も獲得できます。
  </p>
  <button
    class="button primary"
    disabled={disabled || pending}
    aria-busy={pending}
    on:click={() => dispatch('start', { version: 1, characterId, episodeId: episode.id, turns: 3 })}
    >{pending ? '出会いを準備しています…' : '1往復を体験する'} →</button
  >
  <p class="small muted">ログインすると体験の記録を保存し、第1話の本編を始められます。</p>
  <a href={`/login?character=${characterId}&episode=${episode.id}&turns=6`}
    >ログインして6往復で練習する →</a
  >
</section>

<style>
  .guest-intro {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
    background: var(--surface, #fffdf8);
  }
  h3 {
    font-size: clamp(1.2rem, 3vw, 1.6rem);
    margin: 8px 0 16px;
  }
  p {
    line-height: 1.8;
  }
  .button {
    margin: 12px 0;
  }
  a {
    font-size: var(--text-sm);
  }
  @media (max-width: 600px) {
    .guest-intro {
      padding: 20px;
    }
    .button {
      width: 100%;
    }
  }
</style>
