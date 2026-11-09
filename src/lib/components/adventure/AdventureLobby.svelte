<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import {
    characters,
    type Adventure,
    type AdventureProgress,
    type CharacterId,
    type PartnerGender
  } from '$lib/adventure'
  import CharacterPortrait from './CharacterPortrait.svelte'
  import StoryPicker from './StoryPicker.svelte'
  import GuestStoryIntro from './GuestStoryIntro.svelte'
  export let progress: AdventureProgress | null = null
  export let disabled = false
  export let pending = false
  export let loading = false
  export let guest = false
  const dispatch = createEventDispatcher<{ start: Adventure }>()
  let gender: PartnerGender | null = null
  let characterId: CharacterId = 'aoi'
  $: roster = characters.filter((c) => c.gender === gender)
  $: character = characters.find((c) => c.id === characterId)!
  onMount(() => {
    try {
      const query = new URLSearchParams(window.location.search)
      const selected = characters.find((c) => c.id === query.get('character'))
      const saved = JSON.parse(localStorage.getItem('koi-partner-choice:v1') ?? 'null')
      if (selected) {
        gender = selected.gender
        characterId = selected.id
      } else if (saved && ['male', 'female'].includes(saved.gender))
        chooseGender(saved.gender, saved.characterId)
    } catch {
      /* 保存できない環境でも人物は選べる。 */
    }
  })
  function chooseGender(value: PartnerGender, preferred?: string) {
    gender = value
    chooseCharacter(
      characters.find((c) => c.gender === value && c.id === preferred)?.id ??
        characters.find((c) => c.gender === value)!.id
    )
  }
  function chooseCharacter(id: CharacterId) {
    characterId = id
    try {
      localStorage.setItem('koi-partner-choice:v1', JSON.stringify({ gender, characterId }))
    } catch {
      /* 同上。 */
    }
  }
</script>

<section class="lobby" id="scenes" aria-labelledby="lobby-title">
  <div class="lobby-heading">
    <p class="section-label">小さな出会いから、はじめよう</p>
    <h2 id="lobby-title">{gender ? '今日は、誰と話そう。' : 'どんな相手と話したい？'}</h2>
    <p class="muted">
      {gender ? '物語の続きも、話す前の予行練習も。' : 'まずは、お話ししたい相手を選んでください。'}
    </p>
  </div>
  {#if !gender}<div class="gender-choices">
      <button disabled="{pending}" on:click="{() => chooseGender('male')}"
        ><span aria-hidden="true">♂</span><strong>男性と話す</strong>→</button
      ><button disabled="{pending}" on:click="{() => chooseGender('female')}"
        ><span aria-hidden="true">♀</span><strong>女性と話す</strong>→</button
      >
    </div>
    <p class="small muted">あとから変更できます。あなた自身のプロフィール入力は不要です。</p>
  {:else}
    <div class="roster-heading">
      <span>お相手：{gender === 'male' ? '男性' : '女性'}</span><button
        class="text-button"
        disabled="{pending}"
        on:click="{() => (gender = null)}">お相手を変更</button
      >
    </div>
    <div class="character-tabs" aria-label="キャラクターを選ぶ">
      {#each roster as person}<button
          class:active="{characterId === person.id}"
          aria-pressed="{characterId === person.id}"
          disabled="{pending}"
          on:click="{() => chooseCharacter(person.id)}">{person.name}</button
        >{/each}
    </div>
    <div class="roster">
      {#each roster as person}<button
          class="character-card {person.color}"
          class:selected="{characterId === person.id}"
          aria-pressed="{characterId === person.id}"
          aria-label="{`${person.name}、${person.age}歳。${person.subtitle}`}"
          disabled="{pending}"
          on:click="{() => chooseCharacter(person.id)}"
          ><div class="character-art">
            <CharacterPortrait
              characterId="{person.id}"
              emotion="{characterId === person.id ? 'smile' : 'neutral'}"
            />
          </div>
          <div class="character-copy">
            <p><strong>{person.name}</strong><span>{person.age}歳</span></p>
            <p>{person.subtitle}</p>
          </div></button
        >{/each}
    </div>
    <p class="character-detail">{character.detail}</p>
    {#if loading}<p role="status">物語と練習枠を読み込んでいます…</p>
    {:else if guest}<GuestStoryIntro
        characterId="{characterId}"
        disabled="{disabled}"
        pending="{pending}"
        on:start="{(event) => dispatch('start', event.detail)}"
      />
    {:else}<StoryPicker
        characterId="{characterId}"
        progress="{progress}"
        disabled="{disabled}"
        pending="{pending}"
        on:start="{(event) => dispatch('start', event.detail)}"
      />{/if}
  {/if}
</section>

<style>
  .lobby {
    padding: 64px 0;
    scroll-margin-top: 24px;
  }
  .lobby-heading {
    margin-bottom: 28px;
  }
  .lobby-heading h2 {
    margin: 12px 0;
    font-size: clamp(1.7rem, 4vw, 2.6rem);
  }
  .gender-choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 28px 0 16px;
  }
  .gender-choices button {
    display: flex;
    align-items: center;
    gap: 16px;
    text-align: left;
    padding: 28px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    color: var(--ink);
    cursor: pointer;
  }
  .gender-choices strong {
    font-size: 1.3rem;
    flex: 1;
  }
  .gender-choices button > span {
    font-size: 2rem;
    color: var(--accent);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .roster-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
    margin-bottom: 20px;
  }
  .roster {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }
  .character-card {
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 18px;
    text-align: left;
    cursor: pointer;
    color: var(--ink);
    background: #eeeee2;
    transition:
      transform 0.15s,
      border-color 0.15s;
  }
  .character-card.selected {
    border: 2px solid var(--accent);
    transform: translateY(-4px);
  }
  .character-card.clay {
    background: #f2e4d6;
  }
  .character-card.night {
    background: #e5e6ed;
  }
  .character-art {
    height: 320px;
    display: flex;
    justify-content: center;
    overflow: hidden;
    padding-top: 12px;
  }
  .character-art :global(.portrait) {
    width: 215px;
    flex-shrink: 0;
  }
  .character-copy {
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.75);
  }
  .character-copy p {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.7;
  }
  .character-copy p:first-child {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 5px;
  }
  .character-copy strong {
    font-size: 1.35rem;
  }
  .character-copy span {
    color: var(--muted);
  }
  .character-detail {
    font-size: 0.9rem;
    text-align: center;
    margin: 24px 0 36px;
    color: var(--olive);
  }
  .character-tabs {
    display: none;
  }
  @media (max-width: 600px) {
    .lobby {
      padding: 40px 0;
    }
    .gender-choices {
      gap: 12px;
    }
    .gender-choices button {
      padding: 22px 16px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .gender-choices strong {
      font-size: 1rem;
    }
    .gender-choices button > span {
      font-size: 1.5rem;
    }
    .roster {
      display: block;
    }
    .character-card {
      display: none;
      width: 100%;
    }
    .character-card.selected {
      display: block;
      transform: none;
    }
    .character-art {
      height: 355px;
    }
    .character-art :global(.portrait) {
      width: 240px;
    }
    .character-tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 0 0 18px;
    }
    .character-tabs button {
      padding: 12px 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--ink);
      background: white;
      cursor: pointer;
    }
    .character-tabs button.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      font-weight: 700;
    }
    .character-copy {
      text-align: center;
    }
    .character-copy p:first-child {
      justify-content: center;
    }
    .character-detail {
      margin-bottom: 28px;
    }
  }
</style>
