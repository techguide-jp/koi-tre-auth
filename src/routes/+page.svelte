<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import {
    scenes,
    sceneWithPartner,
    partnerNameForScene,
    type BuiltInSceneId,
    type PartnerPreference,
    type CustomSceneInput,
    type PracticeOverview,
    type SceneId
  } from '$lib/practice'
  import { saveCustomSceneDraft } from '$lib/custom-scene-client'
  import CustomSceneForm from '$lib/components/CustomSceneForm.svelte'
  import { startPractice } from '$lib/practice-client'
  import SceneDrawing from '$lib/components/SceneDrawing.svelte'
  import LegacyHome from '$lib/components/LegacyHome.svelte'
  import { guides } from '$lib/content/guides'
  export let data
  let mounted = false
  let loadedUid = ''
  let overview: PracticeOverview | null = null
  let pendingScene: SceneId | null = null
  let partners: Record<BuiltInSceneId, PartnerPreference> = {
    cafe: 'unspecified',
    hobbies: 'unspecified',
    silence: 'unspecified'
  }
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
  async function beginPreset(sceneId: BuiltInSceneId) {
    const customScene = sceneWithPartner(sceneId, partners[sceneId])
    await begin(customScene ? 'custom' : sceneId, customScene, sceneId)
  }
  async function begin(
    sceneId: SceneId,
    customScene?: CustomSceneInput,
    pendingId: SceneId = sceneId
  ) {
    if (pendingScene || !$authReady) return
    if (!$user) {
      const preset = !!customScene && pendingId !== 'custom'
      if (customScene && !saveCustomSceneDraft(customScene, preset ? 'preset' : 'custom')) {
        message =
          '場面を引き継ぐための一時保存ができませんでした。ブラウザの保存を許可して、もう一度お試しください。'
        return
      }
      await goto(`/login?scene=${sceneId}${preset ? '&preset=1' : ''}`)
      return
    }
    pendingScene = pendingId
    message = ''
    try {
      const session = await startPractice(sceneId, customScene)
      await goto(`/practice/${session.id}`)
    } catch (error) {
      message = error instanceof Error ? error.message : '練習を開始できませんでした。'
    } finally {
      pendingScene = null
    }
  }
</script>

{#if !data.practiceEnabled}
  <LegacyHome />
{:else}
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="section-label"><span></span>初対面・デートの会話練習</p>
      <h1 id="hero-title">会う日の前に、<br />会話の<span class="underline">予行練習。</span></h1>
      <p class="hero-description">
        カフェで何を話そう。沈黙したらどうしよう。<br
          class="wide-only"
        />そんなときは、AI相手に少しだけ練習。<br
          class="wide-only"
        />次の会話で使える言い方を、一つ見つけませんか。
      </p>
      <a class="button primary hero-cta" href="#scenes"
        >無料で会話を練習する<span aria-hidden="true">→</span></a
      >
      <p class="cta-caption">月10回無料 · 1回3往復 · スマホでそのまま</p>
      <p class="inclusive-caption">女性も男性も。練習相手を選んで、自分のペースで。</p>
      <a class="example-link" href="#example"
        >まずは会話の例を見る<span aria-hidden="true">↓</span></a
      >
    </div>
    <figure class="hero-visual">
      <img
        src="/images/cafe-conversation.jpg"
        alt="木漏れ日の入るカフェで、コーヒーを飲みながら穏やかに会話する二人のイラスト"
        width="1448"
        height="1086"
        fetchpriority="high"
      />
      <figcaption><span class="caption-line"></span>話す前の、ちいさな準備。</figcaption>
    </figure>
  </section>

  <div class="intro-strip" aria-label="練習の流れ">
    <p>はじめの一歩は、<br /><strong>たった3回の返答から。</strong></p>
    <ol>
      <li><span>01</span>場面を選ぶ</li>
      <li><span>02</span>自分の言葉で返す</li>
      <li><span>03</span>言い換えを見つける</li>
    </ol>
  </div>

  {#if $user}
    <section class="account-strip" aria-label="今月の練習">
      <div>
        <p class="section-label">あなたの練習</p>
        <h2>今日は、何を話してみよう。</h2>
        {#if overview}<p>
            今月はあと <strong>{overview.remaining}回</strong> / {overview.limit}回{overview.reserved
              ? `（ほかに${overview.reserved}回を処理中）`
              : ''}
          </p>
          <p class="small muted">
            次の更新：{new Date(overview.resetsAt).toLocaleDateString('ja-JP', {
              timeZone: 'Asia/Tokyo'
            })}
          </p>
        {:else if loading}<p role="status">利用状況を読み込んでいます…</p>{/if}
      </div>
      <div class="account-actions">
        {#if overview?.activePracticeId}<a
            class="button primary"
            href="{`/practice/${overview.activePracticeId}`}">途中の練習を再開 →</a
          >{/if}
        {#if overview?.latestPracticeId && overview.latestPracticeId !== overview.activePracticeId}<a
            class="text-link"
            href="{`/practice/${overview.latestPracticeId}`}">前回の振り返りを見る</a
          >{/if}
        {#if message}<button class="button secondary" disabled="{loading}" on:click="{loadOverview}"
            >{loading ? '読み込み中…' : '利用状況を再取得'}</button
          >{/if}
      </div>
    </section>
  {/if}

  <section id="example" class="example-section" aria-labelledby="example-title">
    <div class="example-copy">
      <p class="section-label">こんなふうに練習します</p>
      <h2 id="example-title">短いひと言から、<br />会話は広がります。</h2>
      <p>気の利いた話をしなくても大丈夫。<br />いつもの自分の言葉で、返してみてください。</p>
      <p>
        3回のやり取りが終わったら、よかった点と<br
          class="wide-only"
        />次に試す言い方を一緒に振り返ります。
      </p>
      <div class="example-note">
        <span aria-hidden="true">↳</span>
        <p>点数はつけません。<br /><strong>あなたの発言をもとに、具体的に。</strong></p>
      </div>
    </div>
    <div class="example-chat" aria-label="会話と振り返りの見本">
      <div class="example-chat-heading">
        <span class="initial-avatar" aria-hidden="true">は</span>
        <div><strong>はるさん</strong><span>初対面のカフェ · AIとの会話例</span></div>
        <span class="sample-label">見本</span>
      </div>
      <div class="sample-conversation">
        <p class="sample-partner">お休みの日は、どんなふうに過ごしていますか？</p>
        <p class="sample-mine">映画を観ることが多いです。</p>
      </div>
      <div class="sample-feedback">
        <span class="feedback-caption">振り返りの例</span>
        <h3>自分の話に、質問を一つ添えてみる。</h3>
        <p>映画を観ることが多いです。<em>どんな映画がお好きですか？</em></p>
        <span class="small muted">自分のことを伝えながら、相手の話も聞ける言い方に。</span>
      </div>
      <p class="sample-footnote">
        ※説明用の会話例です。実際の振り返りは、あなたの発言に合わせて届きます。
      </p>
    </div>
  </section>

  <section id="scenes" class="scene-section" aria-labelledby="scenes-title">
    <div class="section-heading">
      <div>
        <p class="section-label">さっそく、やってみよう</p>
        <h2 id="scenes-title">今日は、どの場面にする？</h2>
      </div>
      <p>迷ったら、初対面のカフェから。<br />練習相手を選び、Googleでログインできます。</p>
    </div>
    <div class="scene-grid">
      {#each scenes as scene, index}
        <article class="scene-card">
          <div class="scene-art" class:sage="{index === 1}" class:peach="{index === 2}">
            <span class="scene-number">0{index + 1}</span><SceneDrawing scene="{scene.id}" />
          </div>
          <div class="scene-body">
            <p class="scene-category">
              {index === 0
                ? 'はじめの一歩に'
                : index === 1
                  ? 'もう少し話したいときに'
                  : '沈黙が気になるときに'}
            </p>
            <h3>{scene.title}</h3>
            <p class="scene-description">{scene.subtitle}</p>
            <label class="partner-choice" for="{`partner-${scene.id}`}"
              >練習相手
              <select
                id="{`partner-${scene.id}`}"
                bind:value="{partners[scene.id]}"
                disabled="{!!pendingScene}"
              >
                <option value="unspecified">性別を指定しない</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </label>
            <p class="scene-partner">
              <span class="partner-dot" aria-hidden="true"></span>お相手：{partnerNameForScene(
                scene.id,
                partners[scene.id]
              )}さん
              <span>（AI）</span>
            </p>
            <button
              class="button scene-button"
              disabled="{!$authReady || !!pendingScene || overview?.remaining === 0}"
              aria-busy="{pendingScene === scene.id}"
              on:click="{() => beginPreset(scene.id)}"
              >{pendingScene === scene.id ? '準備しています…' : 'この場面を練習する'}<span
                aria-hidden="true">→</span
              ></button
            >
          </div>
        </article>
      {/each}
    </div>
    <CustomSceneForm
      disabled="{!$authReady || !!pendingScene || overview?.remaining === 0}"
      pending="{pendingScene === 'custom'}"
      on:start="{(event) => begin('custom', event.detail)}"
    />
    {#if message}<p class="error" role="alert">{message}</p>{/if}
    {#if overview?.remaining === 0}<p class="notice">
        今月の練習枠を使い切りました。途中の練習は追加消費なしで再開できます。
      </p>{/if}
    <p class="quota-note">
      ご自身の性別は入力不要です。相手の性別を指定せずに練習することもできます。<br />
      最初の返答が届いたら1回分を使用。3回の返答と振り返りまで追加消費はありません。<br
        class="wide-only"
      />途中で閉じても、同じアカウントで再開できます。
    </p>
  </section>

  <section class="faq-section" aria-labelledby="faq-title">
    <div>
      <p class="section-label">始める前に</p>
      <h2 id="faq-title">気になること。</h2>
      <p class="muted">使い方やデータについて、もう少し。</p>
      <a class="text-link" href="/about">詳しい使い方を見る →</a>
    </div>
    <div class="faq-list">
      <details>
        <summary>女性も使えますか？<span aria-hidden="true">＋</span></summary>
        <p>
          はい。性別を問わず利用できます。3つの場面では、練習相手を男性・女性から選べます。相手の性別を指定しないこともできます。ご自身の性別や性的指向を登録する必要はありません。
        </p>
      </details>
      <details>
        <summary>会話が苦手でも使えますか？<span aria-hidden="true">＋</span></summary>
        <p>
          はい。短い返答でも大丈夫です。相手はAIなので、自分のペースで言葉を考えられます。3回返答すると、実際の発言に合わせたアドバイスが届きます。
        </p>
      </details>
      <details>
        <summary>無料でどこまで使えますか？<span aria-hidden="true">＋</span></summary>
        <p>
          月10回、3回の返答と振り返りまで練習できます。日本時間の毎月1日に枠が更新されます。会話例の閲覧や、返答の生成に失敗した場合は消費しません。
        </p>
      </details>
      <details>
        <summary>名前やプロフィールの入力は必要ですか？<span aria-hidden="true">＋</span></summary>
        <p>
          Googleアカウントでログインするだけで始められます。練習のための名前・性別・年齢の入力は不要です。Googleの氏名やメールアドレスを、練習相手への入力に使うこともありません。
        </p>
      </details>
      <details>
        <summary>入力した会話はどう扱われますか？<span aria-hidden="true">＋</span></summary>
        <p>
          返答を作るためにAIへ送信し、練習の再開と振り返りのために保存します。実名・連絡先などは入力しないでください。アクセス解析に会話本文は送りません。
        </p>
      </details>
    </div>
  </section>
{/if}

<section class="reading-section" aria-labelledby="reading-title">
  <p class="section-label">ログインせずに、ここから</p>
  <h2 id="reading-title">何を話そう、と思ったら。</h2>
  <p>会う前に使える話題と、短い会話の例を集めました。</p>
  <a class="button secondary" href="/topics">登録不要の会話ネタ帳を開く →</a>
  <p><a class="text-link" href="/try">まずは30秒。返し方を選ぶお試しへ →</a></p>
  <div class="reading-grid">
    {#each guides as guide}
      <a href="{`/guides/${guide.slug}`}" class="reading-card">
        <span>{guide.category}</span>
        <h3>{guide.title}</h3>
        <span>会話例を読む →</span>
      </a>
    {/each}
  </div>
  <a class="text-link" href="/guides">会話ガイドをすべて見る →</a>
</section>

<style>
  .inclusive-caption {
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.8;
    margin: 0 0 1.3rem;
  }
  .partner-choice {
    display: block;
    font-size: 0.72rem;
    color: var(--muted);
    margin: 1.1rem 0 0.75rem;
  }
  .partner-choice select {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.65rem;
    background: #fffefa;
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--ink);
    font: inherit;
    font-size: 0.85rem;
  }
  .reading-section {
    padding: 3rem 0;
    border-top: 1px solid var(--border);
  }
  .reading-section > p {
    line-height: 1.9;
  }
  .reading-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 1.8rem 0;
  }
  .reading-card {
    display: block;
    padding: 1.5rem;
    border: 1px solid var(--border);
    color: var(--ink);
    border-radius: 4px;
  }
  .reading-card span {
    font-size: 0.75rem;
    color: var(--accent);
  }
  .reading-card h3 {
    font-size: 1.05rem;
    line-height: 1.8;
    margin: 0.75rem 0 1rem;
  }
  @media (max-width: 700px) {
    .reading-grid {
      grid-template-columns: 1fr;
    }
  }
  .section-label {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    margin: 0 0 1rem;
  }
  .section-label > span {
    width: 1.3rem;
    height: 1px;
    background: currentColor;
  }
  .hero {
    display: grid;
    grid-template-columns: 0.95fr 1.1fr;
    align-items: center;
    gap: 1rem;
    padding: 3.75rem 0 3.25rem;
  }
  .hero-copy {
    position: relative;
    z-index: 1;
  }
  h1,
  h2 {
    font-family: var(--font-editorial);
    font-weight: 600;
    text-align: left;
  }
  h1 {
    font-size: clamp(2.2rem, 3.6vw, 3.25rem);
    line-height: 1.65;
    letter-spacing: 0.025em;
    margin: 1.2rem 0 1.5rem;
    white-space: nowrap;
  }
  .underline {
    text-decoration: underline;
    text-decoration-color: #e8b6a6;
    text-decoration-thickness: 6px;
    text-underline-offset: 9px;
  }
  .hero-description {
    font-size: 0.9rem;
    line-height: 2.15;
    margin: 0 0 1.8rem;
  }
  .hero-cta {
    min-width: 17rem;
    justify-content: space-between;
  }
  .cta-caption {
    font-size: 0.69rem;
    color: var(--muted);
    margin: 0.65rem 0 1.3rem;
  }
  .example-link {
    font-size: 0.78rem;
    color: var(--ink);
    border-bottom: 1px solid #a6aca4;
    padding-bottom: 0.35rem;
    display: inline-flex;
    gap: 1.8rem;
  }
  .example-link:hover {
    text-decoration: none;
    border-color: var(--accent);
  }
  .hero-visual {
    margin: 0 -1.5rem 0 0;
  }
  .hero-visual img {
    width: 100%;
    height: auto;
    display: block;
    mix-blend-mode: multiply;
  }
  .hero-visual figcaption {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.6rem;
    margin-top: 1rem;
    padding-right: 1.5rem;
    font-family: var(--font-editorial);
    font-size: 0.8rem;
    color: var(--muted);
    letter-spacing: 0.1em;
  }
  .caption-line {
    width: 2rem;
    height: 1px;
    background: #9ea695;
  }
  .intro-strip {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 1.6rem 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }
  .intro-strip > p {
    font-size: 0.8rem;
    margin: 0;
    line-height: 1.9;
  }
  .intro-strip strong {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .intro-strip ol {
    display: flex;
    gap: 2.1rem;
    padding: 0;
    margin: 0;
    list-style: none;
    font-size: 0.8rem;
  }
  .intro-strip li {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .intro-strip li span {
    font-family: Georgia, serif;
    font-style: italic;
    font-size: 1.3rem;
    color: var(--accent);
  }
  .account-strip {
    margin-top: 2.5rem;
    padding: 1.5rem 2rem;
    background: #edf0e8;
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    align-items: center;
  }
  .account-strip h2 {
    font-size: 1.35rem;
    margin: 0.5rem 0;
  }
  .account-strip p {
    margin: 0.2rem 0;
  }
  .account-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1rem;
  }
  h2 {
    font-size: clamp(1.65rem, 2.8vw, 2.1rem);
    line-height: 1.7;
    letter-spacing: 0.03em;
    margin: 0.7rem 0 1.5rem;
  }
  .example-section {
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 5rem;
    align-items: center;
    padding: 5.5rem 0;
    scroll-margin-top: 2rem;
  }
  .example-copy > p:not(.section-label) {
    font-size: 0.84rem;
    line-height: 2.1;
  }
  .example-note {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1.75rem;
  }
  .example-note > span {
    font-family: Georgia, serif;
    color: var(--accent);
    font-size: 2.4rem;
    transform: rotate(-10deg);
  }
  .example-note p {
    font-size: 0.8rem;
    margin: 0;
    line-height: 1.9;
  }
  .example-note strong {
    font-weight: 600;
  }
  .example-chat {
    padding: 1.5rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 8px 8px 0 #efede5;
  }
  .example-chat-heading {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
  }
  .initial-avatar {
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #e7ecdf;
    width: 2.5rem;
    height: 2.5rem;
    font-family: var(--font-editorial);
    font-size: 1.15rem;
  }
  .example-chat-heading strong {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .example-chat-heading div > span {
    display: block;
    font-size: 0.63rem;
    color: var(--muted);
    margin-top: 0.25rem;
  }
  .sample-label {
    margin-left: auto;
    color: var(--muted);
    border: 1px solid var(--border);
    font-size: 0.62rem;
    padding: 0.2rem 0.5rem;
  }
  .sample-conversation {
    display: flex;
    flex-direction: column;
    padding: 1.2rem 0 1.5rem;
    gap: 0.85rem;
  }
  .sample-conversation p {
    font-size: 0.8rem;
    max-width: 87%;
    padding: 0.75rem 1rem;
    margin: 0;
  }
  .sample-partner {
    background: #f2f3ed;
    border-radius: 0 10px 10px 10px;
    align-self: flex-start;
  }
  .sample-mine {
    background: #f5e5dc;
    border-radius: 10px 0 10px 10px;
    align-self: flex-end;
  }
  .sample-feedback {
    border-top: 1px dashed #cbd0c4;
    padding-top: 1rem;
  }
  .feedback-caption {
    color: #617258;
    font-size: 0.65rem;
    font-weight: 600;
  }
  .sample-feedback h3 {
    font-size: 0.8rem;
    font-weight: 600;
    margin: 0.45rem 0 0.7rem;
  }
  .sample-feedback p {
    border-left: 2px solid #b9c4ab;
    background: #f5f6f1;
    padding: 0.75rem 1rem;
    margin: 0 0 0.6rem;
    font-size: 0.83rem;
  }
  .sample-feedback em {
    font-style: normal;
    color: #9e4936;
    font-weight: 600;
  }
  .sample-feedback .small {
    font-size: 0.67rem;
  }
  .sample-footnote {
    font-size: 0.59rem;
    color: var(--muted);
    margin: 0.8rem 0 0;
  }
  .scene-section {
    background: #efeee6;
    margin: 0 -2rem;
    padding: 3.5rem 2rem 2.5rem;
    scroll-margin-top: 1rem;
  }
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1.6rem;
  }
  .section-heading h2 {
    margin-bottom: 0;
  }
  .section-heading > p {
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.9;
    margin: 0 0 0.3rem;
  }
  .scene-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .scene-card {
    background: #fffefa;
    border: 1px solid #e0dfd4;
  }
  .scene-art {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 1.1rem 0 0.5rem;
    background: #f2e9dd;
  }
  .scene-art.sage {
    background: #e3e8da;
  }
  .scene-art.peach {
    background: #f0e0d4;
  }
  .scene-number {
    position: absolute;
    left: 1rem;
    top: 0.85rem;
    font-family: Georgia, serif;
    font-size: 0.85rem;
    color: #747665;
  }
  .scene-body {
    padding: 1.3rem;
  }
  .scene-category {
    font-size: 0.65rem;
    color: var(--accent);
    margin: 0 0 0.55rem;
  }
  .scene-card h3 {
    font-size: 1rem;
    line-height: 1.7;
    min-height: 3.4em;
    margin: 0 0 0.55rem;
    font-weight: 600;
  }
  .scene-description {
    font-size: 0.75rem;
    line-height: 1.85;
    min-height: 3.7em;
    margin: 0 0 1rem;
  }
  .scene-partner {
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0 0 1.1rem;
  }
  .scene-partner > span:last-child {
    color: var(--muted);
    font-size: 0.62rem;
  }
  .partner-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: #95a486;
  }
  .scene-button {
    width: 100%;
    background: transparent;
    border: 1px solid #b5b7a8;
    color: var(--ink);
    font-size: 0.76rem;
    padding: 0.7rem 0.8rem;
    justify-content: space-between;
    border-radius: 3px;
    min-height: 45px;
  }
  .scene-button:hover:not(:disabled) {
    background: var(--ink);
    color: white;
    border-color: var(--ink);
  }
  .quota-note {
    text-align: center;
    color: var(--muted);
    font-size: 0.68rem;
    line-height: 1.9;
    margin: 1.7rem 0 0;
  }
  .faq-section {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: 4rem;
    padding: 5rem 0;
  }
  .faq-section h2 {
    margin-bottom: 0.7rem;
  }
  .faq-section .muted {
    font-size: 0.8rem;
  }
  .faq-list {
    border-top: 1px solid var(--border);
  }
  details {
    border-bottom: 1px solid var(--border);
  }
  summary {
    padding: 1.3rem 0.2rem;
    font-size: 0.82rem;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary span {
    color: var(--accent);
    font-size: 1.1rem;
    transition: transform 0.2s;
  }
  details[open] summary span {
    transform: rotate(45deg);
  }
  details p {
    font-size: 0.78rem;
    color: var(--muted);
    line-height: 2;
    margin: 0 0 1.4rem;
    padding: 0 0.2rem;
  }
  @media (max-width: 900px) {
    .hero {
      gap: 0;
    }
    h1 {
      font-size: 2.6rem;
    }
    .hero-description {
      font-size: 0.8rem;
    }
    .example-section {
      gap: 2.5rem;
    }
    .intro-strip ol {
      gap: 1.1rem;
    }
    .scene-body {
      padding: 1rem;
    }
  }
  @media (max-width: 700px) {
    .hero {
      grid-template-columns: 1fr;
      padding: 2.5rem 0 1.8rem;
      gap: 1.5rem;
    }
    h1 {
      font-size: clamp(2rem, 7.5vw, 3rem);
      line-height: 1.65;
      margin: 1rem 0 1.2rem;
    }
    .hero-description {
      font-size: 0.83rem;
      line-height: 2;
    }
    .hero-visual {
      margin: 0;
      width: 100%;
    }
    .hero-visual img {
      max-height: 340px;
      object-fit: contain;
    }
    .hero-visual figcaption {
      margin-top: 0.5rem;
      font-size: 0.7rem;
      padding-right: 0.5rem;
    }
    .hero-cta {
      min-width: 0;
      width: 100%;
      max-width: 23rem;
    }
    .cta-caption {
      font-size: 0.68rem;
    }
    .example-link {
      font-size: 0.75rem;
    }
    .intro-strip {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.5rem 0;
    }
    .intro-strip > p br {
      display: none;
    }
    .intro-strip > p strong {
      margin-left: 0.4rem;
      font-size: 0.85rem;
    }
    .intro-strip ol {
      width: 100%;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.66rem;
    }
    .intro-strip li {
      gap: 0.35rem;
    }
    .intro-strip li span {
      font-size: 1.1rem;
    }
    .example-section {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding: 3.5rem 0;
    }
    .example-copy h2 br {
      display: none;
    }
    h2 {
      font-size: 1.65rem;
    }
    .example-copy > p:not(.section-label) {
      font-size: 0.81rem;
    }
    .example-note {
      margin-top: 1rem;
    }
    .example-chat {
      padding: 1.2rem;
    }
    .scene-section {
      margin: 0 -1.25rem;
      padding: 2.6rem 1.25rem 2rem;
    }
    .section-heading {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    .section-heading > p {
      font-size: 0.73rem;
    }
    .scene-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .scene-card {
      display: grid;
      grid-template-columns: 95px minmax(0, 1fr);
    }
    .scene-art {
      padding: 2rem 0 0;
      align-items: center;
      overflow: hidden;
    }
    .scene-art :global(svg) {
      min-width: 115px;
      width: 115px;
    }
    .scene-number {
      left: 0.7rem;
      top: 0.65rem;
    }
    .scene-body {
      padding: 1.1rem;
    }
    .scene-card h3 {
      min-height: 0;
      font-size: 0.95rem;
      margin-bottom: 0.4rem;
    }
    .scene-description {
      min-height: 0;
      font-size: 0.7rem;
      margin-bottom: 0.7rem;
    }
    .scene-category {
      font-size: 0.6rem;
      margin-bottom: 0.4rem;
    }
    .scene-partner {
      font-size: 0.65rem;
      margin-bottom: 0.8rem;
    }
    .scene-button {
      font-size: 0.7rem;
      min-height: 42px;
    }
    .quota-note {
      font-size: 0.65rem;
      text-align: left;
    }
    .faq-section {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding: 3.5rem 0;
    }
    .faq-section h2 {
      margin: 0.5rem 0;
    }
    summary {
      font-size: 0.77rem;
      padding: 1.2rem 0;
    }
    .account-strip {
      flex-direction: column;
      align-items: flex-start;
      padding: 1.4rem;
    }
    .account-actions {
      align-items: flex-start;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    summary span {
      transition: none;
    }
  }
</style>
