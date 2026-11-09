<script lang="ts">
  import { tick } from 'svelte'
  import type { SpecialCardArtwork } from '$lib/special-card-art'
  import { characterById } from '$lib/adventure'
  import SceneArtwork from './SceneArtwork.svelte'
  export let art: SpecialCardArtwork
  export let priority = false
  let dialog: HTMLDialogElement
  let opened = false
  let opening = false
  $: character = characterById(art.characterId)!
  async function open() {
    if (opening || opened) return
    opening = true
    opened = true
    await tick()
    dialog.showModal()
    opening = false
  }
</script>

<button
  class="art-open"
  aria-label="{`${character.name}の「${art.title}」のイラストを大きく見る`}"
  aria-haspopup="dialog"
  on:click="{open}"
>
  <SceneArtwork art="{art}" priority="{priority}" />
  <span class="view-label">大きく見る <span aria-hidden="true">↗</span></span>
</button>
<dialog
  bind:this="{dialog}"
  aria-label="{`${character.name}の「${art.title}」の専用イラスト`}"
  on:close="{() => (opened = false)}"
>
  {#if opened}<div class="viewer">
      <button class="close" aria-label="イラストを閉じる" on:click="{() => dialog.close()}"
        >×</button
      >
      <SceneArtwork art="{art}" priority retryable />
      <div class="viewer-caption">
        <p>SCENE COLLECTION · {character.name}</p>
        <h2>{art.title}</h2>
        <span>6往復で出会えた、一枚。</span>
      </div>
    </div>{/if}
</dialog>

<style>
  .art-open {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: zoom-in;
    position: relative;
    overflow: hidden;
  }
  .art-open:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 4px;
  }
  .view-label {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 7px 11px;
    border: 1px solid #ffffff80;
    border-radius: 99px;
    color: white;
    background: #20251bc7;
    font-size: var(--text-xs);
    line-height: 1.4;
    backdrop-filter: blur(6px);
  }
  dialog {
    border: 1px solid #bfa877;
    border-radius: 18px;
    padding: 0;
    width: min(90vw, 640px, calc(92dvh - 150px));
    max-height: 92dvh;
    background: #faf7ee;
    color: var(--ink);
    overflow: auto;
    box-shadow: 0 25px 90px #0006;
  }
  dialog::backdrop {
    background: #182016c7;
    backdrop-filter: blur(7px);
  }
  .viewer {
    position: relative;
  }
  .close {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    width: 38px;
    height: 38px;
    border: 1px solid #ffffff90;
    border-radius: 50%;
    background: #182016c9;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
  }
  .viewer-caption {
    padding: 20px 24px 24px;
    text-align: center;
  }
  .viewer-caption p {
    font-size: var(--text-xs);
    letter-spacing: 0.12em;
    color: #897447;
    margin: 0 0 10px;
  }
  .viewer-caption h2 {
    font-family: var(--font-editorial);
    font-size: 1.35rem;
    line-height: 1.6;
    margin: 0 0 10px;
  }
  .viewer-caption span {
    font-size: var(--text-sm);
    color: var(--muted);
  }
  @media (max-width: 580px) {
    dialog {
      width: 94vw;
    }
    .viewer-caption {
      padding: 16px;
    }
    .viewer-caption h2 {
      font-size: 1.1rem;
    }
  }
</style>
