<script lang="ts">
  export let rows: { label: string; started: number; completed: number }[]
  $: max = Math.max(1, ...rows.map((r) => r.started))
</script>

<ul class="distribution">
  {#each rows as row}<li>
      <div>
        <span>{row.label}</span><span
          ><strong>{row.started}</strong> 開始 <small>／ {row.completed} 完了</small></span
        >
      </div>
      <div class="track"><div style="width: {(row.started / max) * 100}%"></div></div>
    </li>{/each}
</ul>

<style>
  .distribution {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    margin: 1rem 0;
  }
  li > div:first-child {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: var(--text-sm);
    flex-wrap: wrap;
  }
  small {
    color: var(--muted);
  }
  .track {
    margin-top: 0.4rem;
    height: 0.4rem;
    border-radius: 10px;
    background: var(--surface-soft);
    overflow: hidden;
  }
  .track > div {
    height: 100%;
    background: #7c9e91;
    border-radius: inherit;
  }
</style>
