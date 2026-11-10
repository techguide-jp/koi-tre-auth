<script lang="ts">
  import { page } from '$app/stores'
  import { auth } from '$lib/firebaseConfig'
  import { user } from '$lib/stores'
  import { signOut } from 'firebase/auth'
  import AdminNavigation from './AdminNavigation.svelte'
  let pending = false
  let message = ''
  let current: 'home' | 'knowledge' | 'characters' | 'users' | 'billing' | 'usage' = 'home'
  $: current = $page.url.pathname.startsWith('/admin/users')
    ? 'users'
    : $page.url.pathname.startsWith('/admin/billing')
      ? 'billing'
      : $page.url.pathname.startsWith('/admin/usage')
        ? 'usage'
        : $page.url.pathname.startsWith('/admin/knowledge')
          ? 'knowledge'
          : $page.url.pathname.startsWith('/admin/characters')
            ? 'characters'
            : 'home'
  async function logout() {
    if (!auth || pending) return
    pending = true
    message = ''
    try {
      await signOut(auth)
    } catch {
      message = 'ログアウトできませんでした。もう一度お試しください。'
    } finally {
      pending = false
    }
  }
</script>

<header class="admin-header" aria-label="管理者モード">
  <div class="topbar">
    <a class="brand" href="/admin" aria-label="Koi-Tre 管理トップ">
      <span class="brand-name">Koi-Tre</span><span class="mode">管理者モード</span>
    </a>
    <div class="actions">
      <a class="return-link" href="/">通常モードに戻る <span aria-hidden="true">↗</span></a>
      {#if $user}
        <button disabled="{pending}" aria-busy="{pending}" on:click="{logout}">
          {pending ? 'ログアウト中…' : 'ログアウト'}
        </button>
      {:else}<a href="/login">ログイン</a>{/if}
    </div>
  </div>
  <AdminNavigation current="{current}" />
  {#if message}<p class="error" role="alert">{message}</p>{/if}
</header>

<style>
  .admin-header {
    width: 100%;
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem 2rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    color: var(--ink);
    text-decoration: none;
  }
  .brand-name {
    font:
      600 1.65rem Georgia,
      serif;
    letter-spacing: -0.045em;
  }
  .mode {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--accent);
    border-left: 1px solid var(--border);
    padding-left: 0.8rem;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: var(--text-sm);
    flex-wrap: wrap;
  }
  .actions a {
    color: var(--muted);
  }
  .return-link {
    padding: 0.65rem 0;
  }
  button {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink);
    border-radius: 8px;
    padding: 0.65rem 0.8rem;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  @media (max-width: 700px) {
    .admin-header {
      padding: 1.25rem 1.25rem 1rem;
    }
    .topbar {
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .actions {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
