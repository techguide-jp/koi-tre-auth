<script lang="ts">
  import { characterById } from '$lib/adventure'
  import type { AffinityReaction } from '$lib/affinity-reaction'
  import CharacterPortrait from './CharacterPortrait.svelte'
  export let reaction: AffinityReaction
  export let active = false
  export let revealed = true
  $: character = characterById(reaction.characterId)!
  $: quote = reaction.evidence ? Array.from(reaction.evidence.quote) : []
</script>

<section
  class="reaction"
  class:negative="{reaction.direction === 'negative'}"
  class:pensive="{reaction.emotion === 'puzzled'}"
  class:active="{active}"
  aria-label="{`${character.name}の、この会話への反応`}"
>
  <div class="character-reaction">
    <CharacterPortrait
      characterId="{reaction.characterId}"
      emotion="{revealed ? reaction.emotion : 'neutral'}"
    />
    {#if active && reaction.direction === 'positive' && reaction.emotion !== 'puzzled'}<span
        class="spark"
        aria-hidden="true">♡</span
      >{/if}
  </div>
  <div class="copy">
    <p class="mood">
      {character.name}<span>{revealed ? reaction.mood : 'あなたを見つめている'}</span>
    </p>
    <blockquote>
      <span class:unrevealed="{!revealed}">「{reaction.speech}」</span>{#if !revealed}<span
          class="waiting"
          aria-hidden="true">…</span
        >{/if}
    </blockquote>
    {#if reaction.evidence}<p class="evidence">
        今回のやりとりから · {reaction.evidence.turn}回目<br /><q
          >{quote.slice(0, 70).join('')}{quote.length > 70 ? '…' : ''}</q
        >
      </p>{/if}
  </div>
</section>

<style>
  .reaction {
    display: grid;
    grid-template-columns: clamp(100px, 26%, 150px) minmax(0, 1fr);
    gap: 18px;
    align-items: center;
    padding-bottom: 18px;
    margin-bottom: 18px;
    border-bottom: 1px solid #e5d5d3;
  }
  .character-reaction {
    position: relative;
    align-self: end;
    transform-origin: 50% 90%;
    background: radial-gradient(ellipse at 50% 60%, #efd2d39c, transparent 70%);
  }
  .copy {
    min-width: 0;
  }
  .mood {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 3px 8px;
    margin: 0 0 9px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #884d58;
  }
  .mood span {
    font-size: 0.65rem;
    font-weight: 400;
  }
  blockquote {
    position: relative;
    margin: 0;
    padding: 15px 17px;
    border-radius: 4px 18px 18px 18px;
    background: #fffaf8;
    color: #684c51;
    border: 1px solid #e6c9cc;
    font-size: 0.9rem;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }
  blockquote::before {
    content: '';
    position: absolute;
    width: 9px;
    height: 9px;
    left: -5px;
    top: 20px;
    transform: rotate(45deg);
    background: #fffaf8;
    border-left: 1px solid #e6c9cc;
    border-bottom: 1px solid #e6c9cc;
  }
  .unrevealed {
    opacity: 0;
  }
  .waiting {
    position: absolute;
    top: 15px;
    left: 17px;
  }
  .evidence {
    margin: 10px 0 0;
    font-size: 0.68rem;
    line-height: 1.65;
    color: #866f72;
    overflow-wrap: anywhere;
  }
  q {
    quotes: '「' '」';
  }
  .negative .character-reaction {
    background: radial-gradient(ellipse at 50% 60%, #d9dfe88c, transparent 70%);
  }
  .negative blockquote,
  .negative blockquote::before {
    background: #f7f8fc;
    border-color: #cfd4e1;
    color: #5e6576;
  }
  .negative .mood {
    color: #636c80;
  }
  .active .character-reaction {
    animation: pleased 900ms ease-in-out both;
  }
  .pensive.active .character-reaction {
    animation: pause 1000ms ease-in-out both;
  }
  .active blockquote {
    animation: respond 450ms ease-out both;
  }
  .spark {
    position: absolute;
    right: 10%;
    top: 10%;
    color: #be6482;
    font-size: 1.5rem;
    animation: float-heart 1300ms ease-out both;
    pointer-events: none;
  }
  @keyframes pleased {
    0%,
    100% {
      transform: translateY(0) rotate(0);
    }
    40% {
      transform: translateY(-5px) rotate(-2deg);
    }
    70% {
      transform: translateY(-2px) rotate(1deg);
    }
  }
  @keyframes pause {
    0%,
    100% {
      transform: rotate(0);
    }
    45% {
      transform: rotate(2deg) translateY(2px);
    }
  }
  @keyframes respond {
    from {
      opacity: 0.5;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes float-heart {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.7);
    }
    30% {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: translateY(-24px) scale(1.1);
    }
  }
  @media (max-width: 480px) {
    .reaction {
      grid-template-columns: 100px minmax(0, 1fr);
      gap: 12px;
    }
    blockquote {
      padding: 11px 12px;
      font-size: 0.8rem;
      line-height: 1.8;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .active .character-reaction,
    .active blockquote,
    .spark {
      animation: none;
    }
  }
</style>
