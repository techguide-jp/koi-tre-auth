<script lang="ts">
  import { onMount } from 'svelte'
  import { authenticatedFetch } from '$lib/stores'
  import {
    tipRatingLabel,
    type PracticeTip,
    type TipRating,
    type TipSelfRating
  } from '$lib/practice-tips'
  import TipRatingChoices from './TipRatingChoices.svelte'

  export let tip: PracticeTip
  export let onRating: (rating: TipRating | null) => void
  let ratings: TipRating[] | null = null
  let loading = false
  let saving: TipSelfRating | null = null
  let message = ''
  let failure = ''
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  onMount(() => {
    void load()
  })

  async function load() {
    loading = true
    failure = ''
    try {
      const response = await authenticatedFetch(`/api/me/tips/${tip.id}`)
      ratings = (await response.json()) as TipRating[]
      onRating(ratings[0] ?? null)
    } catch {
      failure = '自己評価の履歴を読み込めませんでした。'
    } finally {
      loading = false
    }
  }

  async function choose(value: TipSelfRating) {
    if (!ratings || saving || loading || ratings[0]?.value === value) return
    saving = value
    message = ''
    failure = ''
    try {
      const response = await authenticatedFetch(`/api/me/tips/${tip.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ value, revision: ratings[0]?.id ?? null })
      })
      const rating: TipRating = await response.json()
      ratings = [rating, ...ratings.filter(({ id }) => id !== rating.id)]
      onRating(rating)
      message = '自己評価を保存しました。'
    } catch (error) {
      await load()
      failure = error instanceof Error ? error.message : '自己評価を保存できませんでした。'
    } finally {
      saving = null
    }
  }
</script>

<div class="tip-detail">
  <p>{tip.tip}</p>
  <blockquote>「{tip.example}」</blockquote>
  {#if loading}
    <p role="status">自己評価の履歴を読み込んでいます…</p>
  {/if}
  {#if failure}
    <p class="error" role="alert">{failure}</p>
  {/if}
  {#if ratings && !loading}
    <TipRatingChoices
      prompt="{tip.prompt}"
      selected="{ratings[0]?.value}"
      saving="{saving}"
      choose="{choose}"
    />
    {#if message}<p class="saved" role="status">{message}</p>{/if}
    <h3>自己評価の推移</h3>
    {#if ratings.length}
      <ol aria-label="自己評価の推移">
        {#each ratings as rating, index (rating.id)}
          <li>
            <time datetime="{rating.ratedAt}">{formatter.format(new Date(rating.ratedAt))}</time>
            <strong>{tipRatingLabel(rating.value)}</strong>
            {#if index === 0}<span>最新</span>{/if}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="muted">自己評価を選ぶと、ここに記録されます。</p>
    {/if}
  {:else if failure && !loading}
    <button class="button secondary" type="button" on:click="{load}">履歴を読み直す</button>
  {/if}
</div>

<style>
  .tip-detail {
    display: grid;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--border);
  }

  p,
  h3,
  blockquote,
  ol {
    margin: 0;
  }

  blockquote {
    padding: 10px 12px;
    border-radius: 10px;
    background: #faf0f2;
    font-size: var(--text-sm);
  }

  h3 {
    font-size: var(--text-sm);
  }

  ol {
    display: grid;
    gap: 8px;
    padding-left: 14px;
    border-left: 2px solid #eed8df;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    font-size: var(--text-sm);
  }

  li span,
  time,
  .muted {
    color: var(--muted);
    font-size: var(--text-xs);
  }

  .saved {
    color: var(--accent);
    font-size: var(--text-sm);
  }
</style>
