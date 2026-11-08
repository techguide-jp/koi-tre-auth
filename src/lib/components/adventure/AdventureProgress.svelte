<script lang="ts">
  import type { AdventureProgress } from '$lib/adventure'
  export let progress: AdventureProgress
</script>

<section class="game-progress" aria-label="会話の経験とコレクション">
  <div class="progress-top">
    <div>
      <span class="eyebrow">あなたの会話の足あと</span>
      <p>
        <strong>Lv.{progress.level}</strong><span
          >{progress.xp} XP · {progress.completed}エピソード完了</span
        >
      </p>
    </div>
    <a href="/memories">思い出アルバム <span aria-hidden="true">↗</span></a>
  </div>
  <div
    class="xp-track"
    role="progressbar"
    aria-label="次のレベルまでの経験値"
    aria-valuenow="{progress.xpInLevel}"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <span style="{`width:${progress.xpInLevel}%`}"></span>
  </div>
  <p class="xp-note">次のレベルまで {100 - progress.xpInLevel} XP</p>
  <details>
    <summary
      >集めたバッジ <span
        >{progress.badges.filter((b) => b.earned).length} / {progress.badges.length}</span
      ></summary
    >
    <div class="badges">
      {#each progress.badges as badge}<div class:earned="{badge.earned}">
          <span aria-hidden="true">{badge.earned ? '✦' : '◇'}</span><strong>{badge.label}</strong>
          <p>{badge.description}</p>
        </div>{/each}
    </div>
  </details>
</section>

<style>
  .game-progress {
    padding: 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
  }
  .progress-top {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }
  .progress-top p {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
    margin: 8px 0 12px;
  }
  .progress-top strong {
    font-size: 1.6rem;
  }
  .progress-top span:not(.eyebrow),
  .xp-note {
    font-size: 0.8rem;
    color: var(--muted);
  }
  a {
    color: var(--accent);
    font-size: 0.9rem;
    text-decoration: none;
  }
  .xp-track {
    height: 7px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface-soft);
  }
  .xp-track span {
    display: block;
    background: var(--olive);
    height: 100%;
    border-radius: 8px;
  }
  .xp-note {
    margin: 8px 0 16px;
    text-align: right;
  }
  summary {
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    gap: 14px;
    align-items: center;
  }
  summary span {
    color: var(--muted);
    font-size: 0.8rem;
  }
  .badges {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 16px;
  }
  .badges > div {
    padding: 14px;
    background: var(--surface-soft);
    border-radius: 10px;
    color: var(--muted);
  }
  .badges .earned {
    color: var(--ink);
    background: var(--olive-soft);
  }
  .badges strong {
    font-size: 0.85rem;
    display: block;
    margin: 4px 0;
  }
  .badges p {
    font-size: 0.75rem;
    margin: 0;
    line-height: 1.7;
  }
  @media (max-width: 600px) {
    .game-progress {
      padding: 18px;
    }
    .progress-top {
      align-items: flex-start;
      flex-direction: column;
      gap: 0;
    }
    .badges {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
