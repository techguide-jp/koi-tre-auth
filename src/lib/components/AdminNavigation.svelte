<script lang="ts">
  export let current: 'home' | 'knowledge' | 'characters' | 'users' | 'billing' | 'usage' = 'home'
</script>

<nav aria-label="運営管理のメニュー">
  <a href="/admin" aria-current="{current === 'home' ? 'page' : undefined}">管理トップ</a>
  <a href="/admin/users" aria-current="{current === 'users' ? 'page' : undefined}">利用者情報</a>
  <a href="/admin/billing" aria-current="{current === 'billing' ? 'page' : undefined}">課金情報</a>
  <a href="/admin/usage" aria-current="{current === 'usage' ? 'page' : undefined}">利用状況</a>
  <a href="/admin/knowledge" aria-current="{current === 'knowledge' ? 'page' : undefined}"
    >評価方針・知識</a
  >
  <a href="/admin/characters" aria-current="{current === 'characters' ? 'page' : undefined}"
    >人物設定</a
  >
</nav>

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
  }
  a {
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--ink);
    font-size: var(--text-sm);
    text-decoration: none;
  }
  a[aria-current='page'] {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
</style>
