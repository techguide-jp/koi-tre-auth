<script lang="ts">
  export let current: 'home' | 'knowledge' | 'characters' = 'home'
</script>

<nav aria-label="運営管理のメニュー">
  <a href="/admin" aria-current="{current === 'home' ? 'page' : undefined}">管理トップ</a>
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
    margin: 20px 0 30px;
  }
  a {
    padding: 10px 14px;
    border: 1px solid #d9ddcf;
    border-radius: 8px;
    color: #46533d;
    font-size: 0.85rem;
    text-decoration: none;
  }
  a[aria-current='page'] {
    background: #58694d;
    border-color: #58694d;
    color: white;
  }
</style>
