<script lang="ts">
  import type { AdminDailyCount } from '$lib/admin-operations'
  export let daily: AdminDailyCount[]
  let width = 700
  $: w = Math.max(300, width)
  $: max = Math.max(1, ...daily.flatMap((d) => [d.started, d.completed]))
  $: x = (index: number) => 35 + (index / Math.max(1, daily.length - 1)) * (w - 55)
  $: y = (value: number) => 168 - (value / max) * 138
  $: points = (key: 'started' | 'completed') =>
    daily.map((d, i) => `${x(i)},${y(d[key])}`).join(' ')
  $: ticks = [...new Set([0, Math.ceil(max / 2), max])]
  $: dates = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])].filter(
    (i) => i >= 0
  )
</script>

<div class="daily-chart" bind:clientWidth="{width}">
  <div class="legend"><span class="started">開始</span><span class="completed">完了</span></div>
  <svg
    viewBox="0 0 {w} 205"
    role="img"
    aria-label="日別の練習開始・完了件数。下の一覧で数値も確認できます。"
  >
    {#each ticks as tick}<line x1="35" x2="{w - 20}" y1="{y(tick)}" y2="{y(tick)}" stroke="#e5e7eb"
      ></line><text x="27" y="{y(tick) + 4}" text-anchor="end">{tick}</text>{/each}
    <polyline points="{points('started')}" fill="none" stroke="#537cb7" stroke-width="2.5"
    ></polyline>
    <polyline points="{points('completed')}" fill="none" stroke="#568276" stroke-width="2.5"
    ></polyline>
    {#each dates as i}<text
        x="{x(i)}"
        y="192"
        text-anchor="{i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}"
        >{daily[i].date.slice(5).replace('-', '/')}</text
      >{/each}
  </svg>
</div>

<style>
  .daily-chart {
    width: 100%;
    min-width: 0;
  }
  svg {
    width: 100%;
    display: block;
    overflow: visible;
  }
  text {
    font: 12px sans-serif;
    fill: #6b7280;
  }
  .legend {
    display: flex;
    gap: 1.2rem;
    font-size: var(--text-sm);
  }
  .legend span::before {
    content: '';
    display: inline-block;
    width: 0.8rem;
    height: 0.2rem;
    margin-right: 0.4rem;
    vertical-align: middle;
  }
  .started::before {
    background: #537cb7;
  }
  .completed::before {
    background: #568276;
  }
</style>
