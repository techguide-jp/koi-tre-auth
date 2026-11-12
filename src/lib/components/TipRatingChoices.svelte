<script lang="ts">
  import { tipSelfRatings, type TipSelfRating } from '$lib/practice-tips'

  export let prompt: string
  export let selected: TipSelfRating | undefined
  export let saving: TipSelfRating | null
  export let choose: (rating: TipSelfRating) => void
</script>

<fieldset disabled="{saving !== null}" aria-busy="{saving !== null}">
  <legend>{prompt}</legend>
  <div class="choices">
    {#each tipSelfRatings as rating}
      <button
        type="button"
        class:selected="{selected === rating.id}"
        aria-pressed="{selected === rating.id}"
        on:click="{() => choose(rating.id)}"
        >{saving === rating.id ? '保存中…' : rating.label}</button
      >
    {/each}
  </div>
</fieldset>

<style>
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }

  button {
    min-height: 44px;
    padding: 6px 9px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
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

  @media (max-width: 430px) {
    .choices {
      grid-template-columns: 1fr;
    }
  }
</style>
