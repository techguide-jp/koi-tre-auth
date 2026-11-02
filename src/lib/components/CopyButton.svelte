<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  export let text: string
  export let label = 'コピーする'
  const dispatch = createEventDispatcher<{ copied: void }>()
  let pending = false
  let message = ''
  let displayedText = text
  $: if (text !== displayedText) {
    displayedText = text
    message = ''
  }
  async function copy() {
    if (pending) return
    pending = true
    message = ''
    const copiedText = text
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(copiedText)
      if (copiedText !== text) return
      message = 'コピーしました。'
      dispatch('copied')
    } catch {
      message = 'コピーできませんでした。表示されている文章・リンクを選択してコピーしてください。'
    } finally {
      pending = false
    }
  }
</script>

<div class="copy-control">
  <button
    class="button secondary"
    type="button"
    disabled="{pending}"
    aria-busy="{pending}"
    on:click="{copy}"
  >
    {pending ? 'コピー中…' : label}
  </button>
  <p class="muted small" role="status">{message}</p>
</div>

<style>
  .copy-control {
    margin: 0.75rem 0;
  }
  p {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    line-height: 1.7;
  }
</style>
