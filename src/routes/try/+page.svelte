<script lang="ts">
  import { goto } from '$app/navigation'
  import { trackEvent } from '$lib/analytics'
  import type { Adventure } from '$lib/adventure'
  import AdventureLobby from '$lib/components/adventure/AdventureLobby.svelte'
  import { guestPracticeUrl } from '$lib/guest-practice'
  import { startGuestPractice } from '$lib/guest-practice-client'
  import '$lib/content/resources.css'

  export let data
  let pending = false
  let message = ''

  async function start(adventure: Adventure) {
    if (pending || !data.practiceEnabled) return
    message = ''
    pending = true
    try {
      const session = await startGuestPractice(adventure)
      trackEvent('quick_try_started', { source: 'try' })
      await goto(guestPracticeUrl(session.id))
    } catch (error) {
      message = error instanceof Error ? error.message : '体験を始められませんでした。'
    } finally {
      pending = false
    }
  }
</script>

<div class="resources experience">
  <nav class="breadcrumbs" aria-label="パンくず">
    <a href="/">ホーム</a><span> / 1往復の会話体験</span>
  </nav>
  <header class="resource-heading">
    <p class="eyebrow">登録不要 · 無料</p>
    <h1>ひと言から、会話を体験。</h1>
    <p>
      気になる相手に1回返すだけ。キャラクターの返事、会話のヒント、あなたの言葉への振り返りが届きます。
    </p>
    <p class="small muted">体験で獲得した経験値とヒントは、ログイン後に引き継げます。</p>
  </header>
  {#if !data.practiceEnabled}
    <p role="status">会話の体験はただいま準備中です。</p>
  {:else}
    <AdventureLobby guest pending="{pending}" on:start="{(event) => start(event.detail)}" />
    {#if message}<p role="alert" class="error">{message}</p>{/if}
  {/if}
  <aside class="more-links">
    <a href="/try/quiz">会話の3択クイズ →</a>
    <a href="/topics">会話ネタ帳 →</a>
  </aside>
</div>

<style>
  .experience {
    width: 100%;
    max-width: 60rem;
    margin: 0 auto;
  }
  .experience :global(.lobby) {
    padding-top: 1.5rem;
  }
</style>
