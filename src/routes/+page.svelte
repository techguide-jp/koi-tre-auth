<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { type CustomSceneInput, type PracticeOverview, type SceneId } from '$lib/practice'
  import { type Adventure, type AdventureProgress } from '$lib/adventure'
  import { saveCustomSceneDraft } from '$lib/custom-scene-client'
  import { availableCredits } from '$lib/billing'
  import { startPractice } from '$lib/practice-client'
  import { startGuestPractice } from '$lib/guest-practice-client'
  import { guestAdventure } from '$lib/guest-practice'
  import AdventureLobby from '$lib/components/adventure/AdventureLobby.svelte'
  import AdventureProgressPanel from '$lib/components/adventure/AdventureProgress.svelte'
  import BillingBalance from '$lib/components/billing/BillingBalance.svelte'
  import CustomSceneForm from '$lib/components/CustomSceneForm.svelte'
  import LegacyHome from '$lib/components/LegacyHome.svelte'
  import { guides } from '$lib/content/guides'
  export let data
  let mounted = false
  let loadedUid = ''
  let overview: PracticeOverview | null = null
  let progress: AdventureProgress | null = null
  let pendingScene: SceneId | null = null
  let loading = false
  let message = ''
  $: customRemaining = progress?.billing
    ? availableCredits(progress.billing.credits)
    : overview?.remaining
  onMount(() => {
    mounted = true
    const refresh = () => {
      if (
        data.practiceEnabled &&
        $user &&
        !loading &&
        !pendingScene &&
        document.visibilityState === 'visible'
      )
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
    progress = null
  }
  async function loadOverview() {
    loading = true
    message = ''
    const uid = $user?.uid
    try {
      const results = await Promise.all([
        authenticatedFetch('/api/me/practices'),
        authenticatedFetch('/api/me/adventure')
      ])
      const [nextOverview, nextProgress] = await Promise.all(
        results.map((response) => response.json())
      )
      if ($user?.uid === uid) {
        overview = nextOverview
        progress = nextProgress
      }
    } catch (error) {
      if ($user?.uid === uid)
        message = error instanceof Error ? error.message : '練習の足あとを読み込めませんでした。'
    } finally {
      if ($user?.uid === uid) loading = false
    }
  }
  async function begin(sceneId: SceneId, customScene?: CustomSceneInput, adventure?: Adventure) {
    if (pendingScene || !$authReady) return
    const guest = !$user && !!guestAdventure(adventure)
    if (!$user && !guest) {
      if (adventure) {
        await goto(
          `/login?character=${adventure.characterId}&episode=${adventure.episodeId}&turns=${adventure.turns}${adventure.revisit ? '&revisit=1' : ''}`
        )
        return
      }
      if (customScene && !saveCustomSceneDraft(customScene)) {
        message =
          '場面を引き継ぐための一時保存ができませんでした。ブラウザの保存を許可して、もう一度お試しください。'
        return
      }
      await goto(`/login?scene=${sceneId}`)
      return
    }
    pendingScene = sceneId
    message = ''
    try {
      const session = guest
        ? await startGuestPractice(adventure!)
        : await startPractice(sceneId, customScene, adventure)
      await goto(`/practice/${session.id}${guest ? '?guest=1' : ''}`)
    } catch (error) {
      message = error instanceof Error ? error.message : '練習を開始できませんでした。'
    } finally {
      pendingScene = null
    }
  }
</script>

{#if !data.practiceEnabled}<LegacyHome />{:else}
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="section-label">恋愛コミュニケーションの練習</p>
      <h1 id="hero-title">今日は、どんな<br /><span>会話が生まれる？</span></h1>
      <p class="hero-description">
        気になる相手と、少しずつ知り合っていく。<br />うまく言えない日も、言い直してみればいい。<br
        />あなたの言葉で始まる、小さな物語。
      </p>
      <a class="button primary" href="#scenes"
        >お相手を選んで始める <span aria-hidden="true">→</span></a
      >
      <p class="small muted hero-note">
        第1話はログイン不要 · 登録後は毎月10枠無料 · スマホでそのまま
      </p>
    </div>
    <figure>
      <img
        src="/images/cafe-conversation.jpg"
        alt="木漏れ日の入るカフェで、穏やかに会話する二人のイラスト"
        width="1448"
        height="1086"
        fetchpriority="high"
      />
      <figcaption>話すたびに、少しずつ。</figcaption>
    </figure>
  </section>
  <div class="intro-strip" aria-label="練習の流れ">
    <p>キャラクター6人。<br /><strong>4つのパートで、少しずつ知り合う。</strong></p>
    <ol>
      <li><span>01</span>お相手を選ぶ</li>
      <li><span>02</span>自分の言葉で話す</li>
      <li><span>03</span>次の物語へ進む</li>
    </ol>
  </div>
  {#if $user}<section class="account-strip" aria-label="今月の練習">
      <div>
        <p class="section-label">あなたの練習</p>
        {#if overview?.billing}<BillingBalance billing="{overview.billing}" />{:else if overview}<p>
            今月はあと <strong>{overview.remaining}枠</strong> / {overview.limit}枠{overview.reserved
              ? `（ほかに${overview.reserved}枠を処理中）`
              : ''}
          </p>
          <p class="small muted">
            次の更新：{new Date(overview.resetsAt).toLocaleDateString('ja-JP', {
              timeZone: 'Asia/Tokyo'
            })}
          </p>{:else if loading}<p role="status">練習の足あとを読み込んでいます…</p>{/if}
      </div>
      <div class="account-actions">
        {#if overview?.activePracticeId}<a
            class="button primary"
            href="{`/practice/${overview.activePracticeId}`}">途中の会話を続ける →</a
          >{/if}{#if overview?.latestPracticeId && overview.latestPracticeId !== overview.activePracticeId}<a
            href="{`/practice/${overview.latestPracticeId}`}">前回の振り返りを見る</a
          >{/if}
      </div>
    </section>
    {#if progress}<AdventureProgressPanel progress="{progress}" />{/if}{/if}
  <AdventureLobby
    guest="{!$user}"
    progress="{progress}"
    loading="{!$authReady || (!!$user && !progress)}"
    disabled="{!$authReady || !!pendingScene}"
    pending="{pendingScene === 'adventure'}"
    on:start="{(event) => begin('adventure', undefined, event.detail)}"
  />
  {#if message}<div class="message-area">
      <p class="error" role="alert">{message}</p>
      {#if $user}<button
          class="button secondary"
          disabled="{loading || !!pendingScene}"
          on:click="{loadOverview}">{loading ? '読み込み中…' : '足あとを再取得'}</button
        >{/if}
    </div>{/if}
  {#if overview?.remaining === 0}<p class="notice">
      現在使える練習枠を使い切りました。途中の会話や振り返り、アルバムは引き続き楽しめます。
    </p>{/if}
  <section class="custom-section" aria-label="自分で場面を設定する">
    <CustomSceneForm
      disabled="{!$authReady || !!pendingScene || customRemaining === 0}"
      pending="{pendingScene === 'custom'}"
      on:start="{(event) => begin('custom', event.detail)}"
    />
  </section>
  <section class="reasons" aria-labelledby="reasons-title">
    <p class="section-label">話す楽しさを、少しずつ</p>
    <h2 id="reasons-title">ひとつの会話が、次の一歩に。</h2>
    <div class="reason-grid">
      <article>
        <span aria-hidden="true">✦</span>
        <h3>小さなミッション</h3>
        <p>
          「自分の気持ちをひと言」など、今回試すことはひとつ。3往復は最大30XP、6往復は最大70XP。じっくり話すと、後半の展開や振り返りも広がります。
        </p>
      </article>
      <article>
        <span aria-hidden="true">↗</span>
        <h3>あなただけの振り返り</h3>
        <p>
          5観点・合計25点の評価とグラフ、実際の発言をもとにした言い換え。クリア済みの本音編などに戻って、話す前の予行練習もできます。
        </p>
      </article>
      <article>
        <span aria-hidden="true">◇</span>
        <h3>思い出を集めよう</h3>
        <p>
          会話を終えると、アルバムに一枚が増えます。合格点と好感度を満たして次の話へ。6往復では、合否にかかわらず、その場面だけの専用イラストを獲得できます。
        </p>
      </article>
    </div>
  </section>
  <section class="faq-section" aria-labelledby="faq-title">
    <h2 id="faq-title">気になること。</h2>
    <div>
      <details>
        <summary>どんな相手と話せますか？</summary>
        <p>
          初めに男性・女性からお相手を選び、その側の3人の成人キャラクターから選べます。お相手はAIです。あなた自身の性別や性的指向の登録は不要で、いつでも選び直せます。
        </p>
      </details>
      <details>
        <summary>無料でどこまで使えますか？</summary>
        <p>
          毎月10枠の無料枠があります。3往復は1枠、6往復は2枠を、最初の返答を正常に保存した時点で使います。途中の会話の再開や、同じ練習で一度だけの言い直しには追加消費がありません。
        </p>
      </details>
      <details>
        <summary>何を話せばいいかわからなくても大丈夫？</summary>
        <p>
          場面と相手の最初のひと言は用意しています。迷ったら「おまかせの場面」で選べます。短い返答でも大丈夫。AI相手も、自分の好みや感じ方を話しながら会話を広げます。
        </p>
      </details>
      <details>
        <summary>前の会話は残りますか？</summary>
        <p>
          同じGoogleアカウントでログインすると、途中の会話、振り返り、経験値、アルバムを確認できます。以前の3つの場面やカスタム練習の履歴も、そのまま再開・閲覧できます。
        </p>
      </details>
    </div>
  </section>
  <section class="guides-section" aria-labelledby="guides-title">
    <p class="section-label">会う日の前に</p>
    <h2 id="guides-title">会話のヒントを、ひとつ。</h2>
    <div>
      {#each guides.slice(0, 3) as guide}<a href="{`/guides/${guide.slug}`}"
          >{guide.title} <span aria-hidden="true">↗</span></a
        >{/each}
    </div>
    <a class="text-link" href="/topics">会話ネタ帳も見る →</a>
  </section>
{/if}

<style>
  .section-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--accent);
    margin: 0;
  }
  .hero {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 40px;
    align-items: center;
    padding: 64px 0;
  }
  .hero h1 {
    text-align: left;
    font-family: var(--font-editorial);
    font-size: clamp(2.2rem, 4.7vw, 3.8rem);
    line-height: 1.45;
    letter-spacing: 0.02em;
    margin: 20px 0;
  }
  .hero h1 span {
    color: var(--accent);
  }
  .hero-description {
    font-size: 0.96rem;
    line-height: 2.1;
    margin-bottom: 24px;
  }
  .hero-note {
    margin: 12px 0 0;
  }
  .hero figure {
    margin: 0;
  }
  .hero img {
    width: 100%;
    height: auto;
    border-radius: 24px;
  }
  .hero figcaption {
    font-size: 0.7rem;
    color: var(--muted);
    margin-top: 12px;
    text-align: right;
  }
  .intro-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-bottom: 32px;
  }
  .intro-strip p {
    margin: 0;
    font-size: 0.85rem;
  }
  .intro-strip ol {
    display: flex;
    gap: 24px;
    padding: 0;
    list-style: none;
  }
  .intro-strip li {
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .intro-strip li span {
    color: var(--accent);
    font-size: 0.7rem;
  }
  .account-strip {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: center;
    padding: 24px 0;
  }
  .account-strip p {
    margin: 8px 0;
  }
  .account-strip strong {
    font-size: 1.5rem;
  }
  .account-actions {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: center;
    font-size: 0.85rem;
  }
  .custom-section {
    padding-bottom: 48px;
  }
  .message-area {
    margin: -28px 0 36px;
  }
  .reasons {
    padding: 52px 0;
    border-top: 1px solid var(--border);
  }
  .reasons h2,
  .guides-section h2 {
    font-size: 1.65rem;
    margin: 14px 0 30px;
  }
  .reason-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 30px;
  }
  .reason-grid article > span {
    font-size: 1.5rem;
    color: var(--accent);
  }
  .reason-grid h3 {
    font-size: 1rem;
  }
  .reason-grid p {
    font-size: 0.85rem;
    color: var(--muted);
    line-height: 1.95;
  }
  .faq-section {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 48px;
    padding: 48px 0;
    border-top: 1px solid var(--border);
  }
  .faq-section h2 {
    font-size: 1.65rem;
  }
  .faq-section details {
    padding: 20px 0;
    border-bottom: 1px solid var(--border);
  }
  .faq-section summary {
    cursor: pointer;
    font-size: 0.95rem;
  }
  .faq-section p {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 16px 0 0;
    line-height: 1.95;
  }
  .guides-section {
    padding: 40px 0 64px;
  }
  .guides-section > div {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .guides-section > div > a {
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 0.9rem;
    line-height: 1.8;
  }
  .guides-section a span {
    color: var(--accent);
    margin-left: 12px;
  }
  @media (max-width: 700px) {
    .hero {
      grid-template-columns: 1fr;
      padding: 36px 0;
      gap: 28px;
    }
    .hero h1 {
      font-size: 2.35rem;
    }
    .hero figure {
      max-width: 480px;
    }
    .hero-description {
      font-size: 0.9rem;
    }
    .intro-strip {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }
    .intro-strip ol {
      gap: 16px;
    }
    .intro-strip li {
      font-size: 0.7rem;
      gap: 6px;
    }
    .account-strip {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }
    .reason-grid,
    .guides-section > div {
      grid-template-columns: 1fr;
      gap: 18px;
    }
    .reason-grid h3 {
      margin: 8px 0;
    }
    .reason-grid p {
      margin: 0;
    }
    .faq-section {
      grid-template-columns: 1fr;
      gap: 0;
      padding: 32px 0;
    }
    .reasons {
      padding: 36px 0;
    }
  }
</style>
