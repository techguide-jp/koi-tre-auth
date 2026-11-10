<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { adminNumber } from '$lib/admin-operations'
  export let page: number
  export let pageSize: number
  export let total: number
  export let pending = false
  const dispatch = createEventDispatcher<{ page: number }>()
</script>

<nav class="ops-pagination" aria-label="一覧のページ">
  <p>
    {total === 0
      ? '0件'
      : (page - 1) * pageSize >= total
        ? `全${adminNumber(total)}件・このページは0件`
        : `${adminNumber((page - 1) * pageSize + 1)}〜${adminNumber(Math.min(page * pageSize, total))} / ${adminNumber(total)}件`}
  </p>
  <div>
    <button disabled="{pending || page <= 1}" on:click="{() => dispatch('page', page - 1)}"
      >前へ</button
    >
    <span>{page}ページ</span><button
      disabled="{pending || page * pageSize >= total}"
      on:click="{() => dispatch('page', page + 1)}">次へ</button
    >
  </div>
</nav>
