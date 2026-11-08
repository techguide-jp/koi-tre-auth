<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import {
    characters,
    episodes,
    episodeKey,
    episodeUnlocked,
    missions,
    nextEpisode,
    type Adventure,
    type PartnerGender,
    type CharacterId,
    type AdventureProgress
  } from '$lib/adventure'
  import CharacterPortrait from './CharacterPortrait.svelte'
  export let progress: AdventureProgress | null = null
  export let disabled = false
  export let pending = false
  const dispatch = createEventDispatcher<{ start: Adventure }>()
  let gender: PartnerGender | null = null
  let characterId: CharacterId = 'aoi'
  let episodeId = 'aoi-1'
  let turns: 3 | 6 = 6
  let randomNote = ''
  let selected: Adventure
  $: roster = characters.filter((c) => c.gender === gender)
  $: character = characters.find((c) => c.id === characterId)!
  $: ownEpisodes = episodes.filter((e) => e.characterId === characterId)
  $: episode = episodes.find((e) => e.id === episodeId)!
  $: completed = progress?.completedEpisodes ?? []
  $: selected = { version: 1, characterId, episodeId, turns }
  $: unlocked = episodeUnlocked(selected, completed)
  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('koi-partner-choice:v1') ?? 'null')
      if (saved && ['male', 'female'].includes(saved.gender))
        chooseGender(saved.gender, saved.characterId)
    } catch {
      /* 保存不可でも選べる。 */
    }
  })
  function remember() {
    try {
      localStorage.setItem('koi-partner-choice:v1', JSON.stringify({ gender, characterId }))
    } catch {
      /* 同上 */
    }
  }
  function chooseGender(value: PartnerGender, preferred?: string) {
    gender = value
    chooseCharacter(
      characters.find((c) => c.gender === value && c.id === preferred)?.id ??
        characters.find((c) => c.gender === value)!.id
    )
  }
  function chooseCharacter(id: CharacterId) {
    characterId = id
    chooseEpisode(nextEpisode(id, completed).id)
    randomNote = ''
    remember()
  }
  function chooseEpisode(id: string) {
    episodeId = id
    const kind = episodes.find((item) => item.id === id)?.coachingProfile
    turns = kind === 'boundary' || kind === 'silence' ? 3 : 6
    randomNote = ''
  }
  function randomScene() {
    const available = episodes.filter(
      (e) =>
        (!e.characterId || e.characterId === characterId) &&
        e.id !== episodeId &&
        episodeUnlocked({ ...selected, episodeId: e.id }, completed)
    )
    const fresh = available.filter((e) => !completed.includes(episodeKey(characterId, e.id)))
    const candidates = fresh.length ? fresh : available
    if (candidates.length) {
      chooseEpisode(candidates[Math.floor(Math.random() * candidates.length)].id)
      randomNote = '今日のひと場面を選びました。何度でも引き直せます。'
    }
  }
</script>

<section class="lobby" id="scenes" aria-labelledby="lobby-title">
  <div class="lobby-heading">
    <p class="section-label">小さな出会いから、はじめよう</p>
    <h2 id="lobby-title">{gender ? '今日は、誰と話そう。' : 'どんな相手と話したい？'}</h2>
    <p class="muted">
      {gender
        ? '相手を選んで、ふたりのエピソードへ。'
        : 'まずは、お話ししたい相手を選んでください。'}
    </p>
  </div>
  {#if !gender}
    <div class="gender-choices">
      <button disabled="{pending}" on:click="{() => chooseGender('male')}"
        ><span class="choice-icon" aria-hidden="true">♂</span><strong>男性と話す</strong><span
          aria-hidden="true">→</span
        ></button
      ><button disabled="{pending}" on:click="{() => chooseGender('female')}"
        ><span class="choice-icon" aria-hidden="true">♀</span><strong>女性と話す</strong><span
          aria-hidden="true">→</span
        ></button
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
            <p class="character-tagline">{person.subtitle}</p>
          </div></button
        >{/each}
    </div>
    <p class="character-detail">{character.detail}</p>
    <div class="episode-heading">
      <div>
        <p class="eyebrow">{character.name}との物語</p>
        <h3>次のひと場面を、選ぼう。</h3>
      </div>
      <div class="episode-actions">
        <button
          class="button secondary"
          disabled="{pending}"
          on:click="{() => chooseEpisode(nextEpisode(characterId, completed).id)}"
          >続きから選ぶ</button
        ><button class="button secondary" disabled="{pending}" on:click="{randomScene}"
          >↻ おまかせの場面</button
        >
      </div>
    </div>
    <div class="story-path">
      {#each ownEpisodes as item}{@const available = episodeUnlocked(
          { ...selected, episodeId: item.id },
          completed
        )}{@const done = completed.includes(episodeKey(characterId, item.id))}<button
          class:active="{episodeId === item.id}"
          class:locked="{!available}"
          disabled="{!available || pending}"
          aria-pressed="{episodeId === item.id}"
          on:click="{() => {
            chooseEpisode(item.id)
          }}"
          ><span class="chapter"
            >{done ? '✓' : available ? `EP.${item.chapter}` : '◇'}
            {done ? '読了' : !available ? `第${(item.chapter ?? 1) - 1}話のあとに` : ''}</span
          ><strong>{item.title}</strong><span>{item.subtitle}</span></button
        >{/each}
    </div>
    <details class="other-scenes">
      <summary>場面から選ぶ <span>誘う・断る・気持ちを伝えるなど、6つの場面</span></summary>
      <div class="shared-scenes">
        {#each episodes.filter((e) => !e.characterId) as item}<button
            class:active="{episodeId === item.id}"
            aria-pressed="{episodeId === item.id}"
            disabled="{pending}"
            on:click="{() => {
              chooseEpisode(item.id)
            }}"><strong>{item.title}</strong><span>{item.subtitle}</span></button
          >{/each}
      </div>
    </details>
    {#if randomNote}<p class="small random-note" role="status">{randomNote}</p>{/if}
    <div class="episode-preview {episode.theme}">
      <div>
        <p class="eyebrow">
          {episode.characterId ? `EP.${episode.chapter}` : 'ひと場面の練習'} · {character.name}
        </p>
        <h3>{episode.title}</h3>
        <p>{episode.setting}</p>
        <div class="mission">
          <span aria-hidden="true">✦</span>
          <p><span>今回のミッション</span><strong>{missions[episode.missionId].label}</strong></p>
        </div>
      </div>
      <div class="start-actions">
        <fieldset disabled="{pending}">
          <legend>会話の長さ</legend><label
            ><input type="radio" bind:group="{turns}" value="{3}" />さくっと3往復</label
          ><label><input type="radio" bind:group="{turns}" value="{6}" />じっくり6往復</label>
        </fieldset>
        <button
          class="button primary"
          disabled="{disabled || pending || !unlocked}"
          aria-busy="{pending}"
          on:click="{() => dispatch('start', selected)}"
          >{pending ? '物語を準備しています…' : 'このエピソードを始める'}
          <span aria-hidden="true">→</span></button
        >
        <p class="small muted">月10回の練習枠を使用。<br />場面選びや引き直しは何度でも。</p>
      </div>
    </div>
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
    letter-spacing: 0.02em;
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
  .choice-icon {
    font-size: 2rem;
    color: var(--accent);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .roster-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .text-button {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .roster {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .character-card {
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    color: var(--ink);
    overflow: hidden;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .character-card.selected {
    border: 2px solid var(--accent);
    box-shadow: 0 8px 24px rgba(135, 81, 59, 0.08);
  }
  .character-art {
    padding: 12px 10px 0;
    background: linear-gradient(160deg, #e9e9db, #f8f2e6);
    height: 300px;
    overflow: hidden;
  }
  .clay .character-art {
    background: linear-gradient(160deg, #f1d9ca, #f9eee2);
  }
  .night .character-art {
    background: linear-gradient(160deg, #d9dfe0, #eeece4);
  }
  .character-art :global(.portrait) {
    height: 100%;
    width: auto;
    max-width: 100%;
    margin: 0 auto;
  }
  .character-copy {
    padding: 18px;
  }
  .character-copy > p:first-child {
    display: flex;
    gap: 12px;
    align-items: baseline;
    margin: 0 0 8px;
  }
  .character-copy strong {
    font-size: 1.4rem;
  }
  .character-copy span {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .character-tagline {
    font-size: 0.85rem;
    margin: 0;
  }
  .character-detail {
    margin: 20px 0 40px;
    color: var(--muted);
    text-align: center;
    font-size: 0.9rem;
  }
  .character-tabs {
    display: none;
  }
  .episode-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    margin-bottom: 20px;
  }
  .episode-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .episode-heading h3 {
    font-size: 1.3rem;
    margin: 8px 0 0;
  }
  .story-path {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .story-path button,
  .shared-scenes button {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 12px;
    padding: 18px;
    text-align: left;
    font: inherit;
    color: var(--ink);
    cursor: pointer;
  }
  .story-path button.active,
  .shared-scenes button.active {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .chapter {
    font-size: 0.75rem;
    color: var(--accent);
    letter-spacing: 0.06em;
  }
  .story-path strong,
  .shared-scenes strong {
    font-size: 0.95rem;
  }
  .story-path button > span:last-child,
  .shared-scenes span {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .other-scenes {
    margin: 22px 0 26px;
  }
  .other-scenes summary {
    cursor: pointer;
    font-size: 0.95rem;
  }
  .other-scenes summary span {
    display: inline-block;
    margin-left: 12px;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .shared-scenes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 18px;
  }
  .episode-preview {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 28px;
    padding: 28px;
    border-radius: 18px;
    background: var(--surface-soft);
  }
  .episode-preview h3 {
    font-size: 1.35rem;
    margin: 12px 0;
  }
  .episode-preview > div > p:not(.eyebrow) {
    font-size: 0.85rem;
    line-height: 1.9;
  }
  .mission {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 22px;
    color: var(--olive);
  }
  .mission > span {
    font-size: 1.5rem;
  }
  .mission p {
    margin: 0;
  }
  .mission p span {
    display: block;
    font-size: 0.72rem;
  }
  .mission strong {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .start-actions {
    align-self: center;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  legend {
    font-size: 0.75rem;
    color: var(--muted);
    margin-bottom: 8px;
  }
  label {
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  input {
    accent-color: var(--accent);
  }
  .start-actions > .button {
    width: 100%;
  }
  .start-actions > .small {
    line-height: 1.7;
    margin: 12px 0 0;
  }
  .random-note {
    color: var(--accent);
    margin: 0 0 16px;
  }
  @media (max-width: 650px) {
    .lobby {
      padding: 40px 0;
    }
    .gender-choices {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .gender-choices button {
      padding: 22px;
    }
    .character-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .character-tabs button {
      flex: 1;
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 10px;
      background: var(--surface);
      font: inherit;
      color: var(--ink);
    }
    .character-tabs button.active {
      color: var(--accent);
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .roster {
      display: block;
    }
    .character-card {
      width: 100%;
    }
    .character-card:not(.selected) {
      display: none;
    }
    .character-art {
      height: 310px;
    }
    .character-copy {
      text-align: center;
    }
    .character-copy > p:first-child {
      justify-content: center;
    }
    .episode-heading {
      flex-direction: column;
      align-items: flex-start;
    }
    .story-path {
      grid-template-columns: 1fr;
    }
    .story-path button {
      gap: 6px;
    }
    .shared-scenes {
      grid-template-columns: 1fr 1fr;
    }
    .other-scenes summary span {
      display: block;
      margin: 8px 0 0;
    }
    .episode-preview {
      grid-template-columns: 1fr;
      padding: 22px;
      gap: 24px;
    }
    .start-actions > .button {
      min-height: 48px;
    }
  }
</style>
