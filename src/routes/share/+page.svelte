<script lang="ts">
  import {
    promotionCards,
    promotionChannels,
    promotionUrl,
    type PromotionChannel
  } from '$lib/promotion'
  import { trackEvent } from '$lib/analytics'
  import CopyButton from '$lib/components/CopyButton.svelte'
  import '$lib/content/resources.css'
  let channel: PromotionChannel = 'x'
  const eventLink = promotionUrl('event', 'flyer')
  const partnerLink = promotionUrl('partner', 'flyer')
  const partnerText = `会う日の前に、会話のちいさな準備を。Koi-Treの会話ネタ帳では、初対面で使える18の話題と返し方を、登録なし・無料で読めます。女性も男性も、ご自身のペースでお使いください。\n${partnerLink}`
  function postText(card: (typeof promotionCards)[number], selectedChannel: PromotionChannel) {
    const url = promotionUrl(selectedChannel, card.id)
    return `${card.caption}\n\n${url}\n\n#初対面 #デートの会話 #コイトレ`
  }
  function downloaded(asset: string) {
    trackEvent('promotion_download', { asset_id: asset })
  }
</script>

<div class="resources">
  <nav class="breadcrumbs" aria-label="パンくず">
    <a href="/">ホーム</a><span> / 紹介・配布素材</span>
  </nav>
  <header class="resource-heading">
    <p class="eyebrow">会話の準備を、必要な人へ</p>
    <h1>Koi-Treを紹介する</h1>
    <p>
      SNSでの紹介や、イベントの事前案内に。<br />画像・投稿文・QR付きの案内を、そのまま使えます。
    </p>
    <p class="muted small">
      掲載料・事前の連絡は不要です。画像はSNSや案内資料にご利用いただけます。
    </p>
  </header>

  <section aria-labelledby="social-title">
    <h2 id="social-title">SNSで使える、3つの会話例</h2>
    <label class="channel-label" for="promotion-channel">紹介する場所</label>
    <select id="promotion-channel" bind:value="{channel}">
      {#each Object.entries(promotionChannels).filter( ([id]) => ['x', 'instagram', 'partner'].includes(id) ) as [id, item]}
        <option value="{id}">{item.label}</option>
      {/each}
    </select>
    <p class="muted small">
      Instagramでは、リンクをプロフィールやストーリーズのリンクに設定してお使いください。
    </p>
    <div class="resource-grid">
      {#each promotionCards as card}
        <article class="resource-card promo-card">
          <img
            src="{`/promo/${card.id}.png`}"
            alt="{card.title.join('')}"
            width="1080"
            height="1350"
            loading="lazy"
          />
          <h3>{card.title.join('')}</h3>
          <a
            class="button secondary"
            href="{`/promo/${card.id}.png`}"
            download
            on:click="{() => downloaded(card.id)}">紹介画像を保存</a
          >
          <label for="{`post-${card.id}`}">投稿文とリンク</label>
          <textarea id="{`post-${card.id}`}" readonly value="{postText(card, channel)}" rows="9"
          ></textarea>
          <CopyButton
            text="{postText(card, channel)}"
            label="投稿文をコピー"
            on:copied="{() => trackEvent('promotion_copy', { asset_id: card.id, channel })}"
          />
        </article>
      {/each}
    </div>
  </section>

  <section class="flyer-section" aria-labelledby="flyer-title">
    <div>
      <p class="eyebrow">イベント・結婚相談所・コミュニティに</p>
      <h2 id="flyer-title">会う前の案内に、QRを一つ。</h2>
      <p>
        登録不要の会話ネタ帳を開けるA4案内です。受付での配布や、事前案内への添付にご利用ください。AI練習にはGoogleログインが必要です。
      </p>
      <a
        class="button primary"
        href="/promo/koi-tre-event-guide.pdf"
        download
        on:click="{() => downloaded('flyer_pdf')}">QR付きA4案内を保存（PDF）</a
      >
      <p>
        <a href="/promo/event-qr.png" download on:click="{() => downloaded('event_qr')}"
          >QR画像だけを保存（PNG）</a
        >
      </p>
      <p class="muted small event-link">
        QRのリンク先：<a href="{eventLink}">登録不要の会話ネタ帳</a>
      </p>
    </div>
    <a
      class="flyer-preview"
      href="/promo/koi-tre-event-guide.pdf"
      data-sveltekit-reload
      aria-label="QR付きA4案内のPDFを見る"
      ><img
        src="/promo/event-guide-preview.png"
        alt="会う日の前に、会話のちいさな準備を。話題と返し方を紹介するQR付き案内"
        width="595"
        height="842"
        loading="lazy"
      /></a
    >
  </section>

  <section class="resource-cta" aria-labelledby="partner-title">
    <h2 id="partner-title">事前案内やWebサイトに添える文章</h2>
    <label for="partner-text">紹介文</label>
    <textarea id="partner-text" readonly rows="6">{partnerText}</textarea>
    <CopyButton
      text="{partnerText}"
      label="紹介文をコピー"
      on:copied="{() =>
        trackEvent('promotion_copy', { asset_id: 'partner_text', channel: 'partner' })}"
    />
    <p class="muted small">
      紹介文には、アクセス元を集計するためのリンクが含まれます。氏名・会話内容は含みません。
    </p>
    <a class="text-link" href="/try">まずは自分で、30秒のお試しを体験する →</a>
  </section>
</div>

<style>
  select {
    color: var(--ink);
    background: #fffdf8;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.7rem;
    font: inherit;
    font-size: var(--text-sm);
    margin-left: 0.75rem;
    max-width: 100%;
  }
  label {
    display: block;
    font-size: var(--text-sm);
    margin: 1.25rem 0 0.5rem;
  }
  .channel-label {
    display: inline;
  }
  textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.8rem;
    border: 1px solid var(--border);
    background: #fffefa;
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    line-height: 1.8;
    resize: vertical;
  }
  .promo-card {
    min-width: 0;
  }
  .promo-card > img {
    width: 100%;
    height: auto;
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .promo-card h3 {
    font-size: var(--text-base);
  }
  .promo-card .button {
    font-size: var(--text-sm);
  }
  .flyer-section {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    align-items: center;
    gap: 2rem;
    border-top: 1px solid var(--border);
    padding-top: 3rem;
    margin-top: 3rem;
  }
  .flyer-preview {
    display: block;
    max-width: 20rem;
    margin: auto;
  }
  .flyer-preview img {
    width: 100%;
    height: auto;
    border: 1px solid var(--border);
    box-shadow: 0 0.5rem 1.5rem #343e3910;
  }
  .event-link {
    overflow-wrap: anywhere;
  }
  @media (max-width: 600px) {
    .flyer-section {
      grid-template-columns: 1fr;
    }
    select {
      display: block;
      margin: 0.6rem 0;
    }
  }
</style>
