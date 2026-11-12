<script lang="ts">
  import { onMount } from 'svelte'
  import { tipSelfRatings, type PracticeTip, type TipSelfRating } from '$lib/practice-tips'

  export let tip: PracticeTip
  export let practiceId: string
  export let ready: boolean
  export let dismiss: () => void

  let dialog: HTMLDialogElement
  let title: HTMLHeadingElement
  let selected: TipSelfRating | undefined

  const storageKey = `koi-practice-tip:${practiceId}:${tip.id}`

  onMount(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      selected = tipSelfRatings.find(({ id }) => id === stored)?.id
    } catch {
      /* 保存できない場合も、その場で選べる。 */
    }
    const modal = dialog
    modal.showModal()
    title.focus()
    return () => modal.close()
  })

  function choose(rating: TipSelfRating) {
    selected = rating
    try {
      sessionStorage.setItem(storageKey, rating)
    } catch {
      /* 自己評価は任意なので、保存できなくても結果へ進める。 */
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
      <h2 id="practice-tip-title" bind:this="{title}" tabindex="-1">{tip.title}</h2>
    </header>

    <p class="tip-text">{tip.tip}</p>
    <blockquote><span>たとえば</span>「{tip.example}」</blockquote>

    <fieldset>
      <legend>{tip.prompt}</legend>
      <div class="choices">
        {#each tipSelfRatings as rating}
          <button
            type="button"
            class:selected="{selected === rating.id}"
            aria-pressed="{selected === rating.id}"
            on:click="{() => choose(rating.id)}">{rating.label}</button
          >
        {/each}
      </div>
    </fieldset>

    <footer>
      <p role="status" aria-live="polite">
        {#if !ready}<span class="spinner" aria-hidden="true"></span>{/if}
        {ready ? '振り返りができました' : '振り返りをまとめています…'}
      </p>
      <button type="button" class:ready="{ready}" on:click="{dismiss}"
        >{ready ? '結果を見る' : '閉じて待つ'}</button
      >
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

  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0 0 8px;
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  button {
    min-height: 44px;
    padding: 6px 9px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-sm);
  }

  button.selected {
    border-color: var(--accent);
    background: #faeef2;
    color: var(--accent);
    font-weight: 700;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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

  footer button.ready {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
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
