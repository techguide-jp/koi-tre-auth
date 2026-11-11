<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { characters, type PartnerGender } from '$lib/adventure-catalog'
  import type { AdventureProgress } from '$lib/adventure'
  import {
    ROUTE_PRICE,
    PLUS_PRICE,
    TOPUP_PRICE,
    TOPUP_CREDITS,
    productKey,
    type BillingProduct
  } from '$lib/billing'
  import { checkoutProduct } from '$lib/billing-client'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import CharacterPortrait from '$lib/components/adventure/CharacterPortrait.svelte'
  export let data
  let gender: PartnerGender | null = null
  let progress: AdventureProgress | null = null
  let loadedUid = ''
  let pendingKey = ''
  let message = ''
  let messageKey = ''
  let requestIds: Record<string, string> = {}
  let mounted = false
  let alive = false
  $: roster = characters.filter((c) => c.gender === gender)
  $: owned = progress?.billing?.ownedCharacters ?? []
  $: subscribed = !!progress?.billing?.subscription?.active
  $: if (mounted && $user && $user.uid !== loadedUid) {
    loadedUid = $user.uid
    void loadProgress()
  }
  $: if (!$user) {
    progress = null
    loadedUid = ''
  }
  onMount(() => {
    mounted = true
    alive = true
    const requested = characters.find((c) => c.id === $page.url.searchParams.get('character'))
    if (requested) gender = requested.gender
    else
      try {
        const saved = JSON.parse(localStorage.getItem('koi-partner-choice:v1') ?? 'null')
        if (['male', 'female'].includes(saved?.gender)) gender = saved.gender
      } catch {
        /* 選び直せる。 */
      }
    return () => {
      alive = false
    }
  })
  async function loadProgress() {
    try {
      const uid = $user?.uid
      const response = await authenticatedFetch('/api/me/adventure')
      const value = await response.json()
      if (alive && $user?.uid === uid) progress = value
    } catch {
      if (alive) {
        messageKey = 'overview'
        message = '購入状況を読み込めませんでした。再読み込みしてお試しください。'
      }
    }
  }
  async function purchase(product: BillingProduct) {
    if (pendingKey || !data.billingReady) return
    const key = productKey(product)
    if (!$user) {
      await goto(
        `/login?returnTo=pricing${product.kind === 'route' ? `&character=${product.characterId}` : ''}`
      )
      return
    }
    pendingKey = key
    message = ''
    messageKey = key
    requestIds[key] ??= crypto.randomUUID()
    try {
      const result = await checkoutProduct(product, requestIds[key])
      if (result.url) window.location.assign(result.url)
      else if (alive)
        message = '購入画面を準備しています。少し待ってから、同じボタンでもう一度開いてください。'
    } catch (e) {
      if (alive) message = e instanceof Error ? e.message : '購入画面を開けませんでした。'
    } finally {
      if (alive) pendingKey = ''
    }
  }
</script>

<section class="pricing-intro">
  {#if progress?.billing?.adminPlay}<p class="notice">
      管理者は購入・Plus加入なしで、全モードを利用枠の消費なくプレイできます。合格点・好感度などの進行条件は通常どおりです。<a
        href="/#scenes">お相手を選ぶ →</a
      >
    </p>{/if}
  <p class="section-label">話したい気持ちに、合わせて。</p>
  <h1>出会って、知り合って。<br />その先の物語へ。</h1>
  <p>
    無料で出会いを体験したら、Plusで全員の本編へ。<br
    />好きな人の物語を残したい方には、買い切りのルートパックも。
  </p>
  {#if data.billingReady && data.billingTestMode}<p class="notice">
      テスト環境です。実際の請求は発生しません。
    </p>{:else if !data.billingReady}<p class="notice">
      有料プランは準備中です。出会い編と無料の練習をお楽しみください。
    </p>{/if}
  <p class="small muted">料金はすべて税込。3往復＝1枠、6往復＝2枠です。</p>
</section>
<div class="plan-grid">
  <article class="plan">
    <p class="eyebrow">まずは、出会ってみよう</p>
    <h2>無料</h2>
    <p class="price">0<span>円</span></p>
    <ul>
      <li>全6人の出会い編・各3話</li>
      <li>各人物の第1話はログインせず3往復を体験</li>
      <li>毎月10枠</li>
      <li>共通場面・カスタム練習</li>
      <li>25点評価・星形グラフ・具体的な言い換え</li>
      <li>無料対象のクリア済み場面の再練習</li>
    </ul>
    <a class="button secondary" href="/#scenes">無料でお相手を選ぶ →</a>
  </article>
  <article class="plan featured" id="plus">
    <p class="eyebrow">全員の物語も、これからの会話も</p>
    <h2>Koi-Tre Plus</h2>
    <p class="price">{PLUS_PRICE.toLocaleString()}<span>円／月</span></p>
    <p class="small muted">申込時に初回決済し、解約するまで毎月自動更新します。</p>
    <ul>
      <li>全キャラの通常本編を攻略・再練習</li>
      <li>本編クリア後は、その人物との日常交流</li>
      <li>契約更新ごと共通60枠・繰越なし</li>
      <li>公開される通常の追加キャラ・ストーリーも対象</li>
      <li>毎月1日・16日の季節イベント</li>
      <li>過去の会話・選んだ結末を引き継ぐ</li>
      <li>成長の振り返りと自分向けの練習</li>
    </ul>
    {#if subscribed}<a class="button secondary" href="/account">契約を確認する</a>{:else}<button
        class="button secondary"
        disabled="{!data.billingReady || !$authReady || !!pendingKey || (!!$user && !progress)}"
        aria-busy="{pendingKey === 'plus'}"
        on:click="{() => purchase({ kind: 'plus' })}"
        >{pendingKey === 'plus'
          ? '購入画面を準備中…'
          : !data.billingReady
            ? '準備中'
            : 'Plusを始める'}</button
      >{/if}
    <p class="small muted">本編クリア前から加入できます。Plusだけで攻略・再練習が可能です。</p>
    {#if messageKey === 'plus' && message}<p class="error" role="status">{message}</p>{/if}
  </article>
  <article class="plan">
    <p class="eyebrow">この人と、結末まで</p>
    <h2>ルートパック</h2>
    <p class="price">{ROUTE_PRICE.toLocaleString()}<span>円／1人・買い切り</span></p>
    <ul>
      <li>選んだ人物の4〜12話・エンディング</li>
      <li>人物専用24枠・期限なし</li>
      <li>本編9話の会話分は6往復で18枠（再挑戦は別）</li>
      <li>6往復の完了で、場面専用イラストを獲得</li>
      <li>デート編・本音編などへ戻って練習</li>
      <li>24枠を使い切っても、購入した本編の利用権は残る</li>
    </ul>
    <a class="button primary" href="#route-packs">気になる人の本編を見る ↓</a>
    <p class="small muted">Plus解約後も購入章を練習できます。将来の追加シーズンは対象外です。</p>
  </article>
</div>
<section class="topup plan" id="topup">
  <p class="eyebrow">もう少し話したいときに</p>
  <h2>追加の共通枠</h2>
  <p class="price">{TOPUP_PRICE.toLocaleString()}<span>円／{TOPUP_CREDITS}枠・期限なし</span></p>
  <p>全キャラ・共通場面・カスタム練習で共有。Plus未加入でも購入できます。</p>
  <p class="small muted">
    有料本編にはPlusか人物パックが必要です。自動購入・自動超過課金はありません。
  </p>
  <button
    class="button secondary"
    disabled="{!data.billingReady || !$authReady || !!pendingKey}"
    aria-busy="{pendingKey === 'topup'}"
    on:click="{() => purchase({ kind: 'topup' })}"
    >{pendingKey === 'topup'
      ? '購入画面を準備中…'
      : data.billingReady
        ? '追加15枠を購入する · 550円'
        : '販売準備中'}</button
  >
  {#if messageKey === 'topup' && message}<p class="error" role="status">{message}</p>{/if}
</section>
<section class="route-packs" id="route-packs">
  <p class="section-label">気になる人の、その先へ。</p>
  <h2>誰の本編を、始めよう。</h2>
  <p>
    月額を使わず1人を攻略したいとき、Plus解約後もその人物の本編を練習したいときに。購入した章には無料枠・専用枠・追加購入枠を使えます。
  </p>
  <div class="gender-tabs">
    <button
      class:active="{gender === 'male'}"
      aria-pressed="{gender === 'male'}"
      on:click="{() => (gender = 'male')}">男性のキャラクター</button
    ><button
      class:active="{gender === 'female'}"
      aria-pressed="{gender === 'female'}"
      on:click="{() => (gender = 'female')}">女性のキャラクター</button
    >
  </div>
  {#if gender}<div class="pack-grid">
      {#each roster as person}{@const key = `route:${person.id}`}
        <article class="pack {person.color}">
          <div class="portrait-wrap">
            <CharacterPortrait characterId="{person.id}" variant="introduction" />
          </div>
          <div class="pack-copy">
            <p class="eyebrow">{person.age}歳 · {person.subtitle}</p>
            <h3>{person.name}の本編</h3>
            <p>{person.detail}</p>
            <p class="small">4〜12話・結末＋専用24枠</p>
            {#if owned.includes(person.id)}<a
                class="button secondary"
                href="/?character={person.id}#scenes">購入済み・物語へ →</a
              >{:else}<button
                class="button primary"
                disabled="{!data.billingReady || !$authReady || !!pendingKey}"
                aria-busy="{pendingKey === key}"
                on:click="{() => purchase({ kind: 'route', characterId: person.id })}"
                >{pendingKey === key
                  ? '購入画面を準備中…'
                  : data.billingReady
                    ? `${person.name}の本編を購入 · 1,480円`
                    : '販売準備中'}</button
              >{/if}{#if messageKey === key && message}<p class="error" role="status">
                {message}
              </p>{/if}
          </div>
        </article>{/each}
    </div>{:else}<p class="small muted">まずは話したいお相手を選んでください。</p>{/if}
</section>
{#if messageKey === 'overview' && message}<p class="error" role="status">{message}</p>{/if}
<section class="rules" id="purchase-terms">
  <h2>枠と購入について</h2>
  <details>
    <summary>買い切りと月額は、両方必要ですか？</summary>
    <p>
      Plusだけで全員の通常本編を攻略・再練習できます。ルートパックは、選んだ人物の本編を月額なしでも遊べる買い切りです。両方の購入は必要ありません。追加15枠は会話量を増やす商品で、本編の解放権は付きません。
    </p>
  </details>
  <details>
    <summary>一度クリアしたパートへ戻れますか？</summary>
    <p>
      お相手を選び「クリア済みパートを練習」から、出会い編・デート編・本音編・気持ちを伝える編のクリア済みの話へ戻れます。その話の時点の関係で練習し、本編の進行・選んだ結末は変わりません。3往復1枠、6往復2枠を使います。
    </p>
  </details>
  <details>
    <summary>枠はいつ使われ、いつ更新されますか？</summary>
    <p>
      最初のAI返答の生成・保存に成功したときに消費します。途中再開・再送・生成失敗で追加消費しません。無料枠は日本時間の月初、Plusは契約更新日に更新し、繰越はありません。パック枠には期限がなく、購入人物の出会い・本編・再挑戦に使えます。期限のある無料・Plus枠、対象人物の専用枠、追加購入の共通枠の順に使います。追加購入枠にも期限はありません。Plusの60枠と無料10枠は合算しません。
    </p>
  </details>
  <details>
    <summary>解約すると、物語や思い出は消えますか？</summary>
    <p>
      解約は次回更新の停止です。支払い済み期間の終了までPlusを利用できます。その後も購入済み本編、未使用の人物専用・追加購入枠、保存済み会話・分析・思い出・進行記録は残ります。未購入の有料本編を新たに遊ぶには、再加入か人物パックが必要です。日常交流やイベントの新しいプレイには再加入が必要です。消費済みの途中会話は完了まで続けられます。
    </p>
  </details>
  <p class="small muted">
    お支払いはカード決済です。支払いが反映されると、購入した利用権や枠をマイページで確認できます。Plusの次回更新を止めるには、更新前にマイページから解約してください。
  </p>
  <a href="/account">マイページへ →</a> · <a href="/contact">購入・請求のお問い合わせ →</a>
</section>

<style>
  .pricing-intro {
    padding: 64px 0 40px;
  }
  .pricing-intro h1 {
    font-family: var(--font-editorial);
    font-size: var(--heading-lg);
    line-height: 1.45;
    margin: 18px 0;
  }
  .pricing-intro > p {
    line-height: 1.9;
  }
  .notice {
    display: inline-block;
    padding: 12px 18px;
    background: var(--olive-soft);
    border-radius: 10px;
    font-size: var(--text-sm);
  }
  .plan-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
  .plan {
    border: 1px solid var(--border);
    background: white;
    border-radius: 18px;
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    scroll-margin-top: 24px;
  }
  .plan.featured {
    border: 2px solid var(--accent);
    background: var(--surface);
  }
  .eyebrow {
    font-size: var(--text-sm);
    color: var(--accent);
    margin: 0;
  }
  .plan h2 {
    font-size: 1.3rem;
    margin: 12px 0;
  }
  .price {
    font-size: 2.3rem;
    font-family: var(--font-editorial);
    margin: 8px 0 20px;
  }
  .price span {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--muted);
    margin-left: 5px;
  }
  .plan ul {
    padding-left: 18px;
    font-size: var(--text-sm);
    line-height: 1.85;
    margin: 0 0 25px;
    flex: 1;
  }
  .plan li {
    margin: 8px 0;
  }
  .button {
    text-align: center;
    font-size: var(--text-sm);
  }
  .plan > .small {
    margin-bottom: 0;
    line-height: 1.8;
  }
  .topup {
    margin-top: 24px;
    max-width: 760px;
  }
  .topup > p {
    line-height: 1.8;
  }
  .topup > button {
    align-self: flex-start;
  }
  .route-packs {
    padding: 64px 0;
    scroll-margin-top: 24px;
  }
  .route-packs h2 {
    font-size: 1.7rem;
  }
  .gender-tabs {
    display: flex;
    gap: 12px;
    margin: 24px 0;
  }
  .gender-tabs button {
    border: 1px solid var(--border);
    border-radius: 30px;
    background: white;
    padding: 12px 20px;
    color: var(--ink);
    cursor: pointer;
  }
  .gender-tabs button.active {
    background: var(--olive);
    color: white;
    border-color: var(--olive);
  }
  .pack-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 22px;
  }
  .pack {
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    background: #e8eee8;
  }
  .pack.clay {
    background: #f4e6e1;
  }
  .pack.night {
    background: #eeebf1;
  }
  .portrait-wrap {
    height: 300px;
    display: flex;
    justify-content: center;
    overflow: hidden;
    padding-top: 12px;
  }
  .portrait-wrap :global(.portrait) {
    width: 205px;
    flex-shrink: 0;
  }
  .pack-copy {
    padding: 24px 20px;
    background: rgba(255, 255, 255, 0.8);
  }
  .pack-copy h3 {
    margin: 10px 0;
    font-size: 1.35rem;
  }
  .pack-copy > p:not(.eyebrow) {
    font-size: var(--text-sm);
    line-height: 1.8;
  }
  .pack-copy > .button {
    width: 100%;
  }
  .rules {
    max-width: 760px;
    margin: 0 auto 64px;
  }
  .rules h2 {
    font-size: 1.4rem;
  }
  .rules details {
    border-top: 1px solid var(--border);
    padding: 18px 0;
  }
  .rules summary {
    cursor: pointer;
    font-weight: 600;
    font-size: var(--text-base);
    line-height: 1.7;
  }
  .rules details p {
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  .error {
    font-size: var(--text-sm);
    line-height: 1.8;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  @media (max-width: 800px) {
    .plan-grid {
      grid-template-columns: 1fr;
    }
    .pack-grid {
      grid-template-columns: 1fr;
    }
    .pricing-intro {
      padding: 40px 0 28px;
    }
    .plan {
      padding: 24px;
    }
    .plan ul {
      margin-bottom: 18px;
    }
    .gender-tabs button {
      font-size: var(--text-sm);
      padding: 12px 14px;
    }
    .portrait-wrap {
      height: 350px;
    }
    .portrait-wrap :global(.portrait) {
      width: 240px;
    }
    .route-packs {
      padding: 44px 0;
    }
  }
</style>
