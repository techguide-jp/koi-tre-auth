<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import type { PracticeSession } from '$lib/practice'
  import {
    characterById,
    episodes,
    episodeKey,
    episodeUnlocked,
    missions,
    type Adventure,
    type AdventureProgress
  } from '$lib/adventure'
  import { authenticatedFetch } from '$lib/stores'
  import CharacterPortrait from './CharacterPortrait.svelte'
  export let session: PracticeSession
  export let enabled = true
  export let starting = false
  const dispatch = createEventDispatcher<{ update: PracticeSession; next: Adventure }>()
  let progress: AdventureProgress | null = null
  let progressLoading = false
  let progressError = ''
  let pendingAction: 'favorite' | 'rehearsal' | null = null
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
  $: episode = episodes.find((e) => e.id === adventure.episodeId)!
  $: last = session.turns.at(-1)
  $: next =
    episodes.find(
      (e) =>
        (!e.characterId || e.characterId === adventure.characterId) &&
        !progress?.completedEpisodes.includes(episodeKey(adventure.characterId, e.id)) &&
        episodeUnlocked({ ...adventure, episodeId: e.id }, progress?.completedEpisodes ?? [])
    ) ?? episodes.find((e) => !e.characterId)!
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
  <div class="memory-card {episode.theme}">
    <div class="memory-art">
      <CharacterPortrait
        characterId="{character.id}"
        emotion="{last?.presentation?.emotion ?? 'neutral'}"
      />
    </div>
    <div class="memory-copy">
      <p class="eyebrow">{character.name}との、今日の一枚</p>
      <h2>{episode.title}</h2>
      <blockquote>「{last?.assistantText}」</blockquote>
      <p class="small muted">このエピソードを、思い出アルバムに残しました。</p>
    </div>
  </div>
  <div class="reward" role="status">
    <div>
      <p class="eyebrow">エピソード完了</p>
      <strong>+{session.reward?.xp ?? 20} <span>XP</span></strong>
      <p>会話を終えた経験に、20XP。</p>
    </div>
    <div>
      <p class="mission-label">✦ {missions[episode.missionId].label}</p>
      {#if session.reward?.mission}<p class="mission-achieved">ミッション達成！ +10XP</p>
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
  <div class="next-actions">
    <button
      class="button primary"
      disabled="{starting || !enabled || !!pendingAction || !progress}"
      aria-busy="{starting}"
      on:click="{() => dispatch('next', { ...adventure, episodeId: next.id })}"
      >{starting ? '次の物語を準備しています…' : '次のエピソードへ'} →</button
    ><a class="button secondary" href="/memories">思い出アルバム</a>
  </div>
  <p class="small muted">次の練習は別の1回分になります。今回の会話はいつでも読み返せます。</p>
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
    font-size: 0.9rem;
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
    font-size: 0.85rem;
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
    font-size: 0.8rem;
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
    font-size: 0.95rem;
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .keepsake label,
  .rehearsal label {
    display: block;
    font-size: 0.8rem;
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
    font-size: 0.85rem;
  }
  .inline-actions {
    margin-top: 14px;
  }
  .text-button {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.8rem;
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
    font-size: 0.88rem;
    line-height: 1.9;
    margin: 12px 0;
  }
  .rehearsal-art {
    background: var(--surface-soft);
    border-radius: 12px;
    overflow: hidden;
  }
  @media (max-width: 580px) {
    .memory-card {
      grid-template-columns: 110px 1fr;
      padding: 16px 16px 0;
      gap: 12px;
    }
    .memory-copy h2 {
      font-size: 1.05rem;
    }
    .memory-copy blockquote {
      font-size: 0.8rem;
    }
    .memory-copy .small {
      font-size: 0.7rem;
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
