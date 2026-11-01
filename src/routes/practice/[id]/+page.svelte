<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import {
    findScene,
    MAX_MESSAGE_LENGTH,
    PRACTICE_TURNS,
    type PracticeSession
  } from '$lib/practice'
  import { getAnalyticsContext } from '$lib/analytics'
  import { startPractice } from '$lib/practice-client'
  export let data
  let session: PracticeSession | null = null
  let text = ''
  let requestId = ''
  let requestText = ''
  let expectedTurn = 0
  let loading = false
  let pending = false
  let restarting = false
  let message = ''
  let mounted = false
  let loadedKey = ''
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let bottom: HTMLDivElement
  $: scene = findScene(session?.sceneId)
  $: feedback = session?.turns.at(-1)?.feedback
  $: sessionKey = `${$user?.uid}:${$page.params.id}`
  $: storageKey = `koi-practice-draft:${sessionKey}`
  $: if (mounted && $authReady && $user && loadedKey !== sessionKey) {
    loadedKey = sessionKey
    session = null
    text = ''
    message = ''
    void load(true)
  }
  $: if (!$user) {
    session = null
    loadedKey = ''
    text = ''
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
      const raw = sessionStorage.getItem(storageKey)
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
  function applySession(result: PracticeSession, initial = false) {
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
    if (result.pending) {
      text = result.pending.text
      requestId = result.pending.requestId
      requestText = text
      expectedTurn = result.turns.length
      saveDraft()
    }
    pending = !!result.pending?.until && new Date(result.pending.until).getTime() > Date.now()
    clearTimeout(pollTimer)
    if (pending && mounted) pollTimer = setTimeout(() => void load(false), 2000)
    void tick().then(() => {
      if (mounted && saved) bottom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }
  async function load(initial = false) {
    if (initial) loading = true
    const key = sessionKey
    try {
      const response = await authenticatedFetch(`/api/me/practices/${$page.params.id}`)
      const result = await response.json()
      if (key === sessionKey && mounted) applySession(result, initial)
    } catch (error) {
      if (key === sessionKey) {
        pending = false
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
    message = ''
    const key = sessionKey
    try {
      const analyticsContext = await getAnalyticsContext()
      const response = await authenticatedFetch(`/api/me/practices/${session.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ requestId, text: requestText, expectedTurn, analyticsContext })
      })
      const result = await response.json()
      if (key === sessionKey && mounted) applySession(result)
    } catch (error) {
      if (key === sessionKey && mounted) {
        pending = false
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
      const result = await startPractice(scene.id)
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
  <a class="text-link" href="/">← 場面選択へ</a>
  {#if !$authReady}<p role="status" class="notice">ログイン状態を確認しています…</p>
  {:else if !$user}<section class="card empty">
      <h1>ログインして続きを練習</h1>
      <p>練習したアカウントでログインすると、会話を再開できます。</p>
      <a class="button primary" href="{`/login?practice=${$page.params.id}`}">Googleでログイン</a>
    </section>
  {:else if session && scene}
    <header class="practice-heading">
      <div>
        <p class="eyebrow">会話の練習</p>
        <h1>{scene.title}</h1>
        <p class="muted">{scene.goal}</p>
      </div>
      <span class="progress"
        >{session.completedAt
          ? '練習完了'
          : `${Math.min(session.turns.length + 1, PRACTICE_TURNS)} / ${PRACTICE_TURNS}`}</span
      >
    </header>
    <div class="progress-track" aria-label="{`${session.turns.length}回返答済み`}">
      <span style="{`width:${(session.turns.length / PRACTICE_TURNS) * 100}%`}"></span>
    </div>
    <aside class="partner-profile" aria-label="会話の相手">
      <span class="partner-avatar" aria-hidden="true">{scene.partnerName.slice(0, 1)}</span>
      <div>
        <p><strong>{scene.partnerName}さん</strong><span class="ai-label">AIの練習相手</span></p>
        <p>{scene.partnerDescription}</p>
        <p class="partner-address">「{scene.partnerName}さん」と呼びかけて話せます。</p>
      </div>
    </aside>
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
          <!-- 最終回は次の返答を促さず、振り返りへの移動を明確にする。 -->
          <span class="speaker"
            >{turn.position === PRACTICE_TURNS ? 'Koi-Tre' : `${scene.partnerName}さん`}</span
          >
          <p>
            {turn.position === PRACTICE_TURNS
              ? '3回の練習が終わりました。今回の会話を振り返りましょう。'
              : turn.assistantText}
          </p>
        </div>{/each}
      <div bind:this="{bottom}"></div>
    </section>
    {#if pending}<p class="notice" role="status" aria-live="polite">
        返答を考えています… この画面を閉じても、あとから再開できます。
      </p>{/if}
    {#if message && !session.completedAt}<p class="error" role="alert">{message}</p>{/if}
    {#if session.completedAt && feedback}
      <section class="card feedback" aria-label="練習の振り返り">
        <p class="eyebrow">ひとつ、持ち帰ろう。</p>
        <h2>おつかれさまでした。</h2>
        <p class="muted">今回の会話を、次のひと言につなげましょう。</p>
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
          <span class="small muted">言い換え例</span>
          <blockquote class="rewrite-example">「{feedback.rewrite}」</blockquote>
        </div>
        <div class="result-actions">
          <button
            class="button primary"
            disabled="{restarting || !data.practiceEnabled}"
            aria-busy="{restarting}"
            on:click="{restart}">{restarting ? '準備しています…' : '同じ場面でもう一度'}</button
          ><a class="button secondary" href="/#scenes">別の場面を選ぶ</a>
        </div>
        {#if message}<p class="error" role="alert">{message}</p>{/if}
        <p class="small muted">
          新しい練習は別の1回分になります。今回の振り返りは、この画面で再確認できます。
        </p>
      </section>
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
              ? '返答を考えています…'
              : session.turns.length === 2
                ? '送信して振り返る'
                : '返答を送る'}<span aria-hidden="true">↑</span></button
          >
        </div>
        <p class="small muted">
          {session.chargedAt
            ? 'この練習は残りの返答と振り返りまで追加消費なし。'
            : '最初の返答が正常に届くと、月10回のうち1回分を使用します。'}<br
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
    font-size: 0.85rem;
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
    font-size: 0.74rem;
    margin: 0;
    line-height: 1.9;
  }
  .partner-profile strong {
    font-size: 0.92rem;
    font-weight: 600;
  }
  .ai-label {
    font-size: 0.6rem;
    margin-left: 0.7rem;
    color: var(--muted);
  }
  .partner-profile .partner-address {
    font-size: 0.7rem;
    color: #58694e;
    margin-top: 0.3rem;
  }
  .progress {
    flex-shrink: 0;
    border: 1px solid var(--border);
    background: white;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
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
    font-size: 0.7rem;
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
    font-size: 0.95rem;
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
    font-size: 0.9rem;
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
    font-size: 0.95rem;
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
      font-size: 0.85rem;
      padding: 0.7rem 1rem;
    }
  }
</style>
