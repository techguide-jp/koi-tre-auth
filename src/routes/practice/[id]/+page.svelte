<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import {
    resolveScene,
    MAX_MESSAGE_LENGTH,
    practiceTurnLimit,
    type PracticeSession
  } from '$lib/practice'
  import { getAnalyticsContext } from '$lib/analytics'
  import { startPractice } from '$lib/practice-client'
  import { isFinalPracticeReply } from '$lib/practice-tips'
  import PracticeWaitTip from '$lib/components/PracticeWaitTip.svelte'
  import { guestFetch } from '$lib/guest-practice-client'
  import { guestLoginUrl } from '$lib/guest-practice'
  import GuestPracticeResult from '$lib/components/adventure/GuestPracticeResult.svelte'
  import PracticeAnalysis from '$lib/components/PracticeAnalysis.svelte'
  import PracticeAspectChart from '$lib/components/PracticeAspectChart.svelte'
  import CharacterPortrait from '$lib/components/adventure/CharacterPortrait.svelte'
  import AdventureResult from '$lib/components/adventure/AdventureResult.svelte'
  import { characterById, emotionLabels, episodeById, type Adventure } from '$lib/adventure'
  export let data
  let session: PracticeSession | null = null
  let text = ''
  let requestId = ''
  let requestText = ''
  let expectedTurn = 0
  let loading = false
  let claiming = false
  let pending = false
  let waitingTipRequestId = ''
  let offeredTipRequestId = ''
  let revealResult = false
  let restarting = false
  let animateAffinity = false
  let message = ''
  let mounted = false
  let loadedKey = ''
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let bottom: HTMLDivElement
  let reactionAnchor: HTMLDivElement
  $: scene = session
    ? resolveScene(session.sceneId, session.customScene, session.adventure)
    : undefined
  $: turnLimit = practiceTurnLimit(session?.adventure)
  $: finalReply = !!session && isFinalPracticeReply(session)
  $: character = characterById(session?.adventure?.characterId)
  $: episode = episodeById(session?.adventure?.episodeId)
  $: presentation = session?.turns.at(-1)?.presentation
  $: feedback = session?.turns.at(-1)?.feedback
  $: resultReady = !!session?.completedAt && !!feedback
  $: guestRoute = $page.url.searchParams.get('guest') === '1'
  $: guestMode = guestRoute && !$user
  $: sessionKey = `${$user?.uid ?? (guestRoute ? 'guest' : 'none')}:${$page.params.id}`
  $: storageKey = `koi-practice-draft:${sessionKey}`
  $: if (mounted && $authReady && ($user || guestRoute) && loadedKey !== sessionKey) {
    loadedKey = sessionKey
    session = null
    waitingTipRequestId = ''
    offeredTipRequestId = ''
    revealResult = false
    animateAffinity = false
    text = ''
    message = ''
    void load(true)
  }
  $: if (!$user && !guestRoute) {
    session = null
    waitingTipRequestId = ''
    offeredTipRequestId = ''
    revealResult = false
    loadedKey = ''
    text = ''
  }
  $: if (revealResult && resultReady && !waitingTipRequestId) {
    revealResult = false
    void tick().then(() => {
      bottom?.focus({ preventScroll: true })
      bottom?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
      clearTimeout(pollTimer)
    }
  })

  function saveDraft() {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ text, requestId, requestText, expectedTurn })
      )
    } catch {
      /* 保存不可でもサーバー上の会話は再開できる。 */
    }
  }
  function readDraft() {
    try {
      const raw =
        sessionStorage.getItem(storageKey) ??
        (guestRoute ? sessionStorage.getItem(`koi-practice-draft:guest:${$page.params.id}`) : null)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (typeof draft.text === 'string') text = draft.text.slice(0, MAX_MESSAGE_LENGTH)
      if (typeof draft.requestId === 'string' && typeof draft.requestText === 'string') {
        requestId = draft.requestId
        requestText = draft.requestText
        expectedTurn = Number(draft.expectedTurn)
      }
    } catch {
      /* 壊れた下書きは利用しない。 */
    }
  }
  function offerWaitingTip(practice: PracticeSession, finalRequestId: string) {
    if (!isFinalPracticeReply(practice)) return
    revealResult = false
    waitingTipRequestId = finalRequestId
    offeredTipRequestId = finalRequestId
  }

  function dismissWaitingTip() {
    waitingTipRequestId = ''
    revealResult = true
  }

  function applySession(result: PracticeSession, initial = false) {
    // 履歴の読み直しを新しい獲得に見せず、この画面で完了・再評価した差分だけを動かす。
    if (initial) animateAffinity = false
    else if (
      session?.id === result.id &&
      ((!session.completedAt && !!result.completedAt) ||
        ((!session.evaluation || session.evaluation.status === 'pending') &&
          result.evaluation &&
          result.evaluation.status !== 'pending'))
    )
      animateAffinity = true
    session = result
    if (initial) readDraft()
    const saved = result.turns.some((turn) => turn.requestId === requestId)
    if (saved || result.completedAt) {
      text = ''
      requestId = ''
      requestText = ''
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* 同上 */
      }
    }
    if (result.pending && !result.completedAt) {
      text = result.pending.text
      requestId = result.pending.requestId
      requestText = text
      expectedTurn = result.turns.length
      saveDraft()
    }
    pending =
      !result.completedAt &&
      !!result.pending?.until &&
      new Date(result.pending.until).getTime() > Date.now()
    // 閉じたTipsを定期取得で開き直さず、再開した最終返答だけ新たに案内する。
    if (pending && result.pending && offeredTipRequestId !== result.pending.requestId)
      offerWaitingTip(result, result.pending.requestId)
    else if (!pending && (!result.completedAt || !result.turns.at(-1)?.feedback))
      waitingTipRequestId = ''
    clearTimeout(pollTimer)
    if (pending && mounted) pollTimer = setTimeout(() => void load(false), 2000)
    if (saved && (!result.completedAt || (!waitingTipRequestId && !revealResult))) {
      void tick().then(() => {
        if (!mounted) return
        const target = result.adventure && !result.completedAt ? reactionAnchor : bottom
        target?.scrollIntoView({
          behavior: result.adventure ? 'auto' : 'smooth',
          block: result.adventure ? 'start' : 'nearest'
        })
      })
    }
  }
  async function load(initial = false) {
    if (initial) loading = true
    const key = sessionKey
    try {
      const importing = guestRoute && !!$user
      claiming = importing
      const response = importing
        ? await authenticatedFetch(`/api/guest/practices/${$page.params.id}/claim`, {
            method: 'POST',
            body: '{}'
          })
        : guestMode
          ? await guestFetch(`/api/guest/practices/${$page.params.id}`)
          : await authenticatedFetch(`/api/me/practices/${$page.params.id}`)
      const result = await response.json()
      if (key === sessionKey && mounted) {
        if (importing && response.status === 202) {
          clearTimeout(pollTimer)
          pollTimer = setTimeout(() => void load(initial), 2000)
          return
        }
        claiming = false
        applySession(result, initial)
        if (importing)
          await goto(`/practice/${$page.params.id}`, { replaceState: true, noScroll: true })
      }
    } catch (error) {
      if (key === sessionKey) {
        pending = false
        waitingTipRequestId = ''
        claiming = false
        message = error instanceof Error ? error.message : '会話を読み込めませんでした。'
      }
    } finally {
      if (key === sessionKey) loading = false
    }
  }
  async function send() {
    if (!session || pending || !text.trim() || text.length > MAX_MESSAGE_LENGTH) return
    if (!requestId || requestText !== text.trim() || expectedTurn !== session.turns.length) {
      requestId = crypto.randomUUID()
      requestText = text.trim()
      expectedTurn = session.turns.length
    }
    saveDraft()
    pending = true
    offerWaitingTip(session, requestId)
    message = ''
    const key = sessionKey
    try {
      const analyticsContext = await getAnalyticsContext()
      const response = await (guestMode ? guestFetch : authenticatedFetch)(
        `/api/${guestMode ? 'guest' : 'me'}/practices/${session.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ requestId, text: requestText, expectedTurn, analyticsContext })
        }
      )
      const result = await response.json()
      if (key === sessionKey && mounted) applySession(result)
    } catch (error) {
      if (key === sessionKey && mounted) {
        pending = false
        waitingTipRequestId = ''
        message =
          error instanceof Error
            ? error.message
            : '返答を受け取れませんでした。もう一度お試しください。'
        await load()
      }
    }
  }
  async function retryLoad() {
    message = ''
    await load(true)
  }
  async function restart() {
    if (!scene || restarting) return
    restarting = true
    message = ''
    try {
      const result = await startPractice(scene.id, session?.customScene, session?.adventure)
      await goto(`/practice/${result.id}`)
    } catch (error) {
      message = error instanceof Error ? error.message : '開始できませんでした。'
    } finally {
      restarting = false
    }
  }
  async function nextAdventure(adventure: Adventure) {
    if (restarting) return
    restarting = true
    message = ''
    try {
      const result = await startPractice('adventure', null, adventure)
      await goto(`/practice/${result.id}`)
    } catch (error) {
      message = error instanceof Error ? error.message : '開始できませんでした。'
    } finally {
      restarting = false
    }
  }
</script>

<svelte:head
  ><title>{scene?.title ?? '会話の練習'} | Koi-Tre</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<div class="practice-shell">
  <a class="text-link" href="/#scenes">← お相手・場面選択へ</a>
  {#if !$authReady}<p role="status" class="notice">ログイン状態を確認しています…</p>
  {:else if !$user && !guestRoute}<section class="card empty">
      <h1>ログインして続きを練習</h1>
      <p>練習したアカウントでログインすると、会話を再開できます。</p>
      <a class="button primary" href="{`/login?practice=${$page.params.id}`}">Googleでログイン</a>
    </section>
  {:else if claiming}<p class="notice" role="status">体験の会話と評価を保存しています…</p>
  {:else if session && scene}
    <header class="practice-heading">
      <div>
        <p class="eyebrow">{guestMode ? 'ログインせず第1話を体験' : '会話の練習'}</p>
        <h1>{scene.title}</h1>
        <p class="muted">{scene.goal}</p>
      </div>
      <span class="progress"
        >{session.completedAt
          ? '練習完了'
          : `${Math.min(session.turns.length + 1, turnLimit)} / ${turnLimit}`}</span
      >
    </header>
    <div class="progress-track" aria-label="{`${session.turns.length}回返答済み`}">
      <span style="{`width:${(session.turns.length / turnLimit) * 100}%`}"></span>
    </div>
    {#if character && episode && session.adventure}
      {#if !session.completedAt}
        <div bind:this="{reactionAnchor}"></div>
        <section
          class="character-stage {episode.theme}"
          aria-label="{`${character.name}のリアクション`}"
        >
          <div class="stage-caption">
            <span>{character.name} · {character.age}歳</span><span class="ai-label"
              >AIの練習相手</span
            >
          </div>
          <div class="stage-art">
            <CharacterPortrait
              characterId="{character.id}"
              emotion="{presentation?.emotion ?? 'neutral'}"
            />
          </div>
          <div class="stage-mood" aria-live="polite">
            <span>{emotionLabels[presentation?.emotion ?? 'neutral']}</span
            >{#if presentation?.gesture}<p>{presentation.gesture}</p>{/if}
          </div>
          <div class="stage-dialogue">
            <p>{session.turns.at(-1)?.assistantText ?? scene.opener}</p>
          </div>
        </section>
      {/if}
      <details class="scene-setting">
        <summary>この場面について</summary>
        <p>{scene.situation}</p>
        <p>{character.description}</p>
      </details>
    {:else}
      {#if scene.situation}<section class="custom-context" aria-label="設定した場面">
          <p class="eyebrow">設定した場面</p>
          <p>{scene.situation}</p>
        </section>{/if}
      <aside class="partner-profile" aria-label="会話の相手">
        <span class="partner-avatar" aria-hidden="true">{scene.partnerName.slice(0, 1)}</span>
        <div>
          <p><strong>{scene.partnerName}さん</strong><span class="ai-label">AIの練習相手</span></p>
          <p>{scene.partnerDescription}</p>
          <p class="partner-address">「{scene.partnerName}さん」と呼びかけて話せます。</p>
        </div>
      </aside>
    {/if}
    <svelte:element this="{session.adventure ? 'details' : 'div'}" class="conversation-log">
      {#if session.adventure}<summary
          >これまでの会話を読む <span>{session.turns.length}往復</span></summary
        >{/if}
      <section class="conversation" aria-label="練習の会話">
        <div class="line partner">
          <span class="speaker">{scene.partnerName}さん</span>
          <p>{scene.opener}</p>
        </div>
        {#each session.turns as turn}<div class="line mine">
            <span class="speaker">あなた · {turn.position}回目</span>
            <p>{turn.userText}</p>
          </div>
          <div class="line partner">
            <span class="speaker">{scene.partnerName}さん</span>
            <p>{turn.assistantText}</p>
          </div>{/each}
      </section>
    </svelte:element>
    <div bind:this="{bottom}" tabindex="-1" aria-label="練習結果"></div>
    {#if waitingTipRequestId}
      {#key waitingTipRequestId}
        <PracticeWaitTip
          practiceId="{session.id}"
          requestId="{waitingTipRequestId}"
          guest="{guestMode}"
          ready="{resultReady}"
          dismiss="{dismissWaitingTip}"
        />
      {/key}
    {/if}
    {#if pending}<p class="notice" role="status" aria-live="polite">
        {finalReply ? '会話全体を振り返り、分析と言い換えをまとめています…' : '返答を考えています…'} この画面を閉じても、あとから再開できます。
      </p>{/if}
    {#if message && !session.completedAt}<p class="error" role="alert">{message}</p>{/if}
    {#if session.completedAt && feedback && !waitingTipRequestId}
      {#if guestMode}<GuestPracticeResult session="{session}" />
      {:else if session.adventure}<AdventureResult
          session="{session}"
          enabled="{data.practiceEnabled}"
          starting="{restarting}"
          animateAffinity="{animateAffinity}"
          on:update="{(event) => applySession(event.detail)}"
          on:next="{(event) => nextAdventure(event.detail)}"
        />{/if}
      <section class="card feedback" aria-label="練習の振り返り">
        <p class="eyebrow">会話を、次につなげよう。</p>
        <h2>おつかれさまでした。</h2>
        <p class="muted">{turnLimit}回のやりとりを振り返り、あなたの言葉をもっと話しやすく。</p>
        {#if feedback.analysis}
          <PracticeAnalysis
            analysis="{feedback.analysis}"
            assessment="{session.evaluation?.assessment}"
          />
        {:else}
          {#if session.evaluation?.assessment}<PracticeAspectChart
              assessment="{session.evaluation.assessment}"
            />{/if}
          <div class="feedback-item">
            <h3><span aria-hidden="true">✦</span> よかった点</h3>
            <p>{feedback.strength}</p>
          </div>
          <div class="feedback-item">
            <h3>次に試すこと</h3>
            <p>{feedback.improvement}</p>
          </div>
          <div class="rewrite">
            <h3>あなたの言葉を、こんなふうに</h3>
            <span class="small muted">今回の発言</span>
            <blockquote>「{feedback.quote}」</blockquote>
            {#if feedback.rewrite.trim() === feedback.quote.trim()}
              <p><strong>そのままでOK</strong></p>
            {:else}
              <span class="small muted">言い換え例</span>
              <blockquote class="rewrite-example">「{feedback.rewrite}」</blockquote>
            {/if}
          </div>
        {/if}
        <div class="result-actions">
          {#if guestMode}<a class="button primary" href="{guestLoginUrl(session.id)}"
              >ログインして、続きも練習する →</a
            >{:else}<button
              class="button primary"
              disabled="{restarting || !data.practiceEnabled}"
              aria-busy="{restarting}"
              on:click="{restart}">{restarting ? '準備しています…' : '同じ場面でもう一度'}</button
            >{/if}<a class="button secondary" href="/#scenes"
            >{guestMode ? '別のお相手を選ぶ' : '別の場面を選ぶ'}</a
          >
        </div>
        {#if message}<p class="error" role="alert">{message}</p>{/if}
        <p class="small muted">
          {guestMode
            ? 'ログインして保存すると、通常のアルバムや再練習も使えます。'
            : session.adminPlay
              ? '管理者の練習は利用枠を消費しません。今回の振り返りは、この画面で再確認できます。'
              : '新しい練習は3往復1枠・6往復2枠を使います。今回の振り返りは、この画面で再確認できます。'}
        </p>
      </section>
    {:else if session.completedAt && feedback}
      <!-- 結果の演出は、ヒントを閉じて結果が見えるときに始める。 -->
    {:else if !data.practiceEnabled}<p class="notice">
        練習の送信は現在停止しています。保存済みの会話は引き続き確認できます。
      </p>
    {:else}<form class="composer card" on:submit|preventDefault="{send}">
        <label for="reply">{scene.partnerName}さんへ · {session.turns.length + 1}回目の返答</label>
        <p class="small muted">{scene.hint}</p>
        <textarea
          id="reply"
          bind:value="{text}"
          on:input="{saveDraft}"
          rows="3"
          maxlength="{MAX_MESSAGE_LENGTH}"
          disabled="{pending}"
          placeholder="{`${scene.partnerName}さんに、どう返しますか？`}"
          required
        ></textarea>
        <div class="composer-actions">
          <span class="small muted">{text.length} / {MAX_MESSAGE_LENGTH}</span><button
            class="button primary"
            disabled="{pending || !text.trim()}"
            aria-busy="{pending}"
            >{pending
              ? finalReply
                ? '分析をまとめています…'
                : '返答を考えています…'
              : finalReply
                ? '送信して振り返る'
                : '返答を送る'}<span aria-hidden="true">↑</span></button
          >
        </div>
        <p class="small muted">
          {guestMode
            ? '未ログインの体験は3往復まで。ログインして会話を保存すると、毎月10枠のうち1枠を使用します。'
            : session.adminPlay
              ? '管理者の練習は利用枠を消費しません。'
              : session.chargedAt
                ? 'この練習は残りの返答と振り返りまで追加消費なし。'
                : `最初の返答の保存に成功すると、${session.creditCost ?? 1}枠を使用します。`}<br
          />会話はAIに送信し、再開・振り返りのために保存します。実名・連絡先は入力しないでください。
        </p>
      </form>{/if}
  {:else if loading}<p role="status" class="notice">保存した会話を読み込んでいます…</p>
  {:else}<section class="card empty">
      <h1>会話を読み込めませんでした</h1>
      {#if message}<p class="error" role="alert">{message}</p>{/if}<button
        class="button secondary"
        on:click="{retryLoad}"
        disabled="{loading}">{loading ? '読み込み中…' : 'もう一度読み込む'}</button
      >
    </section>{/if}
</div>

<style>
  .character-stage {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 75% 25%, #fdf8e7, transparent 55%),
      linear-gradient(145deg, #e4e7d8, #e9ddcb);
    margin: 24px 0 12px;
  }
  .character-stage.evening {
    background:
      radial-gradient(ellipse at 80% 20%, #f8dfb9, transparent 50%),
      linear-gradient(145deg, #c8ced1, #ded6cf);
  }
  .character-stage.books {
    background: linear-gradient(135deg, #ded5c3, #ede5d6);
  }
  .stage-caption {
    position: absolute;
    top: 18px;
    left: 20px;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-weight: 700;
  }
  .stage-caption > .ai-label {
    background: #fffdf9d9;
    padding: 5px 8px;
    border-radius: 20px;
  }
  .stage-art {
    height: 330px;
    max-width: 300px;
    margin: 30px auto 0;
    overflow: hidden;
  }
  .stage-art :global(.portrait) {
    height: 100%;
    width: auto;
    margin: auto;
  }
  .stage-mood {
    padding: 10px 16px 0;
    font-size: var(--text-sm);
    color: var(--muted);
    text-align: center;
  }
  .stage-mood > span {
    font-size: var(--text-sm);
  }
  .stage-mood p {
    margin: 4px 0 0;
    color: var(--ink);
  }
  .stage-dialogue {
    padding: 16px 20px;
    margin: 12px 16px 16px;
    background: var(--surface);
    border: 1px solid #ffffffaa;
    border-radius: 12px;
  }
  .stage-dialogue p {
    font-size: var(--text-base);
    line-height: 1.9;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .conversation-log > summary {
    cursor: pointer;
    display: flex;
    gap: 16px;
    align-items: center;
    font-size: var(--text-sm);
    color: var(--muted);
    padding: 10px 0;
    margin-bottom: 16px;
  }
  .conversation-log > summary > span {
    font-size: var(--text-sm);
  }
  .scene-setting {
    font-size: var(--text-sm);
    color: var(--muted);
    margin-bottom: 24px;
  }
  .scene-setting summary {
    cursor: pointer;
  }
  .scene-setting p {
    line-height: 1.9;
  }
  @media (max-width: 600px) {
    .stage-art {
      height: 300px;
      max-width: 260px;
      margin-top: 40px;
    }
    .stage-caption {
      font-size: var(--text-base);
      left: 16px;
      top: 14px;
    }
  }
  .practice-shell {
    max-width: 47rem;
    width: 100%;
    margin: 1rem auto 3rem;
  }
  .practice-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 2rem;
  }
  h1 {
    text-align: left;
    font-size: 1.65rem;
    margin: 0.6rem 0;
  }
  .practice-heading p {
    font-size: var(--text-sm);
  }
  .custom-context {
    margin: 1.5rem 0;
    padding: 1rem 1.2rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .custom-context > p:last-child {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: var(--text-sm);
    margin: 0.5rem 0 0;
  }
  .partner-profile {
    display: flex;
    gap: 0.9rem;
    align-items: flex-start;
    padding: 1.15rem 1.3rem;
    background: #edf0e7;
    border-left: 2px solid #9baa8d;
    margin-bottom: 1.8rem;
  }
  .partner-avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 2.7rem;
    height: 2.7rem;
    border-radius: 50%;
    background: #dce4d3;
    font-family: var(--font-editorial);
    font-size: 1.3rem;
  }
  .partner-profile p {
    font-size: var(--text-sm);
    margin: 0;
    line-height: 1.9;
  }
  .partner-profile strong {
    font-size: var(--text-base);
    font-weight: 600;
  }
  .ai-label {
    font-size: var(--text-xs);
    margin-left: 0.7rem;
    color: var(--muted);
  }
  .partner-profile .partner-address {
    font-size: var(--text-sm);
    color: #58694e;
    margin-top: 0.3rem;
  }
  .progress {
    flex-shrink: 0;
    border: 1px solid var(--border);
    background: white;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: var(--text-sm);
  }
  .progress-track {
    height: 4px;
    border-radius: 1rem;
    background: #e9e4df;
    margin: 1.3rem 0 2rem;
  }
  .progress-track span {
    height: 100%;
    background: var(--accent);
    display: block;
    border-radius: 1rem;
    transition: width 0.3s;
  }
  .conversation {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .line {
    max-width: 86%;
  }
  .line.mine {
    margin-left: auto;
  }
  .speaker {
    font-size: var(--text-sm);
    color: var(--muted);
    display: block;
    margin-bottom: 0.35rem;
  }
  .mine .speaker {
    text-align: right;
  }
  .line p {
    margin: 0;
    padding: 1rem 1.2rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 1rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: var(--text-base);
  }
  .mine p {
    background: #f4e4d9;
    border-color: #e9d7c8;
  }
  .composer {
    margin-top: 2rem;
    padding: 1.5rem;
  }
  .composer label {
    font-weight: 700;
    font-size: var(--text-base);
  }
  .composer textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid #d5cfc8;
    border-radius: 0.7rem;
    resize: vertical;
    background: #fcfbf9;
    line-height: 1.8;
    font-family: inherit;
    font-size: 1rem;
  }
  .composer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0.8rem 0 1rem;
    gap: 1rem;
  }
  .feedback {
    margin-top: 2rem;
    padding: 2rem;
  }
  .feedback h2 {
    font-size: 1.65rem;
    margin: 0.6rem 0;
  }
  .feedback-item {
    padding: 1.2rem 0;
    border-bottom: 1px solid var(--border);
  }
  .feedback h3 {
    font-size: var(--text-base);
    margin: 0 0 0.6rem;
  }
  .feedback-item p {
    margin: 0;
    white-space: pre-wrap;
  }
  .rewrite {
    background: #f7f4ef;
    border-radius: 8px;
    padding: 1.25rem;
    margin: 1.5rem 0;
  }
  .rewrite blockquote {
    margin: 0.4rem 0 1rem;
    line-height: 1.9;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .rewrite .rewrite-example {
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 0;
  }
  .result-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .empty {
    padding: 2rem;
    margin-top: 2rem;
  }
  @media (max-width: 550px) {
    .feedback,
    .composer {
      padding: 1.2rem;
    }
    h1 {
      font-size: 1.3rem;
    }
    .practice-heading {
      align-items: flex-start;
    }
    .line {
      max-width: 94%;
    }
    .result-actions .button {
      width: 100%;
    }
    .composer-actions .button {
      font-size: var(--text-sm);
      padding: 0.7rem 1rem;
    }
  }
</style>
