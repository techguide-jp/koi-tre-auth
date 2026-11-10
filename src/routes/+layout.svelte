<script>
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/stores'
  import { trackPageView } from '$lib/analytics'
  import { user, authenticatedFetch } from '$lib/stores'
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
  $: adminMode = $page.url.pathname === '/admin' || $page.url.pathname.startsWith('/admin/')
  afterNavigate(({ from, to }) => {
    if (to) trackPageView(to.url, from?.url.href ?? document.referrer)
  })
</script>

<Seo />
<div class="app">
  {#if adminMode}<AdminHeader />{:else}<Header canAdmin="{$adminAccess}" />{/if}

  <main>
    <slot />
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

  @media (max-width: 700px) {
    main {
      padding: 0 1.25rem;
    }
  }
</style>
