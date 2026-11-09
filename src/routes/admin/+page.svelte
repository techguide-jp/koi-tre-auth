<script lang="ts">
  import AdminNavigation from '$lib/components/AdminNavigation.svelte'
</script>

<svelte:head
  ><title>運営管理 | Koi-Tre</title><meta name="robots" content="noindex,nofollow" /></svelte:head
>
<div class="admin-home">
  <a href="/account">← マイページ</a>
  <p>Koi-Tre 運営管理</p>
  <h1>会話と練習を育てる</h1>
  <AdminNavigation />
  <div class="cards">
    <a class="card" href="/admin/knowledge"
      ><span>評価とアドバイス</span>
      <h2>評価方針・知識</h2>
      <p>大切にする考え方と、場面に合うノウハウを整える。</p>
      <strong>方針を編集する →</strong></a
    >
    <a class="card" href="/admin/characters"
      ><span>会話のお相手</span>
      <h2>人物設定</h2>
      <p>その人らしい価値観・話し方・反応を、人物ごとに整える。</p>
      <strong>人物を選ぶ →</strong></a
    >
  </div>
</div>

<style>
  .admin-home {
    max-width: 1000px;
    margin: auto;
    padding: 40px 20px 80px;
    color: #36432f;
  }
  .admin-home > a {
    color: #58694d;
    font-size: 0.8rem;
  }
  h1 {
    font-size: clamp(1.6rem, 4vw, 2.2rem);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
  }
  .card {
    display: block;
    padding: 28px;
    background: #f7f8f1;
    border: 1px solid #d9ddcf;
    border-radius: 16px;
    color: inherit;
    text-decoration: none;
    line-height: 1.8;
  }
  .card span {
    font-size: 0.8rem;
    color: #6f7a64;
  }
  .card h2 {
    margin: 8px 0;
  }
  .card strong {
    font-size: 0.85rem;
  }
</style>
