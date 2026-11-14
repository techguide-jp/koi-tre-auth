<script>
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/stores'
  import { trackPageView } from '$lib/analytics'
  import { authReady, user, authenticatedFetch } from '$lib/stores'
  import { createAdminPermissionStore } from '$lib/admin-permissions'
  import AdminHeader from '$lib/components/AdminHeader.svelte'
  import Footer from '$lib/components/Footer.svelte'
  import Header from './Header.svelte'
  import Seo from '$lib/components/Seo.svelte'
  import './styles.css'

  const adminAccess = createAdminPermissionStore(user, async () => {
    const response = await authenticatedFetch('/api/me/permissions')
    return (await response.json()).knowledgeAdmin === true
  })
  $: adminRoute = $page.route.id === '/admin' || $page.route.id?.startsWith('/admin/')
  $: canAdmin = $adminAccess === 'allowed'
  $: adminMode = adminRoute && canAdmin
  afterNavigate(({ from, to }) => {
    if (to) trackPageView(to.url, from?.url.href ?? document.referrer)
  })
</script>

<Seo />
<div class="app">
  {#if adminMode}<AdminHeader />{:else}<Header canAdmin="{canAdmin}" />{/if}

  <main>
    {#if !adminRoute || canAdmin}
      <slot />
    {:else}
      <section class="card admin-access-notice">
        {#if !$authReady || $adminAccess === 'checking'}
          <p role="status">アクセス権限を確認しています…</p>
        {:else if !$user}
          <h1>ログインが必要です</h1>
          <a class="button primary" href="/login?returnTo=admin">Googleでログイン</a>
        {:else if $adminAccess === 'unavailable'}
          <h1>アクセス権限を確認できませんでした</h1>
          <button class="button primary" type="button" on:click="{() => location.reload()}">
            再読み込み
          </button>
        {:else}
          <h1>このページを利用する権限がありません</h1>
          <a class="button primary" href="/">トップに戻る</a>
        {/if}
      </section>
    {/if}
  </main>

  {#if !adminMode}<Footer />{/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 2rem;
    width: 100%;
    max-width: 72rem;
    margin: 0 auto;
    box-sizing: border-box;
  }

  .admin-access-notice {
    width: min(100%, 32rem);
    margin: 3rem auto;
    padding: clamp(1rem, 5vw, 2rem);
    text-align: center;
  }

  .admin-access-notice h1 {
    font-size: var(--heading-sm);
    margin: 0 0 1rem;
  }

  .admin-access-notice p {
    margin: 0;
  }

  @media (max-width: 700px) {
    main {
      padding: 0 1.25rem;
    }
  }
</style>
