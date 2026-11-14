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
  let confirmed = false
  let active = false
  let dismissTimer: ReturnType<typeof setTimeout> | undefined
  let message = ''
  let loadError = ''
  $: tip = offer && practiceTipById(offer.tipId)

  onMount(() => {
    const modal = dialog
    active = true
    modal.showModal()
    title.focus()
    void loadTip()
    return () => {
      active = false
      clearTimeout(dismissTimer)
      modal.close()
    }
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
    if (!offer || saving || confirmed) return
    if (offer.rating?.value === value) {
      confirmRating()
      return
    }
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
      confirmRating()
    } catch (error) {
      message = error instanceof Error ? error.message : '自己評価を保存できませんでした。'
      await loadTip()
    } finally {
      saving = null
    }
  }

  function confirmRating() {
    if (!active) return
    message = ''
    confirmed = true
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    dismissTimer = setTimeout(dismiss, reduceMotion ? 400 : 1000)
  }

  function skip() {
    if (!saving && !confirmed) dismiss()
  }
</script>

<dialog
  bind:this="{dialog}"
  class:closing="{confirmed}"
  aria-labelledby="practice-tip-title"
  aria-describedby="practice-tip-intro"
  on:cancel|preventDefault="{skip}"
>
  <div class="tip-content">
    <div class="analysis-status">
      <p class="status-label" role="status">
        {#if !ready}<span class="spinner" aria-hidden="true"></span>{/if}
        {ready ? '会話の分析が完了しました' : '会話を分析しています…'}
      </p>
      <p id="practice-tip-intro">
        {ready
          ? '結果を見る前に、会話のヒントをひとつ。'
          : '結果を待つ間に、会話のヒントをひとつ。'}
      </p>
    </div>
    <header>
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
        disabled="{confirmed}"
        choose="{choose}"
      />
      {#if message}<p class="tip-label" role="alert">{message}</p>{/if}
    {:else}
      <p class="tip-text" role="status">{loadError || '会話のヒントを読み込んでいます…'}</p>
    {/if}

    <footer>
      {#if confirmed}
        <p class="saved-label" role="status">
          <span aria-hidden="true">✓</span> 自己評価を保存しました
        </p>
      {:else}
        {#if tip}<p>自己評価を選ぶと、自動で結果へ進みます。</p>{/if}
        {#if ready}<button type="button" disabled="{saving !== null}" on:click="{skip}">
            結果を見る
          </button>{/if}
      {/if}
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

  .analysis-status {
    padding: 10px 12px;
    border-radius: 12px;
    background: #faf0f2;
  }

  .analysis-status p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .status-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--accent);
    font-weight: 700;
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
    min-height: 44px;
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

  footer button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  footer .saved-label {
    color: var(--accent);
    font-weight: 700;
  }

  .saved-label span {
    font-size: var(--text-sm);
    animation: confirm-rating 320ms ease-out both;
  }

  dialog.closing {
    animation: dismiss-tip 1s ease-in both;
  }

  dialog.closing::backdrop {
    animation: dismiss-backdrop 1s ease-in both;
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

  @keyframes confirm-rating {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    65% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes dismiss-tip {
    75% {
      transform: translateY(0);
      opacity: 1;
    }
    100% {
      transform: translateY(8px);
      opacity: 0;
    }
  }

  @keyframes dismiss-backdrop {
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner,
    .saved-label span,
    dialog.closing,
    dialog.closing::backdrop {
      animation: none;
    }
  }
</style>
