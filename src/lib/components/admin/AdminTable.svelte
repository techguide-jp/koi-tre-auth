<script lang="ts">
  export let label: string
</script>

<!-- 横スクロールの表をキーボードでも操作できるようフォーカス可能にする。 -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div class="ops-table" role="region" tabindex="0" aria-label="{label}"><slot /></div>
