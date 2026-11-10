<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import {
    characters,
    episodes,
    episodeById,
    episodeKey,
    adventureAccess,
    nextEpisode,
    missions,
    type Adventure,
    type AdventureProgress,
    type CharacterId
  } from '$lib/adventure'
  import { storyParts, storyPart, stageRules, type StoryPartId } from '$lib/adventure-story'
  import RelationshipMeter from './RelationshipMeter.svelte'
  import { dailyEpisodes, publishedEvents } from '$lib/adventure-life'
  import { availableCredits, practiceCreditCost, hasPaidPracticeAccess } from '$lib/billing'
  export let characterId: CharacterId
  export let progress: AdventureProgress | null = null
  export let disabled = false
  export let pending = false
  const dispatch = createEventDispatcher<{ start: Adventure }>()
  let mode: 'story' | 'revisit' | 'life' | 'scene' = 'story'
  let partId: StoryPartId = 'meeting'
  let episodeId = `${characterId}-1`
  let turns: 3 | 6 = 6
  let previousCharacter = characterId
  let initialized = false
  let touched = false
  let note = ''
  $: completed = progress?.progression?.clearedEpisodes ?? progress?.completedEpisodes ?? []
  $: relationship = progress?.progression?.relationships.find((r) => r.characterId === characterId)
  $: rule = stageRules.find((r) => r.chapter === episode.chapter)
  $: achievement = progress?.progression?.achievements.find(
    (a) => a.characterId === characterId && a.episodeId === episodeId
  )
  $: character = characters.find((c) => c.id === characterId)!
  $: part = storyParts.find((p) => p.id === partId)!
  $: own = episodes.filter((e) => e.characterId === characterId)
  let selected: Adventure
  $: selected = {
    version: 1,
    characterId,
    episodeId,
    turns,
    ...(mode === 'revisit' ? { revisit: true as const } : {})
  }
  $: episode = episodeById(episodeId)!
  $: access = adventureAccess(
    selected,
    completed,
    progress?.billing?.ownedCharacters ?? [],
    hasPaidPracticeAccess(progress?.billing),
    new Date(),
    progress?.progression
  )
  $: adminPlay = progress?.billing?.adminPlay === true
  $: cost = adminPlay ? 0 : practiceCreditCost(turns)
  $: illustrationEarned =
    progress?.memories.some(
      (memory) =>
        memory.characterId === characterId &&
        memory.episodeId === episodeId &&
        memory.variant === 'deep'
    ) ?? false
  $: remaining = progress?.billing
    ? availableCredits(progress.billing.credits, characterId, !!episode.chapter)
    : null
  $: affordable = adminPlay || remaining === null || remaining >= cost
  $: lifeCompleted = completed.includes(episodeKey(characterId, `${characterId}-12`))
  $: events = publishedEvents()
  $: if (previousCharacter !== characterId) {
    previousCharacter = characterId
    touched = false
    mode = 'story'
    ;({ partId, episodeId, turns } = storySelection())
  }
  $: if (progress && !initialized) {
    initialized = true
    if (!touched) {
      mode = 'story'
      ;({ partId, episodeId, turns } = storySelection())
    }
  }
  onMount(() => {
    const query = new URLSearchParams(window.location.search)
    const requested = storyParts.find((p) => p.id === query.get('part'))
    if (requested) {
      touched = true
      mode = query.get('mode') === 'revisit' ? 'revisit' : 'story'
      choosePart(requested.id)
    }
  })
  function chooseEpisode(id: string) {
    episodeId = id
    const kind = episodeById(id)?.coachingProfile
    turns = kind === 'boundary' || kind === 'silence' ? 3 : 6
    note = ''
  }
  function choosePart(id: StoryPartId) {
    partId = id
    if (mode === 'life' || mode === 'scene') mode = 'story'
    const definition = storyParts.find((p) => p.id === id)!
    const choices = own.filter(
      (e) => (e.chapter ?? 0) >= definition.from && (e.chapter ?? 0) <= definition.to
    )
    const preferred =
      mode === 'revisit'
        ? choices.find((e) => completed.includes(episodeKey(characterId, e.id)))
        : choices.find((e) => !completed.includes(episodeKey(characterId, e.id)))
    chooseEpisode((preferred ?? choices[0]).id)
  }
  function storySelection() {
    const next = nextEpisode(characterId, completed)
    const id = next.characterId ? next.id : `${characterId}-1`
    const kind = episodeById(id)?.coachingProfile
    return {
      partId: storyPart(next.chapter)?.id ?? ('meeting' as StoryPartId),
      episodeId: id,
      turns: (kind === 'boundary' || kind === 'silence' ? 3 : 6) as 3 | 6
    }
  }
  function continueStory() {
    mode = 'story'
    ;({ partId, episodeId, turns } = storySelection())
    note = ''
  }
  function changeMode(value: typeof mode) {
    touched = true
    mode = value
    if (value === 'life') chooseEpisode(dailyEpisodes[0].id)
    else choosePart(partId)
  }
  function randomScene() {
    touched = true
    mode = 'scene'
    const choices = episodes.filter((e) => !e.characterId)
    chooseEpisode(choices[Math.floor(Math.random() * choices.length)].id)
    note = '今日の練習場面を選びました。何度でも引き直せます。'
  }
</script>

<section class="story-picker" aria-label="物語とパート別の練習">
  <div class="picker-heading">
    <div>
      <p class="eyebrow">{character.name}との物語</p>
      <h3>今日は、どこから話そう。</h3>
    </div>
    <a href="/pricing?character={characterId}">料金と遊べる範囲 ↗</a>
  </div>
  <div class="mode-tabs" aria-label="遊び方を選ぶ">
    <button
      class:active="{mode === 'story'}"
      aria-pressed="{mode === 'story'}"
      disabled="{pending}"
      on:click="{() => {
        touched = true
        continueStory()
      }}">物語を進める</button
    ><button
      class:active="{mode === 'revisit'}"
      aria-pressed="{mode === 'revisit'}"
      disabled="{pending}"
      on:click="{() => changeMode('revisit')}">クリア済みパートを練習</button
    ><button
      class:active="{mode === 'life'}"
      aria-pressed="{mode === 'life'}"
      disabled="{pending}"
      on:click="{() => changeMode('life')}">今の二人・イベント</button
    >
  </div>
  {#if mode === 'revisit'}<p class="mode-note">
      話す機会の前に、本音編など必要な場面へ。その話の時点の関係で練習します。本編の進行や選んだ結末はそのまま残ります。
    </p>{/if}
  {#if mode !== 'life' && mode !== 'scene'}
    <div class="part-tabs" aria-label="物語のパートを選ぶ">
      {#each storyParts as item}{@const done = own.filter(
          (e) =>
            (e.chapter ?? 0) >= item.from &&
            (e.chapter ?? 0) <= item.to &&
            completed.includes(episodeKey(characterId, e.id))
        ).length}<button
          class:active="{partId === item.id}"
          aria-pressed="{partId === item.id}"
          disabled="{pending}"
          on:click="{() => {
            touched = true
            choosePart(item.id)
          }}"
          ><strong>{item.label}</strong><span
            >{done} / 3話{adminPlay
              ? ' · 管理者'
              : item.from === 1
                ? ' · 無料'
                : ' · ルートパック'}</span
          ></button
        >{/each}
    </div>
    <div class="part-intro">
      <div>
        <h4>{part.label}</h4>
        <p>{part.description}</p>
      </div>
      <span>{part.from}〜{part.to}話</span>
    </div>
    <div class="story-path">
      {#each own.filter((e) => (e.chapter ?? 0) >= part.from && (e.chapter ?? 0) <= part.to) as item}{@const done =
          completed.includes(episodeKey(characterId, item.id))}{@const state = adventureAccess(
          { ...selected, episodeId: item.id },
          completed,
          progress?.billing?.ownedCharacters ?? [],
          hasPaidPracticeAccess(progress?.billing),
          new Date(),
          progress?.progression
        )}<button
          class:active="{episodeId === item.id}"
          class:locked="{state !== 'available'}"
          disabled="{pending || (mode === 'revisit' && !done)}"
          aria-pressed="{episodeId === item.id}"
          on:click="{() => {
            touched = true
            chooseEpisode(item.id)
          }}"
          ><span class="chapter"
            >EP.{item.chapter} · {done
              ? 'クリア'
              : state === 'purchase'
                ? 'パックで開く'
                : state === 'locked'
                  ? '前の話のあとに'
                  : state === 'affinity'
                    ? '好感度を深めよう'
                    : '未クリア'}</span
          ><strong>{item.title}</strong><span
            >{mode === 'revisit'
              ? done
                ? 'この場面を練習する'
                : 'クリアすると練習できます'
              : item.subtitle}</span
          ></button
        >{/each}
    </div>
  {:else if mode === 'life'}
    <p class="mode-note">
      {lifeCompleted
        ? adminPlay
          ? '管理者は日常交流・公開済みイベントも、利用枠の消費なしで楽しめます。'
          : '選んだ結末と、これまでの会話を引き継ぐ時間。日常交流・イベントはPlusの対象です。'
        : '本編12話をクリアすると、今の二人の日常と季節イベントが開きます。'}
    </p>
    <h4>日常のひと場面</h4>
    <div class="life-scenes">
      {#each dailyEpisodes as item}<button
          class:active="{episodeId === item.id}"
          disabled="{pending}"
          on:click="{() => chooseEpisode(item.id)}"
          ><strong>{item.title}</strong><span>{item.subtitle}</span></button
        >{/each}
    </div>
    <h4>季節のイベント・アーカイブ</h4>
    <div class="life-scenes">
      {#each events as item}<button
          class:active="{episodeId === item.id}"
          disabled="{pending}"
          on:click="{() => chooseEpisode(item.id)}"
          ><strong>{item.title}</strong><span>{item.subtitle}</span></button
        >{/each}
    </div>
    <p class="small muted">
      毎月1日・16日に新しいテーマが登場。公開済みのイベントは{adminPlay
        ? '管理者は'
        : '加入中'}いつでも遊べます。
    </p>
  {/if}
  <details class="other-scenes" open="{mode === 'scene'}">
    <summary>場面から練習する <span>誘う・断る・気持ちを伝えるなど</span></summary>
    <div class="life-scenes">
      {#each episodes.filter((e) => !e.characterId) as item}<button
          class:active="{episodeId === item.id}"
          disabled="{pending}"
          on:click="{() => {
            mode = 'scene'
            touched = true
            chooseEpisode(item.id)
          }}"><strong>{item.title}</strong><span>{item.subtitle}</span></button
        >{/each}
    </div>
    <button class="text-button" disabled="{pending}" on:click="{randomScene}"
      >↻ おまかせで選ぶ</button
    >
    <p class="small muted">
      共通場面でも好感度を深めたり、すれ違いを回復できます。物語の結末や過去の記憶は変わりません。
    </p>
  </details>
  {#if note}<p class="small" role="status">{note}</p>{/if}
  <div class="episode-preview {episode.theme}">
    <div>
      <p class="eyebrow">
        {mode === 'revisit'
          ? 'パートの再練習'
          : episode.chapter
            ? `EP.${episode.chapter}`
            : episode.id.startsWith('event-')
              ? '季節イベント'
              : 'ひと場面の練習'} · {character.name}
      </p>
      <h3>{episode.title}</h3>
      {#if progress?.progression}<RelationshipMeter
          name="{character.name}"
          value="{relationship?.affinity ?? 0}"
          required="{rule?.affinity ?? 0}"
        />{/if}
      {#if rule}<p class="stage-requirements">
          クリア目標 {rule.score} / 25点 · 配慮 {rule.consideration}点以上<br />この話の必要好感度 {rule.affinity}
          / 100
        </p>{/if}
      {#if rule && achievement?.bestScore !== null && achievement?.bestScore !== undefined}
        <p class="small muted">
          自己ベスト {achievement.bestScore.toFixed(1)} / 25点
          {#if !achievement.cleared && achievement.bestScore < rule.score}
            · 目標まであと{(rule.score - achievement.bestScore).toFixed(1)}点{/if}
          {#if !achievement.cleared}（配慮の最低点も必要です）{/if}
        </p>
      {/if}
      <p>{access === 'available' ? episode.setting : episode.subtitle}</p>
      <div class="mission">
        <span aria-hidden="true">✦</span>
        <p><span>今回のミッション</span><strong>{missions[episode.missionId].label}</strong></p>
      </div>
    </div>
    <div class="start-actions">
      <fieldset disabled="{pending}">
        <legend>会話の長さ</legend><label
          ><input type="radio" bind:group="{turns}" value="{3}" />さくっと3往復
          <small>{adminPlay ? '利用枠消費なし' : '1枠'}・最大30XP</small></label
        ><label
          ><input type="radio" bind:group="{turns}" value="{6}" />じっくり6往復
          <small>{adminPlay ? '利用枠消費なし' : '2枠'}・最大70XP</small></label
        >
      </fieldset>
      {#if turns === 6}<p class="illustration-reward">
          <span aria-hidden="true">✦</span>
          {illustrationEarned
            ? 'この場面の専用イラストは獲得済み。もう一度、違う言葉で話してみよう。'
            : '6往復を終えると、この場面だけの専用イラストを獲得。アルバムで大きく鑑賞できます。'}
        </p>{/if}
      {#if access === 'affinity'}<p role="status">
          この話まで好感度があと{Math.max(
            0,
            (rule?.affinity ?? 0) - (relationship?.affinity ?? 0)
          )}必要です。解放済みの話や「場面から練習する」で会話を重ねましょう。
        </p>
        <button class="button secondary" disabled="{pending}" on:click="{randomScene}"
          >好感度を深める場面を選ぶ ↻</button
        >
      {:else if access === 'purchase'}<a
          class="button primary"
          href="/pricing?character={characterId}">{character.name}の本編へ</a
        >
        <p class="small muted">
          Plus
          月980円で全員の本編へ。購入した本編を月額なしで遊べるルートパックは1,480円・専用24枠付き。
        </p>
      {:else if access === 'plus'}<a
          class="button primary"
          href="/pricing?character={characterId}#plus">クリア後の交流へ</a
        >
        <p class="small muted">Plus 月980円・契約期間ごと60枠。</p>
      {:else}<button
          class="button primary"
          disabled="{disabled || pending || access !== 'available' || !affordable}"
          aria-busy="{pending}"
          on:click="{() => dispatch('start', selected)}"
          >{pending
            ? '場面を準備しています…'
            : mode === 'revisit'
              ? 'この場面をもう一度練習する'
              : 'この場面を始める'} →</button
        >
        <p class="small muted">
          {access === 'locked'
            ? mode === 'revisit'
              ? 'この話をクリアすると、ここに戻って練習できます。'
              : '前の話をクリアすると開きます。'
            : access === 'unpublished'
              ? 'このイベントは公開前です。'
              : !affordable
                ? `使える枠が足りません（残り${remaining}枠）。3往復なら1枠で遊べます。`
                : adminPlay
                  ? '管理者は利用枠を消費しません。合格点・好感度などの進行条件は通常どおりです。'
                  : `今回は${cost}枠を使用。${remaining === null ? '' : `この場面に使える残り${remaining}枠。`}途中の再開は追加消費なし。`}
        </p>{/if}
    </div>
  </div>
</section>

<style>
  .illustration-reward {
    margin: 14px 0 18px;
    padding: 12px 15px;
    border: 1px solid #dfd0ac;
    border-radius: 10px;
    color: #75613b;
    background: #f8f2e3;
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  .picker-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .picker-heading h3 {
    font-size: 1.4rem;
    margin: 0.4rem 0 1.5rem;
  }
  .picker-heading > a {
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .eyebrow {
    font-size: var(--text-sm);
    color: var(--accent);
    margin: 0;
  }
  .mode-tabs {
    display: flex;
    gap: 8px;
    margin: 12px 0 20px;
    flex-wrap: wrap;
  }
  .mode-tabs button {
    border: 1px solid var(--border);
    background: white;
    border-radius: 40px;
    padding: 12px 18px;
    font-size: var(--text-sm);
    color: var(--ink);
    cursor: pointer;
  }
  .mode-tabs button.active {
    background: var(--olive);
    color: white;
    border-color: var(--olive);
  }
  .mode-note {
    padding: 16px 20px;
    border-radius: 12px;
    background: var(--olive-soft);
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  .part-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 20px 0;
  }
  .part-tabs button {
    padding: 18px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: white;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }
  .part-tabs button.active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .part-tabs strong {
    font-size: var(--text-sm);
    display: block;
  }
  .part-tabs span {
    display: block;
    font-size: var(--text-sm);
    color: var(--muted);
    margin-top: 8px;
  }
  .part-intro {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 24px 0 16px;
  }
  .part-intro h4 {
    font-size: 1.15rem;
    margin: 0;
  }
  .part-intro p {
    font-size: var(--text-sm);
    color: var(--muted);
    margin: 6px 0 0;
  }
  .part-intro > span {
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--accent);
  }
  .story-path {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .story-path button,
  .life-scenes button {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: white;
    padding: 20px;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }
  .story-path button.active,
  .life-scenes button.active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .story-path .chapter {
    font-size: var(--text-xs);
    color: var(--accent);
  }
  .story-path strong,
  .life-scenes strong {
    display: block;
    font-size: var(--text-base);
    margin: 10px 0;
  }
  .story-path button > span:last-child,
  .life-scenes span {
    display: block;
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--muted);
  }
  .story-path .locked {
    background: #f4f2ed;
  }
  .other-scenes {
    margin: 24px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 18px 0;
  }
  .other-scenes summary {
    cursor: pointer;
    font-size: var(--text-base);
    font-weight: 600;
  }
  .other-scenes summary span {
    display: inline-block;
    font-size: var(--text-sm);
    color: var(--muted);
    font-weight: 400;
    margin-left: 12px;
  }
  .life-scenes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 16px 0;
  }
  .episode-preview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 290px;
    gap: 36px;
    padding: 30px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    margin-top: 28px;
  }
  .episode-preview h3 {
    margin: 12px 0;
    font-size: 1.3rem;
  }
  .episode-preview > div > p {
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  .mission {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
  }
  .mission > span {
    font-size: 1.3rem;
    color: var(--accent);
  }
  .mission p {
    margin: 0;
  }
  .mission p > span {
    display: block;
    font-size: var(--text-sm);
    color: var(--muted);
  }
  .mission strong {
    font-size: var(--text-sm);
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 16px;
  }
  legend {
    font-size: var(--text-sm);
    margin-bottom: 10px;
    color: var(--muted);
  }
  fieldset label {
    display: block;
    font-size: var(--text-sm);
    padding: 7px 0;
    cursor: pointer;
  }
  input {
    accent-color: var(--accent);
    margin-right: 7px;
  }
  label small {
    display: block;
    margin: 5px 0 0 22px;
    color: var(--muted);
    font-size: var(--text-sm);
  }
  .start-actions .button {
    width: 100%;
    text-align: center;
  }
  .start-actions > p {
    line-height: 1.8;
    font-size: var(--text-sm);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  h4 {
    font-size: 1rem;
    margin-top: 26px;
  }
  @media (max-width: 650px) {
    .picker-heading {
      display: block;
    }
    .picker-heading > a {
      display: inline-block;
      margin-bottom: 16px;
    }
    .part-tabs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .mode-tabs {
      gap: 7px;
    }
    .mode-tabs button {
      font-size: var(--text-sm);
      padding: 10px 12px;
    }
    .story-path {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .story-path button {
      padding: 16px 18px;
    }
    .story-path strong {
      margin: 7px 0;
    }
    .episode-preview {
      grid-template-columns: 1fr;
      gap: 22px;
      padding: 22px;
    }
    .life-scenes {
      grid-template-columns: 1fr;
    }
    .other-scenes summary span {
      display: block;
      margin: 8px 0 0;
    }
    .part-intro p {
      line-height: 1.8;
    }
  }
</style>
