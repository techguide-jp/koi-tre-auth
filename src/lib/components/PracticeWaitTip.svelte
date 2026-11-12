<script lang="ts">
  import { onMount } from 'svelte'
  import { authenticatedFetch } from '$lib/stores'
  import { guestFetch } from '$lib/guest-practice-client'
  import {
    practiceTipById,
    type TipOffer,
    type TipRating,
    type TipSelfRating
  } from '$lib/practice-tips'
  import TipRatingChoices from './TipRatingChoices.svelte'

  export let practiceId: string
  export let requestId: string
  export let guest: boolean
  export let ready: boolean
  export let dismiss: () => void

  let dialog: HTMLDialogElement
  let title: HTMLHeadingElement
  let offer: TipOffer | null = null
  let saving: TipSelfRating | null = null
  let message = ''
  let loadError = ''
  $: tip = offer && practiceTipById(offer.tipId)

  onMount(() => {
    const modal = dialog
    modal.showModal()
    title.focus()
    void loadTip()
    return () => modal.close()
  })

  async function loadTip() {
    const endpoint = `/api/${guest ? 'guest' : 'me'}/practices/${practiceId}/tip`
    try {
      const response = await (guest ? guestFetch : authenticatedFetch)(endpoint, {
        method: 'POST',
        body: JSON.stringify({ requestId })
      })
      offer = await response.json()
    } catch {
      loadError = '会話のヒントを読み込めませんでした。'
    }
  }

  async function choose(value: TipSelfRating) {
    if (!offer || saving || offer.rating?.value === value) return
    saving = value
    message = ''
    const endpoint = guest
      ? `/api/guest/practices/${practiceId}/tip`
      : `/api/me/tips/${offer.tipId}`
    try {
      const response = await (guest ? guestFetch : authenticatedFetch)(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ value, revision: offer.rating?.id ?? null })
      })
      const rating: TipRating = await response.json()
      offer = { ...offer, rating }
      message = '自己評価を保存しました。'
    } catch (error) {
      message = error instanceof Error ? error.message : '自己評価を保存できませんでした。'
      await loadTip()
    } finally {
      saving = null
    }
  }
</script>

<dialog
  bind:this="{dialog}"
  aria-labelledby="practice-tip-title"
  on:cancel|preventDefault="{dismiss}"
>
  <div class="tip-content">
    <header>
      <p class="tip-label">会話のヒント</p>
      <h2 id="practice-tip-title" bind:this="{title}" tabindex="-1">
        {tip?.title ?? '会話のヒント'}
      </h2>
    </header>

    {#if tip}
      <p class="tip-text">{tip.tip}</p>
      <blockquote><span>たとえば</span>「{tip.example}」</blockquote>
      <TipRatingChoices
        prompt="{tip.prompt}"
        selected="{offer?.rating?.value}"
        saving="{saving}"
        choose="{choose}"
      />
      {#if message}<p class="tip-label" role="status">{message}</p>{/if}
    {:else}
      <p class="tip-text" role="status">{loadError || '会話のヒントを読み込んでいます…'}</p>
    {/if}

    <footer>
      <p role="status" aria-live="polite">
        {#if !ready}<span class="spinner" aria-hidden="true"></span>{/if}
        {ready ? '振り返りができました' : '振り返りをまとめています…'}
      </p>
      {#if ready}<button type="button" on:click="{dismiss}">結果を見る</button>{/if}
    </footer>
  </div>
</dialog>

<style>
  dialog {
    box-sizing: border-box;
    width: min(calc(100% - 28px), 500px);
    max-height: calc(100dvh - 28px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 22px;
    background: #fffdfb;
    color: var(--ink);
    box-shadow: 0 24px 70px #34172840;
  }

  dialog::backdrop {
    background: #35242d85;
  }

  .tip-content {
    display: grid;
    gap: 14px;
    padding: clamp(16px, 4vw, 26px);
  }

  .tip-label {
    margin: 0 0 4px;
    color: var(--accent);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  h2 {
    margin: 0;
    font-family: var(--font-editorial);
    font-size: clamp(1.2rem, 5vw, 1.55rem);
    line-height: 1.45;
  }

  h2:focus {
    outline: none;
  }

  .tip-text,
  blockquote {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.65;
  }

  blockquote {
    border-radius: 12px;
    padding: 10px 12px;
    background: #faf0f2;
  }

  blockquote span {
    display: block;
    color: var(--muted);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  footer p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--muted);
    font-size: var(--text-xs);
  }

  footer button {
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid var(--accent);
    border-radius: 10px;
    background: var(--accent);
    color: white;
    cursor: pointer;
    font: inherit;
    font-size: var(--text-sm);
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
