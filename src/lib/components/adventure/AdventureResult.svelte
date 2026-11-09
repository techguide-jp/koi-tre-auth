<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import type { PracticeSession } from '$lib/practice'
  import {
    characterById,
    episodeById,
    adventureAccess,
    nextEpisode,
    isLifeEpisode,
    missions,
    type Adventure,
    type AdventureProgress
  } from '$lib/adventure'
  import { storyPart } from '$lib/adventure-story'
  import { authenticatedFetch } from '$lib/stores'
  import CharacterPortrait from './CharacterPortrait.svelte'
  import SpecialCardArt from './SpecialCardArt.svelte'
  import { earnedSpecialCard } from '$lib/special-card-art'
  import StageEvaluation from './StageEvaluation.svelte'
  import RelationshipMeter from './RelationshipMeter.svelte'
  import CharacterAffinityReaction from './CharacterAffinityReaction.svelte'
  import { affinityReaction } from '$lib/affinity-reaction'
  export let session: PracticeSession
  export let enabled = true
  export let starting = false
  export let animateAffinity = false
  const dispatch = createEventDispatcher<{ update: PracticeSession; next: Adventure }>()
  let progress: AdventureProgress | null = null
  let progressLoading = false
  let progressError = ''
  let pendingAction: 'favorite' | 'rehearsal' | 'ending' | null = null
  let message = ''
  let success = ''
  let position = session.rehearsal?.position ?? session.turns.length
  let text = session.rehearsal?.text ?? session.turns.at(-1)?.userText ?? ''
  let favoritePosition = session.favoriteTurn ?? session.turns.length
  let attempt = {
    requestId: session.rehearsal?.requestId ?? '',
    text: session.rehearsal?.text ?? '',
    position
  }
  let alive = false
  let timer: ReturnType<typeof setTimeout> | undefined
  $: adventure = session.adventure!
  $: character = characterById(adventure.characterId)!
  $: episode = episodeById(adventure.episodeId)!
  $: last = session.turns.at(-1)
  $: cleared =
    progress?.progression?.clearedEpisodes.includes(
      `${adventure.characterId}:${adventure.episodeId}`
    ) ?? false
  $: nextRule = progress?.stages?.find(
    (stage) => stage.characterId === adventure.characterId && stage.episodeId === next.id
  )
  $: next =
    (episode.chapter === 12 && cleared) || isLifeEpisode(episode.id)
      ? episodeById('daily-today')!
      : nextEpisode(
          adventure.characterId,
          progress?.progression?.clearedEpisodes ?? progress?.completedEpisodes ?? []
        )
  let nextSelection: Adventure
  $: nextSelection = {
    version: 1,
    characterId: adventure.characterId,
    episodeId: next.id,
    turns: adventure.turns
  }
  $: nextAccess = adventureAccess(
    nextSelection,
    progress?.completedEpisodes ?? [],
    progress?.billing?.ownedCharacters ?? [],
    !!progress?.billing?.subscription?.active,
    new Date(),
    progress?.progression
  )
  $: baseXp = (session.reward?.xp ?? 20) >= 50 ? 50 : 20
  $: missionXp = session.reward?.xp === 70 ? 20 : 10
  $: part = storyPart(episode.chapter)
  $: artwork = earnedSpecialCard(session)
  $: reaction = affinityReaction(session)
  $: selectedEnding = progress?.endings?.some((e) => e.practiceId === session.id && e.selected)
  onMount(() => {
    alive = true
    void loadProgress()
    if (
      session.rehearsal &&
      !session.rehearsal.reply &&
      session.pending?.until &&
      new Date(session.pending.until).getTime() > Date.now()
    ) {
      pendingAction = 'rehearsal'
      timer = setTimeout(poll, 2000)
    }
    return () => {
      alive = false
      clearTimeout(timer)
    }
  })
  async function loadProgress() {
    progressLoading = true
    progressError = ''
    try {
      const response = await authenticatedFetch('/api/me/adventure')
      const value = await response.json()
      if (alive) progress = value
    } catch {
      if (alive)
        progressError = '次の物語を確認できませんでした。今回の会話と報酬は保存されています。'
    } finally {
      if (alive) progressLoading = false
    }
  }
  function apply(value: PracticeSession) {
    session = value
    dispatch('update', value)
  }
  async function chooseEnding() {
    if (pendingAction) return
    pendingAction = 'ending'
    message = ''
    success = ''
    try {
      await authenticatedFetch(`/api/me/practices/${session.id}/ending`, {
        method: 'POST',
        body: '{}'
      })
      await loadProgress()
      if (alive) success = 'この結末を、これからの交流へ引き継ぎました。'
    } catch (e) {
      if (alive) message = e instanceof Error ? e.message : '結末を保存できませんでした。'
    } finally {
      if (alive) pendingAction = null
    }
  }
  async function poll() {
    try {
      const result = await authenticatedFetch(`/api/me/practices/${session.id}`)
      const value: PracticeSession = await result.json()
      if (!alive) return
      apply(value)
      if (
        !value.rehearsal?.reply &&
        value.pending?.until &&
        new Date(value.pending.until).getTime() > Date.now()
      )
        timer = setTimeout(poll, 2000)
      else pendingAction = null
    } catch {
      if (alive) {
        pendingAction = null
        message = '言い直しの状態を確認できませんでした。もう一度お試しください。'
      }
    }
  }
  async function favorite(position: number | null) {
    if (pendingAction) return
    pendingAction = 'favorite'
    message = ''
    success = ''
    try {
      const response = await authenticatedFetch(`/api/me/practices/${session.id}/favorite`, {
        method: 'POST',
        body: JSON.stringify({ position })
      })
      const result = await response.json()
      if (alive) {
        apply(result)
        success = position === null ? 'アルバムから外しました。' : '思い出アルバムに保存しました。'
      }
    } catch (error) {
      if (alive) message = error instanceof Error ? error.message : '保存できませんでした。'
    } finally {
      if (alive) pendingAction = null
    }
  }
  async function rehearse() {
    if (pendingAction || !text.trim() || !enabled) return
    pendingAction = 'rehearsal'
    message = ''
    success = ''
    if (!attempt.requestId || attempt.text !== text.trim() || attempt.position !== position)
      attempt = { requestId: crypto.randomUUID(), text: text.trim(), position }
    try {
      const response = await authenticatedFetch(`/api/me/practices/${session.id}/rehearsal`, {
        method: 'POST',
        body: JSON.stringify(attempt)
      })
      const result = await response.json()
      if (alive) {
        apply(result)
        if (response.status === 202) timer = setTimeout(poll, 2000)
        else pendingAction = null
      }
    } catch (error) {
      if (alive) {
        message = error instanceof Error ? error.message : '返答を作れませんでした。'
        pendingAction = null
      }
    }
  }
</script>

<section class="adventure-result" aria-label="エピソードの報酬と思い出">
  {#if artwork}<div class="memory-card deep scene-reward">
      <div class="special-image"><SpecialCardArt art="{artwork}" priority /></div>
      <div class="memory-copy special-copy">
        <p class="collection-stamp">✦ 場面限定イラスト</p>
        <p class="eyebrow">{character.name}と、じっくり話した一枚</p>
        <h2>{episode.title}</h2>
        <blockquote>「{last?.assistantText}」</blockquote>
        <p class="small muted">
          思い出アルバムに保存しました。<br />絵をタップすると、大きく鑑賞できます。
        </p>
      </div>
    </div>{:else}<div class="memory-card {episode.theme}">
      <div class="memory-art">
        <CharacterPortrait
          characterId="{character.id}"
          emotion="{last?.presentation?.emotion ?? 'neutral'}"
        />
      </div>
      <div class="memory-copy">
        <p class="eyebrow">
          {character.name}との、{adventure.turns === 6 ? 'じっくり話した特別な一枚' : '今日の一枚'}
        </p>
        <h2>{episode.title}</h2>
        <blockquote>「{last?.assistantText}」</blockquote>
        <p class="small muted">このエピソードを、思い出アルバムに残しました。</p>
      </div>
    </div>{/if}
  <StageEvaluation
    enabled="{enabled}"
    session="{session}"
    cleared="{cleared}"
    on:update="{async (event) => {
      apply(event.detail)
      await loadProgress()
    }}"
  />
  {#if progress?.progression}<RelationshipMeter
      name="{character.name}"
      value="{progress.progression.relationships.find((r) => r.characterId === character.id)
        ?.affinity ?? 0}"
      required="{nextRule?.requiredAffinity ?? 0}"
      previous="{session.evaluation &&
      progress.progression.relationships.find((r) => r.characterId === character.id)?.affinity ===
        session.evaluation.affinityAfter
        ? session.evaluation.affinityBefore
        : null}"
      animate="{animateAffinity}"
    >
      <svelte:fragment slot="reaction" let:active let:revealed>
        {#if reaction}<CharacterAffinityReaction
            reaction="{reaction}"
            active="{active}"
            revealed="{revealed}"
          />{/if}
      </svelte:fragment>
    </RelationshipMeter>{/if}
  <div class="reward" role="status">
    <div>
      <p class="eyebrow">エピソード完了</p>
      <strong>+{session.reward?.xp ?? 20} <span>XP</span></strong>
      <p>会話を終えた経験に、{baseXp}XP。</p>
    </div>
    <div>
      <p class="mission-label">✦ {missions[episode.missionId].label}</p>
      {#if session.reward?.mission}<p class="mission-achieved">ミッション達成！ +{missionXp}XP</p>
        <details>
          <summary>達成したひと言</summary
          >{#each session.reward.mission.evidence as evidence}<blockquote>
              {evidence.turn}回目「{evidence.quote}」
            </blockquote>{/each}
        </details>{:else}<p class="small muted">
          今回の挑戦を、次の会話にも。
        </p>{/if}{#if progress}<p class="small muted">
          Lv.{progress.level} · 合計 {progress.xp} XP
        </p>{/if}
    </div>
  </div>
  {#if session.storyEnding}<section class="ending-card">
      <p class="eyebrow">二人の物語の、ひと区切り</p>
      <h2>
        {session.storyEnding.kind === 'lovers' ? '恋人として、ここから' : '急がずに、もう少しずつ'}
      </h2>
      <p>{session.storyEnding.reason}</p>
      {#if selectedEnding}<p class="small">
          この結末を、日常交流へ引き継いでいます。
        </p>{:else if session.evaluation?.status !== 'passed' || !cleared}<p class="small">
          この結末の記録は残ります。第12話を新基準でクリアすると、日常交流へ引き継げます。
        </p>{:else}<button
          class="button secondary"
          disabled="{!!pendingAction}"
          aria-busy="{pendingAction === 'ending'}"
          on:click="{chooseEnding}"
          >{pendingAction === 'ending' ? '結末を保存中…' : 'この結末を日常交流へ引き継ぐ'}</button
        >{/if}
    </section>{/if}
  {#if nextRule && next.id !== episode.id}
    <p class="small muted">
      次の話は {nextRule.requiredScore} / 25点・配慮 {nextRule.requiredConsideration}点以上が目標。
      必要好感度 {nextRule.requiredAffinity}（現在 {nextRule.affinity}）{nextRule.affinityGap > 0
        ? `、あと${nextRule.affinityGap}`
        : ''}。
      {#if nextRule.lockedReasons.includes('previous')}前の話のクリアが必要です。{/if}
      {#if nextRule.lockedReasons.includes('purchase')}この人物のルートパックが必要です。{/if}
    </p>
  {/if}
  <div class="next-actions">
    {#if nextAccess === 'affinity' || nextAccess === 'locked'}<a
        class="button primary"
        href="/?character={adventure.characterId}#scenes">次の条件と、練習する場面を見る →</a
      >
    {:else if adventure.revisit}<a
        class="button primary"
        href="/?character={adventure.characterId}&part={part?.id ?? 'meeting'}&mode=revisit#scenes"
        >同じパートで、別の場面を練習 →</a
      >{:else if nextAccess === 'purchase'}<a
        class="button primary"
        href="/pricing?character={adventure.characterId}">{character.name}の、本編の続きへ →</a
      >{:else if nextAccess === 'plus'}<a
        class="button primary"
        href="/pricing?character={adventure.characterId}#plus">今の二人で話してみる · Plus →</a
      >{:else}<button
        class="button primary"
        disabled="{starting || !enabled || !!pendingAction || !progress}"
        aria-busy="{starting}"
        on:click="{() => dispatch('next', nextSelection)}"
        >{starting
          ? '次の場面を準備しています…'
          : isLifeEpisode(next.id)
            ? '今の二人で話してみる'
            : next.id === episode.id
              ? 'この話にもう一度挑戦'
              : '次のエピソードへ'} →</button
      >{/if}
    <a class="button secondary" href="/memories">思い出アルバム</a>
  </div>
  {#if part}<a
      class="small"
      href="/?character={adventure.characterId}&part={part.id}&mode=revisit#scenes"
      >{part.label}に戻って練習する →</a
    >{/if}
  <p class="small muted">
    新しい練習は3往復1枠・6往復2枠を使います。今回の会話はいつでも読み返せます。
  </p>
  {#if progressError}
    <p class="small" role="status">{progressError}</p>
    <button
      class="text-button"
      disabled="{progressLoading}"
      aria-busy="{progressLoading}"
      on:click="{loadProgress}">{progressLoading ? '確認中…' : 'もう一度確認する'}</button
    >
  {/if}
  <details class="keepsake">
    <summary>気に入った、自分のひと言を残す <span aria-hidden="true">⌄</span></summary><label
      for="favorite-turn">アルバムに残す返答</label
    ><select id="favorite-turn" bind:value="{favoritePosition}" disabled="{!!pendingAction}"
      >{#each session.turns as turn}<option value="{turn.position}"
          >{turn.position}回目：{turn.userText.slice(0, 50)}</option
        >{/each}</select
    >
    <div class="inline-actions">
      <button
        class="button secondary"
        disabled="{!!pendingAction}"
        aria-busy="{pendingAction === 'favorite'}"
        on:click="{() => favorite(favoritePosition)}"
        >{pendingAction === 'favorite' ? '保存中…' : 'このひと言を保存'}</button
      >{#if session.favoriteTurn}<button
          class="text-button"
          disabled="{!!pendingAction}"
          on:click="{() => favorite(null)}">保存を外す</button
        >{/if}
    </div>
  </details>
  <details class="rehearsal" open="{!!session.rehearsal}">
    <summary>ひと言、言い直してみる <span class="small">この練習で1回</span></summary
    >{#if session.rehearsal?.reply}<div class="rehearsal-result">
        <div class="rehearsal-art">
          <CharacterPortrait
            characterId="{character.id}"
            emotion="{session.rehearsal.presentation?.emotion ?? 'neutral'}"
          />
        </div>
        <div>
          <p class="small muted">{session.rehearsal.position}回目を、こんなふうに</p>
          <blockquote>あなた「{session.rehearsal.text}」</blockquote>
          <blockquote>{character.name}「{session.rehearsal.reply}」</blockquote>
          {#if session.rehearsal.presentation?.gesture}<p class="small muted">
              {session.rehearsal.presentation.gesture}
            </p>{/if}
        </div>
      </div>{:else}<p class="small muted">
        同じ相手に、別の言い方で。元の会話と振り返りを残したまま、反応を一度試せます。追加の利用枠やXPの変動はありません。
      </p>
      <form on:submit|preventDefault="{rehearse}">
        <label for="rehearsal-turn">言い直す返答</label><select
          id="rehearsal-turn"
          bind:value="{position}"
          disabled="{!!pendingAction}"
          on:change="{() =>
            (text = session.turns.find((turn) => turn.position === position)?.userText ?? '')}"
          >{#each session.turns as turn}<option value="{turn.position}"
              >{turn.position}回目：{turn.userText.slice(0, 50)}</option
            >{/each}</select
        ><label for="rehearsal-text">今なら、どう伝えますか？</label><textarea
          id="rehearsal-text"
          bind:value="{text}"
          maxlength="1000"
          rows="3"
          required
          disabled="{!!pendingAction}"
        ></textarea><button
          class="button secondary"
          type="submit"
          disabled="{!!pendingAction || !enabled || !text.trim()}"
          aria-busy="{pendingAction === 'rehearsal'}"
          >{pendingAction === 'rehearsal' ? '返答を考えています…' : 'この言い方を試す'}</button
        >
      </form>{/if}
  </details>
  {#if message}<p class="error" role="alert">{message}</p>{/if}{#if success}<p
      class="notice"
      role="status"
    >
      {success}
    </p>{/if}
</section>

<style>
  .memory-card.deep {
    border: 2px solid #a89366;
    box-shadow: 0 8px 28px #a893661a;
  }
  .memory-card.scene-reward {
    grid-template-columns: 1fr 1.05fr;
    padding: 0;
    gap: 0;
    background: linear-gradient(135deg, #f7f0df, #fffaf0);
  }
  .special-image {
    width: 100%;
    align-self: stretch;
    display: flex;
    align-items: center;
    background: #e5e1d4;
  }
  .special-image :global(.art-open) {
    width: 100%;
  }
  .special-copy {
    padding: 24px;
  }
  .special-copy h2 {
    font-size: 1.25rem;
  }
  .special-copy .collection-stamp {
    font-size: var(--text-xs);
    letter-spacing: 0.1em;
    color: #7f652e;
    margin: 0 0 20px;
  }
  .ending-card {
    padding: 26px;
    margin: 24px 0;
    background: linear-gradient(135deg, #f0e4d5, #e8eddc);
    border: 1px solid var(--border);
    border-radius: 18px;
  }
  .ending-card h2 {
    font-size: 1.5rem;
    margin: 12px 0;
  }
  .ending-card > p {
    font-size: var(--text-base);
    line-height: 1.9;
  }
  .adventure-result {
    margin: 32px 0;
  }
  .memory-card {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 20px;
    align-items: center;
    background: linear-gradient(135deg, #e7e7d9, #faf0de);
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    padding: 20px 24px 0;
  }
  .memory-card.evening {
    background: linear-gradient(135deg, #e4dcd6, #f4e9d3);
  }
  .memory-art {
    align-self: end;
  }
  .memory-copy {
    padding-bottom: 20px;
  }
  .memory-copy h2 {
    font-family: var(--font-editorial);
    font-size: 1.4rem;
    line-height: 1.7;
    margin: 10px 0;
  }
  .memory-copy blockquote {
    margin: 12px 0;
    font-size: var(--text-base);
    line-height: 1.9;
  }
  .reward {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 24px;
    padding: 28px 0;
    align-items: center;
  }
  .reward strong {
    font-size: 2.5rem;
    color: var(--accent);
    letter-spacing: 0.02em;
  }
  .reward strong span {
    font-size: 1rem;
  }
  .reward p {
    font-size: var(--text-sm);
    margin: 6px 0;
  }
  .reward .mission-label {
    font-weight: 650;
    color: var(--olive);
  }
  .mission-achieved {
    color: var(--accent);
    font-weight: 700;
  }
  .reward details {
    font-size: var(--text-sm);
    margin-top: 10px;
  }
  .reward blockquote {
    margin: 10px 0;
    line-height: 1.8;
  }
  .next-actions,
  .inline-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  .keepsake,
  .rehearsal {
    border-top: 1px solid var(--border);
    padding: 20px 0;
  }
  .keepsake summary,
  .rehearsal summary {
    cursor: pointer;
    font-size: var(--text-base);
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .keepsake label,
  .rehearsal label {
    display: block;
    font-size: var(--text-sm);
    margin: 18px 0 8px;
  }
  select,
  textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    font: inherit;
    color: var(--ink);
  }
  select {
    font-size: var(--text-sm);
  }
  .inline-actions {
    margin-top: 14px;
  }
  .text-button {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .rehearsal form > .button {
    margin-top: 16px;
  }
  .rehearsal .small {
    line-height: 1.8;
  }
  .rehearsal-result {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 18px;
    align-items: center;
    margin-top: 16px;
  }
  .rehearsal-result blockquote {
    font-size: var(--text-base);
    line-height: 1.9;
    margin: 12px 0;
  }
  .rehearsal-art {
    background: var(--surface-soft);
    border-radius: 12px;
    overflow: hidden;
  }
  @media (max-width: 580px) {
    .memory-card.scene-reward {
      grid-template-columns: 1fr;
      padding: 0;
      gap: 0;
    }
    .special-copy {
      padding: 22px;
    }
    .special-copy .collection-stamp {
      margin-bottom: 14px;
    }
    .memory-card {
      grid-template-columns: 110px 1fr;
      padding: 16px 16px 0;
      gap: 12px;
    }
    .memory-copy h2 {
      font-size: 1.05rem;
    }
    .memory-copy blockquote {
      font-size: var(--text-sm);
    }
    .memory-copy .small {
      font-size: var(--text-sm);
    }
    .reward {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .next-actions > .button {
      width: 100%;
    }
    .rehearsal-result {
      grid-template-columns: 85px 1fr;
      gap: 12px;
    }
    .rehearsal summary {
      flex-wrap: wrap;
    }
  }
</style>
