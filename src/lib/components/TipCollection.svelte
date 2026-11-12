<script lang="ts">
  import { onMount } from 'svelte'
  import { authenticatedFetch } from '$lib/stores'
  import {
    practiceTipById,
    practiceTips,
    tipGroups,
    tipRatingLabel,
    type CollectedTip,
    type TipGroup,
    type TipRating
  } from '$lib/practice-tips'
  import TipCollectionRating from './TipCollectionRating.svelte'

  export let full = false
  let collected: CollectedTip[] | null = null
  let loading = false
  let errorMessage = ''
  let activeTip = ''
  let groupFilter: TipGroup | '' = ''
  let search = ''
  const total = practiceTips.length
  const themes = (Object.keys(tipGroups) as TipGroup[]).map((id) => ({
    id,
    label: tipGroups[id],
    total: practiceTips.filter((tip) => tip.group === id).length
  }))
  $: entries = (collected ?? []).flatMap((entry) => {
    const tip = practiceTipById(entry.tipId)
    return tip ? [{ ...entry, tip }] : []
  })
  $: counts = themes.map((theme) => ({
    ...theme,
    count: entries.filter(({ tip }) => tip.group === theme.id).length
  }))
  $: percent = Math.floor((100 * entries.length) / total)
  $: nextMilestone = Math.min(total, (Math.floor(entries.length / 10) + 1) * 10)
  $: query = search.trim().toLocaleLowerCase('ja')
  $: visible = entries.filter(
    ({ tip }) =>
      (!groupFilter || tip.group === groupFilter) &&
      [tip.title, tip.tip, tip.example].some((value) =>
        value.toLocaleLowerCase('ja').includes(query)
      )
  )

  onMount(() => {
    void load()
  })

  async function load() {
    if (loading) return
    loading = true
    errorMessage = ''
    try {
      const response = await authenticatedFetch('/api/me/tips')
      collected = await response.json()
    } catch {
      errorMessage = 'Tipsコレクションを読み込めませんでした。'
    } finally {
      loading = false
    }
  }

  function updateRating(tipId: string, rating: TipRating | null) {
    if (collected)
      collected = collected.map((entry) => (entry.tipId === tipId ? { ...entry, rating } : entry))
  }
</script>

<section class="tip-progress" aria-label="Tipsの収集状況">
  <div class="progress-heading">
    <h2>{full ? 'Tipsの収集率' : 'Tipsコレクション'}</h2>
    {#if !full}<a href="/account/tips">集めたTipsを見る →</a>{/if}
  </div>
  {#if collected}
    <div class="progress-count">
      <strong>{entries.length}<span> / {total}件</span></strong>
      <span>{percent}%</span>
    </div>
    <progress aria-label="Tipsの収集率" max="{total}" value="{entries.length}"></progress>
    <p>
      {#if entries.length === total}
        全{total}件コンプリート！
      {:else if entries.length === 0}
        練習の最後に出会ったヒントが、ここに集まります。
      {:else}
        次の節目の{nextMilestone}件まで、あと{nextMilestone - entries.length}件
      {/if}
    </p>
  {:else if errorMessage}
    <p role="alert">{errorMessage}</p>
    <button class="button secondary" type="button" on:click="{load}">読み直す</button>
  {:else}
    <p role="status">集めたTipsを読み込んでいます…</p>
  {/if}
</section>

{#if full && collected}
  <section class="tip-themes" aria-label="テーマ別の収集状況">
    <h2>テーマ別の進み具合</h2>
    <ul>
      {#each counts as theme (theme.id)}
        <li class:complete="{theme.count === theme.total}">
          <span>{theme.label}</span>
          <strong>{theme.count} / {theme.total}</strong>
        </li>
      {/each}
    </ul>
  </section>
  <section class="tip-list" aria-label="集めたTips">
    <h2>集めたTips</h2>
    {#if entries.length}
      <div class="filters">
        <label
          >キーワード<input
            type="search"
            bind:value="{search}"
            placeholder="例：話題、約束"
          /></label
        >
        <label
          >テーマ<select bind:value="{groupFilter}">
            <option value="">すべてのテーマ</option>
            {#each counts.filter((theme) => theme.count) as theme (theme.id)}
              <option value="{theme.id}">{theme.label}</option>
            {/each}
          </select></label
        >
      </div>
      {#if visible.length === 0}<p>条件に合うTipsはありません。</p>{/if}
      <div class="entries">
        {#each visible as entry (entry.tipId)}
          <article>
            <button
              class="tip-trigger"
              type="button"
              aria-expanded="{activeTip === entry.tipId}"
              on:click="{() => (activeTip = activeTip === entry.tipId ? '' : entry.tipId)}"
            >
              <span>
                <small>{tipGroups[entry.tip.group]}</small>
                <strong>{entry.tip.title}</strong>
              </span>
              <span class="rating">
                {entry.rating ? tipRatingLabel(entry.rating.value) : '未評価'}
                <span aria-hidden="true">{activeTip === entry.tipId ? '−' : '+'}</span>
              </span>
            </button>
            {#if activeTip === entry.tipId}
              <TipCollectionRating
                tip="{entry.tip}"
                onRating="{(rating) => updateRating(entry.tipId, rating)}"
              />
            {/if}
          </article>
        {/each}
      </div>
    {:else}
      <p>最初のTipsを集めに行きましょう。</p>
      <a class="button primary" href="/#scenes">練習する</a>
    {/if}
  </section>
{/if}

<style>
  section {
    display: grid;
    gap: 12px;
    padding: clamp(14px, 3vw, 23px);
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
  }

  .tip-progress {
    background: linear-gradient(115deg, #fffaf9, #fff3f5);
  }

  h2,
  p,
  ul {
    margin: 0;
  }

  h2 {
    font-size: var(--text-lg, 1.2rem);
  }

  p {
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .progress-heading,
  .progress-count {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 12px;
  }

  .progress-heading a {
    font-size: var(--text-sm);
  }

  .progress-count {
    color: var(--accent);
    font-weight: 700;
  }

  .progress-count strong {
    font-size: 1.85rem;
    line-height: 1.1;
  }

  .progress-count strong span {
    color: var(--muted);
    font-size: var(--text-sm);
  }

  progress {
    width: 100%;
    height: 11px;
    accent-color: var(--accent);
    border: 0;
    border-radius: 999px;
    background: #eedce2;
    overflow: hidden;
  }

  progress::-webkit-progress-bar {
    background: #eedce2;
  }
  progress::-webkit-progress-value {
    background: var(--accent);
  }
  progress::-moz-progress-bar {
    background: var(--accent);
  }

  ul {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 7px 10px;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    border-radius: 8px;
    background: #faf4f4;
    font-size: var(--text-xs);
  }

  li strong {
    flex-shrink: 0;
    color: var(--muted);
  }

  li.complete {
    background: #f7e6ed;
  }

  li.complete strong {
    color: var(--accent);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .filters label {
    display: grid;
    gap: 4px;
    flex: 1 1 185px;
    font-size: var(--text-xs);
  }

  input,
  select {
    box-sizing: border-box;
    min-width: 0;
    min-height: 44px;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
  }

  .entries {
    display: grid;
    gap: 8px;
  }

  article {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .tip-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: 0;
    padding: 10px 12px;
    background: transparent;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    font: inherit;
  }

  .tip-trigger:hover,
  .tip-trigger[aria-expanded='true'] {
    background: #fdf4f6;
  }

  .tip-trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }

  .tip-trigger small,
  .tip-trigger strong {
    display: block;
  }

  .tip-trigger small {
    color: var(--muted);
    font-size: var(--text-xs);
  }

  .rating {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 8px;
    color: var(--accent);
    font-size: var(--text-xs);
  }

  .rating span {
    font-size: 1rem;
  }

  .button {
    justify-self: start;
  }
</style>
