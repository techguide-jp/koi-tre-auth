<script lang="ts">
  import { topics, topicCategories, type TopicCategory } from '$lib/content/topics'
  import { trackEvent } from '$lib/analytics'
  import '$lib/content/resources.css'
  let category: TopicCategory = 'opening'
  let position = 0
  $: cards = topics.filter((topic) => topic.category === category)
  $: card = cards[position % cards.length]
  $: scene = topicCategories.find((item) => item.id === category)?.scene ?? 'cafe'
  function selectCategory(value: TopicCategory) {
    category = value
    position = 0
  }
</script>

<div class="resources">
  <nav class="breadcrumbs" aria-label="パンくず">
    <a href="/">ホーム</a><span> / 会話ネタ帳</span>
  </nav>
  <header class="resource-heading">
    <p class="eyebrow">登録不要 · 無料 · 18の話題</p>
    <h1>初対面・デートの<br />会話ネタ帳</h1>
    <p>何を話そう、と迷ったら。<br />聞き方と、自分の話の添え方を一枚ずつ。</p>
    <p class="muted small">例文は、自分の経験に合う言葉に変えて使ってください。</p>
  </header>
  <section class="topic-picker" aria-labelledby="picker-title">
    <h2 id="picker-title">どんな場面で話す？</h2>
    <div class="topic-filters" role="group" aria-label="場面を選ぶ">
      {#each topicCategories as item}<button
          type="button"
          class:active="{category === item.id}"
          aria-pressed="{category === item.id}"
          on:click="{() => selectCategory(item.id)}">{item.label}</button
        >{/each}
    </div>
    <article class="topic-card" aria-live="polite" aria-atomic="true">
      <p class="eyebrow">{(position % cards.length) + 1} / {cards.length} 枚</p>
      <h3>{card.title}</h3>
      <dl>
        <dt>こんなふうに聞いてみる</dt>
        <dd class="topic-question">「{card.question}」</dd>
        <dt>自分のことも、ひと言</dt>
        <dd>「{card.self}」</dd>
        <dt>答えが返ってきたら</dt>
        <dd>{card.followUp}</dd>
      </dl>
    </article>
    <div class="topic-actions">
      <button
        class="button primary"
        type="button"
        on:click="{() => {
          position += 1
          trackEvent('topic_card_next', { category })
        }}">次の話題を見る →</button
      ><a href="#all-topics">18の話題を一覧で読む ↓</a>
    </div>
    <noscript
      ><p>すべての話題を下の一覧で読めます。カードの切り替えにはJavaScriptが必要です。</p></noscript
    >
  </section>
  <aside class="resource-cta">
    <p class="eyebrow">言葉を選んだら、試してみよう</p>
    <h2>相手の返事に、どう返す？</h2>
    <p>
      話題を読むだけでなく、AIとの短いやり取りで自分の言葉を試せます。3回返答すると、あなたの発言に合わせた振り返りが届きます。
    </p>
    <a
      class="button primary"
      href="{`/login?scene=${scene}`}"
      on:click="{() => trackEvent('practice_cta_clicked', { source: 'topics', category })}"
      >この場面をAIと練習する →</a
    >
    <p class="muted small">Googleログインが必要です。月10回無料・1回3往復と振り返り。</p>
  </aside>
  <section id="all-topics" class="all-topics" aria-labelledby="all-title">
    <h2 id="all-title">18の話題を、まとめて読む</h2>
    <p>一度に全部覚えず、話しやすそうなものを一つ選んでみてください。</p>
    {#each topicCategories as item}<h3>{item.label}</h3>
      {#each topics.filter((topic) => topic.category === item.id) as topic}<details>
          <summary>{topic.title}</summary>
          <dl>
            <dt>聞き方の例</dt>
            <dd>{topic.question}</dd>
            <dt>自分の話を添えるなら</dt>
            <dd>{topic.self}</dd>
            <dt>広げ方のヒント</dt>
            <dd>{topic.followUp}</dd>
          </dl>
        </details>{/each}{/each}
  </section>
  <aside class="resource-cta">
    <h2>会話の流れごと、読んでみる。</h2>
    <p>3つの短い場面で返し方を選ぶ、登録不要のお試しもあります。</p>
    <a class="button secondary" href="/try">30秒の会話お試しへ →</a>
    <p>初デートや沈黙したときの会話例を、ガイドにまとめています。</p>
    <a class="text-link" href="/guides">会話ガイドを読む →</a>
  </aside>
</div>

<style>
  .topic-picker {
    max-width: 46rem;
    margin: 0 auto;
  }
  .topic-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 1.25rem 0;
  }
  .topic-filters button {
    border: 1px solid var(--border);
    background: transparent;
    border-radius: 2rem;
    padding: 0.7rem 1rem;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--ink);
  }
  .topic-filters button.active {
    border-color: var(--accent);
    background: #f8e7df;
    color: var(--accent-strong);
  }
  .topic-card {
    border: 1px solid var(--border);
    background: #fffdf8;
    padding: 2rem;
    border-radius: 5px;
    min-height: 28rem;
  }
  .topic-card h3 {
    font-family: var(--font-editorial);
    font-size: 1.5rem;
    margin: 0 0 1.5rem;
  }
  dt {
    color: var(--muted);
    font-size: 0.75rem;
    margin: 1.3rem 0 0.5rem;
  }
  dd {
    margin: 0;
    line-height: 1.9;
  }
  .topic-question {
    font-size: 1.2rem;
    font-family: var(--font-editorial);
  }
  .topic-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.25rem;
    margin-top: 1.25rem;
  }
  .topic-actions a {
    font-size: 0.8rem;
  }
  .all-topics {
    max-width: 46rem;
    margin: 3rem auto;
  }
  .all-topics h3 {
    margin: 2.5rem 0 1rem;
  }
  details {
    border-bottom: 1px solid var(--border);
    padding: 1rem 0;
  }
  summary {
    cursor: pointer;
    padding: 0.5rem 0;
  }
  details dl {
    padding: 0 0.5rem 1rem;
  }
  @media (max-width: 600px) {
    .topic-card {
      padding: 1.25rem;
      min-height: 32rem;
    }
  }
</style>
