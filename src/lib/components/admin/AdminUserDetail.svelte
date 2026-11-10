<script lang="ts">
  import AdminTable from '$lib/components/admin/AdminTable.svelte'
  import { onMount, createEventDispatcher } from 'svelte'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { createAdminReport } from '$lib/admin-report'
  import {
    adminDate,
    adminNumber,
    adminPerson,
    adminCharacter,
    adminCreditKind,
    adminContractStatus,
    type AdminUserDetailView
  } from '$lib/admin-operations'
  import { characters, episodeById } from '$lib/adventure'
  import AdminReportState from './AdminReportState.svelte'
  export let uid: string
  const dispatch = createEventDispatcher<{ back: void }>()
  const report = createAdminReport<AdminUserDetailView>(authenticatedFetch)
  let mounted = false
  $: endpoint = `/api/admin/users/${encodeURIComponent(uid)}`
  $: if (mounted) report.load($authReady ? ($user?.uid ?? null) : null, endpoint)
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
      report.destroy()
    }
  })
  const retry = () => report.load($user?.uid ?? null, endpoint, true)
</script>

<button class="ops-link" on:click="{() => dispatch('back')}">← 利用者一覧に戻る</button>
<AdminReportState
  pending="{$report.pending}"
  error="{$report.error}"
  ready="{!!$report.data}"
  on:retry="{retry}"
>
  {#if $report.data}{@const view = $report.data}
    <div class="ops-header">
      <div>
        <h1>{adminPerson(view.user)}</h1>
        <p class="ops-intro">{view.user.email || 'メール未設定'}</p>
      </div>
      <p class="ops-period">{adminDate(view.asOf)} 時点</p>
    </div>
    <section class="ops-panel">
      <h2>利用者の情報</h2>
      <dl class="ops-facts">
        <div>
          <dt>UID</dt>
          <dd>{view.user.uid}</dd>
        </div>
        <div>
          <dt>登録日時</dt>
          <dd>{adminDate(view.user.createdAt)}</dd>
        </div>
        <div>
          <dt>最終練習</dt>
          <dd>{adminDate(view.user.lastPracticeAt)}</dd>
        </div>
        <div>
          <dt>利用権</dt>
          <dd>
            {view.billing.subscription?.active ? 'Plus利用中' : 'Plusなし'}・人物パック {view
              .billing.ownedCharacters.length}人
          </dd>
        </div>
      </dl>
    </section>
    <dl class="ops-metrics">
      {#each [{ label: '練習開始', value: view.user.started, unit: '件' }, { label: '会話完了', value: view.user.completed, unit: '件' }, { label: '返信を保存', value: view.user.replies, unit: '回' }, { label: '獲得XP', value: view.activity.xp, unit: 'XP' }] as item}<div
          class="ops-metric"
        >
          <dt>{item.label}</dt>
          <dd>{adminNumber(item.value)}<small>{item.unit}</small></dd>
        </div>{/each}
    </dl>
    <div class="ops-grid">
      <section class="ops-panel">
        <h2>契約・購入権</h2>
        {#if view.billing.subscription}{@const contract = view.billing.subscription}
          <dl class="ops-facts">
            <div>
              <dt>Plusの契約状態</dt>
              <dd>{adminContractStatus(contract.status)}</dd>
            </div>
            <div>
              <dt>現在の利用権</dt>
              <dd>{contract.active ? '有効' : '有効な支払期間なし'}</dd>
            </div>
            <div>
              <dt>記録済みの利用期間</dt>
              <dd>{adminDate(contract.periodStart)} 〜 {adminDate(contract.periodEnd)}</dd>
            </div>
            <div>
              <dt>解約予約</dt>
              <dd>{contract.cancelAtPeriodEnd ? '期間末で終了予定' : 'なし'}</dd>
            </div>
          </dl>
        {:else}<p>Plus契約の記録はありません。</p>{/if}
        <h3>購入済みの人物パック</h3>
        <p>
          {view.billing.ownedCharacters.length
            ? view.billing.ownedCharacters.map(adminCharacter).join('、')
            : 'なし'}
        </p>
      </section>
      <section class="ops-panel">
        <h2>現在の利用枠</h2>
        <dl class="ops-facts">
          <div>
            <dt>共通枠の残り</dt>
            <dd>
              {view.billing.credits
                .filter((g) => g.kind !== 'route')
                .reduce((n, g) => n + g.remaining, 0)}枠
            </dd>
          </div>
          <div>
            <dt>人物専用枠の残り</dt>
            <dd>
              {view.billing.credits
                .filter((g) => g.kind === 'route')
                .reduce((n, g) => n + g.remaining, 0)}枠
            </dd>
          </div>
          <div>
            <dt>生成中の予約</dt>
            <dd>{view.billing.reserved}枠</dd>
          </div>
          <div>
            <dt>次の共通枠更新</dt>
            <dd>{adminDate(view.billing.resetsAt)}</dd>
          </div>
        </dl>
        <p class="ops-muted">
          生成中の予約は残枠から除外済み。人物専用枠は対象人物の本編で使えます。
        </p>
      </section>
    </div>
    <AdminTable label="利用枠の内訳">
      <table>
        <thead><tr><th>枠の種類</th><th>対象</th><th>残り／付与枠</th><th>有効期限</th></tr></thead
        ><tbody
          >{#each view.billing.credits as grant}<tr
              ><td>{adminCreditKind(grant.kind)}</td><td
                >{grant.characterId ? adminCharacter(grant.characterId) : '全員共通'}</td
              ><td>{grant.remaining} ／ {grant.units}枠</td><td
                >{grant.expiresAt ? adminDate(grant.expiresAt) : '期限なし'}</td
              ></tr
            >{/each}</tbody
        >
      </table>
    </AdminTable>
    <section class="ops-panel">
      <h2>人物別の進行・好感度</h2>
      <div class="ops-grid">
        {#each characters as character}{@const relationship = view.progression.relationships.find(
            (r) => r.characterId === character.id
          )}{@const clears = view.progression.achievements.filter(
            (a) => a.characterId === character.id && a.cleared && episodeById(a.episodeId)?.chapter
          ).length}
          <div>
            <h3>{character.name} <span class="ops-badge">{clears} ／ 12話クリア</span></h3>
            <p>{relationship?.affinity ?? 0} ／ 100・{relationship?.label ?? '知り合ったばかり'}</p>
            <meter
              min="0"
              max="100"
              value="{relationship?.affinity ?? 0}"
              aria-label="{character.name}の好感度"
            ></meter>
          </div>{/each}
      </div>
      <p class="ops-muted">
        保存済みの進行を表示しています。閲覧による採点や好感度の変更はありません。
      </p>
    </section>
    <section>
      <h2>最近の会話</h2>
      {#if !view.history.length}<p>会話の記録はありません。</p>{:else}<AdminTable
          label="最近の会話。横にスクロールできます"
        >
          <table class="ops-wide">
            <thead
              ><tr
                ><th>開始・作成日時</th><th>場面</th><th>進行</th><th>消費枠</th><th>攻略評価</th
                ><th>XP</th></tr
              ></thead
            ><tbody
              >{#each view.history as item}<tr
                  ><td>{adminDate(item.chargedAt ?? item.createdAt)}</td><td
                    >{item.characterId
                      ? adminCharacter(item.characterId)
                      : item.sceneId === 'custom'
                        ? 'カスタム'
                        : '共通練習'}<span class="ops-sub"
                      >{item.episodeId
                        ? (episodeById(item.episodeId)?.title ?? item.episodeId)
                        : ''}</span
                    ></td
                  ><td
                    >{item.completedAt ? '会話完了' : item.chargedAt ? '途中' : '未送信'}<span
                      class="ops-sub">{item.replied} ／ {item.turns}往復</span
                    ></td
                  ><td>{item.chargedAt ? `${item.creditCost}枠` : '未確定'}</td><td
                    >{item.evaluation === 'pending' ||
                    (item.characterId && item.completedAt && !item.evaluation)
                      ? '評価待ち'
                      : item.evaluation
                        ? `${item.score ?? '未記録'} / 25・${item.evaluation === 'passed' ? '基準達成' : '未達'}`
                        : '対象外'}</td
                  ><td>{item.xp}</td></tr
                >{/each}</tbody
            >
          </table>
        </AdminTable>{/if}
      {#if view.historyHasMore}<p class="ops-muted">新しい20件を表示しています。</p>{/if}
      <p class="ops-muted">
        未送信の会話 {view.activity.drafts}件。旧形式のやりとり {view.activity
          .legacyReplies}回は、現在の練習件数とは別です。
      </p>
    </section>
  {/if}
</AdminReportState>

<style>
  meter {
    width: 100%;
    height: 0.8rem;
  }
</style>
