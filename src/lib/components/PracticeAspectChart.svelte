<script lang="ts">
  import {
    analysisAspects,
    assessmentLabel,
    assessmentStatus,
    assessmentValue,
    type PracticeAnalysis
  } from '$lib/practice'
  import { createRadarGeometry } from '$lib/practice-radar'

  export let analysis: PracticeAnalysis
  $: rows = analysisAspects.map(({ id, label }) => {
    const assessment = analysis.assessment?.aspects.find((item) => item.id === id)
    const score = assessmentValue(assessment)
    return {
      id,
      label,
      score,
      mode: assessmentStatus(assessment),
      status: assessment ? assessmentLabel(assessment) : '未評価',
      detail: analysis.aspects.find((item) => item.id === id)
    }
  })
  $: evaluated = rows.filter(({ score }) => score !== null).length
  $: radar = createRadarGeometry(rows.map(({ score }) => score))
  const labelLines = [
    ['受け止め・共感'],
    ['自分の', '伝え方'],
    ['質問の', '答えやすさ'],
    ['話題の', 'つながり'],
    ['距離感・', '配慮']
  ]
  const labelPositions = [
    { x: 50, y: 5 },
    { x: 90, y: 36 },
    { x: 75, y: 86 },
    { x: 25, y: 86 },
    { x: 10, y: 36 }
  ]
</script>

<section class="aspect-chart" aria-labelledby="analysis-aspects">
  <div class="chart-heading">
    <div>
      <p class="eyebrow">今回の会話の傾向</p>
      <h3 id="analysis-aspects">5つの観点をひと目で</h3>
    </div>
    <span class="coverage">今回の目安 <strong>{evaluated}</strong><span> / 5</span></span>
  </div>

  <div class="radar-layout">
    <div class="radar-panel">
      <div
        class="radar"
        data-radar-state="{radar.polygon ? 'complete' : evaluated ? 'partial' : 'unavailable'}"
      >
        <svg
          viewBox="0 0 320 280"
          role="img"
          aria-label="{`5観点のレーダーチャート。${evaluated}項目の目安を表示。外側ほど、その観点がよくできています。`}"
        >
          <desc
            >{rows
              .map(
                (row) => `${row.label}：${row.status}${row.mode === 'reference' ? '（参考）' : ''}`
              )
              .join('。')}</desc
          >
          <polygon class="radar-background" points="{radar.rings[2]}"></polygon>
          {#each radar.rings as ring}
            <polygon class="radar-grid" points="{ring}"></polygon>
          {/each}
          {#each radar.axes as axis, index}
            <line
              class="radar-axis"
              class:pending="{rows[index].score === null}"
              x1="{radar.center.x}"
              y1="{radar.center.y}"
              x2="{axis.x}"
              y2="{axis.y}"
            ></line>
          {/each}
          {#if radar.polygon}
            <polygon class="radar-area" points="{radar.polygon}"></polygon>
          {:else}
            {#each radar.segments as segment}
              <polyline class="radar-line" class:gap="{segment.gap}" points="{segment.points}"
              ></polyline>
            {/each}
          {/if}
          {#each radar.vertices as vertex, index}
            {#if vertex}<circle
                class="radar-point"
                class:reference="{rows[index].mode === 'reference'}"
                cx="{vertex.x}"
                cy="{vertex.y}"
                r="4.5"
              ></circle>{/if}
          {/each}
        </svg>
        {#each rows as row, index}
          <span
            class="radar-label"
            class:pending="{row.score === null}"
            style:left="{`${labelPositions[index].x}%`}"
            style:top="{`${labelPositions[index].y}%`}"
            aria-hidden="true"
          >
            {#each labelLines[index] as line}<span>{line}</span>{/each}
            {#if row.score === null}<small
                >{row.mode === 'insufficient' ? '材料不足' : row.status}</small
              >{/if}
          </span>
        {/each}
      </div>
      <p class="radar-guide">外側ほど、その観点がよくできています。</p>
    </div>
    <div class="chart-rows">
      {#each rows as row}
        <details class="aspect-row" data-assessment="{row.mode}">
          <summary>
            <span class="aspect-label">{row.label}</span>
            <span class="assessment-label" class:muted="{row.score === null}">
              {row.status}
              {#if row.mode === 'reference'}<span class="reference-badge">参考</span>{/if}
            </span>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          {#if row.detail}
            <div class="aspect-detail">
              {#if row.mode === 'reference'}
                <p class="rating-note">評価する段階に幅があるため、参考値として表示しています。</p>
              {:else if row.mode === 'insufficient'}
                <p class="rating-note">
                  この観点を判断する発言や機会が足りないため、点を表示していません。
                </p>
              {:else if row.mode === 'uncertain'}
                <p class="rating-note">
                  評価の幅が大きいため、平均の点は表示せず、会話の解説を確認できます。
                </p>
              {/if}
              <p>{row.detail.observation}</p>
              {#each row.detail.evidence as evidence}
                <blockquote><span>{evidence.turn}回目の発言</span>「{evidence.quote}」</blockquote>
              {/each}
            </div>
          {/if}
        </details>
      {/each}
    </div>
  </div>
  <p class="chart-note">
    {analysis.assessment
      ? '白抜き点は参考値、点線は未評価の軸をまたぐ補助線です。未評価の項目に点は置きません。'
      : '今回は観点別の目安は未評価です。各観点を開くと、会話に基づく解説を読めます。'}
  </p>
  <p class="detail-hint">各観点をタップすると、解説と根拠の発言を確認できます。</p>
</section>

<style>
  .aspect-chart {
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #fff;
  }
  .chart-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .eyebrow {
    margin: 0 0 0.35rem;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    color: #526746;
    font-weight: 600;
  }
  h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .coverage {
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--muted);
  }
  .coverage strong {
    color: var(--ink);
    font-size: 1.25rem;
    margin-left: 0.35rem;
  }
  .radar {
    position: relative;
    width: 100%;
    max-width: 410px;
    aspect-ratio: 320 / 280;
    margin: 1.2rem auto 0;
  }
  .radar svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .radar-grid {
    fill: none;
    stroke: #d9dfd3;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .radar-background {
    fill: #f8faf5;
  }
  .radar-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 1.2rem;
    align-items: center;
    margin-top: 1rem;
  }
  .radar-axis {
    stroke: #cbd3c4;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .radar-axis.pending {
    stroke-dasharray: 4 4;
  }
  .radar-area {
    fill: #718562;
    fill-opacity: 0.2;
    stroke: #718562;
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }
  .radar-line {
    fill: none;
    stroke: #718562;
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }
  .radar-point {
    fill: #60764f;
    stroke: #fff;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .radar-point.reference {
    fill: #fff;
    stroke: #60764f;
  }
  .radar-line.gap {
    stroke-dasharray: 2 4;
  }
  .reference-badge {
    border: 1px solid #8a997c;
    border-radius: 4px;
    padding: 0.1rem 0.3rem;
    color: #526746;
    font-size: 0.65rem;
    flex-shrink: 0;
    margin-left: 0.3rem;
  }
  .rating-note {
    color: #526746;
    font-size: 0.75rem;
  }
  .radar-label {
    position: absolute;
    transform: translate(-50%, -50%);
    width: max-content;
    max-width: 100px;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.5;
    color: #435b37;
  }
  .radar-label > span {
    display: block;
  }
  .radar-label.pending {
    color: var(--muted);
  }
  .radar-label small {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.65rem;
    font-weight: 400;
  }
  .radar-guide {
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted);
    margin: 0.3rem 0 1rem;
  }
  .aspect-row {
    border-top: 1px solid #eeece7;
  }
  summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 0.65rem;
    gap: 0.75rem;
    align-items: center;
    min-height: 46px;
    cursor: pointer;
    list-style: none;
    border-radius: 5px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .aspect-label {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .assessment-label {
    text-align: right;
    font-size: 0.7rem;
    color: #435b37;
    font-weight: 600;
  }
  .assessment-label.muted {
    color: var(--muted);
    font-weight: 400;
  }
  .chevron {
    color: var(--muted);
    text-align: center;
  }
  details[open] .chevron {
    transform: rotate(180deg);
  }
  .aspect-detail {
    padding: 0 0 1rem;
  }
  .aspect-detail p {
    margin: 0.2rem 0 0.7rem;
    font-size: 0.85rem;
    line-height: 1.85;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  blockquote {
    margin: 0.6rem 0 0;
    padding: 0.8rem;
    border-radius: 5px;
    background: #f7f5f0;
    font-size: 0.8rem;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  blockquote span {
    display: block;
    font-size: 0.7rem;
    color: var(--muted);
    margin-bottom: 0.25rem;
  }
  .chart-note {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    margin: 0.75rem 0 0;
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.6;
  }
  .detail-hint {
    margin: 0.4rem 0 0;
    font-size: 0.75rem;
    color: var(--muted);
  }
  @media (max-width: 550px) {
    .radar-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.3rem;
      margin-top: 0.4rem;
    }
    .aspect-chart {
      padding: 1rem;
    }
    .chart-heading {
      gap: 0.5rem;
    }
    h3 {
      font-size: 1rem;
    }
    .coverage {
      font-size: 0.75rem;
    }
    .radar-label {
      font-size: 0.75rem;
      max-width: 88px;
    }
    summary {
      grid-template-columns: minmax(0, 1fr) auto 0.6rem;
      gap: 0.45rem 0.65rem;
      padding: 0.7rem 0;
    }
    .aspect-label {
      grid-column: 1;
      grid-row: 1;
      font-size: 0.85rem;
    }
    .assessment-label {
      grid-column: 2;
      grid-row: 1;
      font-size: 0.75rem;
    }
    .chevron {
      grid-column: 3;
      grid-row: 1;
    }
  }
</style>
