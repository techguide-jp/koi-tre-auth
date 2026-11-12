<script lang="ts">
  import { authReady, user } from '$lib/stores'
  import TipCollection from '$lib/components/TipCollection.svelte'
</script>

<svelte:head><title>Tipsコレクション | Koi-Tre</title></svelte:head>
<div class="tips-page">
  <a href="/account">← マイページ</a>
  <h1>Tipsコレクション</h1>
  {#if !$authReady}
    <p role="status">ログイン状態を確認しています…</p>
  {:else if !$user}
    <p>ログインすると、練習で出会ったTipsと自己評価の履歴を見返せます。</p>
    <a class="button primary" href="/login?returnTo=tips">ログインして開く</a>
  {:else}
    {#key $user.uid}<TipCollection full />{/key}
  {/if}
</div>

<style>
  .tips-page {
    display: grid;
    gap: 18px;
    max-width: 960px;
    margin: 0 auto;
  }

  h1,
  p {
    margin: 0;
  }

  a {
    justify-self: start;
  }
</style>
