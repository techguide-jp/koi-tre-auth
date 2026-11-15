<script lang="ts">
  import { onMount } from 'svelte'

  export let text: string
  let synthesis: typeof window.speechSynthesis | undefined
  let speaking = false

  onMount(() => {
    synthesis = window.speechSynthesis
    return () => {
      if (speaking) synthesis?.cancel()
    }
  })

  function listen() {
    if (!synthesis) return
    if (speaking) {
      synthesis.cancel()
      speaking = false
      return
    }
    const line = new SpeechSynthesisUtterance(text)
    line.lang = 'ja-JP'
    line.onend = line.onerror = () => (speaking = false)
    speaking = true
    synthesis.speak(line)
  }
</script>

{#if synthesis}
  <button class="text-link" type="button" on:click="{listen}">
    {speaking ? '読み上げを止める' : 'セリフを聞く'}
  </button>
{/if}

<style>
  button {
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-sm);
    padding: 0 10px;
  }
</style>
