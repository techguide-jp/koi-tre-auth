<script lang="ts">
  import { COMMERCE_DISCLOSURE_PATH, COMMERCE_DISCLOSURE_TITLE } from '$lib/billing-disclosure'

  const groups = [
    {
      title: '練習する',
      links: [
        { href: '/#scenes', label: 'お相手を選ぶ' },
        { href: '/try', label: '30秒のお試し' },
        { href: '/memories', label: '思い出アルバム' }
      ]
    },
    {
      title: '会話のヒント',
      links: [
        { href: '/topics', label: '会話ネタ帳' },
        { href: '/guides', label: '会話ガイド' }
      ]
    },
    {
      title: 'Koi-Treについて',
      links: [
        { href: '/about', label: '使い方' },
        { href: '/pricing', label: '料金と遊べる範囲' },
        { href: '/share', label: '紹介・配布素材' },
        { href: '/contact', label: 'お問い合わせ' },
        { href: COMMERCE_DISCLOSURE_PATH, label: COMMERCE_DISCLOSURE_TITLE }
      ]
    }
  ]
</script>

<footer>
  <div class="footer-inner">
    <div class="footer-main">
      <div class="brand">
        <a href="/" aria-label="Koi-Tre ホーム">Koi-Tre<span>コイトレ</span></a>
        <p>会う日の前に、<br />会話の予行練習。</p>
      </div>
      <nav aria-label="フッターメニュー">
        {#each groups as group}
          <div class="link-group">
            <h2>{group.title}</h2>
            <ul>
              {#each group.links as link}<li><a href="{link.href}">{link.label}</a></li>{/each}
            </ul>
          </div>
        {/each}
      </nav>
    </div>
    <div class="footer-bottom">
      <a href="/about#data">会話とデータの扱い</a>
      <small>&copy; TechGuide LLC.</small>
    </div>
  </div>
</footer>

<style>
  footer {
    margin-top: 2rem;
    background: var(--surface-soft);
    border-top: 1px solid var(--border);
  }
  .footer-inner {
    width: 100%;
    max-width: 72rem;
    margin: 0 auto;
    padding: 3rem 2rem 1.25rem;
  }
  .footer-main {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) minmax(0, 2.3fr);
    gap: 3rem;
    padding-bottom: 2rem;
  }
  .brand > a {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    font:
      600 1.75rem Georgia,
      serif;
    color: var(--ink);
    letter-spacing: -0.045em;
    text-decoration: none;
  }
  .brand > a span {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 400;
    letter-spacing: 0.2em;
    margin-top: 0.35rem;
  }
  .brand p {
    font-family: var(--font-editorial);
    font-size: var(--text-base);
    line-height: 1.9;
    color: var(--muted);
    margin: 1.25rem 0 0;
  }
  nav {
    display: grid;
    grid-template-columns: 1fr 1fr 1.3fr;
    gap: 1.5rem;
  }
  h2 {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 700;
    margin: 0 0 0.75rem;
    line-height: 1.7;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li a {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    color: var(--muted);
    font-size: var(--text-sm);
    line-height: 1.6;
    padding: 0.35rem 0;
  }
  li a:hover,
  .footer-bottom a:hover {
    color: var(--accent);
  }
  .footer-bottom {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    align-items: center;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
  .footer-bottom a,
  .footer-bottom small {
    color: var(--muted);
    font-size: var(--text-xs);
  }
  .footer-bottom a {
    padding: 0.5rem 0;
  }
  @media (max-width: 800px) {
    .footer-main {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .brand p {
      margin: 0;
      font-size: var(--text-sm);
    }
  }
  @media (max-width: 550px) {
    .footer-inner {
      padding: 2rem 1.25rem 1rem;
    }
    nav {
      grid-template-columns: 1fr 1fr;
      row-gap: 1.5rem;
    }
    .link-group:last-child {
      grid-column: 1 / -1;
    }
    .link-group:last-child ul {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 1.5rem;
    }
    .footer-main {
      padding-bottom: 1.5rem;
    }
    .footer-bottom {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }
  }
</style>
