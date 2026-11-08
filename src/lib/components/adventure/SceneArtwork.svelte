<script lang="ts">
  import { onMount } from 'svelte'
  import type { SpecialCardArtwork } from '$lib/special-card-art'
  export let art: SpecialCardArtwork
  export let priority = false
  export let retryable = false
  let image: HTMLImageElement
  let state: 'loading' | 'ready' | 'error' = 'loading'
  let attempt = 0
  let previousId = art.id
  $: if (previousId !== art.id) {
    previousId = art.id
    attempt = 0
    state = 'loading'
  }
  $: source = art.src + (attempt ? `?retry=${attempt}` : '')
  onMount(() => {
    if (image?.complete && image.naturalWidth > 0) state = 'ready'
  })
  function retry() {
    state = 'loading'
    attempt += 1
  }
</script>

<div class="scene-art" aria-busy="{state === 'loading'}">
  <div class="cell">
    <img
      bind:this="{image}"
      src="{source}"
      alt="{art.title}の専用イラスト"
      loading="{priority ? 'eager' : 'lazy'}"
      decoding="async"
      style="{`width:${art.columns * 100}%;height:${art.rows * 100}%;left:${-art.column * 100}%;top:${-art.row * 100}%`}"
      on:load="{() => (state = 'ready')}"
      on:error="{() => (state = 'error')}"
    />
  </div>
  {#if state !== 'ready'}<div class="image-state" role="status">
      <span aria-hidden="true">✦</span>
      <p>{state === 'loading' ? '一枚を、開いています…' : 'イラストを読み込めませんでした。'}</p>
    </div>{/if}
</div>
{#if state === 'error' && retryable}<button class="button secondary retry" on:click="{retry}"
    >もう一度読み込む</button
  >{/if}

<style>
  .scene-art {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background: #e9e4d8;
    isolation: isolate;
  }
  /* セル境界の細線を隣の場面と一緒に表示しない。元の絵の配列は変更しない。 */
  .cell {
    position: absolute;
    inset: 0;
    overflow: hidden;
    transform: scale(1.014);
  }
  img {
    position: absolute;
    max-width: none;
    display: block;
  }
  .image-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #756b55;
    text-align: center;
    background: linear-gradient(135deg, #f0eadc, #e5e7da);
  }
  .image-state span {
    font-size: 1.8rem;
  }
  .image-state p {
    font-size: 0.75rem;
    line-height: 1.8;
    margin: 10px 0 0;
  }
  .retry {
    margin: 16px auto 0;
    display: block;
  }
</style>
