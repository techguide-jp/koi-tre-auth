<script lang="ts">
  export let xp: number | undefined = undefined
  export let caption = ''
</script>

<div class="reward-summary">
  {#if xp || caption}
    <div class="earned">
      {#if xp}<span>獲得経験値</span><strong>+{xp} <small>XP</small></strong>{/if}
      {#if caption}<p>{caption}</p>{/if}
    </div>
  {/if}
  {#if $$slots.affinity}<div class="affinity"><slot name="affinity" /></div>{/if}
</div>

<style>
  .reward-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .earned {
    display: grid;
    flex: 1 1 10rem;
    align-self: start;
    align-content: center;
    gap: 4px;
    padding: 16px 20px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--olive-soft);
    color: var(--olive);
    font-size: var(--text-sm);
  }
  .earned strong {
    font-size: 2.15rem;
    line-height: 1.1;
  }
  .earned small {
    font-size: var(--text-base);
  }
  .earned p {
    margin: 4px 0 0;
    line-height: 1.6;
  }
  .affinity {
    flex: 2 1 17rem;
    min-width: 0;
  }
  .affinity:empty {
    display: none;
  }
  @media (max-width: 600px) {
    .earned,
    .affinity {
      flex-basis: 100%;
    }
  }
</style>
