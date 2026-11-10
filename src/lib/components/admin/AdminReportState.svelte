<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { authReady, user } from '$lib/stores'
  export let pending = false
  export let error = ''
  export let ready = false
  const dispatch = createEventDispatcher<{ retry: void }>()
</script>

{#if !$authReady}<p role="status">ログイン状態を確認しています…</p>
{:else if !$user}<section class="ops-panel">
    <h2>管理者のログインが必要です</h2>
    <p>指定されたGoogleアカウントでログインしてください。</p>
    <a class="ops-button" href="/login">ログインへ</a>
  </section>
{:else if pending}<p class="ops-loading" role="status" aria-live="polite">
    情報を読み込んでいます…
  </p>
{:else if error}<section class="ops-panel ops-error" role="alert">
    <p>{error}</p>
    <button on:click="{() => dispatch('retry')}">再読み込み</button>
  </section>
{:else if ready}<slot />
{:else}<p role="status">情報を読み込んでいます…</p>{/if}
