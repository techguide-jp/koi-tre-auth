<script lang="ts">
  import AdminTable from '$lib/components/admin/AdminTable.svelte'
  import { onMount } from 'svelte'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { createAdminReport } from '$lib/admin-report'
  import {
    adminDate,
    adminNumber,
    adminPerson,
    type AdminAccessFilter,
    type AdminUsersView
  } from '$lib/admin-operations'
  import AdminReportState from '$lib/components/admin/AdminReportState.svelte'
  import AdminPagination from '$lib/components/admin/AdminPagination.svelte'
  import AdminUserDetail from '$lib/components/admin/AdminUserDetail.svelte'
  const report = createAdminReport<AdminUsersView>(authenticatedFetch)
  let mounted = false,
    search = '',
    appliedSearch = '',
    access: AdminAccessFilter = 'all',
    appliedAccess: AdminAccessFilter = 'all',
    page = 1,
    selectedUid = ''
  const path = (q: string, access: AdminAccessFilter, page: number) =>
    `/api/admin/users?${new URLSearchParams({ q, access, page: String(page) })}`
  $: endpoint = path(appliedSearch, appliedAccess, page)
  $: if (mounted) report.load($authReady ? ($user?.uid ?? null) : null, endpoint)
  $: if (!$user) selectedUid = ''
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
      report.destroy()
    }
  })
  function searchUsers() {
    appliedSearch = search.trim()
    appliedAccess = access
    page = 1
    report.load($user?.uid ?? null, path(appliedSearch, appliedAccess, page), true)
  }
  const retry = () => report.load($user?.uid ?? null, endpoint, true)
</script>

<svelte:head
  ><title>利用者情報 | Koi-Tre 運営管理</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>
<div class="ops">
  {#if selectedUid}
    {#key selectedUid}<AdminUserDetail
        uid="{selectedUid}"
        on:back="{() => (selectedUid = '')}"
      />{/key}
  {:else}
    <div class="ops-header">
      <div>
        <h1>利用者情報</h1>
        <p class="ops-intro">登録情報と、契約・残枠・練習の状態を確認できます。</p>
      </div>
    </div>
    {#if $user}<form class="ops-controls" on:submit|preventDefault="{searchUsers}">
        <label class="ops-search"
          >表示名・メール・UID<input
            type="search"
            bind:value="{search}"
            maxlength="100"
            placeholder="利用者を検索"
            disabled="{$report.pending}"
          /></label
        >
        <label
          >有料本編の利用権<select bind:value="{access}" disabled="{$report.pending}"
            ><option value="all">すべて</option><option value="plus">Plusあり</option><option
              value="route">人物パックあり</option
            ><option value="free">Plus・パックなし</option></select
          ></label
        >
        <button class="ops-primary" disabled="{$report.pending}" aria-busy="{$report.pending}"
          >{$report.pending ? '検索中…' : '検索・絞り込み'}</button
        >
      </form>{/if}
    <AdminReportState
      pending="{$report.pending}"
      error="{$report.error}"
      ready="{!!$report.data}"
      on:retry="{retry}"
    >
      {#if $report.data}{@const view = $report.data}
        <p class="ops-period">{adminDate(view.asOf)} 時点・最終練習は返答を保存した日時です。</p>
        {#if !view.users.length}<section class="ops-panel">
            <p>条件に合う利用者はいません。</p>
          </section>
        {:else}<AdminTable label="利用者一覧。横にスクロールできます">
            <table class="ops-wide">
              <thead
                ><tr
                  ><th>利用者</th><th>登録日時</th><th>利用権</th><th>開始</th><th>完了</th><th
                    >返信</th
                  ><th>最終練習</th></tr
                ></thead
              ><tbody>
                {#each view.users as person}<tr
                    ><td
                      ><button class="ops-link" on:click="{() => (selectedUid = person.uid)}"
                        >{adminPerson(person)}</button
                      ><span class="ops-sub">{person.email || 'メール未設定'}</span></td
                    >
                    <td>{adminDate(person.createdAt)}</td><td
                      >{#if person.plus}<span class="ops-badge">Plus</span
                        >{/if}{#if person.routePacks}<span class="ops-badge"
                          >パック {person.routePacks}人</span
                        >{/if}{#if !person.plus && !person.routePacks}<span class="ops-badge muted"
                          >Plus・パックなし</span
                        >{/if}</td
                    >
                    <td class="ops-number">{adminNumber(person.started)}</td><td class="ops-number"
                      >{adminNumber(person.completed)}</td
                    ><td class="ops-number">{adminNumber(person.replies)}</td><td
                      >{adminDate(person.lastPracticeAt)}</td
                    ></tr
                  >{/each}
              </tbody>
            </table>
          </AdminTable>{/if}
        <AdminPagination
          page="{view.page}"
          pageSize="{view.pageSize}"
          total="{view.total}"
          on:page="{(e) => (page = e.detail)}"
        />
        <p class="ops-muted">
          開始は最初の返答保存、完了は3／6往復の終了です。未送信の会話や未ログイン体験は一覧の件数に含めません。
        </p>
      {/if}
    </AdminReportState>
  {/if}
</div>
