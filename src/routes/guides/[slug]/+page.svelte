<script lang="ts">
  import type { PageData } from './$types'
  import { guides } from '$lib/content/guides'
  import { trackEvent } from '$lib/analytics'
  import '$lib/content/resources.css'
  export let data: PageData
  $: guide = data.guide
</script>

<div class="resources">
  <nav class="breadcrumbs" aria-label="パンくず">
    <a href="/">ホーム</a><span> / </span><a href="/guides">会話ガイド</a><span>
      / {guide.category}</span
    >
  </nav>
  <article class="guide-article">
    <header class="resource-heading">
      <p class="eyebrow">{guide.category}</p>
      <h1>{guide.title}</h1>
      <p class="article-credit">
        Koi-Tre編集部（運営：TechGuide LLC.） · <time datetime="2026-11-02">2026年11月2日公開</time>
      </p>
      <p class="guide-summary">{guide.summary}</p>
      <p class="muted small">
        会話例は説明用に作成した架空のやり取りです。相手の気持ちや結果を保証するものではありません。
      </p>
    </header>
    <nav class="guide-toc" aria-label="この記事の目次">
      <h2>この記事で読めること</h2>
      <ol>
        {#each guide.sections as section}<li>
            <a href="{`#${section.id}`}">{section.title}</a>
          </li>{/each}
      </ol>
    </nav>
    {#each guide.sections as section}
      <section id="{section.id}" class="guide-section">
        <h2>{section.title}</h2>
        {#each section.paragraphs as paragraph}<p>{paragraph}</p>{/each}
        {#if section.tips}<ul>
            {#each section.tips as tip}<li>{tip}</li>{/each}
          </ul>{/if}
        {#if section.conversation}
          <div class="conversation-example" aria-label="会話例">
            <p class="eyebrow">会話の例</p>
            <dl>
              {#each section.conversation as line}<div>
                  <dt>{line.speaker}</dt>
                  <dd>{line.text}</dd>
                </div>{/each}
            </dl>
          </div>
        {/if}
      </section>
    {/each}
    <section class="guide-checklist">
      <h2>会う前に、ここだけ確認</h2>
      <ul>
        {#each guide.checklist as item}<li>{item}</li>{/each}
      </ul>
    </section>
    <aside class="resource-cta">
      <p class="eyebrow">読むところから、試すところへ</p>
      <h2>自分なら、どう返す？</h2>
      <p>{guide.practice}</p>
      <a
        class="button primary"
        href="{`/login?scene=${guide.scene}`}"
        on:click="{() => trackEvent('practice_cta_clicked', { source: guide.slug })}"
        >この場面をAIと練習する →</a
      >
      <p class="muted small">Googleログインが必要です。月10回無料・1回3往復と振り返り。</p>
      <a class="text-link" href="/topics">まずは登録不要の会話ネタ帳を見る →</a>
      <p><a class="text-link" href="/try">返し方を選ぶ、30秒のお試しも →</a></p>
    </aside>
  </article>
  <section class="related-guides" aria-labelledby="related-title">
    <h2 id="related-title">ほかの場面も読んでみる</h2>
    <div class="resource-grid">
      {#each guides.filter((item) => item.slug !== guide.slug) as related}
        <a class="resource-card" href="{`/guides/${related.slug}`}"
          ><p class="eyebrow">{related.category}</p>
          <h3>{related.title}</h3>
          <span class="text-link">会話例を読む →</span></a
        >
      {/each}
    </div>
  </section>
</div>
