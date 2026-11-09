<script>
  import { afterNavigate } from '$app/navigation'
  import { trackPageView } from '$lib/analytics'
  import Header from './Header.svelte'
  import Seo from '$lib/components/Seo.svelte'
  import './styles.css'

  afterNavigate(({ from, to }) => {
    if (to) trackPageView(to.url, from?.url.href ?? document.referrer)
  })
</script>

<Seo />
<div class="app">
  <Header />

  <main>
    <slot />
  </main>

  <footer>
    <p>Koi-Tre — 会う日の前に、会話の予行練習。</p>
    <p><a href="/topics">会話ネタ帳</a> · <a href="/guides">会話ガイド</a></p>
    <p><a href="/try">30秒のお試し</a> · <a href="/share">紹介・配布素材</a></p>
    <p><a href="/pricing">料金と遊べる範囲</a> · <a href="/memories">思い出アルバム</a></p>
    <p><a href="/about">使い方とデータの扱い</a> · <a href="/contact">お問い合わせ</a></p>
    <p>&copy; TechGuide LLC.</p>
  </footer>
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

  footer {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem 1.25rem;
    border-top: 1px solid var(--border);
    gap: 0.4rem;
    color: var(--muted);
    font-size: var(--text-xs);
  }

  footer p {
    margin: 0;
  }

  @media (max-width: 700px) {
    main {
      padding: 0 1.25rem;
    }
  }

  @media (min-width: 480px) {
    footer {
      padding: 2rem 0;
    }
  }
</style>
