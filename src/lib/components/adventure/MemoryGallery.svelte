<script lang="ts">
  import type { AdventureProgress } from '$lib/adventure'
  import { characterById, episodeById } from '$lib/adventure'
  import { specialCardArtwork, specialCardCollections } from '$lib/special-card-art'
  import CharacterPortrait from './CharacterPortrait.svelte'
  import SpecialCardArt from './SpecialCardArt.svelte'
  export let memories: AdventureProgress['memories']
  let onlySpecial = false
  $: special = memories.filter((memory) => memory.variant === 'deep')
  $: collections = specialCardCollections(memories)
  $: visible = onlySpecial ? special : memories
</script>

<section class="collection" aria-label="専用イラストのコレクション">
  <div class="collection-heading">
    <div>
      <p class="eyebrow">6往復で出会える、場面の一枚。</p>
      <h2>あなたの、イラストコレクション</h2>
    </div>
    <p class="collected"><strong>{special.length}</strong> 枚</p>
  </div>
  <p class="collection-description">
    一緒に過ごした景色を、何度でも。絵をタップすると大きく開けます。
  </p>
  <div class="collection-progress">
    {#each collections as collection}<div class="person-progress">
        <p>
          {collection.name}の本編
          <strong>{collection.earned}<span> / {collection.total}枚</span></strong>
        </p>
        <div
          class="progress-track"
          role="progressbar"
          aria-label="{`${collection.name}の本編イラスト`}"
          aria-valuenow="{collection.earned}"
          aria-valuemin="{0}"
          aria-valuemax="{collection.total}"
        >
          <span style="{`width:${(collection.earned / collection.total) * 100}%`}"></span>
        </div>
      </div>{/each}
  </div>
</section>
<div class="filters" aria-label="思い出の種類">
  <button aria-pressed="{!onlySpecial}" on:click="{() => (onlySpecial = false)}"
    >すべての思い出 <span>{memories.length}</span></button
  ><button aria-pressed="{onlySpecial}" on:click="{() => (onlySpecial = true)}"
    >専用イラスト <span>{special.length}</span></button
  >
</div>
{#if visible.length === 0}<div class="empty-special">
    <p>最初の専用イラストを、ここに。</p>
    <span>好きな場面で6往復を終えると、場面だけの一枚が増えていきます。</span><a href="/#scenes"
      >6往復の場面を選ぶ →</a
    >
  </div>{:else}<div class="memory-grid">
    {#each visible as memory (`${memory.characterId}:${memory.episodeId}:${memory.variant ?? 'short'}`)}
      {@const character = characterById(memory.characterId)}{@const episode = episodeById(
        memory.episodeId
      )}{@const artwork =
        memory.variant === 'deep'
          ? specialCardArtwork(memory.characterId, memory.episodeId)
          : undefined}
      {#if character && episode}<article class="memory {episode.theme}" class:deep="{!!artwork}">
          {#if artwork}<SpecialCardArt art="{artwork}" />{:else}<a
              class="art-link"
              href="{`/practice/${memory.practiceId}`}"
              aria-label="{`${memory.title}の会話を読む`}"
              ><div class="art">
                <CharacterPortrait
                  characterId="{character.id}"
                  emotion="{memory.emotion ?? 'relieved'}"
                />
              </div></a
            >{/if}
          <div class="caption">
            <span
              >{character.name} · {new Date(memory.completedAt).toLocaleDateString('ja-JP', {
                timeZone: 'Asia/Tokyo'
              })}</span
            >
            <h3><a href="{`/practice/${memory.practiceId}`}">{memory.title}</a></h3>
            {#if artwork}<span class="deep-label">✦ 場面限定イラスト</span
              >{#if memory.quote}<blockquote>「{memory.quote}」</blockquote>{/if}{/if}
            <a class="conversation-link" href="{`/practice/${memory.practiceId}`}"
              >会話と振り返りを読む ↗</a
            >
          </div>
        </article>{/if}
    {/each}
  </div>{/if}

<style>
  .collection {
    margin: 30px 0 22px;
    padding: 24px;
    border: 1px solid #d5c7a6;
    border-radius: 18px;
    background: linear-gradient(135deg, #f7f1e1, #faf8f0);
  }
  .collection-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }
  .collection-heading .eyebrow {
    font-size: var(--text-xs);
    margin: 0 0 8px;
  }
  h2 {
    font-family: var(--font-editorial);
    font-size: 1.45rem;
    line-height: 1.6;
    margin: 0;
  }
  .collected {
    flex-shrink: 0;
    color: #847047;
    margin: 0;
    font-size: var(--text-sm);
  }
  .collected strong {
    font-family: var(--font-editorial);
    font-size: 2.5rem;
  }
  .collection-description {
    font-size: var(--text-sm);
    color: var(--muted);
    line-height: 1.9;
    margin: 16px 0;
  }
  .collection-progress {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px 22px;
  }
  .person-progress p {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-sm);
    margin: 0 0 8px;
    gap: 12px;
  }
  .person-progress strong {
    color: #7a663d;
  }
  .person-progress strong span {
    font-weight: 400;
  }
  .progress-track {
    height: 5px;
    border-radius: 99px;
    overflow: hidden;
    background: #e6e0d2;
  }
  .progress-track > span {
    display: block;
    height: 100%;
    background: #9d8656;
    border-radius: inherit;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .filters button {
    font: inherit;
    font-size: var(--text-sm);
    border: 1px solid var(--border);
    padding: 10px 14px;
    border-radius: 99px;
    color: var(--muted);
    background: var(--surface);
    cursor: pointer;
  }
  .filters button[aria-pressed='true'] {
    color: #68532d;
    background: #f1e9d7;
    border-color: #ad9564;
  }
  .filters span {
    font-variant-numeric: tabular-nums;
    margin-left: 8px;
  }
  .memory-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-top: 24px;
    align-items: start;
  }
  .memory {
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    background: var(--surface);
  }
  .memory.deep {
    border: 1px solid #b9a16c;
    box-shadow: 0 5px 20px #8d764315;
  }
  .art-link {
    display: block;
  }
  .art {
    height: 250px;
    overflow: hidden;
    background: linear-gradient(145deg, #e6e7d9, #f5e5d1);
  }
  .evening .art {
    background: linear-gradient(145deg, #dfd8d4, #f0e1cc);
  }
  .books .art {
    background: linear-gradient(145deg, #dedcd1, #efebe1);
  }
  .art :global(.portrait) {
    height: 100%;
    width: auto;
    max-width: 100%;
    margin: 0 auto;
  }
  .caption {
    padding: 18px;
  }
  .caption > span,
  .conversation-link {
    font-size: var(--text-sm);
    color: var(--muted);
  }
  h3 {
    font-size: 1rem;
    line-height: 1.8;
    margin: 8px 0;
  }
  h3 a {
    color: inherit;
  }
  .caption .deep-label {
    display: inline-block;
    color: #806532;
    font-size: var(--text-xs);
    margin: 6px 0;
  }
  .caption blockquote {
    font-size: var(--text-sm);
    line-height: 1.8;
    margin: 12px 0;
    padding: 12px;
    background: #f7f4ec;
    border-radius: 8px;
    overflow-wrap: anywhere;
  }
  .conversation-link {
    display: inline-block;
    color: var(--accent);
    margin-top: 12px;
  }
  .empty-special {
    margin-top: 24px;
    padding: 32px 24px;
    text-align: center;
    border: 1px dashed #cab992;
    border-radius: 16px;
  }
  .empty-special p {
    font-family: var(--font-editorial);
    font-size: 1.25rem;
  }
  .empty-special span {
    display: block;
    font-size: var(--text-sm);
    line-height: 1.8;
    color: var(--muted);
  }
  .empty-special a {
    display: inline-block;
    margin-top: 18px;
    font-size: var(--text-sm);
  }
  @media (max-width: 650px) {
    .memory-grid {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .art {
      height: 200px;
    }
    .caption {
      padding: 12px;
    }
    h3 {
      font-size: var(--text-base);
    }
    .caption > span {
      font-size: var(--text-xs);
    }
    .collection {
      padding: 18px;
    }
    h2 {
      font-size: 1.15rem;
    }
  }
  @media (max-width: 420px) {
    .memory-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .art {
      height: 270px;
    }
  }
</style>
