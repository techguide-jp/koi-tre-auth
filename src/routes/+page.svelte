<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { scenes, type PracticeOverview, type SceneId } from '$lib/practice'
  import { startPractice } from '$lib/practice-client'
  import LegacyHome from '$lib/components/LegacyHome.svelte'
  export let data
  let mounted = false
  let loadedUid = ''
  let overview: PracticeOverview | null = null
  let pendingScene: SceneId | null = null
  let loading = false
  let message = ''
  onMount(() => {
    mounted = true
    const refresh = () => {
      if (data.practiceEnabled && $user && !loading && document.visibilityState === 'visible')
        void loadOverview()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  })
  $: if (mounted && data.practiceEnabled && $user && $user.uid !== loadedUid) {
    loadedUid = $user.uid
    void loadOverview()
  }
  $: if (!$user) {
    loadedUid = ''
    overview = null
  }
  async function loadOverview() {
    loading = true
    message = ''
    const uid = $user?.uid
    try {
      const result = await authenticatedFetch('/api/me/practices')
      if ($user?.uid === uid) overview = await result.json()
    } catch (error) {
      message = error instanceof Error ? error.message : '利用状況を読み込めませんでした。'
    } finally {
      loading = false
    }
  }
  async function begin(sceneId: SceneId) {
    if (pendingScene || !$authReady) return
    if (!$user) {
      await goto(`/login?scene=${sceneId}`)
      return
    }
    pendingScene = sceneId
    message = ''
    try {
      const session = await startPractice(sceneId)
      await goto(`/practice/${session.id}`)
    } catch (error) {
      message = error instanceof Error ? error.message : '練習を開始できませんでした。'
    } finally {
      pendingScene = null
    }
  }
</script>

<svelte:head
  ><title>Koi-Tre | 初対面とデートの会話を練習しよう</title><meta
    name="description"
    content="初対面やデートで、何を話そう。Koi-TreはAIとの3回のやり取りで会話を練習し、自分の言葉に合った具体的なアドバイスを受け取れるアプリです。月10回無料。"
  /></svelte:head
>

{#if !data.practiceEnabled}
  <LegacyHome />
{:else}
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">会話は、練習していい。</p>
      <h1>「何を話そう」を、<br /><span>「話してみよう」に。</span></h1>
      <p class="lead">
        初対面も、デートも。AIを相手に短く練習して、<br
          class="desktop-break"
        />次の会話で使えるひと言を見つけましょう。
      </p>
      <a class="button primary" href="#scenes"
        >練習する場面を選ぶ <span aria-hidden="true">↗</span></a
      >
      <p class="small muted">1回3ターン・月10回無料・テキストで気軽に</p>
      <div class="steps" aria-label="使い方">
        <span>01 場面を選ぶ</span><span>02 3回返答する</span><span>03 言い方を持ち帰る</span>
      </div>
    </div>
    <div class="sample card" aria-label="会話と振り返りの見本">
      <div class="sample-heading">
        <span class="dot"></span><strong>こんなふうに練習します</strong><span class="pill"
          >会話例</span
        >
      </div>
      <p class="bubble partner">お休みの日は、何をして過ごすことが多いですか？</p>
      <p class="bubble mine">映画を観ることが多いです。</p>
      <div class="sample-feedback">
        <p class="eyebrow">ひと言添えると、会話が広がる</p>
        <p>自分の話のあとに、相手が答えやすい質問を添えてみましょう。</p>
        <blockquote>「映画を観ることが多いです。どんな映画がお好きですか？」</blockquote>
      </div>
      <p class="small muted">見本です。練習後は、あなたの発言に合わせて振り返ります。</p>
    </div>
  </section>
  {#if $user}<section class="account-strip card" aria-label="今月の練習">
      <div>
        <p class="eyebrow">YOUR PRACTICE</p>
        <h2>今日も、自分のペースで。</h2>
        {#if overview}<p>
            今月はあと <strong>{overview.remaining}回</strong> / {overview.limit}回{overview.reserved
              ? `（ほかに${overview.reserved}回を処理中）`
              : ''}
          </p>
          <p class="small muted">
            次の更新：{new Date(overview.resetsAt).toLocaleDateString('ja-JP', {
              timeZone: 'Asia/Tokyo'
            })}
          </p>{:else if loading}<p role="status">利用状況を読み込んでいます…</p>{/if}
      </div>
      <div class="actions">
        {#if overview?.activePracticeId}<a
            class="button secondary"
            href="{`/practice/${overview.activePracticeId}`}">途中の練習を再開</a
          >{/if}{#if overview?.latestPracticeId && overview.latestPracticeId !== overview.activePracticeId}<a
            class="text-link"
            href="{`/practice/${overview.latestPracticeId}`}">前回の振り返りを見る</a
          >{/if}{#if message}<button
            class="button secondary"
            disabled="{loading}"
            on:click="{loadOverview}">{loading ? '読み込み中…' : '利用状況を再取得'}</button
          >{/if}
      </div>
    </section>{/if}
  <section id="scenes" class="scene-section">
    <p class="eyebrow">まずは、ひとつ。</p>
    <h2>どんな場面を練習しますか？</h2>
    <p class="muted">うまい答えを考えすぎず、いつもの言葉で大丈夫です。</p>
    <div class="scene-grid">
      {#each scenes as scene, index}<article class="card scene-card">
          <span class="scene-number">0{index + 1}</span>
          <h3>{scene.title}</h3>
          <p>{scene.subtitle}</p>
          <p class="small muted">3回返答して、振り返りへ</p>
          <button
            class="button secondary"
            disabled="{!$authReady || !!pendingScene || overview?.remaining === 0}"
            aria-busy="{pendingScene === scene.id}"
            on:click="{() => begin(scene.id)}"
            >{pendingScene === scene.id ? '準備しています…' : 'この場面で練習する'}<span
              aria-hidden="true">→</span
            ></button
          >
        </article>{/each}
    </div>
    {#if message}<p class="error" role="alert">{message}</p>{/if}{#if overview?.remaining === 0}<p
        class="notice"
      >
        今月の練習枠を使い切りました。途中の練習は追加消費なしで再開できます。
      </p>{/if}
    <p class="small muted quota-note">
      練習にはGoogleアカウントでの登録が必要です。最初の返答が届いたら1回分を使用します。途中で閉じても再開でき、3回の返答と振り返りまで追加消費はありません。
    </p>
  </section>
  <section class="quiet-note">
    <h2>本番の前に、安心して試せる場所を。</h2>
    <p>
      正解を当てるためのテストではありません。<br
      />相手の話を聞き、自分のことを伝える。その小さな練習から始めましょう。
    </p>
    <p class="small muted">
      会話はAIへの送信と振り返り・再開のために保存されます。実名・連絡先などは入力しないでください。<a
        href="/about">使い方とデータの扱い</a
      >
    </p>
  </section>
{/if}

<style>
  .hero {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 3.5rem;
    align-items: center;
    padding: 4.5rem 0 3.5rem;
  }
  h1 {
    font-size: clamp(2rem, 4.4vw, 3.4rem);
    line-height: 1.5;
    letter-spacing: -0.04em;
    margin: 1rem 0 1.25rem;
    text-align: left;
    font-weight: 750;
  }
  h1 span {
    color: var(--accent);
  }
  .lead {
    font-size: 1.05rem;
    line-height: 1.95;
    margin-bottom: 1.7rem;
  }
  .hero-copy > .button {
    margin-bottom: 0.65rem;
  }
  .steps {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 2rem;
  }
  .sample {
    padding: 1.4rem;
    transform: rotate(1deg);
    box-shadow: 0 18px 60px #472e4010;
  }
  .sample-heading {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.82rem;
    margin-bottom: 1.5rem;
  }
  .sample-heading .pill {
    margin-left: auto;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #7a9e8c;
  }
  .bubble {
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    max-width: 90%;
    line-height: 1.7;
    font-size: 0.92rem;
  }
  .partner {
    background: #f2f0ed;
    border-bottom-left-radius: 0.2rem;
  }
  .mine {
    margin-left: auto;
    background: #f8e9e8;
    border-bottom-right-radius: 0.2rem;
  }
  .sample-feedback {
    margin: 1.25rem 0;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
    font-size: 0.88rem;
  }
  .sample-feedback blockquote {
    margin: 1rem 0 0;
    padding: 0.85rem;
    border-left: 3px solid var(--accent);
    background: #fcf7f5;
    line-height: 1.8;
  }
  .account-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 2rem;
    margin: 1rem 0 3rem;
  }
  .account-strip h2 {
    font-size: 1.2rem;
    margin: 0.3rem 0 0.8rem;
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .scene-section {
    padding: 2.5rem 0;
    scroll-margin-top: 2rem;
  }
  .scene-section > h2 {
    font-size: 1.8rem;
    margin: 0.6rem 0;
  }
  .scene-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 2rem 0 1.25rem;
  }
  .scene-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .scene-number {
    font-family: Georgia, serif;
    color: var(--accent);
    font-size: 1.6rem;
  }
  .scene-card h3 {
    font-size: 1.1rem;
    margin: 1rem 0 0.5rem;
    line-height: 1.6;
    min-height: 3.5rem;
  }
  .scene-card p {
    font-size: 0.9rem;
  }
  .scene-card .button {
    width: 100%;
    margin-top: auto;
    font-size: 0.87rem;
    justify-content: space-between;
  }
  .scene-card .small {
    margin-bottom: 1.5rem;
  }
  .quota-note {
    max-width: 48rem;
    line-height: 1.8;
  }
  .quiet-note {
    margin: 2rem 0 3rem;
    padding: 2rem;
    text-align: center;
    background: #f1efeb;
    border-radius: 1.5rem;
  }
  .quiet-note h2 {
    font-size: 1.3rem;
    margin-bottom: 1rem;
  }
  .quiet-note p {
    line-height: 1.9;
  }
  .quiet-note .small {
    max-width: 42rem;
    margin: 1.5rem auto 0;
  }
  @media (max-width: 760px) {
    .hero {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding: 2rem 0;
    }
    .sample {
      transform: none;
    }
    .scene-grid {
      grid-template-columns: 1fr;
    }
    .scene-card h3 {
      min-height: 0;
    }
    .scene-card .button {
      margin-top: 0.5rem;
    }
    .account-strip {
      flex-direction: column;
      align-items: flex-start;
      padding: 1.4rem;
    }
    .quiet-note {
      padding: 1.5rem;
    }
    .desktop-break {
      display: none;
    }
  }
</style>
