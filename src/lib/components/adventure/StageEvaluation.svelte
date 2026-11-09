<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import type { PracticeSession } from '$lib/practice'
  import { authenticatedFetch } from '$lib/stores'
  export let session: PracticeSession
  export let cleared = false
  export let enabled = true
  const dispatch = createEventDispatcher<{ update: PracticeSession }>()
  let busy = false,
    message = '',
    alive = false
  let timer: ReturnType<typeof setTimeout> | undefined
  $: evaluation = session.evaluation
  $: delta = evaluation ? evaluation.affinityAfter - evaluation.affinityBefore : 0
  $: scoreGap =
    evaluation?.score === null || !evaluation
      ? 0
      : Math.max(0, evaluation.requiredScore - evaluation.score)
  $: considerationGap =
    evaluation?.consideration === null || !evaluation
      ? 0
      : Math.max(0, evaluation.requiredConsideration - evaluation.consideration)
  onMount(() => {
    alive = true
    if (evaluation?.pending) void refresh()
  })
  onDestroy(() => {
    alive = false
    clearTimeout(timer)
  })
  async function refresh() {
    try {
      const response = await authenticatedFetch(`/api/me/practices/${session.id}`)
      const value: PracticeSession = await response.json()
      if (!alive) return
      dispatch('update', value)
      if (value.evaluation?.pending) timer = setTimeout(refresh, 1500)
      else busy = false
    } catch {
      if (alive) {
        busy = false
        message = '評価の状態を確認できませんでした。再読み込みしてください。'
      }
    }
  }
  async function retry() {
    if (busy || evaluation?.pending) return
    busy = true
    message = ''
    try {
      const response = await authenticatedFetch(`/api/me/practices/${session.id}/assessment`, {
        method: 'POST',
        body: '{}'
      })
      const value: PracticeSession = await response.json()
      if (!alive) return
      dispatch('update', value)
      if (value.evaluation?.pending) timer = setTimeout(refresh, 1500)
      else {
        busy = false
        if (value.evaluation?.status === 'pending')
          message = 'まだ判定できない観点があります。会話と利用枠はそのままです。'
      }
    } catch (e) {
      if (alive) {
        busy = false
        message = e instanceof Error ? e.message : '再評価できませんでした。'
        void refresh()
      }
    }
  }
</script>

<section
  class="evaluation"
  class:passed="{evaluation?.status === 'passed'}"
  aria-label="今回のクリア判定と好感度"
>
  <div class="result-heading">
    <div>
      <p class="eyebrow">今回の達成</p>
      <h3>
        {evaluation?.status === 'passed'
          ? '✦ 合格点を達成！'
          : evaluation?.status === 'failed'
            ? 'あと一歩。次に試してみよう'
            : '評価を確認しています'}
      </h3>
    </div>
    <strong>{evaluation?.score?.toFixed(1) ?? '—'}<small> / 25点</small></strong>
  </div>
  {#if evaluation && evaluation.status !== 'pending'}
    <p class="criteria">
      目標 {evaluation.requiredScore}点 · 距離感・配慮 {evaluation.requiredConsideration}点以上
    </p>
    {#if evaluation.status === 'failed'}<p>
        {#if scoreGap > 0}目標まであと{scoreGap.toFixed(
            1
          )}点。{/if}{#if considerationGap > 0}配慮はあと{considerationGap.toFixed(
            1
          )}点。{/if}{cleared
          ? 'この話のクリアは保持されています。'
          : '振り返りをヒントに、違う言葉で挑戦できます。'}
      </p>{/if}
    <div class="affinity-change">
      <span>♡ 好感度</span><strong>{delta > 0 ? '+' : ''}{delta}</strong><span
        >{evaluation.affinityBefore} → {evaluation.affinityAfter}</span
      >
    </div>
    <p class="small">
      {evaluation.earnedDelta > 0
        ? 'この場面で、これまでより関係が深まりました。'
        : ''}{evaluation.strainDelta < 0
        ? '気持ちを受け止める会話で、すれ違いがやわらぎました。'
        : evaluation.strainDelta > 0
          ? '相手が選べる言い方を、次の会話で試してみましょう。'
          : evaluation.earnedDelta === 0
            ? '同じ場面は、より良い評価や6往復で好感度が増えます。'
            : ''}
    </p>
  {:else}
    <p>
      採点できない観点や旧基準の評価があるため、クリア判定と好感度は保留です。0点や不合格にはしません。
    </p>
    <button
      class="button secondary"
      disabled="{!enabled || busy || !!evaluation?.pending}"
      aria-busy="{busy || !!evaluation?.pending}"
      on:click="{retry}"
      >{busy || evaluation?.pending ? '保存した会話を再評価中…' : 'この会話を再評価する'}</button
    >
    <p class="small">利用枠は消費しません。会話・XP・獲得したカードは残ります。</p>
  {/if}
  {#if message}<p class="small" role="status">{message}</p>{/if}
</section>

<style>
  .evaluation {
    margin: 24px 0;
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: #fbf8f0;
  }
  .evaluation.passed {
    border-color: #a7af8a;
    background: linear-gradient(125deg, #f0f3e5, #fbf8ef);
  }
  .result-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }
  .result-heading .eyebrow {
    margin: 0 0 8px;
  }
  .result-heading h3 {
    font-size: 1.1rem;
    margin: 0;
  }
  .result-heading > strong {
    font-size: 2rem;
    color: var(--accent);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: var(--text-sm);
    font-weight: 400;
  }
  p {
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  .criteria {
    color: var(--muted);
  }
  .affinity-change {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-top: 16px;
    border-top: 1px solid #ded6c7;
    color: #99594e;
    font-size: var(--text-sm);
  }
  .affinity-change strong {
    font-size: 1.5rem;
  }
  .small {
    font-size: var(--text-sm);
    color: var(--muted);
  }
  @media (max-width: 480px) {
    .evaluation {
      padding: 18px;
    }
    .result-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }
  }
</style>
