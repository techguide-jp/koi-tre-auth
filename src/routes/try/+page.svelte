<script lang="ts">
  import { tick } from 'svelte'
  import { quickTryQuestions } from '$lib/content/quick-try'
  import { trackEvent } from '$lib/analytics'
  import { promotionUrl } from '$lib/promotion'
  import CopyButton from '$lib/components/CopyButton.svelte'
  import '$lib/content/resources.css'
  let started = false
  let finished = false
  let step = 0
  let answers: string[] = []
  let panel: HTMLElement
  const shareLink = promotionUrl('visitor', 'quick_try')
  $: question = quickTryQuestions[step]
  $: selected = question.options.find((option) => option.id === answers[step])

  async function focusPanel() {
    await tick()
    panel?.focus()
  }
  function start() {
    started = true
    finished = false
    step = 0
    answers = []
    trackEvent('quick_try_started', { source: 'try' })
    void focusPanel()
  }
  function choose(id: string) {
    if (selected) return
    answers = [...answers, id]
    trackEvent('quick_try_answered', { question_id: question.id, option_id: id })
  }
  function next() {
    if (!selected || finished) return
    if (step === quickTryQuestions.length - 1) {
      finished = true
      trackEvent('quick_try_completed', { question_count: quickTryQuestions.length })
    } else step += 1
    void focusPanel()
  }
</script>

<div class="resources quick-try">
  <nav class="breadcrumbs" aria-label="パンくず">
    <a href="/">ホーム</a><span> / 30秒の会話お試し</span>
  </nav>
  <header class="resource-heading">
    <p class="eyebrow">登録不要 · 無料 · 3つの短い場面</p>
    <h1>あなたなら、どう返す？</h1>
    <p>カフェ、少しの沈黙、帰り際。<br />言いやすそうな返し方を選んで、言葉のヒントを一つ。</p>
    <p class="muted small">
      目安30秒。採点・性格診断はありません。会話例は架空のもので、どの選択にも解説があります。
    </p>
    {#if !started}<button class="button primary" type="button" on:click="{start}"
        >30秒のお試しを始める →</button
      >{/if}
    <noscript
      ><p>
        お試しの操作にはJavaScriptが必要です。<a href="/topics">会話ネタ帳</a>と<a href="/guides"
          >会話ガイド</a
        >はそのまま読めます。
      </p></noscript
    >
  </header>

  {#if started}
    <section
      class="try-panel"
      bind:this="{panel}"
      tabindex="-1"
      aria-labelledby="{finished ? 'complete-title' : 'question-title'}"
    >
      {#if finished}
        <p class="eyebrow">3つの場面を、お試しできました</p>
        <h2 id="complete-title">次の会話に、ひと言だけ。</h2>
        <p>
          気になった言い方を、自分の経験に合う言葉に変えて使ってみてください。相手の返事を聞きながら、途中で変えても大丈夫です。
        </p>
        <div class="takeaways">
          {#each quickTryQuestions as item, index}
            {@const answer =
              item.options.find((option) => option.id === answers[index]) ?? item.options[0]}
            <article>
              <p class="eyebrow">{index + 1}. {item.scene}</p>
              <h3>{answer.title}</h3>
              <blockquote>{answer.alternative}</blockquote>
              <a class="text-link" href="{`/guides/${item.guide}`}"
                >この場面の会話例をもっと読む →</a
              >
            </article>
          {/each}
        </div>
        <aside class="resource-cta">
          <h2>今度は、自分の言葉で。</h2>
          <p>
            AIと3往復の会話をすると、あなたの発言に合わせた振り返りが届きます。相手を男性・女性・指定なしから選べます。
          </p>
          <a
            class="button primary"
            href="/#scenes"
            on:click="{() => trackEvent('practice_cta_clicked', { source: 'quick_try' })}"
            >相手と場面を選んで、AIと練習する →</a
          >
          <p class="muted small">
            Googleログインが必要です。月10回無料。今回のお試しでは利用枠を消費しません。
          </p>
        </aside>
        <div class="share-box">
          <h3>会う前の準備に、友人にも。</h3>
          <p class="muted small">
            共有されるのはお試しへのリンクだけです。あなたの選択は含まれません。
          </p>
          <label for="try-share-link">お試しの共有リンク</label>
          <input id="try-share-link" readonly value="{shareLink}" />
          <CopyButton
            text="{shareLink}"
            label="お試しのリンクをコピー"
            on:copied="{() => trackEvent('quick_try_shared', { method: 'copy_link' })}"
          />
          <a href="/share">SNSやイベントで使える紹介素材を見る →</a>
        </div>
        <button class="button secondary" type="button" on:click="{start}">別の返し方も試す</button>
      {:else}
        <p class="eyebrow">{step + 1} / {quickTryQuestions.length} · {question.scene}</p>
        <h2 id="question-title">自分なら、どう返す？</h2>
        <p class="scene-prompt">{question.prompt}</p>
        <div class="choices" role="group" aria-label="言いやすそうな返し方を一つ選ぶ">
          {#each question.options as option, index}
            <button
              type="button"
              class:selected="{selected?.id === option.id}"
              disabled="{!!selected}"
              aria-pressed="{selected?.id === option.id}"
              on:click="{() => choose(option.id)}"
            >
              <span aria-hidden="true">{['A', 'B', 'C'][index]}</span>{option.text}
            </button>
          {/each}
        </div>
        {#if selected}
          <div class="answer-note" role="status">
            <h3>{selected.title}</h3>
            <p>{selected.explanation}</p>
            <p class="eyebrow">こんな言い方も</p>
            <blockquote>{selected.alternative}</blockquote>
          </div>
          <button class="button primary next-button" type="button" on:click="{next}"
            >{step === quickTryQuestions.length - 1
              ? '3つの言葉を振り返る →'
              : '次の場面へ →'}</button
          >
        {/if}
      {/if}
    </section>
  {/if}
  <aside class="more-links">
    <a href="/topics">登録不要の会話ネタ帳を開く →</a><a href="/guides/matching-app-phone-topics"
      >会う前の電話の話題を読む →</a
    >
  </aside>
</div>

<style>
  .quick-try {
    max-width: 48rem;
    width: 100%;
    margin: 0 auto;
  }
  .resource-heading {
    padding-bottom: 1.5rem;
  }
  .try-panel {
    background: #fffdf8;
    padding: 2rem;
    border: 1px solid var(--border);
    border-radius: 5px;
    scroll-margin-top: 1rem;
  }
  .try-panel:focus {
    outline: none;
  }
  .try-panel:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 4px;
  }
  .try-panel h2 {
    margin-top: 0.5rem;
  }
  .scene-prompt {
    font-size: 1.15rem;
    padding: 1.2rem;
    background: #f0f1e8;
    border-left: 3px solid var(--accent);
  }
  .choices {
    display: grid;
    gap: 0.75rem;
    margin: 1.5rem 0;
  }
  .choices button {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    text-align: left;
    font: inherit;
    font-size: 0.9rem;
    line-height: 1.8;
    color: var(--ink);
    background: #fffefa;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1rem;
    cursor: pointer;
  }
  .choices button span {
    font-size: 0.8rem;
    color: var(--accent);
  }
  .choices button:hover:not(:disabled),
  .choices button.selected {
    border-color: var(--accent);
    background: #f7ece6;
  }
  .choices button:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .choices button.selected {
    opacity: 1;
  }
  .answer-note {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
  blockquote {
    margin: 1rem 0;
    padding: 1rem 1.2rem;
    border-left: 3px solid var(--accent);
    background: #f0f1e8;
    font-size: 0.95rem;
    line-height: 1.9;
  }
  .next-button {
    margin-top: 0.75rem;
  }
  .takeaways article {
    border-top: 1px solid var(--border);
    padding: 1.25rem 0;
  }
  .resource-cta {
    margin: 1.5rem 0;
  }
  .share-box {
    margin: 2rem 0;
  }
  label {
    display: block;
    margin: 1rem 0 0.5rem;
    font-size: 0.8rem;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    color: var(--ink);
    background: #fffefa;
    font: inherit;
    font-size: 0.8rem;
    padding: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .more-links {
    display: flex;
    gap: 0.75rem 1.5rem;
    flex-wrap: wrap;
    margin-top: 2rem;
    font-size: 0.85rem;
  }
  @media (max-width: 600px) {
    .try-panel {
      padding: 1.25rem;
    }
  }
</style>
