<script lang="ts">
  import AdminTable from '$lib/components/admin/AdminTable.svelte'
  import { onMount } from 'svelte'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { createAdminReport } from '$lib/admin-report'
  import {
    adminDate,
    adminNumber,
    adminPerson,
    adminCharacter,
    adminCreditKind,
    adminContractStatus,
    adminProduct,
    adminGrantStatus,
    type AdminBillingView,
    type AdminDays,
    type AdminProductFilter
  } from '$lib/admin-operations'
  import AdminReportState from '$lib/components/admin/AdminReportState.svelte'
  import AdminPagination from '$lib/components/admin/AdminPagination.svelte'
  const report = createAdminReport<AdminBillingView>(authenticatedFetch)
  let mounted = false,
    days: AdminDays = 30,
    kind: AdminProductFilter = 'all',
    page = 1
  $: endpoint = `/api/admin/billing?${new URLSearchParams({ days: String(days), kind, page: String(page) })}`
  $: if (mounted) report.load($authReady ? ($user?.uid ?? null) : null, endpoint)
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
      report.destroy()
    }
  })
  const retry = () => report.load($user?.uid ?? null, endpoint, true)
  const checkoutStatus = (status: string, expiresAt: string, now: string) =>
    status === 'completed'
      ? '手続き完了'
      : status === 'failed'
        ? '画面準備失敗'
        : expiresAt <= now
          ? '期限切れ'
          : status === 'creating'
            ? '画面準備中'
            : status === 'open'
              ? '購入画面発行'
              : status
</script>

<svelte:head
  ><title>課金情報 | Koi-Tre 運営管理</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>
<div class="ops">
  <div class="ops-header">
    <div>
      <h1>課金情報</h1>
      <p class="ops-intro">Plus・人物パック・追加枠の契約と利用権を確認できます。</p>
    </div>
  </div>
  <AdminReportState
    pending="{$report.pending}"
    error="{$report.error}"
    ready="{!!$report.data}"
    on:retry="{retry}"
  >
    {#if $report.data}{@const view = $report.data}
      <div class="ops-notice">
        <strong
          >{view.enabled
            ? view.testMode
              ? 'テスト決済環境'
              : '本番決済環境'
            : '購入は準備中'}</strong
        >
        <p>
          {#if view.testMode}決済情報はテスト記録です。{/if}支払額・返金額はアプリに保存されていないため、この画面では金額を未記録として扱います。
        </p>
      </div>
      <p class="ops-period">
        {adminDate(view.period.to)} 時点。以下の人数は集計期間にかかわらず現在の状態です。
      </p>
      <dl class="ops-metrics">
        {#each [{ label: '有効なPlus利用権', value: view.current.plusUsers }, { label: '人物パック購入者', value: view.current.routeOwners }, { label: '追加枠の購入者', value: view.current.topupOwners }] as item}<div
            class="ops-metric"
          >
            <dt>{item.label}</dt>
            <dd>{adminNumber(item.value)}<small>人</small></dd>
          </div>{/each}
      </dl>
    {/if}
  </AdminReportState>
  {#if $user}<div class="ops-controls">
      <label
        >履歴の期間<select
          bind:value="{days}"
          on:change="{() => (page = 1)}"
          disabled="{$report.pending}"
          ><option value="{7}">直近7日</option><option value="{30}">直近30日</option><option
            value="{90}">直近90日</option
          ></select
        ></label
      ><label
        >付与・購入の商品<select
          bind:value="{kind}"
          on:change="{() => (page = 1)}"
          disabled="{$report.pending}"
          ><option value="all">すべて</option><option value="plus">Plus</option><option
            value="route">人物パック</option
          ><option value="topup">追加枠</option></select
        ></label
      ><button disabled="{$report.pending}" aria-busy="{$report.pending}" on:click="{retry}"
        >{$report.pending ? '読み込み中…' : '最新情報に更新'}</button
      >
    </div>{/if}
  {#if $user && $report.data}{@const view = $report.data}
    <section>
      <h2>購入枠の付与・停止履歴</h2>
      <p class="ops-muted">
        {adminDate(view.period.from)} 〜 {adminDate(view.period.to)} に付与された記録。無料枠は含めません。
      </p>
      {#if !view.grants.length}<section class="ops-panel">
          <p>この期間の商品に該当する付与記録はありません。</p>
        </section>{:else}<AdminTable label="購入枠の付与履歴。横にスクロールできます">
          <table class="ops-wide">
            <thead
              ><tr
                ><th>付与日時</th><th>利用者</th><th>商品</th><th>付与枠</th><th>状態</th><th
                  >利用期限</th
                ></tr
              ></thead
            ><tbody
              >{#each view.grants as grant}{@const status = adminGrantStatus(
                  grant,
                  view.period.to
                )}<tr
                  ><td>{adminDate(grant.startsAt)}</td><td
                    >{adminPerson(grant)}<span class="ops-sub">{grant.email || 'メール未設定'}</span
                    ></td
                  ><td
                    >{adminCreditKind(grant.kind)}{grant.characterId
                      ? `・${adminCharacter(grant.characterId)}`
                      : ''}</td
                  ><td class="ops-number">{grant.units}</td><td
                    ><span
                      class="ops-badge"
                      class:warning="{status === '停止'}"
                      class:muted="{status === '期限終了'}">{status}</span
                    ></td
                  ><td>{grant.expiresAt ? adminDate(grant.expiresAt) : '期限なし'}</td></tr
                >{/each}</tbody
            >
          </table>
        </AdminTable>{/if}
      <AdminPagination
        page="{view.page}"
        pageSize="{view.pageSize}"
        total="{view.total}"
        on:page="{(e) => (page = e.detail)}"
      />
    </section>
    <section class="ops-panel">
      <h2>契約の記録</h2>
      <p class="ops-muted">
        更新の新しい25契約。利用権は支払い確認済みの有効期間に基づいています。
      </p>
      {#if !view.contracts.length}<p>契約の記録はありません。</p>{:else}<AdminTable
          label="Plus契約の記録。横にスクロールできます"
        >
          <table class="ops-wide">
            <thead
              ><tr
                ><th>利用者</th><th>契約状態</th><th>支払期間の利用権</th><th>期間</th><th
                  >解約予約</th
                ></tr
              ></thead
            ><tbody
              >{#each view.contracts as contract}<tr
                  ><td
                    >{adminPerson(contract)}<span class="ops-sub"
                      >{contract.email || 'メール未設定'}</span
                    ></td
                  ><td>{adminContractStatus(contract.status)}</td><td
                    >{contract.paidAccess ? '有効' : '有効な期間なし'}</td
                  ><td>{adminDate(contract.periodStart)} 〜<br />{adminDate(contract.periodEnd)}</td
                  ><td>{contract.cancelAtPeriodEnd ? '期間末で終了予定' : 'なし'}</td></tr
                >{/each}</tbody
            >
          </table>
        </AdminTable>{/if}
    </section>
    <details class="ops-panel">
      <summary>購入画面の準備・手続き履歴（期間内の新しい25件）</summary>
      <p class="ops-muted">画面の発行や手続き完了と、支払い検証後の枠付与は別の記録です。</p>
      {#if !view.checkouts.length}<p>購入画面の記録はありません。</p>{:else}<AdminTable
          label="購入画面の準備履歴。横にスクロールできます"
        >
          <table class="ops-wide">
            <thead
              ><tr><th>作成日時</th><th>利用者</th><th>商品</th><th>状態</th><th>記録ID</th></tr
              ></thead
            ><tbody
              >{#each view.checkouts as checkout}<tr
                  ><td>{adminDate(checkout.createdAt)}</td><td
                    >{adminPerson(checkout)}<span class="ops-sub"
                      >{checkout.email || 'メール未設定'}</span
                    ></td
                  ><td>{adminProduct(checkout.product)}</td><td
                    >{checkoutStatus(checkout.status, checkout.expiresAt, view.period.to)}</td
                  ><td><span class="ops-sub">{checkout.id}</span></td></tr
                >{/each}</tbody
            >
          </table>
        </AdminTable>{/if}
    </details>
  {/if}
</div>
