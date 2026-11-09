<script lang="ts">
  import { characters } from '$lib/adventure-catalog'
  import type { BillingOverview } from '$lib/billing'
  export let billing: BillingOverview
  $: common = billing.credits
    .filter((g) => g.kind === 'free' || g.kind === 'plus')
    .reduce((sum, g) => sum + g.remaining, 0)
  $: topup = billing.credits
    .filter((g) => g.kind === 'topup')
    .reduce((sum, g) => sum + g.remaining, 0)
  $: packs = billing.credits.filter((g) => g.kind === 'route')
</script>

<div class="balance" aria-label="利用できる練習枠">
  <p class="label">{billing.subscription?.active ? 'Plus' : '無料'}の共通枠</p>
  <p class="remaining">
    あと <strong>{common}</strong> 枠 <span>／ {billing.subscription?.active ? '60' : '10'}枠</span>
  </p>
  <p class="small muted">
    3往復＝1枠 · 6往復＝2枠{billing.reserved ? ` · ${billing.reserved}枠を処理中` : ''}
  </p>
  <p class="small muted">
    {billing.subscription?.active && billing.subscription.cancelAtPeriodEnd
      ? 'Plusの利用期限'
      : '次の更新'}：{new Date(billing.resetsAt).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo'
    })}
  </p>
  <p class="small">
    追加購入の共通枠 <strong>{topup}枠</strong> · 期限なし <a href="/pricing#topup">追加する →</a>
  </p>
  {#if packs.length}<div class="pack-balances">
      {#each packs as pack}<span
          >{characters.find((c) => c.id === pack.characterId)?.name}専用
          <strong>{pack.remaining}枠</strong> · 期限なし</span
        >{/each}
    </div>{/if}<a class="small" href="/account">枠・購入・契約を確認 →</a>
</div>

<style>
  .label {
    font-size: var(--text-sm);
    color: var(--accent);
    margin: 0 0 5px;
  }
  .remaining {
    font-size: var(--text-base);
    margin: 0;
  }
  .remaining strong {
    font-size: 1.8rem;
    color: var(--ink);
  }
  .remaining span {
    font-size: var(--text-sm);
    color: var(--muted);
  }
  .balance > .small {
    margin: 0.4rem 0;
  }
  .pack-balances {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0;
  }
  .pack-balances > span {
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: var(--text-sm);
    background: white;
  }
</style>
