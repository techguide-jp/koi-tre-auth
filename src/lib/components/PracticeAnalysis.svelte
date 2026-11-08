<script lang="ts">
  import type { PracticeAnalysis } from '$lib/practice'
  import PracticeAspectChart from './PracticeAspectChart.svelte'
  export let analysis: PracticeAnalysis
</script>

<div class="analysis">
  <PracticeAspectChart analysis="{analysis}" />

  <section class="next-practice" aria-labelledby="analysis-next">
    <span class="next-icon" aria-hidden="true">↗</span>
    <div>
      <h3 id="analysis-next">次の練習は、これを意識</h3>
      <p>{analysis.nextPractice.goal}</p>
      <details class="example">
        <summary>試してみるひと言 <span class="chevron" aria-hidden="true">⌄</span></summary>
        <blockquote>「{analysis.nextPractice.example}」</blockquote>
      </details>
    </div>
  </section>

  <div class="point-columns">
    <section aria-labelledby="analysis-strengths">
      <h3 id="analysis-strengths">
        <span class="section-icon strength-icon" aria-hidden="true">✓</span> よかった点
      </h3>
      {#each analysis.strengths as point}
        <details class="point strength">
          <summary
            ><span>{point.title}</span><span class="chevron" aria-hidden="true">⌄</span></summary
          >
          <div class="detail-body">
            <p>{point.observation}</p>
            {#each point.evidence as evidence}
              <blockquote><span>{evidence.turn}回目の発言</span>「{evidence.quote}」</blockquote>
            {/each}
          </div>
        </details>
      {/each}
    </section>

    <section aria-labelledby="analysis-improvements">
      <h3 id="analysis-improvements">
        <span class="section-icon improvement-icon" aria-hidden="true">↗</span> もっとよくなる工夫
      </h3>
      {#if analysis.improvements.length === 0}
        <p class="no-improvement">今回の会話では、優先して直す点は見つかりませんでした。</p>
      {/if}
      {#each analysis.improvements as point}
        <details class="point improvement">
          <summary
            ><span>{point.title}</span><span class="chevron" aria-hidden="true">⌄</span></summary
          >
          <div class="detail-body">
            <p>{point.observation}</p>
            {#each point.evidence as evidence}
              <blockquote><span>{evidence.turn}回目の発言</span>「{evidence.quote}」</blockquote>
            {/each}
            <p class="suggestion">{point.suggestion}</p>
          </div>
        </details>
      {/each}
    </section>
  </div>

  <section class="turns" aria-labelledby="analysis-turns">
    <h3 id="analysis-turns">ひと言ずつ、見直してみる</h3>
    <p class="section-note">気になる返答を開くと、言い換えとその理由が読めます。</p>
    {#each analysis.turns as turn}
      <details class="point turn">
        <summary>
          <span class="turn-number" aria-hidden="true">{turn.turn}</span>
          <span class="turn-heading"
            ><span>{turn.turn}回目の返答</span><span class="turn-preview" aria-hidden="true"
              >{turn.quote}</span
            ></span
          >
          <span class="chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="detail-body">
          <p>{turn.observation}</p>
          <blockquote><span>今回の発言</span>「{turn.quote}」</blockquote>
          <blockquote class="rewrite"><span>言い換え例</span>「{turn.rewrite}」</blockquote>
          <p class="reason">{turn.reason}</p>
        </div>
      </details>
    {/each}
  </section>

  <details class="overview">
    <summary
      ><span>会話全体の振り返りを読む</span><span class="chevron" aria-hidden="true">⌄</span
      ></summary
    >
    <p>{analysis.summary}</p>
    <p class="section-note">この3回の返答から観察できることを振り返っています。</p>
  </details>
</div>

<style>
  .analysis {
    margin: 1.8rem 0;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.95rem;
    margin: 0 0 0.8rem;
  }
  p {
    line-height: 1.85;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    cursor: pointer;
    list-style: none;
    min-height: 48px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 4px;
  }
  .chevron {
    flex-shrink: 0;
    font-size: 1rem;
    font-weight: 400;
    color: var(--muted);
  }
  details[open] > summary .chevron {
    transform: rotate(180deg);
  }
  .point-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
    margin: 1.8rem 0;
  }
  .section-icon {
    display: inline-flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.85rem;
  }
  .strength-icon {
    color: #435b37;
    background: #edf1e8;
  }
  .improvement-icon {
    color: #9a4b31;
    background: #f6eae1;
  }
  .point {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-top: 0.6rem;
  }
  .point > summary {
    padding: 0.7rem 0.85rem;
  }
  .strength {
    border-left: 3px solid #809274;
  }
  .improvement {
    border-left: 3px solid #bc7659;
  }
  .detail-body {
    padding: 0 0.85rem 0.85rem;
    font-size: 0.85rem;
  }
  .detail-body > p:first-child {
    margin-top: 0.2rem;
  }
  .suggestion {
    font-weight: 600;
    margin-bottom: 0;
  }
  blockquote {
    margin: 0.7rem 0 0;
    padding: 0.8rem;
    background: #f7f4ef;
    border-radius: 6px;
    line-height: 1.85;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  blockquote span {
    display: block;
    color: var(--muted);
    font-size: 0.7rem;
    margin-bottom: 0.3rem;
    font-weight: 400;
  }
  .rewrite {
    color: var(--accent);
    font-weight: 600;
  }
  .reason,
  .section-note {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .section-note {
    margin: -0.2rem 0 0.8rem;
  }
  .no-improvement {
    padding: 0.85rem;
    margin: 0;
    border-radius: 8px;
    background: #f1f4ec;
    font-size: 0.8rem;
  }
  .next-practice {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 0.8rem;
    margin: 1rem 0 0;
    padding: 1rem;
    border-radius: 10px;
    background: #f7eee5;
  }
  .next-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid #d7bba3;
    border-radius: 50%;
    color: #9a4b31;
    font-size: 1.2rem;
  }
  .next-practice h3 {
    margin: 0 0 0.3rem;
    font-size: 0.75rem;
    color: #9a4b31;
  }
  .next-practice p {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .example summary {
    justify-content: flex-start;
    min-height: 40px;
    font-size: 0.75rem;
    color: #7f533c;
    font-weight: 400;
  }
  .example blockquote {
    background: #fffaf4;
    margin: 0;
    font-size: 0.85rem;
  }
  .turn > summary {
    justify-content: flex-start;
  }
  .turn-number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid #ddd9d0;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .turn-heading {
    display: block;
    flex: 1;
    min-width: 0;
  }
  .turn-heading > span {
    display: block;
  }
  .turn-preview {
    margin-top: 0.3rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--muted);
    font-weight: 400;
    font-size: 0.75rem;
  }
  .overview {
    margin-top: 1.2rem;
    border-top: 1px solid var(--border);
  }
  .overview summary {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 400;
  }
  .overview > p {
    font-size: 0.85rem;
  }
  .overview > .section-note {
    font-size: 0.75rem;
  }
  @media (max-width: 550px) {
    .point-columns {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.4rem;
    }
    .next-practice {
      grid-template-columns: 26px minmax(0, 1fr);
      padding: 0.9rem;
      gap: 0.6rem;
    }
    .next-icon {
      width: 26px;
      height: 26px;
      font-size: 1rem;
    }
    .next-practice p {
      font-size: 0.85rem;
    }
  }
</style>
