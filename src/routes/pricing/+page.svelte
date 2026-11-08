<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { characters, type PartnerGender } from '$lib/adventure-catalog'
  import type { AdventureProgress } from '$lib/adventure'
  import { ROUTE_PRICE, PLUS_PRICE, productKey, type BillingProduct } from '$lib/billing'
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
  $: eligible = !!progress?.endings?.some(
    (e) =>
      owned.includes(e.characterId) &&
      (!progress?.progression ||
        progress.progression.clearedEpisodes.includes(`${e.characterId}:${e.characterId}-12`))
  )
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
  <p class="section-label">話したい気持ちに、合わせて。</p>
  <h1>出会って、知り合って。<br />その先の物語へ。</h1>
  <p>
    無料で好きなお相手を見つけて、気になる人の本編を。<br
    />クリアした後も話したくなったら、Plusで続きを楽しめます。
  </p>
  {#if data.billingReady}<p class="notice">テスト環境です。実際の請求は発生しません。</p>{:else}<p
      class="notice"
    >
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
      <li>毎月10枠</li>
      <li>共通場面・カスタム練習</li>
      <li>25点評価・星形グラフ・具体的な言い換え</li>
      <li>クリア済み場面の再練習</li>
    </ul>
    <a class="button secondary" href="/#scenes">無料でお相手を選ぶ →</a>
  </article>
  <article class="plan featured">
    <p class="eyebrow">この人と、結末まで</p>
    <h2>ルートパック</h2>
    <p class="price">{ROUTE_PRICE.toLocaleString()}<span>円／1人・買い切り</span></p>
    <ul>
      <li>選んだ人物の4〜12話・エンディング</li>
      <li>人物専用24枠・期限なし</li>
      <li>全9話を6往復で遊んでも18枠</li>
      <li>6往復の完了で、場面専用イラストを獲得</li>
      <li>デート編・本音編などへ戻って練習</li>
      <li>本編・会話・獲得した思い出を保持</li>
    </ul>
    <a class="button primary" href="#route-packs">気になる人の本編を見る ↓</a>
    <p class="small muted">月額への加入は任意です。</p>
  </article>
  <article class="plan" id="plus">
    <p class="eyebrow">物語のあとも、話したい</p>
    <h2>Koi-Tre Plus</h2>
    <p class="price">{PLUS_PRICE.toLocaleString()}<span>円／月</span></p>
    <ul>
      <li>本編クリア済みの人物との日常交流</li>
      <li>契約更新ごと共通60枠</li>
      <li>毎月1日・16日の季節イベント</li>
      <li>過去の会話・選んだ結末を引き継ぐ</li>
      <li>成長の振り返りと自分向けの練習</li>
    </ul>
    {#if subscribed}<a class="button secondary" href="/account">契約を確認する</a>{:else}<button
        class="button secondary"
        disabled="{!data.billingReady || !$authReady || !!pendingKey || !eligible}"
        aria-busy="{pendingKey === 'plus'}"
        on:click="{() => purchase({ kind: 'plus' })}"
        >{pendingKey === 'plus'
          ? '購入画面を準備中…'
          : !data.billingReady
            ? '準備中'
            : eligible
              ? 'Plusを始める'
              : '本編クリア後に始められます'}</button
      >{/if}
    <p class="small muted">本編の解放は人物別ルートパックの対象です。</p>
    {#if messageKey === 'plus' && message}<p class="error" role="status">{message}</p>{/if}
  </article>
</div>
<section class="route-packs" id="route-packs">
  <p class="section-label">気になる人の、その先へ。</p>
  <h2>誰の本編を、始めよう。</h2>
  <p>出会い編の続きから、全12話の物語へ進みます。</p>
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
            <CharacterPortrait characterId="{person.id}" emotion="shy" />
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
<section class="rules">
  <h2>枠と購入について</h2>
  <details>
    <summary>買い切りと月額は、両方必要ですか？</summary>
    <p>
      ルートパックだけで、その人物の本編を最後まで楽しめます。Plusは本編クリア後の交流を楽しむための任意のプランです。Plusは1アカウント分で、クリア済みの人物全員が対象です。
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
      最初のAI返答の生成・保存に成功したときに消費します。途中再開・再送・生成失敗で追加消費しません。無料枠は日本時間の月初、Plusは契約更新日に更新し、繰越はありません。パック枠には期限がなく、購入人物の出会い・本編・再挑戦に使えます。使用できる共通枠を先に、不足分を人物専用枠から使います。
    </p>
  </details>
  <details>
    <summary>解約すると、物語や思い出は消えますか？</summary>
    <p>
      解約は次回更新の停止です。支払い済み期間の終了までPlusを利用できます。その後も購入済み本編、保存済み会話、思い出、XPは残ります。Plus対象の日常交流やイベントの新しいプレイには、再加入が必要です。
    </p>
  </details>
  <p class="small muted">
    購入内容・料金・更新日を決済画面で確認してからお手続きください。契約管理はマイページから行えます。
  </p>
  <a href="/account">マイページへ →</a>
</section>

<style>
  .pricing-intro {
    padding: 64px 0 40px;
  }
  .pricing-intro h1 {
    font-family: Georgia, serif;
    font-size: clamp(2rem, 4vw, 3rem);
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
    font-size: 0.85rem;
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
    font-size: 0.7rem;
    color: var(--accent);
    margin: 0;
  }
  .plan h2 {
    font-size: 1.3rem;
    margin: 12px 0;
  }
  .price {
    font-size: 2.3rem;
    font-family: Georgia, serif;
    margin: 8px 0 20px;
  }
  .price span {
    font-family: var(--font-body);
    font-size: 0.7rem;
    color: var(--muted);
    margin-left: 5px;
  }
  .plan ul {
    padding-left: 18px;
    font-size: 0.82rem;
    line-height: 1.85;
    margin: 0 0 25px;
    flex: 1;
  }
  .plan li {
    margin: 8px 0;
  }
  .button {
    text-align: center;
    font-size: 0.8rem;
  }
  .plan > .small {
    margin-bottom: 0;
    line-height: 1.8;
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
    background: #e9ecdf;
  }
  .pack.clay {
    background: #f1e4d8;
  }
  .pack.night {
    background: #e8e7ef;
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
    font-size: 0.8rem;
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
    font-size: 0.9rem;
    line-height: 1.7;
  }
  .rules details p {
    font-size: 0.85rem;
    line-height: 1.9;
  }
  .error {
    font-size: 0.8rem;
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
      font-size: 0.8rem;
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
