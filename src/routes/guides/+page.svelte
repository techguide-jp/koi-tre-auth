<script lang="ts">
  import { guides } from '$lib/content/guides'
  import '$lib/content/resources.css'
</script>

<div class="resources">
  <nav class="breadcrumbs" aria-label="パンくず">
    <a href="/">ホーム</a><span> / 会話ガイド</span>
  </nav>
  <header class="resource-heading">
    <p class="eyebrow">会う前の、ちいさな準備</p>
    <h1>初対面・デートの<br />会話ガイド</h1>
    <p>
      何を話すかだけでなく、どう返すかも。<br />自分の言葉で話し始めるための、具体例を集めました。
    </p>
    <p class="muted small">すべて登録なしで読めます。会話例は説明用の架空のやり取りです。</p>
  </header>
  <div class="resource-grid">
    {#each guides as guide}
      <a class="resource-card" href="{`/guides/${guide.slug}`}">
        <p class="eyebrow">{guide.category}</p>
        <h2>{guide.title}</h2>
        <p>{guide.description}</p>
        <span class="text-link">会話例を読む →</span>
      </a>
    {/each}
  </div>
  <aside class="resource-cta">
    <h2>話すきっかけを、一つ選んでみる。</h2>
    <p>場面に合わせた18枚の話題カード。聞き方と、返ってきた答えの広げ方をまとめました。</p>
    <a class="button primary" href="/topics">無料の会話ネタ帳を開く →</a>
  </aside>
</div>
