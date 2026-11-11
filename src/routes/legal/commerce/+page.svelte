<script lang="ts">
  import {
    PLUS_CREDITS,
    PLUS_PRICE,
    ROUTE_CREDITS,
    ROUTE_PRICE,
    TOPUP_CREDITS,
    TOPUP_PRICE
  } from '$lib/billing'
  import {
    COMMERCE_DISCLOSURE_TITLE,
    PLUS_REFUND,
    REFUND_AFTER_PROVISION,
    REFUND_EXCEPTIONS
  } from '$lib/billing-disclosure'
  import type { PageData } from './$types'

  export let data: PageData
</script>

<svelte:head>
  <title>{COMMERCE_DISCLOSURE_TITLE} | Koi-Tre</title>
</svelte:head>

<article class="disclosure">
  <h1>{COMMERCE_DISCLOSURE_TITLE}</h1>

  <section aria-labelledby="seller">
    <h2 id="seller">販売事業者</h2>
    <dl>
      <div>
        <dt>販売事業者</dt>
        <dd>TechGuide合同会社</dd>
      </div>
      <div>
        <dt>運営責任者</dt>
        <dd>高橋 雄太</dd>
      </div>
      <div>
        <dt>所在地</dt>
        <dd>〒160-0022 東京都新宿区新宿7-20-6 大久保マンション1F</dd>
      </div>
      {#if data.phone}<div>
          <dt>電話番号</dt>
          <dd><a href="tel:{data.phone.replaceAll('-', '')}">{data.phone}</a></dd>
        </div>{/if}
      <div>
        <dt>お問い合わせ</dt>
        <dd><a href="/contact">購入・請求・解約のお問い合わせ</a></dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="products">
    <h2 id="products">料金と利用内容</h2>
    <dl>
      <div>
        <dt>Plus</dt>
        <dd>
          月額{PLUS_PRICE}円。契約期間ごとに共通{PLUS_CREDITS}枠を付与し、未使用枠の繰り越しはありません。契約中は全キャラクターの通常本編を利用でき、本編をクリアした人物との日常交流・公開済みイベントも対象です。
        </dd>
      </div>
      <div>
        <dt>人物別ルートパック</dt>
        <dd>
          1人{ROUTE_PRICE.toLocaleString(
            'ja-JP'
          )}円の買い切り。購入人物の4〜12話・結末の利用権と、期限なしの人物専用{ROUTE_CREDITS}枠を付与します。
        </dd>
      </div>
      <div>
        <dt>追加共通枠</dt>
        <dd>
          {TOPUP_PRICE}円の買い切り。期限なしの共通{TOPUP_CREDITS}枠を付与します。利用できる場面はお持ちの利用権に応じます。
        </dd>
      </div>
    </dl>
    <p>価格はすべて税込です。3往復は1枠、6往復は2枠を使います。</p>
  </section>

  <section aria-labelledby="payment">
    <h2 id="payment">お支払いと利用開始</h2>
    <dl>
      <div>
        <dt>支払方法・時期</dt>
        <dd>クレジットカードで申込時に決済します。Plusは解約まで毎月同額で自動更新します。</dd>
      </div>
      <div>
        <dt>提供時期</dt>
        <dd>支払い確認後、購入した利用権と利用枠をアカウントに反映します。</dd>
      </div>
      <div>
        <dt>代金以外の費用</dt>
        <dd>インターネット接続や通信にかかる費用はお客様の負担です。</dd>
      </div>
      <div>
        <dt>利用環境</dt>
        <dd>
          インターネットに接続できるスマートフォンまたはパソコンのブラウザ。購入と有料商品の利用にはログインが必要です。
        </dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="cancellation">
    <h2 id="cancellation">Plusの解約</h2>
    <p>
      次回の請求前に、<a href="/account">マイページ</a
      >の契約管理から解約を予約してください。予約後も、支払い済み期間の終了まで利用できます。
    </p>
  </section>

  <section aria-labelledby="refunds">
    <h2 id="refunds">キャンセル・返金</h2>
    <p>{REFUND_AFTER_PROVISION}{PLUS_REFUND}</p>
    <p>{REFUND_EXCEPTIONS}</p>
    <p><a href="/contact">購入・請求・解約のお問い合わせ</a></p>
  </section>

  <p class="back"><a href="/pricing">← 料金と遊べる範囲に戻る</a></p>
</article>

<style>
  .disclosure {
    width: 100%;
    max-width: 47rem;
    margin: 0 auto;
    padding: clamp(2rem, 6vw, 4rem) 0;
    line-height: 1.85;
  }
  h1 {
    font-family: var(--font-editorial);
    font-size: var(--heading-lg);
    line-height: 1.45;
    margin: 0 0 2rem;
  }
  section {
    margin: 0 0 1.5rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
  }
  h2 {
    font-size: var(--heading-sm);
    margin: 0 0 0.6rem;
  }
  dl,
  dd {
    margin: 0;
  }
  dl > div {
    display: grid;
    grid-template-columns: minmax(8.5rem, 1fr) minmax(0, 3fr);
    gap: 0 1.25rem;
    border-bottom: 1px solid var(--border);
    padding: 0.65rem 0;
  }
  dl > div:last-child {
    border-bottom: 0;
  }
  dt {
    font-weight: 700;
  }
  section p {
    margin: 0.65rem 0 0;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  @media (max-width: 560px) {
    dl > div {
      grid-template-columns: 1fr;
    }
  }
</style>
