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
    type AdminUsageView,
    type AdminDays
  } from '$lib/admin-operations'
  import AdminReportState from '$lib/components/admin/AdminReportState.svelte'
  import AdminDailyChart from '$lib/components/admin/AdminDailyChart.svelte'
  import AdminDistribution from '$lib/components/admin/AdminDistribution.svelte'
  const report = createAdminReport<AdminUsageView>(authenticatedFetch)
  let mounted = false,
    days: AdminDays = 30
  $: endpoint = `/api/admin/usage?days=${days}`
  $: if (mounted) report.load($authReady ? ($user?.uid ?? null) : null, endpoint)
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
      report.destroy()
    }
  })
  const retry = () => report.load($user?.uid ?? null, endpoint, true)
  const modeLabel = (key: string) => {
    const [mode, turns] = key.split(':')
    return `${mode === 'adventure' ? '人物との練習' : mode === 'custom' ? 'カスタム' : '共通練習'}・${turns}往復`
  }
</script>

<svelte:head
  ><title>利用状況 | Koi-Tre 運営管理</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>
<div class="ops">
  <div class="ops-header">
    <div>
      <h1>利用状況</h1>
      <p class="ops-intro">実際に保存された練習の利用と、日ごとの変化を確認できます。</p>
    </div>
  </div>
  {#if $user}<div class="ops-controls">
      <label
        >集計期間<select bind:value="{days}" disabled="{$report.pending}"
          ><option value="{7}">直近7日</option><option value="{30}">直近30日</option><option
            value="{90}">直近90日</option
          ></select
        ></label
      ><button disabled="{$report.pending}" aria-busy="{$report.pending}" on:click="{retry}"
        >{$report.pending ? '集計中…' : '最新情報に更新'}</button
      >
    </div>{/if}
  <AdminReportState
    pending="{$report.pending}"
    error="{$report.error}"
    ready="{!!$report.data}"
    on:retry="{retry}"
  >
    {#if $report.data}{@const view = $report.data}
      <p class="ops-period">
        {adminDate(view.period.from)} 〜 {adminDate(view.period.to)}（日本時間）
      </p>
      <dl class="ops-metrics">
        {#each [{ label: '登録利用者（累計）', value: view.totals.registered, unit: '人' }, { label: '期間内の新規登録', value: view.totals.newUsers, unit: '人' }, { label: '返信を保存した利用者', value: view.totals.activeUsers, unit: '人' }, { label: '練習開始', value: view.totals.started, unit: '件' }, { label: '会話完了', value: view.totals.completed, unit: '件' }, { label: '保存した返信', value: view.totals.replies, unit: '回' }, { label: '確定した枠消費', value: view.totals.credits, unit: '枠' }, { label: 'ステージクリア', value: view.totals.cleared, unit: '話' }] as item}<div
            class="ops-metric"
          >
            <dt>{item.label}</dt>
            <dd>{adminNumber(item.value)}<small>{item.unit}</small></dd>
          </div>{/each}
      </dl>
      <p class="ops-muted">
        管理者の練習も含むログイン利用者の集計です。サイト訪問者数ではありません。開始は最初の返答保存、完了は3／6往復の終了、クリアは点数・好感度等の条件達成です。
      </p>
      {#if view.totals.pendingEvaluations}<p class="ops-notice">
          人物との完了会話で、攻略評価が未確定のものが {view.totals.pendingEvaluations}件あります。
        </p>{/if}
      <section class="ops-panel">
        <h2>日別の練習</h2>
        <AdminDailyChart daily="{view.daily}" />
        {#if !view.totals.started && !view.totals.completed}<p class="ops-muted">
            期間内の開始・完了記録はありません。
          </p>{/if}
        <details>
          <summary>日別の数値を確認する</summary>
          <AdminTable label="日別の利用件数">
            <table>
              <thead
                ><tr><th>日付</th><th>新規登録</th><th>開始</th><th>完了</th><th>返信</th></tr
                ></thead
              ><tbody
                >{#each view.daily as day}<tr
                    ><td class="ops-nowrap">{day.date.replaceAll('-', '/')}</td><td
                      class="ops-number">{day.registered}</td
                    ><td class="ops-number">{day.started}</td><td class="ops-number"
                      >{day.completed}</td
                    ><td class="ops-number">{day.replies}</td></tr
                  >{/each}</tbody
              >
            </table>
          </AdminTable>
        </details>
      </section>
      <div class="ops-grid">
        <section class="ops-panel">
          <h2>人物別の利用</h2>
          <AdminDistribution
            rows="{view.characters.map((c) => ({ ...c, label: adminCharacter(c.characterId) }))}"
          />
        </section>
        <section class="ops-panel">
          <h2>モード・往復数別の利用</h2>
          {#if view.modes.length}<AdminDistribution
              rows="{view.modes.map((m) => ({ ...m, label: modeLabel(m.key) }))}"
            />{:else}<p class="ops-muted">期間内の記録はありません。</p>{/if}
          <p class="ops-muted">
            開始と完了はそれぞれの日時で計上するため、期間内の件数は一致しないことがあります。
          </p>
        </section>
      </div>
      <section class="ops-panel">
        <h2>未ログイン体験（保存分）</h2>
        <p class="ops-muted">
          期間内に作成され、保持期限内にある体験の現状です。保存期間は{view.guest
            .retentionDays}日。ログインへの引き継ぎ分は上の集計と合算しません。
        </p>
        <dl class="ops-metrics">
          {#each [{ label: '体験の作成', value: view.guest.created }, { label: 'うち会話完了', value: view.guest.completed }, { label: 'うち引き継ぎ済み', value: view.guest.claimed }] as item}<div
              class="ops-metric"
            >
              <dt>{item.label}</dt>
              <dd>{item.value}<small>件</small></dd>
            </div>{/each}
        </dl>
      </section>
      <section class="ops-panel">
        <h2>利用者別の返信数</h2>
        <p class="ops-muted">期間内の上位10人。<a href="/admin/users">利用者一覧で詳細を確認</a></p>
        {#if !view.topUsers.length}<p>期間内の返信記録はありません。</p>{:else}<AdminTable
            label="利用者別の返信数"
          >
            <table>
              <thead><tr><th>利用者</th><th>返信数</th></tr></thead><tbody
                >{#each view.topUsers as person}<tr
                    ><td
                      >{adminPerson(person)}<span class="ops-sub"
                        >{person.email || 'メール未設定'}</span
                      ></td
                    ><td class="ops-number">{adminNumber(person.replies)}</td></tr
                  >{/each}</tbody
              >
            </table>
          </AdminTable>{/if}
      </section>
    {/if}
  </AdminReportState>
</div>
